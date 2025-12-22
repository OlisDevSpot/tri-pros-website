import type { GeneralInquiryFormSchema } from '@/features/landing/schemas/general-inquiry-form'
import { TRPCError } from '@trpc/server'
import {
  // LeadsApi,
  PersonsApi,
} from 'pipedrive/v2'
import { pipedriveConfig } from '../client'

export async function putLead(input: GeneralInquiryFormSchema) {
  const personApi = new PersonsApi(pipedriveConfig)
  // const leadsApi = new LeadsApi(pipedriveConfig)

  const { data: newPerson, success: personSuccess } = await personApi.addPerson({
    AddPersonRequest: {
      name: input.name,
      emails: [{
        label: true,
        value: input.email,
        primary: true,
      }],
      phones: [{
        label: true,
        value: input.phone,
        primary: true,
      }],
    },
  })

  if (!personSuccess) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      cause: 'Failed to create person',
    })
  }

  return { newPerson }
}
