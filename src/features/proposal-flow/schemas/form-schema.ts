import z from 'zod'
import { insertProposalSchema } from '@/shared/db/schema'
import { tradesData } from '@/shared/db/seeds/data/trades'

export const proposalFormSchema = z.object({
  homeowner: insertProposalSchema.pick({
    firstName: true,
    lastName: true,
    email: true,
    phoneNum: true,
    customerAge: true,
    hubspotContactVid: true,
  }),
  project: z.object({
    ...insertProposalSchema.pick({
      address: true,
      city: true,
      state: true,
      zipCode: true,
      projectType: true,
      label: true,
      timeAllocated: true,
      agreementNotes: true,
    }).shape,
    scopes: z.array(
      z.object({
        trade: z.enum(tradesData.map(trade => trade.accessor)).optional(),
        scope: z.array(z.string()),
        sow: z.string().optional(),
      }),
    ).min(0, { message: 'At least one scope is required' }),
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
        allowDiscounts: z.boolean().default(false).optional(),
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
    phoneNum: '',
    customerAge: 0,
  },
  project: {
    address: '',
    city: '',
    state: '',
    zipCode: '',
    projectType: 'general-remodeling',
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
