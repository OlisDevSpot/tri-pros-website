import type { Pain } from '@/shared/entities/customers/schemas'
import { boolean, integer, jsonb, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import z from 'zod'
import { painSchema } from '@/shared/entities/customers/schemas'
import { createdAt, updatedAt } from '../lib/schema-helpers'
import { customers } from './customers'
import {
  creditScoreRangeEnum,
  customerAgeGroupEnum,
  decisionTimelineEnum,
  foundationTypeEnum,
  householdTypeEnum,
  hvacComponentEnum,
  hvacTypeEnum,
  insulationLevelEnum,
  outcomePriorityEnum,
  priorContractorExperienceEnum,
  roofTypeEnum,
  sellPlanEnum,
  triggerEventEnum,
  windowsTypeEnum,
  yearBuiltRangeEnum,
  yearsInHomeEnum,
} from './meta'

// 1:1 sales-discovery profile. Row-exists = discovery data has been collected
// (lazy upsert; ~18% of customers). `age` deliberately lives on customers —
// written by anonymous homeowners (contracts flow), read by envelope rules.
// see docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md §10
export const customerProfiles = pgTable('customer_profiles', {
  customerId: uuid('customer_id').primaryKey().references(() => customers.id, { onDelete: 'cascade' }),
  // ── customer-profile section ──
  triggerEvent: triggerEventEnum('trigger_event'),
  mainPainAccessor: text('main_pain_accessor'),
  mainPainUrgency: integer('main_pain_urgency'),
  // identity-free value array, replaced whole, never SQL-queried (sanctioned
  // JSONB, promotion trigger documented in customers/DOCS.md)
  additionalPainPoints: jsonb('additional_pain_points').$type<Pain[]>(),
  outcomePriority: outcomePriorityEnum('outcome_priority'),
  timeInHome: yearsInHomeEnum('time_in_home'),
  householdType: householdTypeEnum('household_type'),
  priorContractorExperience: priorContractorExperienceEnum('prior_contractor_experience'),
  constructionOutlookFavorabilityRating: integer('construction_outlook_favorability_rating'),
  sellPlan: sellPlanEnum('sell_plan'),
  decisionTimeline: decisionTimelineEnum('decision_timeline'),
  projectNecessityRating: integer('project_necessity_rating'),
  ageGroup: customerAgeGroupEnum('age_group'),
  // ── property section ──
  hoa: boolean('hoa'),
  yearBuilt: yearBuiltRangeEnum('year_built'),
  roofType: roofTypeEnum('roof_type'),
  foundationType: foundationTypeEnum('foundation_type'),
  hvacType: hvacTypeEnum('hvac_type'),
  hvacComponents: hvacComponentEnum('hvac_components'),
  windowsType: windowsTypeEnum('windows_type'),
  insulationLevel: insulationLevelEnum('insulation_level'),
  // ── financial section ──
  numQuotesReceived: integer('num_quotes_received'),
  creditScore: creditScoreRangeEnum('credit_score'),
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
