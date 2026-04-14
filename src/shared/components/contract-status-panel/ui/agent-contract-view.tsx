'use client'

import type { ZohoActionStatus, ZohoContractStatus } from '@/shared/services/zoho-sign/types'
import { useMutation } from '@tanstack/react-query'
import { CheckCircle, Eye, Loader2, Mail, Minus, RefreshCw, Send, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { formatDate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'
import { ACTION_TOOLTIPS } from '../constants/contract-statuses'
import { useCreditCooldown } from '../hooks/use-credit-cooldown'
import { CustomerAgeForm } from './customer-age-form'
import { ResendConfirmDialog } from './resend-confirm-dialog'

interface AgentContractViewProps {
  proposalId: string
  contractStatus: (ZohoContractStatus & { contractSentAt: string | null }) | null
  customerAge: number | null
  customerId: string | null
  onSendProposalEmail?: (message: string) => void
  isSendingEmail?: boolean
  proposalStatus?: string
  proposalSentAt?: string | null
  isDraftSyncing?: boolean
}

const ACTION_ICONS: Record<ZohoActionStatus, React.ReactNode> = {
  NOACTION: <Minus className="size-3.5 text-muted-foreground" />,
  UNOPENED: <Mail className="size-3.5 text-muted-foreground" />,
  VIEWED: <Eye className="size-3.5 text-blue-500" />,
  SIGNED: <CheckCircle className="size-3.5 text-green-500" />,
}

const ACTION_LABELS: Record<ZohoActionStatus, string> = {
  NOACTION: 'Waiting',
  UNOPENED: 'Unopened',
  VIEWED: 'Viewed',
  SIGNED: 'Signed',
}

function getStatusBadge(requestStatus: string | undefined) {
  switch (requestStatus) {
    case 'draft':
      return { label: 'Draft', className: 'bg-muted text-muted-foreground' }
    case 'inprogress':
      return { label: 'Awaiting Signatures', className: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400' }
    case 'completed':
      return { label: 'Signed', className: 'bg-green-500/10 text-green-700 dark:text-green-400' }
    case 'declined':
      return { label: 'Declined', className: 'bg-red-500/10 text-red-700 dark:text-red-400' }
    case 'recalled':
      return { label: 'Recalled', className: 'bg-muted text-muted-foreground' }
    case 'expired':
      return { label: 'Expired', className: 'bg-red-500/10 text-red-700 dark:text-red-400' }
    default:
      return null
  }
}

export function AgentContractView({
  proposalId,
  contractStatus,
  customerAge,
  onSendProposalEmail,
  isSendingEmail,
  proposalStatus,
  proposalSentAt,
  isDraftSyncing,
}: AgentContractViewProps) {
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()
  const [showResendConfirm, setShowResendConfirm] = useState(false)
  const [message, setMessage] = useState('')
  const { isCoolingDown, remainingSeconds, startCooldown } = useCreditCooldown()

  const invalidate = () => invalidateProposal()

  const submitContract = useMutation(
    trpc.proposalsRouter.contracts.submitContract.mutationOptions({
      onSuccess: () => {
        startCooldown()
        invalidate()
      },
    }),
  )

  const recallContract = useMutation(
    trpc.proposalsRouter.contracts.recallContract.mutationOptions({
      onSuccess: () => invalidate(),
    }),
  )

  const resendContract = useMutation(
    trpc.proposalsRouter.contracts.resendContract.mutationOptions({
      onSuccess: () => {
        startCooldown()
        invalidate()
      },
    }),
  )

  const isPending = submitContract.isPending || recallContract.isPending || resendContract.isPending
  const requestStatus = contractStatus?.requestStatus
  const isSent = proposalStatus === 'sent'
  const statusBadge = getStatusBadge(requestStatus)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Gradient background wash — matches homeowner view */}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/4 via-primary/2 to-transparent dark:from-primary/8 dark:via-primary/3" />

        <div className="relative space-y-5 p-5 sm:p-7">
          {/* Header row: title + status badge */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold tracking-tight sm:text-lg">
                Agreement
              </h3>
              {isSent && proposalSentAt && (
                <div className="mt-1 flex items-center gap-2">
                  <p className="text-xs text-muted-foreground">
                    Proposal sent
                    {' '}
                    {formatDate(proposalSentAt)}
                  </p>
                  <button
                    type="button"
                    onClick={() => onSendProposalEmail?.(message)}
                    disabled={isSendingEmail}
                    className="text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50"
                  >
                    Resend
                  </button>
                </div>
              )}
            </div>
            {statusBadge && (
              <span className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                statusBadge.className,
              )}
              >
                {statusBadge.label}
              </span>
            )}
          </div>

          {/* Age gate — must be set before any contract actions */}
          {customerAge == null && (
            <CustomerAgeForm proposalId={proposalId} />
          )}

          {/* State: Draft is being created by background job */}
          {!contractStatus && isDraftSyncing && customerAge != null && (
            <DraftSyncingState />
          )}

          {/* State: No contract yet (age must be set) */}
          {!contractStatus && !isDraftSyncing && customerAge != null && (
            <NoContractState
              isSent={isSent}
              isSendingEmail={isSendingEmail ?? false}
              message={message}
              onMessageChange={setMessage}
              onSend={() => onSendProposalEmail?.(message)}
            />
          )}

          {/* State: Has contract — show signer grid + actions */}
          {contractStatus && (
            <>
              {/* Signer status grid */}
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {contractStatus.signerStatuses.map(signer => (
                  <div
                    key={signer.role}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-3',
                      signer.status === 'SIGNED'
                        ? 'border-green-500/20 bg-green-500/5'
                        : 'border-border bg-muted/30',
                    )}
                  >
                    <div className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded-full',
                      signer.status === 'SIGNED'
                        ? 'bg-green-500/10'
                        : 'bg-muted',
                    )}
                    >
                      {ACTION_ICONS[signer.status]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium leading-tight">{signer.role}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {ACTION_LABELS[signer.status]}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sent date */}
              {contractStatus.contractSentAt && (
                <p className="text-xs text-muted-foreground">
                  Agreement sent
                  {' '}
                  {formatDate(contractStatus.contractSentAt)}
                </p>
              )}

              {/* Action buttons — contextual to current state */}
              <ContractActions
                requestStatus={requestStatus}
                isPending={isPending}
                isCoolingDown={isCoolingDown}
                remainingSeconds={remainingSeconds}
                onSubmit={() => submitContract.mutate({ proposalId })}
                onRecall={() => recallContract.mutate({ proposalId })}
                onResend={() => setShowResendConfirm(true)}
              />
            </>
          )}
        </div>
      </div>

      <ResendConfirmDialog
        open={showResendConfirm}
        onOpenChange={setShowResendConfirm}
        onConfirm={() => {
          setShowResendConfirm(false)
          resendContract.mutate({ proposalId })
        }}
      />
    </motion.div>
  )
}

