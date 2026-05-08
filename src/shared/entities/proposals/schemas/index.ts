import z from 'zod'
import { envelopeDocumentIds, projectTypes, validThroughTimeframes } from '@/shared/constants/enums'
import { homeAreas } from '@/shared/domains/construction/constants/enums'
import { createEmptySowSection } from '../lib/create-empty-sow-section'

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

export const sectionIncentiveSchema = z.object({
  id: z.string().uuid(),
  label: z.string().min(1, 'Label is required'),
  amount: z.number().positive('Amount must be greater than 0'),
  notes: z.string().optional(),
})
export type SectionIncentive = z.infer<typeof sectionIncentiveSchema>

export const sowFinancialsSchema = z.object({
  sectionPrice: z.number().nullable(),
  costLines: z.array(costLineSchema),
  incentives: z.array(sectionIncentiveSchema),
})
export type SowFinancials = z.infer<typeof sowFinancialsSchema>

export const sowSchema = z.object({
  contentJSON: z.string(),
  html: z.string(),
  scopes: z.array(constructionItemSchema),
  title: z.string(),
  trade: constructionItemSchema,
  financials: sowFinancialsSchema,
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

export const fundingSectionSchema = z.object({
  data: fundingDataSchema,
  meta: fundingMetaSchema,
})

// --- Proposal Form Schema (composite) ---

/**
 * Raw object shape — exported so consumers that need ZodObject methods
 * (`.partial()`, `.pick()`, `.extend()`) can derive from it. The refined
 * `proposalFormSchema` below is a ZodEffects (because of `superRefine`)
 * and Zod blocks those derivations on refined schemas. Use `*Shape` for
 * derivation, `*Schema` for validation.
 */
export const proposalFormShape = z.object({
  meta: formMetaSectionSchema,
  project: projectSectionSchema,
  funding: fundingSectionSchema,
})

/**
 * Validated form schema — feeds `zodResolver`. Cross-field rules:
 * - Breakdown mode: every section's `sectionPrice` must be a positive number.
 * - Every cost line's `relatedScopeId` must reference a scope selected in its section.
 * Defense-in-depth — the form UI cascade keeps these in sync; the schema
 * is the safety net at submit time.
 */
export const proposalFormSchema = proposalFormShape.superRefine((proposal, ctx) => {
  const isBreakdown = proposal.meta.pricingMode === 'breakdown'

  proposal.project.data.sow.forEach((section, sectionIndex) => {
    // 1. Section price required + positive in breakdown mode
    if (isBreakdown) {
      const sp = section.financials.sectionPrice
      if (sp === null || sp <= 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['project', 'data', 'sow', sectionIndex, 'financials', 'sectionPrice'],
          message: 'Section price is required in breakdown pricing mode',
        })
      }
    }

    // 2. Every cost line's relatedScopeId must match a selected scope
    const selectedScopeIds = new Set(section.scopes.map(s => s.id))
    section.financials.costLines.forEach((line, lineIndex) => {
      if (!selectedScopeIds.has(line.relatedScopeId)) {
        ctx.addIssue({
          code: 'custom',
          path: ['project', 'data', 'sow', sectionIndex, 'financials', 'costLines', lineIndex, 'relatedScopeId'],
          message: 'Related scope must be one of this section\'s selected scopes',
        })
      }
    })
  })
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
      sow: [createEmptySowSection()],
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
