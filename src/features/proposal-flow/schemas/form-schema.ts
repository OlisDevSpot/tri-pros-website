import z from 'zod'
import { fundingSectionSchema, homeownerSectionSchema, projectSectionSchema } from '@/shared/entities/proposals/schemas'

export const proposalFormSchema = z.object({
  homeowner: homeownerSectionSchema,
  project: projectSectionSchema,
  funding: fundingSectionSchema,
})

export type ProposalFormSchema = z.infer<typeof proposalFormSchema>

export const baseDefaultValues: ProposalFormSchema = {
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
          title: '',
          scopes: [],
          trade: '',
          html: '',
        },
      ],
      summary: '',
      homeAreasUpgrades: [],
      projectObjectives: [],
      timeAllocated: '',
      agreementNotes: '',
    },
    meta: {
      enabled: true,
    },
  },
  funding: {
    data: {
      startingTcp: 0,
      finalTcp: 0,
      depositAmount: 1000,
      cashInDeal: 0,
      incentives: [],
    },
    meta: {
      enabled: true,
    },
  },
}
