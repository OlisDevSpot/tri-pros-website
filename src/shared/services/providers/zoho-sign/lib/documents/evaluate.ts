import type { ProposalContext } from './types'
import type { EnvelopeDocumentId } from '@/shared/constants/enums'
import { ENVELOPE_DOCUMENTS } from './registry'

export type AgreementDocStatus = 'required' | 'optional'

export interface AgreementDocProjection {
  id: EnvelopeDocumentId
  label: string
  status: AgreementDocStatus
}

export interface DocumentEvaluation {
  /** Forced on. Render with check icon, no Switch. */
  required: EnvelopeDocumentId[]
  /** Agent toggles via Switch. Default off. */
  optional: EnvelopeDocumentId[]
  /** Not applicable for this kind. UI hides. Server rejects if submitted. */
  forbidden: EnvelopeDocumentId[]
}

/**
 * Walks the registry and partitions every known document into
 * required / optional / forbidden for the given context.
 *
 * Drives both the agent UI (which checkboxes are forced on / available
 * / hidden) and the server-side validation guard.
 */
export function evaluateDocuments(ctx: ProposalContext): DocumentEvaluation {
  const required: EnvelopeDocumentId[] = []
  const optional: EnvelopeDocumentId[] = []
  const forbidden: EnvelopeDocumentId[] = []

  for (const doc of ENVELOPE_DOCUMENTS) {
    if (!doc.applicableKinds.includes(ctx.kind)) {
      forbidden.push(doc.id)
      continue
    }
    const rule = doc.perKindRules[ctx.kind]
    if (!rule) {
      forbidden.push(doc.id)
      continue
    }
    switch (rule.kind) {
      case 'required':
        required.push(doc.id)
        break
      case 'required-when':
        if (rule.predicate(ctx)) {
          required.push(doc.id)
        }
        else {
          forbidden.push(doc.id)
        }
        break
      case 'optional':
        optional.push(doc.id)
        break
      case 'forbidden-when':
        if (rule.predicate(ctx)) {
          forbidden.push(doc.id)
        }
        else {
          optional.push(doc.id)
        }
        break
    }
  }
  return { required, optional, forbidden }
}

export class EnvelopeSelectionError extends Error {
  readonly missing: EnvelopeDocumentId[]
  readonly banned: EnvelopeDocumentId[]
  constructor({ missing, banned }: { missing: EnvelopeDocumentId[], banned: EnvelopeDocumentId[] }) {
    const parts: string[] = []
    if (missing.length > 0) {
      parts.push(`missing required: ${missing.join(', ')}`)
    }
    if (banned.length > 0) {
      parts.push(`forbidden present: ${banned.join(', ')}`)
    }
    super(`Invalid envelope selection — ${parts.join('; ')}`)
    this.name = 'EnvelopeSelectionError'
    this.missing = missing
    this.banned = banned
  }
}

/**
 * Throws if the agent-submitted selection violates the per-kind rules
 * (missing a required doc, or includes a forbidden doc). Optional docs
 * may be present or absent freely.
 *
 * Called both client-side (UX feedback) and server-side (defense in
 * depth — never trust the client's selection without re-validating).
 */
export function validateEnvelopeSelection(
  ctx: ProposalContext,
  selection: readonly EnvelopeDocumentId[],
): void {
  const { required, forbidden } = evaluateDocuments(ctx)
  const missing = required.filter(id => !selection.includes(id))
  const banned = selection.filter(id => forbidden.includes(id))
  if (missing.length > 0 || banned.length > 0) {
    throw new EnvelopeSelectionError({ missing, banned })
  }
}

/**
 * Brings a previously-saved selection back into validity after the
 * source-of-truth (e.g., customer age) has changed. Pure function — does
 * no I/O, mutates nothing.
 *
 * Reconciliation is deliberately silent: no notification is surfaced to
 * the agent (per the design decision in ADR-0004 amendment — when the
 * agreement context changes, the system maintains internal consistency
 * automatically). Required-set additions and forbidden-set removals
 * happen without the agent having to acknowledge each one.
 *
 * Algorithm:
 *   1. Drop any saved doc that the new evaluation marks `forbidden`.
 *   2. Add any doc the new evaluation marks `required` that isn't
 *      already present.
 *   3. Leave optional choices untouched (whether previously checked or
 *      unchecked).
 *
 * The result is guaranteed to pass `validateEnvelopeSelection` against
 * the same evaluation — required ⊆ result, result ∩ forbidden = ∅.
 */
export function reconcileEnvelopeSelection(
  currentSelection: readonly EnvelopeDocumentId[],
  evaluation: DocumentEvaluation,
): EnvelopeDocumentId[] {
  const forbiddenSet = new Set(evaluation.forbidden)
  const requiredSet = new Set(evaluation.required)
  // Drop forbidden first, then ensure required.
  const kept = currentSelection.filter(id => !forbiddenSet.has(id))
  const keptSet = new Set(kept)
  for (const id of requiredSet) {
    if (!keptSet.has(id)) {
      kept.push(id)
    }
  }
  return kept
}

/**
 * Shapes the registry-driven evaluation into the agreement-context UI's
 * docs list — `{ id, label, status }` per (required ∪ optional) document,
 * preserving registry order. Forbidden docs are filtered out (the UI
 * hides them entirely).
 */
export function projectAgreementDocs(evaluation: DocumentEvaluation): AgreementDocProjection[] {
  const requiredSet = new Set(evaluation.required)
  const optionalSet = new Set(evaluation.optional)
  return ENVELOPE_DOCUMENTS
    .filter(d => requiredSet.has(d.id) || optionalSet.has(d.id))
    .map(d => ({
      id: d.id,
      label: d.label,
      status: requiredSet.has(d.id) ? 'required' : 'optional',
    }))
}
