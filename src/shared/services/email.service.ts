import type { GeneralInquiryFormSchema, ScheduleConsultationFormSchema } from '@/shared/entities/landing/schemas'
import { publicUrl } from '@/shared/config/public-url'
import { ROOTS } from '@/shared/config/roots'
import { resendClient } from '@/shared/services/providers/resend/client'
import { RESEND_FROM, RESEND_LEAD_INBOX } from '@/shared/services/providers/resend/constants'
import { buildSenderFrom } from '@/shared/services/providers/resend/lib/build-sender-from'
import { formatProjectType } from '@/shared/services/providers/resend/lib/format-project-type'
import {
  renderCustomerConfirmationEmail,
  renderGeneralInquiryEmail,
  renderProposalEmail,
  renderScheduleConsultationEmail,
} from '@/shared/services/providers/resend/lib/render-emails'

// Best-effort recap projections: include only fields the customer actually
// filled in so the confirmation email doesn't show empty rows.

function buildGeneralInquiryRecap(data: GeneralInquiryFormSchema) {
  const items: { label: string, value: string }[] = []
  if (data.address?.fullAddress) {
    items.push({ label: 'Address', value: data.address.fullAddress })
  }
  if (data.inquiryDescription) {
    items.push({ label: 'Your inquiry', value: data.inquiryDescription })
  }
  return items
}

function buildScheduleConsultationRecap(data: ScheduleConsultationFormSchema) {
  const items: { label: string, value: string }[] = []
  items.push({ label: 'Project type', value: formatProjectType(data.projectType) })
  if (data.timeline) {
    items.push({ label: 'Preferred timeline', value: data.timeline })
  }
  if (data.propertyType) {
    items.push({ label: 'Property type', value: data.propertyType })
  }
  if (data.location) {
    items.push({ label: 'Location', value: data.location })
  }
  if (data.projectDescription) {
    items.push({ label: 'Description', value: data.projectDescription })
  }
  return items
}

function firstNameOf(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] || fullName
}

function createEmailService() {
  return {
    sendProposalEmail: async (params: {
      proposalId: string
      token: string
      customerName: string
      email: string
      message?: string
      replyTo?: string
      repName?: string
    }) => {
      const proposalUrl = publicUrl(`${ROOTS.public.proposalReview(params.proposalId, params.token)}&utm_source=email`)
      const firstName = params.customerName.split(' ')[0] ?? params.customerName

      const { data, error } = await resendClient.emails.send({
        from: buildSenderFrom(params.repName),
        to: params.email,
        replyTo: params.replyTo,
        subject: `🏠 ${firstName}, your Tri Pros proposal is ready`,
        react: renderProposalEmail({
          proposalUrl,
          customerName: params.customerName,
          message: params.message,
        }),
      })

      if (error) {
        throw new Error(`Failed to send proposal email: ${JSON.stringify(error)}`)
      }

      return { data }
    },

    sendScheduleConsultationEmail: async (formData: ScheduleConsultationFormSchema) => {
      const { data, error } = await resendClient.emails.send({
        to: RESEND_LEAD_INBOX,
        from: RESEND_FROM.default,
        replyTo: formData.email,
        subject: 'Consultation scheduled!',
        react: renderScheduleConsultationEmail(formData),
      })

      if (error) {
        throw new Error(`Failed to send consultation email: ${JSON.stringify(error)}`)
      }

      return { data }
    },

    sendGeneralInquiryEmail: async (formData: GeneralInquiryFormSchema) => {
      const { data, error } = await resendClient.emails.send({
        to: RESEND_LEAD_INBOX,
        from: RESEND_FROM.default,
        replyTo: formData.email,
        subject: `New inquiry: ${formData.name}`,
        react: renderGeneralInquiryEmail(formData),
      })

      if (error) {
        throw new Error(`Failed to send general inquiry email: ${JSON.stringify(error)}`)
      }

      return { data }
    },

    /**
     * Customer-facing receipt: confirms we received the inquiry, sets the
     * 24-hour callback expectation, and aligns the SMS line to the lead's
     * actual consent posture (only mentions SMS if they opted in).
     */
    sendInquiryConfirmationEmail: async (params: {
      type: 'general' | 'schedule'
      formData: GeneralInquiryFormSchema | ScheduleConsultationFormSchema
    }) => {
      const { type, formData } = params
      const recapItems = type === 'general'
        ? buildGeneralInquiryRecap(formData as GeneralInquiryFormSchema)
        : buildScheduleConsultationRecap(formData as ScheduleConsultationFormSchema)
      const firstName = firstNameOf(formData.name)

      const { data, error } = await resendClient.emails.send({
        to: formData.email,
        from: RESEND_FROM.default,
        replyTo: RESEND_LEAD_INBOX,
        subject: `Thanks, ${firstName} — we'll be in touch within 24 hours`,
        react: renderCustomerConfirmationEmail({
          firstName,
          smsConsent: formData.smsConsent,
          callConsent: formData.callConsent,
          recapItems,
        }),
      })

      if (error) {
        throw new Error(`Failed to send confirmation email: ${JSON.stringify(error)}`)
      }

      return { data }
    },
  }
}

export type EmailService = ReturnType<typeof createEmailService>
export const emailService = createEmailService()
