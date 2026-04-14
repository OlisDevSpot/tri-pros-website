import type { GeneralInquiryFormSchema, ScheduleConsultationFormSchema } from '@/shared/entities/landing/schemas'
import { ROOTS } from '@/shared/config/roots'
import { resendClient } from '@/shared/services/resend/client'
import { renderGeneralInquiryEmail, renderProposalEmail, renderScheduleConsultationEmail } from '@/shared/services/resend/lib/render-emails'

function createEmailService() {
  return {
    sendProposalEmail: async (params: {
      proposalId: string
      token: string
      customerName: string
      email: string
      message?: string
    }) => {
      const proposalUrl = `${ROOTS.public.proposals({ absolute: true, isProduction: true })}/proposal/${params.proposalId}?token=${params.token}&utm_source=email`

      const { data, error } = await resendClient.emails.send({
        from: 'Tri Pros <info@triprosremodeling.com>',
        to: params.email,
        bcc: 'info@triprosremodeling.com',
        subject: 'Your Proposal From Tri Pros Remodeling',
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
        to: 'Tri Pros <test@triprosremodeling.com>',
        from: 'info@triprosremodeling.com',
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
        to: 'Tri Pros <test@triprosremodeling.com>',
        from: 'info@triprosremodeling.com',
        subject: 'General Inquiry',
        react: renderGeneralInquiryEmail(formData),
      })

      if (error) {
        throw new Error(`Failed to send general inquiry email: ${JSON.stringify(error)}`)
      }

      return { data }
    },
  }
}

export type EmailService = ReturnType<typeof createEmailService>
export const emailService = createEmailService()
