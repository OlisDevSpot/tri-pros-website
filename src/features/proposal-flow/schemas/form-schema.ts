import type { ScopeAccessor } from '@/shared/db/types'
import z from 'zod'
import { insertProposalSchema } from '@/shared/db/schema'
import { scopesData } from '@/shared/db/seeds/data/scopes'
import { tradesData } from '@/shared/db/seeds/data/trades'

export const proposalFormSchema = z.object({
  homeowner: insertProposalSchema.pick({
    name: true,
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
    sow: z.array(
      z.object({
        title: z.string(),
        trade: z.enum(tradesData.map(trade => trade.accessor)),
        scopes: z.array(
          z.enum(Object.values(scopesData).flatMap(scopesOfTrade => scopesOfTrade.map(scope => scope.accessor)) as ScopeAccessor[]),
        ),
        html: z.string(),
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
    name: '',
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
    sow: [],
    timeAllocated: '',
    agreementNotes: '',
  },
  funding: {
    tcp: 0,
    depositAmount: 1000,
    cashInDeal: 0,
  },
}
