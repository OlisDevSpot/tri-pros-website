import z from 'zod'
import { homeAreas, projectTypes } from '@/shared/constants/enums'

// SUB-SCHEMAS
const homeAreaSchema = z.enum(homeAreas)
const sowSchema = z.object({
  title: z.string(),
  trade: z.string(),
  scopes: z.array(z.string()),
  html: z.string(),
})

const DiscountIncentiveSchema = z.object({
  type: z.literal('discount'),
  amount: z.number(),
  notes: z.string().optional(),
})

const ExclusiveOfferIncentiveSchema = z.object({
  type: z.literal('exclusive-offer'),
  offer: z.string(),
  units: z.int().positive(),
  notes: z.string().optional(),
})

const incentiveSchema = z.discriminatedUnion('type', [DiscountIncentiveSchema, ExclusiveOfferIncentiveSchema])

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
  energyBenefits: z.string().optional(),
  projectObjectives: z.array(z.string()),
  homeAreasUpgrades: z.array(homeAreaSchema),
  agreementNotes: z.string().optional(),
  sow: z.array(sowSchema).min(1, { message: 'At least one scope is required' }),
})

const fundingDataSchema = z.object({
  cashInDeal: z.number(),
  depositAmount: z.number(),
  startingTcp: z.number(),
  finalTcp: z.number(),
  incentives: z.array(incentiveSchema),
})

const sectionMetaSchema = z.object({
  enabled: z.boolean(),
})

// MAIN SCHEMAS
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
