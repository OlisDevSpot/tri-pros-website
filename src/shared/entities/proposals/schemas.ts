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
})

const exclusiveOfferIncentiveSchema = z.object({
  type: z.literal('exclusive-offer'),
  offer: z.string(),
  notes: z.string().optional(),
})

const incentiveSchema = z.discriminatedUnion('type', [discountIncentiveSchema, exclusiveOfferIncentiveSchema])

// MAIN SCHEMA BUILDING BLOCKS

const homeownerDataSchema = z.object({
  name: z.string(),
  phoneNum: z.string(),
  email: z.string(),
  age: z.number().int().nonnegative().optional(),
})

const projectDataSchema = z.object({
  address: z.string(),
  city: z.string(),
  state: z.literal('CA'),
  zip: z.string().min(5).max(5),
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

// MAIN SCHEMAS
export const formMetaSectionSchema = z.object({
  pricingMode: z.enum(['total', 'breakdown']),
})

export const homeownerSectionSchema = z.object({
  data: homeownerDataSchema,
  meta: sectionMetaSchema,
})

export const projectSectionSchema = z.object({
  data: projectDataSchema,
  meta: sectionMetaSchema,
})

export const fundingSectionSchema = z.object({
  data: fundingDataSchema,
  meta: sectionMetaSchema,
})
