import type { Buffer } from 'node:buffer'
import type { EnvelopeDocumentId, EnvelopeScenario } from '@/shared/constants/enums'
import type { ProposalWithCustomer } from '@/shared/dal/server/proposals/api'

/**
 * Snapshot of everything an envelope assembler needs to fill fields and
 * evaluate scenario rules. Built once per draft creation by
 * `buildProposalContext` (see `proposal-context.ts`). Predicates and
 * field sources receive this and return values — never read globals or
 * issue queries themselves.
 */
export interface ProposalContext {
  proposal: ProposalWithCustomer
  scenario: EnvelopeScenario
  isSenior: boolean
  isLongSow: boolean
  /** Total contract price after incentives. */
  finalTcp: number
  /** Plaintext of the SOW (already computed once for the long/short check). */
  sowText: string
  /**
   * Date the project's original (initial-sale) agreement was sent —
   * sourced from the earliest `contractSentAt` across all proposals on
   * all meetings of this proposal's project. Used by AWD's
   * `original-contract-date` field on upsell envelopes. Null in the
   * initial scenario (no project yet) and as a defensive fallback if
   * the project has no contract-sent proposal yet (shouldn't happen
   * given the project-creation rule, but assemblers should degrade
   * gracefully).
   */
  originalContractDate: Date | null
}

/** Resolves a Zoho field's value from the context. Pure function. */
export type FieldSource = (ctx: ProposalContext) => string

/**
 * Per-scenario rule for a document. Predicates fire against the same
 * `ProposalContext` the field sources see.
 *
 * - `required`: always required when scenario is applicable.
 * - `required-when`: required only when predicate returns true; otherwise forbidden.
 * - `optional`: agent toggles via UI, default off.
 * - `forbidden-when`: explicitly forbidden when predicate is true; otherwise optional.
 */
export type DocumentRule
  = | { kind: 'required' }
    | { kind: 'required-when', predicate: (ctx: ProposalContext) => boolean }
    | { kind: 'optional' }
    | { kind: 'forbidden-when', predicate: (ctx: ProposalContext) => boolean }

/**
 * Source of a document — either a Zoho-hosted template (with form
 * fields) or a generated PDF (no form fields, attached via the existing
 * `addFilesToRequest` multipart endpoint).
 */
export type DocumentSource
  = | { kind: 'zoho-template', zohoTemplateId: string }
    | { kind: 'generated-pdf', generator: (ctx: ProposalContext) => Promise<Buffer> }

/**
 * Per-template signer action IDs sent in the mergesend payload. Zoho
 * dedupes by email and assigns new envelope-level action IDs in the
 * response. Optional fields handle ancillary templates that have only
 * one signer (Homeowner-only, no Contractor placement).
 */
export interface TemplateSignerActions {
  contractor?: string
  homeowner?: string
}

export interface EnvelopeDocument {
  id: EnvelopeDocumentId
  /** Human-readable label for the agent UI. */
  label: string
  source: DocumentSource
  /** Scenarios where this document can ever appear. */
  applicableScenarios: readonly EnvelopeScenario[]
  /** Rule per applicable scenario — keys must be a subset of applicableScenarios. */
  perScenarioRules: Partial<Record<EnvelopeScenario, DocumentRule>>
  /** Zoho field-name → value resolver. Only present for `zoho-template` sources. */
  fieldMappings?: Record<string, FieldSource>
  /** Zoho field-name → value resolver for date fields (CustomDate type). */
  dateFieldMappings?: Record<string, FieldSource>
  /** Action IDs sent in mergesend. Only present for `zoho-template` sources. */
  signerActions?: TemplateSignerActions
}
