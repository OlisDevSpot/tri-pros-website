'use client'

import type { ZohoContractStatus } from '@/shared/services/zoho-sign/types'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { useState } from 'react'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { formatDate } from '@/shared/lib/formatters'
import { useTRPC } from '@/trpc/helpers'
import { ACTION_TOOLTIPS, REQUEST_STATUS_CONFIG } from '../constants/contract-statuses'
import { useCreditCooldown } from '../hooks/use-credit-cooldown'
import { SignerStatusRow } from './signer-status-row'

interface AgentContractViewProps {
  proposalId: string
  contractStatus: (ZohoContractStatus & { contractSentAt: string | null }) | null
  onSendProposalEmail?: (message: string) => void
  isSendingEmail?: boolean
  proposalStatus?: string
  proposalSentAt?: string | null
}

function ActionButton(props: {
  label: string
  tooltip: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'outline' | 'destructive'
  cooldownSeconds?: number
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        size="sm"
        variant={props.variant ?? 'outline'}
        onClick={props.onClick}
        disabled={props.disabled}
      >
        {props.cooldownSeconds
          ? `Wait ${props.cooldownSeconds}s...`
          : props.label}
      </Button>
      <HybridPopoverTooltip content={props.tooltip} side="top">
        <Info className="size-3.5 cursor-help text-muted-foreground" />
      </HybridPopoverTooltip>
    </div>
  )
}

export function AgentContractView({
  proposalId,
  contractStatus,
  onSendProposalEmail,
  isSendingEmail,
  proposalStatus,
  proposalSentAt,
}: AgentContractViewProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [showResendConfirm, setShowResendConfirm] = useState(false)
  const [message, setMessage] = useState('')
  const { isCoolingDown, remainingSeconds, startCooldown } = useCreditCooldown()

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: trpc.proposalsRouter.contracts.getContractStatus.queryKey({ proposalId }),
    })
  }

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
      onSuccess: () => {
        invalidate()
      },
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
  const statusConfig = requestStatus ? REQUEST_STATUS_CONFIG[requestStatus] : null
  const isSent = proposalStatus === 'sent'

  // State 1: No contract — show send proposal email UI
  if (!contractStatus) {
    return (
      <div className="flex flex-col gap-3">
        {!isSent && (
          <div className="flex flex-col gap-1.5">
            <label className="text-sm text-muted-foreground">Personal note (optional)</label>
            <Textarea
              placeholder="Add a personal note..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={!isSent ? 'default' : 'outline'}
            onClick={() => onSendProposalEmail?.(message)}
            disabled={isSendingEmail || (isSent && false)}
          >
            {isSent ? `Proposal Sent${proposalSentAt ? ` on ${formatDate(proposalSentAt)}` : ''}` : 'Send Proposal Link'}
          </Button>
          {isSent && (
            <Button
              variant="link"
              onClick={() => onSendProposalEmail?.(message)}
              size="sm"
              className="pl-2"
              disabled={isSendingEmail}
            >
              Resend?
            </Button>
          )}
        </div>
      </div>
    )
  }

  // State 5: Declined / Recalled / Expired
  if (requestStatus === 'declined' || requestStatus === 'recalled' || requestStatus === 'expired') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            Agreement:
            {statusConfig?.label}
          </span>
          <span className={`size-2.5 rounded-full ${statusConfig?.dotClass}`} />
        </div>
        <ActionButton
          label="Resend"
          tooltip={ACTION_TOOLTIPS.resend}
          onClick={() => setShowResendConfirm(true)}
          disabled={isPending || isCoolingDown}
          cooldownSeconds={isCoolingDown ? remainingSeconds : undefined}
        />
        <ResendConfirmDialog
          open={showResendConfirm}
          onOpenChange={setShowResendConfirm}
          onConfirm={() => {
            setShowResendConfirm(false)
            resendContract.mutate({ proposalId })
          }}
        />
      </div>
    )
  }

  // State 4: Completed
  if (requestStatus === 'completed') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            Agreement:
            {statusConfig?.label}
          </span>
          <span className={`size-2.5 rounded-full ${statusConfig?.dotClass}`} />
        </div>
        {contractStatus.signerStatuses.map(s => (
          <SignerStatusRow key={s.role} role={s.role} status={s.status} />
        ))}
        {contractStatus.contractSentAt && (
          <p className="text-xs text-muted-foreground">
            Sent
            {' '}
            {formatDate(contractStatus.contractSentAt)}
          </p>
        )}
      </div>
    )
  }

  // State 2: Draft
  if (requestStatus === 'draft') {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Agreement: Draft</span>
          <span className={`size-2.5 rounded-full ${statusConfig?.dotClass}`} />
        </div>
        {contractStatus.signerStatuses.map(s => (
          <SignerStatusRow key={s.role} role={s.role} status={s.status} />
        ))}
        <div className="flex gap-2">
          <ActionButton
            label="Send for Signing"
            tooltip={ACTION_TOOLTIPS.sendForSigning}
            variant="default"
            onClick={() => submitContract.mutate({ proposalId })}
            disabled={isPending || isCoolingDown}
            cooldownSeconds={isCoolingDown ? remainingSeconds : undefined}
          />
          <ActionButton
            label="Recall"
            tooltip={ACTION_TOOLTIPS.recall}
            variant="destructive"
            onClick={() => recallContract.mutate({ proposalId })}
            disabled={isPending}
          />
        </div>
      </div>
    )
  }

  // State 3: In progress
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">
          Agreement:
          {statusConfig?.label}
        </span>
        <span className={`size-2.5 rounded-full ${statusConfig?.dotClass}`} />
      </div>
      {contractStatus.signerStatuses.map(s => (
        <SignerStatusRow key={s.role} role={s.role} status={s.status} />
      ))}
      {contractStatus.contractSentAt && (
        <p className="text-xs text-muted-foreground">
          Sent
          {' '}
          {formatDate(contractStatus.contractSentAt)}
        </p>
      )}
      <div className="flex gap-2">
        <ActionButton
          label="Resend"
          tooltip={ACTION_TOOLTIPS.resend}
          onClick={() => setShowResendConfirm(true)}
          disabled={isPending || isCoolingDown}
          cooldownSeconds={isCoolingDown ? remainingSeconds : undefined}
        />
        <ActionButton
          label="Recall"
          tooltip={ACTION_TOOLTIPS.recall}
          variant="destructive"
          onClick={() => recallContract.mutate({ proposalId })}
          disabled={isPending}
        />
      </div>
      <ResendConfirmDialog
        open={showResendConfirm}
        onOpenChange={setShowResendConfirm}
        onConfirm={() => {
          setShowResendConfirm(false)
          resendContract.mutate({ proposalId })
        }}
      />
    </div>
  )
}

function ResendConfirmDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}) {
  return (
    <AlertDialog open={props.open} onOpenChange={props.onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Resend Agreement?</AlertDialogTitle>
          <AlertDialogDescription>
            This will invalidate the existing agreement. The homeowner will need to request a new agreement link. Continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={props.onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
