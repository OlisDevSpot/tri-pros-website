import type { FunnelAnswers, FunnelSpec, PiiAnswer } from '@/shared/domains/funnels/types'
import { useEffect } from 'react'
import { useEnrichLead } from '@/shared/domains/funnels/hooks/use-enrich-lead'
import { buildLeadEnrichment, enrichmentSignature } from '@/shared/domains/funnels/lib/build-lead-enrichment'

/**
 * Progressive lead enrichment. Sends the FULL accumulated enrichment record each
 * time the answer set changes and a leadId exists — so a drop-off before the
 * confirmation step still persists everything answered so far.
 *
 * Sending the full record (not a delta) is deliberate: enrichment is best-effort
 * and fire-and-forget (errors swallowed, no retry — see use-enrich-lead), so a
 * dropped request must be self-healing. Because the server merges atomically into
 * `source.enrichment` (a single `jsonb_set` — see mergeFunnelEnrichment), every
 * send is idempotent and monotonic, and the next send re-includes any key whose
 * earlier request failed. The signature dep keeps it from re-firing on no-op
 * renders.
 */
export function useProgressiveEnrichment(spec: FunnelSpec, answers: FunnelAnswers): void {
  const enrich = useEnrichLead()

  const leadId = (answers.pii as PiiAnswer | null)?.leadId ?? null
  const full = buildLeadEnrichment(spec, answers)
  // Empty record → empty signature, which doubles as the "nothing to send" guard.
  const sig = enrichmentSignature(full)

  useEffect(() => {
    if (!leadId || !sig) {
      return
    }
    enrich({ leadId, enrichment: full })
    // Re-run whenever the answered set changes (or the lead first appears).
    // enrich is a new closure each render but captures a stable mutation ref, so omitting it (and the
    // render-fresh `full`, keyed by `sig`) from deps is safe.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, sig])
}
