/* eslint-disable unused-imports/no-unused-imports */
import { TRPCError } from '@trpc/server'
import { generalInquiryFormSchema } from '@/features/landing/schemas/general-inquiry-form'
import { scheduleConsultationFormSchema } from '@/features/landing/schemas/schedule-consultation-form'
import { resendClient } from '@/services/email/resend'
import { GeneralInquiryEmail } from '@/services/email/templates/general-inquiry-email'
import { ProjectEmailTemplate } from '@/services/email/templates/project-inquiry-email'
import { putLead as putMondayLead } from '@/services/monday/api/put-lead'
import { putLead as putPipedriveLead } from '@/services/pipedrive/api/put-lead'
import { baseProcedure, createTRPCRouter } from '../init'

export const landingRouter = createTRPCRouter({
  scheduleConsultation: baseProcedure
    .input(scheduleConsultationFormSchema)
    .mutation(async ({ input }) => {
      const { data, error } = await resendClient.emails.send({
        to: 'Tri Pros <test@triprosremodeling.com>',
        from: 'info@triprosremodeling.com',
        subject: 'Consultation scheduled!',
        react: <ProjectEmailTemplate data={input} />,
      })

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          cause: error,
        })
      }

      return { data, input }
    }),
  generalInquiry: baseProcedure
    .input(generalInquiryFormSchema)
    .mutation(async ({ input }) => {
      const { data, error } = await resendClient.emails.send({
        to: 'Tri Pros <test@triprosremodeling.com>',
        from: 'info@triprosremodeling.com',
        subject: 'General Inquiry',
        react: <GeneralInquiryEmail data={input} />,
      })

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          cause: error,
        })
      }

      try {
        // await putMondayLead(input)
        await putPipedriveLead(input)
      }
      catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          cause: error,
        })
      }

      return { data, input }
    }),
})
