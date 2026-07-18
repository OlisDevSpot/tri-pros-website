import { useMutation } from '@tanstack/react-query'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

/**
 * Sends the proposal email (`status='sent'`, meeting outcome derived).
 *
 * Deliberately does NOT touch the signing envelope: envelope creation is a
 * manual agent decision made on the envelope card. The retired
 * `useSendProposalWithDraft` orchestrator auto-created a Zoho draft as its
 * first stage, which put every sent proposal on the lock ladder before any
 * agent decided to prepare a contract (#264, ADR-0004 amendment 2026-07-18).
 * see `@/shared/entities/proposals/lib/proposal-lock.ts`
 */
export function useSendProposal() {
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()

  return useMutation(trpc.proposalsRouter.delivery.sendProposalEmail.mutationOptions({
    onSuccess: (_data, variables) => {
      invalidateProposal({ proposalId: variables.proposalId })
    },
  }))
}
