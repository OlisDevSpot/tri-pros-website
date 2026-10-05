import type { Buffer } from 'node:buffer'
import type { EnvelopeDocumentId, ProposalKind } from '@/shared/constants/enums'
import type { ProposalWithCustomer } from '@/shared/modules/proposals/core/dal/server/queries'

/** Predicates and field sources read only this — never globals or queries. */
export interface ProposalContext {
  proposal: ProposalWithCustomer
  /** Mirrors `proposal.kind`. */
  kind: ProposalKind
  isSenior: boolean
  isLongSow: boolean
  /** Total contract price after incentives. */
  finalTcp: number
  sowText: string
  /** Earliest `contractSentAt` across the project's proposals; null on initial-sale (no project yet). */
  originalContractDate: Date | null
}

export type FieldSource = (ctx: ProposalContext) => string

/** `required-when` falls back to forbidden; `forbidden-when` falls back to optional. */
export type DocumentRule
  = | { kind: 'required' }
    | { kind: 'required-when', predicate: (ctx: ProposalContext) => boolean }
    | { kind: 'optional' }
    | { kind: 'forbidden-when', predicate: (ctx: ProposalContext) => boolean }

export type DocumentSource
  = | { kind: 'zoho-template', zohoTemplateId: string }
    | { kind: 'generated-pdf', generator: (ctx: ProposalContext) => Promise<Buffer> }

/** Template-level action ids; Zoho returns new envelope-level ids after deduping by email. */
export interface TemplateSignerActions {
  contractor?: string
  homeowner?: string
}

export interface EnvelopeDocument {
  id: EnvelopeDocumentId
  label: string
  source: DocumentSource
  applicableKinds: readonly ProposalKind[]
  /** Keys must be a subset of `applicableKinds`. */
  perKindRules: Partial<Record<ProposalKind, DocumentRule>>
  /** `zoho-template` sources only. */
  fieldMappings?: Record<string, FieldSource>
  /** Zoho CustomDate fields. */
  dateFieldMappings?: Record<string, FieldSource>
  /** `zoho-template` sources only. */
  signerActions?: TemplateSignerActions
}
