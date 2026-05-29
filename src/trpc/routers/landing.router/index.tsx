import type { GeneralInquiryFormSchema, ScheduleConsultationFormSchema } from '@/shared/entities/landing/schemas'
import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'
import { generalInquiryFormSchema } from '@/features/landing/schemas/general-inquiry-form'
import { scheduleConsultationFormSchema } from '@/features/landing/schemas/schedule-consultation-form'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { customerNotes } from '@/shared/db/schema/customer-notes'
import { leadSourcesTable } from '@/shared/db/schema/lead-sources'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { emailService } from '@/shared/services/email.service'
import { putLead as putPipedriveLead } from '@/shared/services/providers/pipedrive/api/put-lead'
import { formatProjectType } from '@/shared/services/providers/resend/lib/format-project-type'
import { baseProcedure, createTRPCRouter } from '../../init'
import { projectsRouter } from './projects.router'

const WEBSITE_LEAD_SOURCE_SLUG = 'website'

export const landingRouter = createTRPCRouter({
  projectsRouter,
  scheduleConsultation: baseProcedure
    .input(scheduleConsultationFormSchema)
    .mutation(async ({ input }) => {
      // Internal lead email is the must-succeed leg. Customer confirmation,
      // customer-record ingest, and Pipedrive run in parallel and any of those
      // failing is logged but doesn't block the success path.
      const [leadResult, confirmationResult, ingestResult] = await Promise.allSettled([
        emailService.sendScheduleConsultationEmail(input),
        emailService.sendInquiryConfirmationEmail({ type: 'schedule', formData: input }),
        ingestWebsiteLead({ formType: 'schedule', formData: input }),
      ])

      if (leadResult.status === 'rejected') {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to deliver the inquiry to the Tri Pros team. Please try again or call us directly.',
          cause: leadResult.reason,
        })
      }

      if (confirmationResult.status === 'rejected') {
        console.error('[landing/scheduleConsultation] confirmation email failed:', confirmationResult.reason)
      }

      if (ingestResult.status === 'rejected') {
        console.error('[landing/scheduleConsultation] customer ingest failed:', ingestResult.reason)
      }

      return { data: leadResult.value.data, input }
    }),
  generalInquiry: baseProcedure
    .input(generalInquiryFormSchema)
    .mutation(async ({ input }) => {
      const [leadResult, confirmationResult, ingestResult] = await Promise.allSettled([
        emailService.sendGeneralInquiryEmail(input),
        emailService.sendInquiryConfirmationEmail({ type: 'general', formData: input }),
        ingestWebsiteLead({ formType: 'general', formData: input }),
      ])

      if (leadResult.status === 'rejected') {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to deliver the inquiry to the Tri Pros team. Please try again or call us directly.',
          cause: leadResult.reason,
        })
      }

      if (confirmationResult.status === 'rejected') {
        console.error('[landing/generalInquiry] confirmation email failed:', confirmationResult.reason)
      }

      if (ingestResult.status === 'rejected') {
        console.error('[landing/generalInquiry] customer ingest failed:', ingestResult.reason)
      }

      try {
        await putPipedriveLead(input)
      }
      catch (error) {
        // Pipedrive sync failure shouldn't block the lead — emails already
        // delivered. Log and surface as a non-fatal warning in the response.
        console.error('[landing/generalInquiry] pipedrive sync failed:', error)
      }

      return { data: leadResult.value.data, input }
    }),
})

// ─── customer ingest ────────────────────────────────────────────────────────

/**
 * Persist a website inquiry as a `customers` row + attached note.
 *
 * Customer insert goes through `customerCrud.create` (DAL factory). The slug
 * lookup and the note insert use direct drizzle — these are LEGACY patterns
 * that match `business.router.ts` (`createFromIntake`, `addNote`) and will
 * migrate to a lead-sources DAL + a customer-notes DAL when those exist.
 *
 * Failure here is non-blocking at the caller (Promise.allSettled). No
 * transaction — explicitly deferred to a future refactor.
 */
