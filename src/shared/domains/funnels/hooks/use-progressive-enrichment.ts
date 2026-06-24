import type { EnrichmentRecord, FunnelAnswers, FunnelSpec, PiiAnswer } from '@/shared/domains/funnels/types'
import { useEffect, useRef } from 'react'
import { useEnrichLead } from '@/shared/domains/funnels/hooks/use-enrich-lead'
import { buildLeadEnrichment } from '@/shared/domains/funnels/lib/build-lead-enrichment'

/**
 * Progressive lead enrichment. Captures each declared enrichment dimension as
 * soon as it is answered AND a leadId exists — so a drop-off before the
 * confirmation step still persists everything answered so far. Pre-PII answers
 * flush in one patch the moment the lead is created. The server merges per key
 * (JSONB `||`), so sending only the delta is safe.
 */
export function useProgressiveEnrichment(spec: FunnelSpec, answers: FunnelAnswers): void {
  const enrich = useEnrichLead()
  const sentRef = useRef<Set<string>>(new Set())

  const leadId = (answers.pii as PiiAnswer | null)?.leadId ?? null
  const full = buildLeadEnrichment(spec, answers)

  useEffect(() => {
    if (!leadId) {
      return
    }
    const delta: EnrichmentRecord = {}
    for (const [stepId, entry] of Object.entries(full)) {
      const key = `${stepId}=${entry.value}`
      if (!sentRef.current.has(key)) {
        delta[stepId] = entry
        sentRef.current.add(key)
      }
    }
    if (Object.keys(delta).length > 0) {
      enrich({ leadId, enrichment: delta })
    }
    // Re-run whenever the captured set changes (or the lead first appears).
    // enrich is a new closure each render but captures a stable mutation ref, so omitting it from deps is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, Object.keys(full).map(k => `${k}=${full[k].value}`).join('|')])
}
