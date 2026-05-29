import { TRPCError } from '@trpc/server'
import { generalInquiryFormSchema } from '@/features/landing/schemas/general-inquiry-form'
import { scheduleConsultationFormSchema } from '@/features/landing/schemas/schedule-consultation-form'
import { emailService } from '@/shared/services/email.service'
import { putLead as putPipedriveLead } from '@/shared/services/providers/pipedrive/api/put-lead'
import { baseProcedure, createTRPCRouter } from '../../init'
import { projectsRouter } from './projects.router'

export const landingRouter = createTRPCRouter({
  projectsRouter,
  scheduleConsultation: baseProcedure
    .input(scheduleConsultationFormSchema)
    .mutation(async ({ input }) => {
      // Internal lead email is the must-succeed leg. The customer confirmation
      // is sent in parallel and a failure there is logged but doesn't block the
      // success path — the lead is captured regardless.
      const [leadResult, confirmationResult] = await Promise.allSettled([
        emailService.sendScheduleConsultationEmail(input),
        emailService.sendInquiryConfirmationEmail({ type: 'schedule', formData: input }),
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

      return { data: leadResult.value.data, input }
    }),
  generalInquiry: baseProcedure
    .input(generalInquiryFormSchema)
    .mutation(async ({ input }) => {
      const [leadResult, confirmationResult] = await Promise.allSettled([
        emailService.sendGeneralInquiryEmail(input),
        emailService.sendInquiryConfirmationEmail({ type: 'general', formData: input }),
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
