import z from 'zod'

export const painSchema = z.object({
  accessor: z.string(),
  urgencyRating: z.number().int().min(1).max(10),
})
export type Pain = z.infer<typeof painSchema>

// `age` is deliberately NOT here — it stays on `customers` because anonymous homeowners write it via the share-token flow.
// Grouped per section for display; the flat union below serves CASL + patch validation.
export const CUSTOMER_PROFILE_COLUMN_KEYS = [
  'triggerEvent',
  'mainPainAccessor',
  'mainPainUrgency',
  'additionalPainPoints',
  'outcomePriority',
  'timeInHome',
  'householdType',
  'priorContractorExperience',
  'constructionOutlookFavorabilityRating',
  'sellPlan',
  'decisionTimeline',
  'projectNecessityRating',
  'ageGroup',
] as const
export const PROPERTY_PROFILE_COLUMN_KEYS = [
  'hoa',
  'yearBuilt',
  'roofType',
  'foundationType',
  'hvacType',
  'hvacComponents',
  'windowsType',
  'insulationLevel',
] as const
export const FINANCIAL_PROFILE_COLUMN_KEYS = ['numQuotesReceived', 'creditScore'] as const
export const PROFILE_COLUMN_KEYS = [
  ...CUSTOMER_PROFILE_COLUMN_KEYS,
  ...PROPERTY_PROFILE_COLUMN_KEYS,
  ...FINANCIAL_PROFILE_COLUMN_KEYS,
] as const
export type ProfileKey = (typeof PROFILE_COLUMN_KEYS)[number]

// `value` is the resolved option label so no server-side label mirror is needed; `order` drives display.
export const enrichmentRecordSchema = z.record(
  z.string(),
  z.object({ label: z.string(), value: z.string(), order: z.number().int() }),
)
export type EnrichmentRecord = z.infer<typeof enrichmentRecordSchema>

// Must mirror the `source` discriminated-union literals below.
export const leadSourceKinds = ['bina', 'generic', 'funnel'] as const
export type LeadSourceKind = (typeof leadSourceKinds)[number]

export const leadMetaSchema = z.object({
  mp3RecordingKey: z.string().optional(),
  closedBy: z.string().optional(),
  scheduledFor: z.string().optional(), // also receives Bina selfBookingDateTime

  // Source-agnostic envelope: downstream (dialer attributes, SMS merge) reads ONLY these keys, never `source.kind`.
  interestedTradesRaw: z.array(z.string()).optional(),
  // Attribution only — distinct from the operational enrolled campaign; does NOT drive routing.
  originCampaign: z.string().optional(),
  // Twilio Lookup v2 result. 'unverified' also covers an indeterminate gate (outage) or a skipped lookup.
  phoneVerification: z.object({
    status: z.enum(['verified', 'unverified']),
    lineType: z.string().nullable(),
    carrierName: z.string().nullable(),
  }).optional(),
  // Human-confirmed link to app trades, filled later by an agent; `interestedTradesRaw` stays the cross-source truth.
  requestedTrades: z.array(z.object({
    tradeId: z.string(),
    scopeIds: z.array(z.string()),
  })).optional(),

  // `kind` is the payload SHAPE, decoupled from the lead-source slug. Raw provider fields for human context — never read by the generic dial/SMS path.
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
    z.object({
      kind: z.literal('funnel'),
      offer: z.string(),
      funnelSlug: z.string(),
      utm: z.object({
        source: z.string().nullable(),
        medium: z.string().nullable(),
        campaign: z.string().nullable(),
        content: z.string().nullable(),
        term: z.string().nullable(),
        fbclid: z.string().nullable(),
        gclid: z.string().nullable(),
      }),
      meta: z.object({
        fbp: z.string().nullable(),
        fbc: z.string().nullable(),
      }).partial().optional(),
      // Transport shape only — split into `customer_enrichment` rows at intake, never persisted here.
      enrichment: enrichmentRecordSchema.optional(),
      // Implied TCPA consent at funnel submit (the PII step shows the disclaimer). Audit-only — the dial/SMS path never reads it.
      consent: z.object({ agreed: z.literal(true), at: z.string() }).optional(),
    }),
  ]).optional(),
})
export type LeadMeta = z.infer<typeof leadMetaSchema>
