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
import { CUSTOMER_AGE_MAX, CUSTOMER_AGE_MIN } from '@/shared/entities/customers/lib/constants'

// HELPER SCHEMA
export const painSchema = z.object({
  accessor: z.string(),
  urgencyRating: z.number().int().min(1).max(10),
})

export const customerProfileSchema = z.object({
  triggerEvent: z.enum(triggerEvents),
  mainPainPoint: painSchema,
  additionalPainPoints: z.array(painSchema),
  outcomePriority: z.enum(outcomePriorities),
  timeInHome: z.enum(yearsInHomeRanges),
  householdType: z.enum(householdTypes),
  priorContractorExperience: z.enum(priorContractorExperiences),
  constructionOutlookFavorabilityRating: z.number().int().min(1).max(10),
  sellPlan: z.enum(sellPlans),
  decisionTimeline: z.enum(decisionTimelines),
  projectNecessityRating: z.number().int().min(1).max(10),
  ageGroup: z.enum(customerAgeGroups),
  age: z.number().int().min(CUSTOMER_AGE_MIN).max(CUSTOMER_AGE_MAX),
}).partial()

export const propertyProfileSchema = z.object({
  hoa: z.boolean().default(false).optional(),
  yearBuilt: z.enum(yearBuiltRanges),
  roofType: z.enum(roofTypes),
  foundationType: z.enum(foundationTypes),
  hvacType: z.enum(hvacTypes),
  hvacComponents: z.enum(hvacComponents),
  windowsType: z.enum(windowsTypes),
  insulationLevel: z.enum(insulationLevels),
}).partial()

export const financialProfileSchema = z.object({
  numQuotesReceived: z.number().int().min(0),
  creditScore: z.enum(creditScoreRanges),
}).partial()

export type CustomerProfile = z.infer<typeof customerProfileSchema>
export type PropertyProfile = z.infer<typeof propertyProfileSchema>
export type FinancialProfile = z.infer<typeof financialProfileSchema>

export const leadMetaSchema = z.object({
  // ── operational (unchanged) ──
  mp3RecordingKey: z.string().optional(),
  closedBy: z.string().optional(),
  scheduledFor: z.string().optional(), // also receives Bina selfBookingDateTime

  // ── normalized envelope (source-AGNOSTIC; identical keys for every source) ──
  // Raw, human-readable interested-trade strings. Bina → split campaign trades;
  // in-app form → resolved picked-trade NAMES. Downstream (CT attributes, SMS
  // merge) reads ONLY the envelope — never branches on `source.kind`.
  interestedTradesRaw: z.array(z.string()).optional(),
  // Origin-campaign ATTRIBUTION — free string off the lead-source origin + intake
  // form. Descriptive/immutable; distinct from the OPERATIONAL enrolled campaign
  // (voip_campaign_contacts.voip_campaign_id). Does NOT drive routing.
  originCampaign: z.string().optional(),
  // OPTIONAL human-confirmed app-trade link, filled later by an agent. The
  // envelope's interestedTradesRaw is the cross-source truth; this is the
  // structured link to real app trades/scopes once a human confirms it.
  requestedTrades: z.array(z.object({
    tradeId: z.string(),
    scopeIds: z.array(z.string()),
  })).optional(),

  // ── typed source capture (discriminated union; kind = payload SHAPE, decoupled
  //    from the dynamic lead-source slug). Raw provider fields verbatim, for
  //    human/agent context. NEVER read by the generic dial/SMS path. ──
  source: z.discriminatedUnion('kind', [
    z.object({
      kind: z.literal('bina'),
      budgetSolution: z.string().nullable(),
      rebateAmount: z.string().nullable(),
      bathroomAge: z.string().nullable(),
      bathroomSize: z.string().nullable(),
      bathroomScope: z.string().nullable(),
      kitchenAge: z.string().nullable(),
      kitchenSize: z.string().nullable(),
      kitchenScope: z.string().nullable(),
    }),
    z.object({ kind: z.literal('generic') }),
  ]).optional(),
})
export type LeadMeta = z.infer<typeof leadMetaSchema>
