import z from 'zod'
import { fundingSectionSchema, homeownerSectionSchema, projectSectionSchema } from '@/shared/entities/proposals/schemas'

export const proposalFormSchema = z.object({
  meta: z.object({
    pricingMode: z.enum(['total', 'breakdown']),
  }),
  homeowner: homeownerSectionSchema,
  project: projectSectionSchema,
  funding: fundingSectionSchema,
})

export type ProposalFormSchema = z.infer<typeof proposalFormSchema>

export const baseDefaultValues: ProposalFormSchema = {
  meta: {
    pricingMode: 'total',
  },
  homeowner: {
    data: {
      name: '',
      email: '',
      phoneNum: '',
      age: 0,
    },
    meta: {
      enabled: true,
    },
  },
  project: {
    data: {
      address: '',
      city: '',
      state: 'CA',
      zip: '',
      type: 'general-remodeling',
      label: '',
      sow: [
        {
          contentJSON: '',
          html: '',
          scopes: [],
          title: '',
          trade: {
            id: '',
            label: '',
          },
        },
      ],
      summary: '',
      homeAreasUpgrades: [],
      projectObjectives: [],
      timeAllocated: '',
      validThroughTimeframe: '60 days',
      agreementNotes: '',
    },
    meta: {
      enabled: true,
    },
  },
  funding: {
    data: {
      cashInDeal: 0,
      depositAmount: 1000,
      finalTcp: 0,
      incentives: [],
      miscPrice: 0,
      startingTcp: 0,
    },
    meta: {
      enabled: true,
    },
  },
}
