import { TRPCError } from '@trpc/server'
import { generalInquiryFormSchema } from '@/features/landing/schemas/general-inquiry-form'
import { scheduleConsultationFormSchema } from '@/features/landing/schemas/schedule-consultation-form'
import { resendClient } from '@/services/email/resend'
import { GeneralInquiryEmail } from '@/services/email/templates/general-inquiry-email'
import { ProjectEmailTemplate } from '@/services/email/templates/project-inquiry-email'
import { mondayClient } from '@/services/monday/client'
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
        const op = await mondayClient.operations.createItemOp({
          boardId: '18391997685',
          groupId: 'new_group94377',
          itemName: input.name,
        })

        if (!op.create_item) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            cause: 'Failed to create item',
          })
        }

        await mondayClient.operations.changeMultipleColumnValuesOp({
          boardId: '18391997685',
          itemId: op.create_item.id,
          columnValues: JSON.stringify({

            // Inquiry description
            text_mkyk8jj3: input.inquiryDescription,

            // email
            email: {
              email: input.email,
              text: input.email,
            },

            // source
            color_mkykqefx: {
              label: 'Website',
            },

            // phone
            phone: {
              phone: input.phone,
              countryShortName: 'US',
            },

            // address
            location: {
              address: input.address?.fullAddress,
              lat: input.address?.location.lat,
              lng: input.address?.location.lng,
            },
          }),
        })
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
