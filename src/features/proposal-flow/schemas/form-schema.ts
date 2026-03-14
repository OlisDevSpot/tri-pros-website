import z from 'zod'
import { fundingSectionSchema, projectSectionSchema } from '@/shared/entities/proposals/schemas'

export const proposalFormSchema = z.object({
  meta: z.object({
    pricingMode: z.enum(['total', 'breakdown']),
  }),
  project: projectSectionSchema,
  funding: fundingSectionSchema,
})

export type ProposalFormSchema = z.infer<typeof proposalFormSchema>

export const baseDefaultValues: ProposalFormSchema = {
  meta: {
    pricingMode: 'total',
  },
  project: {
    data: {
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
          price: 0,
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
      showPricingBreakdown: false,
    },
  },
}
