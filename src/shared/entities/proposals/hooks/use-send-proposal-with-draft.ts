import { useMutation } from '@tanstack/react-query'
import { useCallback, useState } from 'react'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

/**
 * Sends a proposal to the customer by orchestrating two independent
 * mutations in sequence:
 *
 *   1. `createContractDraft` — idempotent on `proposal.signingRequestId`.
 *   2. `sendProposalEmail`   — marks `status='sent'`, derives meeting outcome.
 *
 * Client-orchestrated (instead of one server mutation) so the staged UI
 * is honest by construction: each step corresponds 1:1 to a real network
 * call, never a faked timer. Replaces the QStash `syncContractDraftJob`
 * auto-dispatch retired in ADR-0004.
 *
 * Failure semantics: stage 1 failure ⇒ nothing happened, retry safely.
 * Stage 2 failure ⇒ draft exists, proposal is NOT marked sent; the UI
 * lands in a recoverable state (envelope present, "Send Proposal" still
 * available) and retrying re-uses the already-created draft.
 *
 * see `src/shared/entities/proposals/DOCS.md#proposal-contract-independence`
 */

export type SendProposalStage = 'idle' | 'creating-draft' | 'sending-email' | 'done' | 'error'
export type SendProposalStep = Extract<SendProposalStage, 'creating-draft' | 'sending-email'>

export interface SendProposalInput {
  proposalId: string
  customerName: string
  email: string
  token: string
  message?: string
}

interface SendProposalState {
  stage: SendProposalStage
  errorMessage: string | null
  failedStep: SendProposalStep | null
}

const INITIAL_STATE: SendProposalState = {
  stage: 'idle',
  errorMessage: null,
  failedStep: null,
}

export function useSendProposalWithDraft() {
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()
  const [state, setState] = useState<SendProposalState>(INITIAL_STATE)

  const createDraft = useMutation(
    trpc.proposalsRouter.contracts.createContractDraft.mutationOptions(),
  )
  const sendEmail = useMutation(
    trpc.proposalsRouter.delivery.sendProposalEmail.mutationOptions(),
  )

  const reset = useCallback(() => setState(INITIAL_STATE), [])

  const send = useCallback(async (input: SendProposalInput) => {
    setState({ stage: 'creating-draft', errorMessage: null, failedStep: null })

    try {
      await createDraft.mutateAsync({ proposalId: input.proposalId })
    }
    catch (err) {
      // Stage-1 failure leaves no server-side state to surface; nothing to invalidate.
      const message = err instanceof Error ? err.message : 'Failed to prepare signing envelope'
      setState({ stage: 'error', errorMessage: message, failedStep: 'creating-draft' })
      throw err
    }

    // Stage 1 created a draft — invalidate so envelope state is visible even
    // if stage 2 throws below (recoverable: agent re-clicks Send, idempotent).
    invalidateProposal({ proposalId: input.proposalId })
    setState({ stage: 'sending-email', errorMessage: null, failedStep: null })

    try {
      await sendEmail.mutateAsync({
        proposalId: input.proposalId,
        customerName: input.customerName,
        email: input.email,
        token: input.token,
        message: input.message,
      })
    }
    catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send proposal email'
      setState({ stage: 'error', errorMessage: message, failedStep: 'sending-email' })
      throw err
    }

    invalidateProposal({ proposalId: input.proposalId })
    setState({ stage: 'done', errorMessage: null, failedStep: null })
  }, [createDraft, sendEmail, invalidateProposal])

  const { stage, errorMessage, failedStep } = state
  const isPending = stage === 'creating-draft' || stage === 'sending-email'

  return { stage, errorMessage, failedStep, isPending, send, reset }
}
