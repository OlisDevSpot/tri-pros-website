import z from 'zod'
import { envelopeDocumentIds, projectTypes, validThroughTimeframes } from '@/shared/constants/enums'
import { homeAreas } from '@/shared/domains/construction/constants/enums'

// SUB-SCHEMAS
const homeAreaSchema = z.enum(homeAreas)
export const constructionItemSchema = z.object({
  id: z.string(),
  label: z.string(),
})

export const costLineSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1, 'Label is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  relatedScopeId: z.string().min(1, 'Related scope is required'),
  notes: z.string().optional(),
})
export type CostLine = z.infer<typeof costLineSchema>

export const sowFinancialsSchema = z.object({
  sectionPrice: z.number().nullable(),
  costLines: z.array(costLineSchema),
})
export type SowFinancials = z.infer<typeof sowFinancialsSchema>

const sowShape = z.object({
  contentJSON: z.string(),
  html: z.string(),
  scopes: z.array(constructionItemSchema),
  title: z.string(),
  trade: constructionItemSchema,
  financials: sowFinancialsSchema,
})

/**
 * Read-time migration: legacy proposals stored `sow[].price` at the top
 * level. Map that into the new `financials` shape so existing data loads
 * without error. Idempotent — once a proposal is saved with the new
 * shape, the `'financials' in raw` branch short-circuits.
 */
export const sowSchema = z.preprocess((raw) => {
  if (raw && typeof raw === 'object' && !('financials' in raw)) {
    const { price, ...rest } = raw as { price?: number, [k: string]: unknown }
    return {
      ...rest,
      financials: {
        sectionPrice: typeof price === 'number' ? price : null,
        costLines: [],
      },
    }
  }
  return raw
}, sowShape)

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
  // Uses sowShape (not sowSchema) so the form schema has clean static types
  // for zodResolver. sowSchema (with preprocess) is used in the DB layer only.
  sow: z.array(sowShape).min(1, { message: 'At least one scope is required' }),
})

// `finalTcp` is NOT stored here — it is derived via
// `computeFinalTcp(fundingData)` in `entities/proposals/lib`. Persisted
// derived values invite drift between inputs and the cached number;
// always compute on demand from `startingTcp` + `incentives`.
const fundingDataSchema = z.object({
  cashInDeal: z.number(),
  depositAmount: z.number(),
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
  /**
   * Ordered list of Zoho Sign documents the agent picked for this
   * proposal's envelope. Captured at draft-config time, consumed by the
   * envelope assembler. Optional + nullable so existing proposals (created
   * before this field shipped) fall through to the legacy two-template
   * path until manually re-saved.
   */
  envelopeDocumentIds: z.array(z.enum(envelopeDocumentIds)).nullish(),
})

export const projectSectionSchema = z.object({
  data: projectDataSchema,
  meta: sectionMetaSchema,
})

/**
 * Migration-aware variant of projectSectionSchema for the DB layer.
 * Uses sowSchema (with preprocess) so legacy `sow[].price` is migrated
 * at read time. The form-facing `projectSectionSchema` uses `sowShape`
 * directly to keep zodResolver types clean.
 */
const projectDataMigrationSchema = projectDataSchema.extend({
  sow: z.array(sowSchema).min(1, { message: 'At least one scope is required' }),
})
export const projectSectionMigrationSchema = z.object({
  data: projectDataMigrationSchema,
  meta: sectionMetaSchema,
})

export const fundingSectionSchema = z.object({
  data: fundingDataSchema,
  meta: fundingMetaSchema,
})

// --- Proposal Form Schema (composite) ---

export const proposalFormSchema = z.object({
  meta: formMetaSectionSchema,
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
          financials: {
            sectionPrice: null,
            costLines: [],
          },
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
