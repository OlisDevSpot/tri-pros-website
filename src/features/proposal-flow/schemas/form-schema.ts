import z from 'zod'
import { projectTypes } from '@/shared/constants/enums'
import { insertProposalSchema } from '@/shared/db/schema'
import { tradesData } from '@/shared/db/seeds/data/trades'

export const proposalFormSchema = z.object({
  homeowner: z.object({
    firstName: z.string().min(1, { message: 'First name is required' }),
    lastName: z.string().min(1, { message: 'Last name is required' }),
    email: z.string().min(1, { message: 'Email is required' }),
    phone: z.string().min(1, { message: 'Phone is required' }),
    address: z.string().min(1, { message: 'Address is required' }),
    city: z.string().min(1, { message: 'City is required' }),
    state: z.string().min(1, { message: 'State is required' }),
    zipCode: z.string().min(1, { message: 'Zip code is required' }),
    age: z.number().min(18, { message: 'You must be 18 or older' }),
    hubspotVid: z.string().optional(),
  }),
  project: z.object({
    label: z.string().min(1, { message: 'Label is required' }),
    type: z.enum(projectTypes).default('general-remodeling').nonoptional(),
    scopes: z.array(
      z.object({
        trade: z.enum(tradesData.map(trade => trade.accessor)).optional(),
        scope: z.array(z.string()),
        sow: z.string().optional(),
      }),
    ).min(0, { message: 'At least one scope is required' }),
    timeAllocated: z.string().min(1, { message: 'Time allocated is required' }),
    agreementNotes: z.string().optional(),
  }),
  funding: z.object({
    ...insertProposalSchema.pick({
      tcp: true,
      depositAmount: true,
      cashInDeal: true,
    }).shape,
    extraFields: z.object({
      ...insertProposalSchema.pick({
        discounts: true,
      }).shape,
      options: z.object({
        allowDiscounts: z.boolean().default(false),
      }),
    }).optional(),
  }),
})

export type ProposalFormValues = z.infer<typeof proposalFormSchema>

export const baseDefaultValues: ProposalFormValues = {
  homeowner: {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    age: 0,
  },
  project: {
    type: 'general-remodeling',
    label: '',
    scopes: [],
    timeAllocated: '',
    agreementNotes: '',
  },
  funding: {
    tcp: 0,
    depositAmount: 1000,
    cashInDeal: 0,
  },
}