function DraftSyncingState() {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 p-4">
        <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Creating draft agreement...
        </p>
      </div>
      {/* Skeleton for signer grid */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {[0, 1].map(i => (
          <div key={i} className="flex items-center gap-3 rounded-lg border border-border p-3">
            <div className="size-8 shrink-0 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 w-20 animate-pulse rounded bg-muted" />
              <div className="h-3 w-14 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NoContractState(props: {
  isSent: boolean
  isSendingEmail: boolean
  message: string
  onMessageChange: (val: string) => void
  onSend: () => void
}) {
  if (props.isSent) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-sm text-muted-foreground">
          Proposal has been sent. A draft agreement will appear here shortly.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm text-muted-foreground">Personal note (optional)</label>
        <Textarea
          placeholder="Add a personal note to the proposal email..."
          value={props.message}
          onChange={e => props.onMessageChange(e.target.value)}
          rows={3}
          className="resize-none"
        />
      </div>
      <Button
        onClick={props.onSend}
        disabled={props.isSendingEmail}
        className="w-full sm:w-auto"
      >
        <Send className="mr-2 size-4" />
        Send Proposal Link
      </Button>
    </div>
  )
}

function ContractActions(props: {
  requestStatus: string | undefined
  isPending: boolean
  isCoolingDown: boolean
  remainingSeconds: number
  onSubmit: () => void
  onRecall: () => void
  onResend: () => void
}) {
  const cooldownLabel = props.isCoolingDown ? `Wait ${props.remainingSeconds}s...` : null

  // Draft: Send for Signing (primary) + Recall (subtle)
  if (props.requestStatus === 'draft') {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <HybridPopoverTooltip content={ACTION_TOOLTIPS.sendForSigning} side="top">
          <Button
            onClick={props.onSubmit}
            disabled={props.isPending || props.isCoolingDown}
            className="w-full sm:w-auto"
          >
            <Send className="mr-2 size-4" />
            {cooldownLabel ?? 'Send for Signing'}
          </Button>
        </HybridPopoverTooltip>
        <HybridPopoverTooltip content={ACTION_TOOLTIPS.recall} side="top">
          <Button
            variant="outline"
            onClick={props.onRecall}
            disabled={props.isPending}
            className="w-full border-destructive/30 text-destructive hover:border-destructive/50 hover:bg-destructive/5 sm:w-auto"
          >
            <Trash2 className="mr-2 size-4" />
            Discard Draft
          </Button>
        </HybridPopoverTooltip>
      </div>
    )
  }

  // In progress: Resend (outline) + Recall (subtle)
  if (props.requestStatus === 'inprogress') {
    return (
      <div className="flex flex-col gap-2 sm:flex-row">
        <HybridPopoverTooltip content={ACTION_TOOLTIPS.resend} side="top">
          <Button
            variant="outline"
            onClick={props.onResend}
            disabled={props.isPending || props.isCoolingDown}
            className="w-full sm:w-auto"
          >
            <RefreshCw className="mr-2 size-4" />
            {cooldownLabel ?? 'Resend Agreement'}
          </Button>
        </HybridPopoverTooltip>
        <HybridPopoverTooltip content={ACTION_TOOLTIPS.recall} side="top">
          <Button
            variant="outline"
            onClick={props.onRecall}
            disabled={props.isPending}
            className="w-full border-destructive/30 text-destructive hover:border-destructive/50 hover:bg-destructive/5 sm:w-auto"
          >
            <Trash2 className="mr-2 size-4" />
            Recall
          </Button>
        </HybridPopoverTooltip>
      </div>
    )
  }

  // Declined / Recalled / Expired: Resend only
  if (props.requestStatus === 'declined' || props.requestStatus === 'recalled' || props.requestStatus === 'expired') {
    return (
      <HybridPopoverTooltip content={ACTION_TOOLTIPS.resend} side="top">
        <Button
          onClick={props.onResend}
          disabled={props.isPending || props.isCoolingDown}
          className="w-full sm:w-auto"
        >
          <RefreshCw className="mr-2 size-4" />
          {cooldownLabel ?? 'Resend Agreement'}
        </Button>
      </HybridPopoverTooltip>
    )
  }

  // Completed: no actions needed
  return null
}
