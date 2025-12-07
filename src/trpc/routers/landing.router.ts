import { TRPCError } from '@trpc/server'
import { scheduleConsultationFormSchema } from '@/features/landing/schemas/schedule-consultation-form'
import { resendClient } from '@/services/email/resend'
import { EmailTemplate } from '@/services/email/templates/example'
import { baseProcedure, createTRPCRouter } from '../init'

export const landingRouter = createTRPCRouter({
  scheduleConsultation: baseProcedure
    .input(scheduleConsultationFormSchema)
    .mutation(async ({ input }) => {
      const { data, error } = await resendClient.emails.send({
        to: 'Tri Pros <info@triprosremodeling.com>',
        from: 'info@triprosremodeling.com',
        subject: 'Consultation scheduled!',
        html: '<p>Cool stuff bro</p>',
      })

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          cause: error,
        })
      }

      return { data, input }
    }),
})
