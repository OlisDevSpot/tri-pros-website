import type { GeneralInquiryFormSchema } from '@/features/landing/schemas/general-inquiry-form'
import { TRPCError } from '@trpc/server'
import { mondayClient } from '../client'

export async function putLead(input: GeneralInquiryFormSchema) {
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
