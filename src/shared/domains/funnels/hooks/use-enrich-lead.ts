import type { EnrichmentRecord } from '@/shared/domains/funnels/types'
import { useMutation } from '@tanstack/react-query'

import { useTRPC } from '@/trpc/helpers'

interface EnrichArgs {
  leadId: string
  enrichment: EnrichmentRecord
}

/**
 * Best-effort enrichment: never awaited, errors swallowed. Post-lead enrichment
 * must never block or break the funnel experience.
 */
export function useEnrichLead() {
  const trpc = useTRPC()
  const mutation = useMutation(trpc.funnelsRouter.enrichFunnelLead.mutationOptions())
  return (args: EnrichArgs) => {
    mutation.mutate(args, { onError: () => {} })
  }
}
