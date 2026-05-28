import { useQuery } from '@tanstack/react-query'

import { useTRPC } from '@/trpc/helpers'

/**
 * Polls Zoho Sign contract status for a proposal.
 *
 * **Scope is intentionally narrow**: this hook polls only for signing
 * lifecycle transitions (`inprogress → completed/declined`). It does NOT
 * try to detect "a draft is about to be created" — draft creation is now
 * synchronous (no QStash hop, see ADR-0004 + the proposals DOCS.md on
 * proposal-contract independence). Once `getContractStatus` returns
 * `null`, polling stops. The "Create Draft" CTA is the only way back to
 * an envelope from a null state.
 */
export function useContractStatus(proposalId: string, token?: string) {
  const trpc = useTRPC()

  return useQuery({
    ...trpc.proposalsRouter.contracts.getContractStatus.queryOptions({ id: proposalId, token }),
    refetchInterval: (query) => {
      const data = query.state.data

      // Webhook persists terminal state — stop polling immediately even if
      // Zoho's live status hasn't caught up.
      if (data?.contractSignedAt || data?.contractDeclinedAt) {
        return false
      }

      // Once signing is in-progress, fixed 30s polling for signer-side events.
      if (data?.requestStatus === 'inprogress') {
        return 30_000
      }

      // Any other state (draft, completed-via-webhook, no envelope) — no poll.
      return false
    },
  })
}
