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
  required: EnvelopeDocumentId[]
  optional: EnvelopeDocumentId[]
  forbidden: EnvelopeDocumentId[]
}

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

/** Runs client-side for UX and again server-side — never trust the client's selection. */
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

/** Deliberately silent — the agent is not notified when a context change adds or drops documents. */
export function reconcileEnvelopeSelection(
  currentSelection: readonly EnvelopeDocumentId[],
  evaluation: DocumentEvaluation,
): EnvelopeDocumentId[] {
  const forbiddenSet = new Set(evaluation.forbidden)
  const requiredSet = new Set(evaluation.required)
  const kept = currentSelection.filter(id => !forbiddenSet.has(id))
  const keptSet = new Set(kept)
  for (const id of requiredSet) {
    if (!keptSet.has(id)) {
      kept.push(id)
    }
  }
  return kept
}

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
