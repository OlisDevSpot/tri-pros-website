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

  try {
    const { data: newPerson, success: personSuccess } = await personApi.addPerson({
      AddPersonRequest: {
        name: input.name,
        emails: [{
          value: input.email,
          primary: true,
        }],
        phones: [{
          value: input.phone,
          primary: true,
        }],
      },
    })

    return { newPerson, personSuccess }
  }

  catch (error) {
    console.log('pipedrive error', error)

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      cause: error,
    })
  }
}
