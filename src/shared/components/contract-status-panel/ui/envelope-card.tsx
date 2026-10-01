'use client'

import type { ProposalKind } from '@/shared/constants/enums'
import type { ZohoContractStatus } from '@/shared/services/providers/zoho-sign/types'
import { useMutation } from '@tanstack/react-query'
import { FilePlus, RefreshCw, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { formatDate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'
import { useCreditCooldown } from '../hooks/use-credit-cooldown'
import { getEnvelopeStatusBadge, isEnvelopeActive } from '../lib/get-status-badge'
import { ActionButtonWithImpact } from './action-button-with-impact'
import { ActionConfirmDialog } from './action-confirm-dialog'
import { EnvelopeConfigurationSection } from './envelope-configuration-section'
import { EnvelopePreSendReview } from './envelope-pre-send-review'
import { EnvelopeSignerGrid } from './envelope-signer-grid'

interface EnvelopeCardProps {
  proposalId: string
  contractStatus: (ZohoContractStatus & { contractSentAt: string | null }) | null
  customerName: string | null
  proposalKind?: ProposalKind
}

type ConfirmAction = 'createDraft' | 'send' | 'discard' | 'recall' | 'resend' | 'recreate'

/**
 * Card 2 of the agreement section: the Zoho Sign envelope lifecycle.
 *
 * Renders one of four states based on `contractStatus` + config:
 *   1. Not configured → AgentDraftConfigurationForm
 *   2. Configured, no envelope → "Create Draft" CTA
 *   3. Draft ready → PreSendReview + Send/Discard
 *   4. In progress → SignerGrid + Resend/Recall
 *   5. Terminal (signed/declined/recalled/expired) → status + optional Recreate
 *
 * Every action button carries an inline notification-impact line and
 * customer-facing actions are gated by an AlertDialog confirmation.
 *
 * Draft creation is synchronous (the QStash auto-trigger was removed —
 * see ADR-0004). The "draft syncing" intermediate state no longer exists
 * on this card; either an envelope is loaded or it isn't.
 */
export function EnvelopeCard({
  proposalId,
  contractStatus,
  customerName,
  proposalKind,
}: EnvelopeCardProps) {
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()
  const { isCoolingDown, remainingSeconds, startCooldown } = useCreditCooldown()
  const [confirmDialog, setConfirmDialog] = useState<ConfirmAction | null>(null)

  const requestStatus = contractStatus?.requestStatus
  const isActive = isEnvelopeActive(requestStatus)
  const statusBadge = getEnvelopeStatusBadge(requestStatus)
  const customerLabel = customerName?.trim() || 'the customer'

  const invalidate = () => invalidateProposal()

  const createDraft = useMutation(
    trpc.proposalsRouter.contracts.createContractDraft.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast.success('Draft envelope created')
      },
      onError: err => toast.error(err.message || 'Failed to create draft'),
    }),
  )

  const submitContract = useMutation(
    trpc.proposalsRouter.contracts.submitContract.mutationOptions({
      onSuccess: () => {
        startCooldown()
        invalidate()
        toast.success('Envelope sent for signing')
      },
      onError: err => toast.error(err.message || 'Failed to send envelope'),
    }),
  )

  const recallContract = useMutation(
    trpc.proposalsRouter.contracts.recallContract.mutationOptions({
      onSuccess: () => {
        invalidate()
      },
      onError: err => toast.error(err.message || 'Failed to recall envelope'),
    }),
  )

  const discardDraftContract = useMutation(
    trpc.proposalsRouter.contracts.discardDraftContract.mutationOptions({
      onSuccess: () => {
        invalidate()
        toast.success('Draft discarded')
      },
      onError: err => toast.error(err.message || 'Failed to discard draft'),
    }),
  )

  const resendContract = useMutation(
    trpc.proposalsRouter.contracts.resendContract.mutationOptions({
      onSuccess: () => {
        startCooldown()
        invalidate()
        toast.success('Envelope recreated and sent')
      },
      onError: err => toast.error(err.message || 'Failed to resend envelope'),
    }),
  )

  const isPending = createDraft.isPending || submitContract.isPending || recallContract.isPending || discardDraftContract.isPending || resendContract.isPending

  const ageLockReason = (() => {
    if (requestStatus === 'draft') {
      return 'Discard the draft envelope to change age'
    }
    if (requestStatus === 'inprogress') {
      return 'Recall the envelope to change age'
    }
    if (requestStatus === 'completed') {
      return 'Envelope has been signed — age can no longer change'
    }
    return undefined
  })()

  function runConfirmed(action: ConfirmAction) {
    setConfirmDialog(null)
    switch (action) {
      case 'createDraft':
        createDraft.mutate({ proposalId })
        break
      case 'send':
        submitContract.mutate({ proposalId })
        break
      case 'discard':
        discardDraftContract.mutate({ proposalId })
        break
      case 'recall':
        recallContract.mutate({ proposalId })
        break
      case 'resend':
      case 'recreate':
        resendContract.mutate({ proposalId })
        break
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 sm:p-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold tracking-tight sm:text-base">
            Signing Envelope
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Legally binding Zoho Sign package
          </p>
        </div>
        {statusBadge && (
          <span
            className={cn(
              'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
              statusBadge.className,
            )}
          >
            {statusBadge.label}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="space-y-4">
        <EnvelopeConfigurationSection
          proposalId={proposalId}
          locked={isActive || requestStatus === 'completed'}
          lockReason={ageLockReason}
        />

        {/* State-specific body */}
        {!contractStatus && (
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">
              Configuration ready. Create a draft to prepare the envelope
              for signing — or sending the proposal will prepare one
              automatically as its first step.
            </p>
          </div>
        )}

        {contractStatus && requestStatus === 'draft' && proposalKind && (
          <EnvelopePreSendReview
            proposalKind={proposalKind}
            customerName={customerName}
          />
        )}

        {contractStatus && requestStatus !== 'draft' && (
          <>
            <EnvelopeSignerGrid signerStatuses={contractStatus.signerStatuses} />
            {contractStatus.contractSentAt && (
              <p className="text-xs text-muted-foreground">
                Envelope sent
                {' '}
                {formatDate(contractStatus.contractSentAt)}
              </p>
            )}
          </>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
          {!contractStatus && (
            <ActionButtonWithImpact
              variant="default"
              impact="silent"
              impactCopy="Prepares envelope in Zoho — no customer notification"
              icon={<FilePlus className="size-4" />}
              label="Create Draft"
              onClick={() => createDraft.mutate({ proposalId })}
              isPending={createDraft.isPending}
              disabled={isPending}
            />
          )}

          {requestStatus === 'draft' && (
            <>
              <ActionButtonWithImpact
                variant="default"
                impact="notifies"
                impactCopy="Customer will receive a Zoho Sign email"
                icon={<Send className="size-4" />}
                label={isCoolingDown ? `Wait ${remainingSeconds}s...` : 'Send for Signing'}
                onClick={() => setConfirmDialog('send')}
                isPending={submitContract.isPending}
                disabled={isPending || isCoolingDown}
              />
              <ActionButtonWithImpact
                variant="destructive"
                impact="silent"
                impactCopy="Draft is deleted — no customer notification"
                icon={<Trash2 className="size-4" />}
                label="Discard Draft"
                onClick={() => setConfirmDialog('discard')}
                isPending={discardDraftContract.isPending}
                disabled={isPending}
              />
            </>
          )}

          {requestStatus === 'inprogress' && (
            <>
              <ActionButtonWithImpact
                variant="outline"
                impact="notifies"
                impactCopy="Recalls current envelope and sends a new one — customer gets a new email"
                icon={<RefreshCw className="size-4" />}
                label={isCoolingDown ? `Wait ${remainingSeconds}s...` : 'Resend Envelope'}
                onClick={() => setConfirmDialog('resend')}
                isPending={resendContract.isPending}
                disabled={isPending || isCoolingDown}
              />
              <ActionButtonWithImpact
                variant="destructive"
                impact="destructive"
                impactCopy="Customer's signing link goes dead — they'll see it as recalled"
                icon={<Trash2 className="size-4" />}
                label="Recall Envelope"
                onClick={() => setConfirmDialog('recall')}
                isPending={recallContract.isPending}
                disabled={isPending}
              />
            </>
          )}

          {(requestStatus === 'declined' || requestStatus === 'recalled' || requestStatus === 'expired') && (
            <ActionButtonWithImpact
              variant="default"
              impact="notifies"
              impactCopy="Creates a fresh envelope and sends — customer gets a new Zoho Sign email"
              icon={<RefreshCw className="size-4" />}
              label={isCoolingDown ? `Wait ${remainingSeconds}s...` : 'Recreate & Resend'}
              onClick={() => setConfirmDialog('recreate')}
              isPending={resendContract.isPending}
              disabled={isPending || isCoolingDown}
            />
          )}
        </div>
      </div>

      {/* Confirmation dialogs */}
      <ActionConfirmDialog
        open={confirmDialog === 'send'}
        onOpenChange={open => !open && setConfirmDialog(null)}
        title="Send signing envelope?"
        description={`${customerLabel} will receive a Zoho Sign email and can sign electronically. Make sure the proposal and envelope contents are correct.`}
        details={(
          <p className="text-xs text-muted-foreground">
            This consumes 5 Zoho Sign credits.
          </p>
        )}
        confirmLabel="Send envelope"
        onConfirm={() => runConfirmed('send')}
        isPending={submitContract.isPending}
      />

      <ActionConfirmDialog
        open={confirmDialog === 'discard'}
        onOpenChange={open => !open && setConfirmDialog(null)}
        title="Discard this draft envelope?"
        description="The draft will be deleted from Zoho. No notification is sent to the customer. You can create a new draft anytime — useful when you need to change the customer's age, edit the proposal, or re-pick documents."
        confirmLabel="Discard draft"
        confirmVariant="destructive"
        onConfirm={() => runConfirmed('discard')}
        isPending={discardDraftContract.isPending}
      />

      <ActionConfirmDialog
        open={confirmDialog === 'recall'}
        onOpenChange={open => !open && setConfirmDialog(null)}
        title="Recall the signing envelope?"
        description={`${customerLabel}'s current signing link will stop working. They'll see the envelope marked as recalled in their inbox.`}
        details={(
          <p className="text-xs text-destructive/80">
            This cannot be undone.
          </p>
        )}
        confirmLabel="Recall envelope"
        confirmVariant="destructive"
        onConfirm={() => runConfirmed('recall')}
        isPending={recallContract.isPending}
      />

      <ActionConfirmDialog
        open={confirmDialog === 'resend'}
        onOpenChange={open => !open && setConfirmDialog(null)}
        title="Recall and resend envelope?"
        description={`The current envelope will be recalled and a fresh one created with the latest proposal data. ${customerLabel} will receive a new Zoho Sign email.`}
        details={(
          <p className="text-xs text-muted-foreground">
            Consumes 5 Zoho Sign credits.
          </p>
        )}
        confirmLabel="Recall & resend"
        onConfirm={() => runConfirmed('resend')}
        isPending={resendContract.isPending}
      />

      <ActionConfirmDialog
        open={confirmDialog === 'recreate'}
        onOpenChange={open => !open && setConfirmDialog(null)}
        title="Recreate envelope and send?"
        description={`A new signing envelope will be created and sent to ${customerLabel}. Costs 5 Zoho Sign credits.`}
        confirmLabel="Recreate & send"
        onConfirm={() => runConfirmed('recreate')}
        isPending={resendContract.isPending}
      />
    </div>
  )
}
