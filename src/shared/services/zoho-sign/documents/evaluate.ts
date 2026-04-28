import type { ProposalContext } from './types'
import type { EnvelopeDocumentId } from '@/shared/constants/enums'
import { ENVELOPE_DOCUMENTS } from './registry'

export interface DocumentEvaluation {
  /** Forced on. Render with check icon, no Switch. */
  required: EnvelopeDocumentId[]
  /** Agent toggles via Switch. Default off. */
  optional: EnvelopeDocumentId[]
  /** Not applicable in this scenario. UI hides. Server rejects if submitted. */
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
    if (!doc.applicableScenarios.includes(ctx.scenario)) {
      forbidden.push(doc.id)
      continue
    }
    const rule = doc.perScenarioRules[ctx.scenario]
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
 * Throws if the agent-submitted selection violates the scenario rules
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
