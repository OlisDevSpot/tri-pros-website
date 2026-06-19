import { useMutation } from '@tanstack/react-query'

import { useTRPC } from '@/trpc/helpers'

interface EnrichArgs {
  enrichment?: {
    age?: null | string
    homeType?: null | string
    scope?: null | string
    timeline?: null | string
  }
  leadId: string
}

/**
 * Best-effort enrichment: never awaited, errors swallowed. Post-lead enrichment
 * must never block or break the confirmation experience (spec §6).
 */
export function useEnrichLead() {
  const trpc = useTRPC()
  const mutation = useMutation(trpc.funnelsRouter.enrichFunnelLead.mutationOptions())
  return (args: EnrichArgs) => {
    mutation.mutate(args, { onError: () => {} })
  }
}
