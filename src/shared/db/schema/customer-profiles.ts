import type { Pain } from '@/shared/entities/customers/schemas'
import { boolean, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import z from 'zod'
import {
  creditScoreRanges,
  customerAgeGroups,
  decisionTimelines,
  householdTypes,
  outcomePriorities,
  priorContractorExperiences,
  sellPlans,
  triggerEvents,
  yearBuiltRanges,
  yearsInHomeRanges,
} from '@/shared/constants/enums/customers'
import {
  foundationTypes,
  hvacComponents,
  hvacTypes,
  insulationLevels,
  roofTypes,
  windowsTypes,
} from '@/shared/domains/construction/constants/enums'
import { painSchema } from '@/shared/entities/customers/schemas'
import { createdAt, updatedAt } from '../lib/schema-helpers'
import { customers } from './customers'

// 1:1 sales-discovery profile. Row-exists = discovery data has been collected
// (lazy upsert; ~12% of customers). `age` deliberately lives on customers —
// written by anonymous homeowners (contracts flow), read by envelope rules.
// see docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md §10
//
// Closed vocabularies are `text(..., { enum })`, NOT pgEnum — the const array
// is the single source of truth; validation happens at the DAL boundary (Zod).
// see docs/codebase-conventions/enum-standardization.md#text-with-enum
export const customerProfiles = pgTable('customer_profiles', {
  customerId: uuid('customer_id').primaryKey().references(() => customers.id, { onDelete: 'cascade' }),
  // ── customer-profile section ──
  triggerEvent: text('trigger_event', { enum: triggerEvents }),
  mainPainAccessor: text('main_pain_accessor'),
  mainPainUrgency: integer('main_pain_urgency'),
  // identity-free value array, replaced whole, never SQL-queried (sanctioned
  // JSONB, promotion trigger documented in customers/DOCS.md)
  additionalPainPoints: jsonb('additional_pain_points').$type<Pain[]>(),
  outcomePriority: text('outcome_priority', { enum: outcomePriorities }),
  timeInHome: text('time_in_home', { enum: yearsInHomeRanges }),
  householdType: text('household_type', { enum: householdTypes }),
  priorContractorExperience: text('prior_contractor_experience', { enum: priorContractorExperiences }),
  constructionOutlookFavorabilityRating: integer('construction_outlook_favorability_rating'),
  sellPlan: text('sell_plan', { enum: sellPlans }),
  decisionTimeline: text('decision_timeline', { enum: decisionTimelines }),
  projectNecessityRating: integer('project_necessity_rating'),
  ageGroup: text('age_group', { enum: customerAgeGroups }),
  // ── property section ──
  hoa: boolean('hoa'),
  yearBuilt: text('year_built', { enum: yearBuiltRanges }),
  roofType: text('roof_type', { enum: roofTypes }),
  foundationType: text('foundation_type', { enum: foundationTypes }),
  hvacType: text('hvac_type', { enum: hvacTypes }),
  hvacComponents: text('hvac_components', { enum: hvacComponents }),
  windowsType: text('windows_type', { enum: windowsTypes }),
  insulationLevel: text('insulation_level', { enum: insulationLevels }),
  // ── financial section ──
  numQuotesReceived: integer('num_quotes_received'),
  creditScore: text('credit_score', { enum: creditScoreRanges }),
  createdAt,
  updatedAt,
})

export const selectCustomerProfileSchema = createSelectSchema(customerProfiles)
export type CustomerProfileRow = z.infer<typeof selectCustomerProfileSchema>

export const insertCustomerProfileSchema = createInsertSchema(customerProfiles, {
  additionalPainPoints: z.array(painSchema).nullable().optional(),
  mainPainUrgency: z.number().int().min(1).max(10).nullable().optional(),
  constructionOutlookFavorabilityRating: z.number().int().min(1).max(10).nullable().optional(),
  projectNecessityRating: z.number().int().min(1).max(10).nullable().optional(),
  numQuotesReceived: z.number().int().min(0).nullable().optional(),
}).omit({ createdAt: true, updatedAt: true })

// Wire patch: undefined = untouched, null = clear. No pick(), no import-cycle exile.
export const customerProfilePatchSchema = insertCustomerProfileSchema.omit({ customerId: true }).partial()
export type CustomerProfilePatch = z.infer<typeof customerProfilePatchSchema>