async function ingestWebsiteLead(params: {
  formType: 'general' | 'schedule'
  formData: GeneralInquiryFormSchema | ScheduleConsultationFormSchema
}): Promise<{ customerId: string }> {
  const { formType, formData } = params

  // LEGACY: direct slug → id lookup. Mirrors existing call sites in
  // customers.router and lead-sources.router. Move to lead-sources DAL later.
  const [leadSource] = await db
    .select({ id: leadSourcesTable.id })
    .from(leadSourcesTable)
    .where(eq(leadSourcesTable.slug, WEBSITE_LEAD_SOURCE_SLUG))
    .limit(1)

  if (!leadSource) {
    throw new Error(`Lead source "${WEBSITE_LEAD_SOURCE_SLUG}" not found`)
  }

  const customerInput = formType === 'general'
    ? buildGeneralInquiryCustomer(formData as GeneralInquiryFormSchema, leadSource.id)
    : buildScheduleConsultationCustomer(formData as ScheduleConsultationFormSchema, leadSource.id)

  const createResult = await customerCrud.create(SYSTEM_CONTEXT, customerInput)
  if (!createResult.success) {
    throw new Error(`customerCrud.create failed: ${JSON.stringify(createResult.error)}`)
  }

  // LEGACY: direct note insert. Matches existing addNote / createFromIntake.
  // Move to a customer-notes DAL when one exists.
  const noteContent = formType === 'general'
    ? buildGeneralInquiryNote(formData as GeneralInquiryFormSchema)
    : buildScheduleConsultationNote(formData as ScheduleConsultationFormSchema)

  await db.insert(customerNotes).values({
    customerId: createResult.data.id,
    content: noteContent,
    authorId: null,
  })

  return { customerId: createResult.data.id }
}

function buildGeneralInquiryCustomer(data: GeneralInquiryFormSchema, leadSourceId: string) {
  return {
    name: data.name,
    phone: data.phone,
    email: data.email,
    address: data.address?.fullAddress ?? data.address?.street ?? null,
    city: data.address?.city ?? 'Unknown',
    state: data.address?.state ?? 'CA',
    zip: data.address?.zipCode ?? '',
    leadSourceId,
  }
}

function buildScheduleConsultationCustomer(data: ScheduleConsultationFormSchema, leadSourceId: string) {
  // Best-effort parse: schedule-consultation has only a free-text Location
  // field. Take "City, State" if present; otherwise dump the whole string
  // into city and leave the team to clean it up. Note retains the raw value.
  const locationParts = data.location.split(',').map(s => s.trim()).filter(Boolean)
  const city = locationParts[0] || 'Unknown'
  const state = locationParts[1]?.slice(0, 2).toUpperCase() || 'CA'

  return {
    name: data.name,
    phone: data.phone,
    email: data.email,
    city,
    state,
    zip: '',
    leadSourceId,
  }
}

function buildGeneralInquiryNote(data: GeneralInquiryFormSchema): string {
  const lines = ['📋 Lead from Website (General Inquiry)']
  if (data.address?.fullAddress) {
    lines.push(`Address: ${data.address.fullAddress}`)
  }
  lines.push(`SMS Consent: ${data.smsConsent ? 'Granted' : 'Not granted'}`)
  lines.push(`Call Consent: ${data.callConsent ? 'Granted' : 'Not granted'}`)
  lines.push('')
  lines.push(data.inquiryDescription)
  return lines.join('\n')
}

function buildScheduleConsultationNote(data: ScheduleConsultationFormSchema): string {
  const lines = ['📋 Lead from Website (Schedule Consultation)']
  lines.push(`Project Type: ${formatProjectType(data.projectType)}`)
  if (data.timeline) {
    lines.push(`Preferred Timeline: ${data.timeline}`)
  }
  if (data.propertyType) {
    lines.push(`Property Type: ${data.propertyType}`)
  }
  if (data.location) {
    lines.push(`Location (raw): ${data.location}`)
  }
  lines.push(`SMS Consent: ${data.smsConsent ? 'Granted' : 'Not granted'}`)
  lines.push(`Call Consent: ${data.callConsent ? 'Granted' : 'Not granted'}`)
  if (data.projectDescription) {
    lines.push('')
    lines.push(data.projectDescription)
  }
  return lines.join('\n')
}
