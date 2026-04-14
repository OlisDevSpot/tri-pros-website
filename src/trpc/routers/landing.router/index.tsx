import { TRPCError } from '@trpc/server'
import { generalInquiryFormSchema } from '@/features/landing/schemas/general-inquiry-form'
import { scheduleConsultationFormSchema } from '@/features/landing/schemas/schedule-consultation-form'
import { emailService } from '@/shared/services/email.service'
import { putLead as putPipedriveLead } from '@/shared/services/pipedrive/api/put-lead'
import { baseProcedure, createTRPCRouter } from '../../init'
import { projectsRouter } from './projects.router'

export const landingRouter = createTRPCRouter({
  projectsRouter,
  scheduleConsultation: baseProcedure
    .input(scheduleConsultationFormSchema)
    .mutation(async ({ input }) => {
      const { data } = await emailService.sendScheduleConsultationEmail(input)
      return { data, input }
    }),
  generalInquiry: baseProcedure
    .input(generalInquiryFormSchema)
    .mutation(async ({ input }) => {
      const { data } = await emailService.sendGeneralInquiryEmail(input)

      try {
        await putPipedriveLead(input)
      }
      catch (error) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: error })
      }

      return { data, input }
    }),
})
