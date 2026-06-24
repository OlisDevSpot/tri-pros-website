import type { CardSelectStep, EnrichmentRecord, FunnelAnswers, FunnelSpec } from '@/shared/domains/funnels/types'

/** True when a step contributes a selectable, label-resolvable answer. */
function isCardSelect(step: FunnelSpec['steps'][number]): step is CardSelectStep {
  return step.kind === 'card-select'
}

/**
 * Build the full enrichment record from currently-answered declared dimensions.
 * Self-describing: stores the option's human label as `value` so no server-side
 * label mirror is needed. `order` is the dimension's index in `spec.enrichment`.
 */
export function buildLeadEnrichment(spec: FunnelSpec, answers: FunnelAnswers): EnrichmentRecord {
  const dims = spec.enrichment ?? []
  const out: EnrichmentRecord = {}
  dims.forEach((dim, order) => {
    const step = spec.steps.find(s => s.id === dim.stepId)
    if (!step || !isCardSelect(step)) {
      return
    }
    const selectedId = answers[dim.stepId]
    if (typeof selectedId !== 'string') {
      return
    }
    const label = step.content.options[selectedId]?.label
    if (!label) {
      return
    }
    out[dim.stepId] = { label: dim.label, value: label, order }
  })
  return out
}

/** Stable signature for diffing what has already been persisted. */
export function enrichmentSignature(record: EnrichmentRecord): string {
  return Object.keys(record)
    .sort()
    .map(k => `${k}=${record[k].value}`)
    .join('|')
}
