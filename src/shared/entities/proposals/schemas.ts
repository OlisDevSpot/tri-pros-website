import z from 'zod'
import { homeAreas, projectTypes } from '@/shared/constants/enums'

const homeAreaSchema = z.enum(homeAreas)
const sowSchema = z.object({
  title: z.string(),
  trade: z.string(),
  scopes: z.array(z.string()),
  html: z.string(),
})

const sectionMetaSchema = z.object({
  enabled: z.boolean(),
})

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
  tcp: z.number(),
  incentives: z.array(z.object({ reason: z.string(), amount: z.number() })),
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
