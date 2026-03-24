import z from 'zod'
import { homeAreas, projectTypes, validThroughTimeframes } from '@/shared/constants/enums'

// SUB-SCHEMAS
const homeAreaSchema = z.enum(homeAreas)
export const constructionItemSchema = z.object({
  id: z.string(),
  label: z.string(),
})
export const sowSchema = z.object({
  contentJSON: z.string(),
  html: z.string(),
  price: z.number().optional(),
  scopes: z.array(constructionItemSchema),
  title: z.string(),
  trade: constructionItemSchema,
})

const discountIncentiveSchema = z.object({
  type: z.literal('discount'),
  amount: z.number(),
  notes: z.string().optional(),
  expiresAt: z.iso.datetime().optional(),
})

const exclusiveOfferIncentiveSchema = z.object({
  type: z.literal('exclusive-offer'),
  offer: z.string(),
  notes: z.string().optional(),
  expiresAt: z.iso.datetime().optional(),
})

const incentiveSchema = z.discriminatedUnion('type', [discountIncentiveSchema, exclusiveOfferIncentiveSchema])

// MAIN SCHEMA BUILDING BLOCKS

const projectDataSchema = z.object({
  label: z.string(),
  summary: z.string().optional(),
  type: z.enum(projectTypes),
  timeAllocated: z.string(),
  validThroughTimeframe: z.enum(validThroughTimeframes),
  energyBenefits: z.string().optional(),
  projectObjectives: z.array(z.string()),
  homeAreasUpgrades: z.array(homeAreaSchema),
  agreementNotes: z.string().optional(),
  sow: z.array(sowSchema).min(1, { message: 'At least one scope is required' }),
})

const fundingDataSchema = z.object({
  cashInDeal: z.number(),
  depositAmount: z.number(),
  finalTcp: z.number(),
  incentives: z.array(incentiveSchema),
  miscPrice: z.number().optional(),
  startingTcp: z.number(),
})

const sectionMetaSchema = z.object({
  enabled: z.boolean(),
})

const fundingMetaSchema = sectionMetaSchema.extend({
  showPricingBreakdown: z.boolean(),
})

// MAIN SCHEMAS
export const formMetaSectionSchema = z.object({
  pricingMode: z.enum(['total', 'breakdown']),
})

export const projectSectionSchema = z.object({
  data: projectDataSchema,
  meta: sectionMetaSchema,
})

export const fundingSectionSchema = z.object({
  data: fundingDataSchema,
  meta: fundingMetaSchema,
})

// --- Proposal Form Schema (composite) ---

export const proposalFormSchema = z.object({
  meta: z.object({
    pricingMode: z.enum(['total', 'breakdown']),
  }),
  project: projectSectionSchema,
  funding: fundingSectionSchema,
})

export type ProposalFormSchema = z.infer<typeof proposalFormSchema>

export const proposalFormBaseDefaultValues: ProposalFormSchema = {
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
