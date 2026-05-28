'use client'

import type { ProposalStatus } from '@/shared/constants/enums'

import { Mail, Send } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Textarea } from '@/shared/components/ui/textarea'
import { useSendProposalWithDraft } from '@/shared/entities/proposals/hooks/use-send-proposal-with-draft'
import { formatDate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

import { getProposalStatusBadge } from '../lib/get-status-badge'
import { ActionButtonWithImpact } from './action-button-with-impact'
import { ActionConfirmDialog } from './action-confirm-dialog'
import { SendProposalProgress } from './send-proposal-progress'

interface ProposalCardProps {
  proposalId: string
  token: string
  customerName: string | null
  customerEmail: string | null
  proposalStatus: ProposalStatus | undefined
  proposalSentAt: string | null | undefined
}

type ConfirmAction = 'resend'

/**
 * Card 1 of the agreement section: the proposal email lifecycle.
 *
 * The "proposal" here is the interactive document the customer reviews
 * in our app via a tokenized link — separate from the Zoho Sign envelope
 * managed in Card 2. Acting on one card never affects the other.
 *
 * Send orchestration: clicking "Send Proposal Email" runs the two-step
 * `useSendProposalWithDraft` orchestrator — stage 1 prepares the Zoho
 * draft envelope (idempotent), stage 2 sends the email + marks the
 * proposal sent. The staged `SendProposalProgress` panel reflects real
 * hook state, never a faked timer.
 * see `../../entities/proposals/DOCS.md#proposal-contract-independence`.
 */
export function ProposalCard({
  proposalId,
  token,
  customerName,
  customerEmail,
  proposalStatus,
  proposalSentAt,
}: ProposalCardProps) {
  const [message, setMessage] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmAction | null>(null)
  const { stage, failedStep, errorMessage, isPending, send } = useSendProposalWithDraft()

  const customerLabel = customerName?.trim() || 'the customer'
  const isSent = proposalStatus === 'sent'
  const isApproved = proposalStatus === 'approved'
  const isDeclined = proposalStatus === 'declined'
  const statusBadge = getProposalStatusBadge(proposalStatus)

  async function runSend(action: 'send' | 'resend') {
    if (action === 'resend') {
      setConfirmDialog(null)
    }
    if (!customerEmail) {
      toast.error('Email is not configured')
      return
    }
    try {
      await send({
        proposalId,
        customerName: customerName ?? 'Customer',
        email: customerEmail,
        token,
        message,
      })
      toast.success('Proposal sent!')
    }
    catch {
      // Error surface is already in the staged progress panel + hook state.
      // Toast intentionally omitted to avoid double-reporting.
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4 sm:p-5">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold tracking-tight sm:text-base">
            Proposal
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Interactive document the customer reviews in-app
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
        {/* Status line */}
        {!isSent && !isApproved && !isDeclined && (
          <p className="text-sm text-muted-foreground">Not sent yet.</p>
        )}
        {isSent && proposalSentAt && (
          <p className="text-sm text-muted-foreground">
            Sent to
            {' '}
            {customerLabel}
            {' '}
            on
            {' '}
            <span className="text-foreground">{formatDate(proposalSentAt)}</span>
          </p>
        )}
        {isApproved && (
          <p className="text-sm text-green-700 dark:text-green-400">
            {customerLabel}
            {' '}
            approved this proposal.
          </p>
        )}
        {isDeclined && (
          <p className="text-sm text-red-700 dark:text-red-400">
            {customerLabel}
            {' '}
            declined this proposal.
          </p>
        )}

        {/* Personal note — only shown before the proposal is sent */}
        {!isSent && !isApproved && !isDeclined && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="proposal-personal-note" className="text-xs font-medium text-muted-foreground">
              Personal note (optional)
            </label>
            <Textarea
              id="proposal-personal-note"
              placeholder="Add a personal note to the proposal email..."
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              className="resize-none"
              disabled={isPending}
            />
          </div>
        )}

        {/* Staged progress — visible while sending or after a failure */}
        <SendProposalProgress
          stage={stage}
          failedStep={failedStep}
          errorMessage={errorMessage}
        />

        {/* Actions */}
        {!isSent && !isApproved && !isDeclined && (
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <ActionButtonWithImpact
              variant="default"
              impact="notifies"
              impactCopy={`${customerLabel} will receive an email with the proposal link`}
              icon={<Send className="size-4" />}
              label="Send Proposal Email"
              onClick={() => runSend('send')}
              isPending={isPending}
              disabled={isPending}
            />
          </div>
        )}

        {isSent && (
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <ActionButtonWithImpact
              variant="outline"
              impact="notifies"
              impactCopy={`Sends another email to ${customerLabel} — use sparingly`}
              icon={<Mail className="size-4" />}
              label="Resend Proposal Email"
              onClick={() => setConfirmDialog('resend')}
              isPending={isPending}
              disabled={isPending}
            />
          </div>
        )}
      </div>

      <ActionConfirmDialog
        open={confirmDialog === 'resend'}
        onOpenChange={open => !open && setConfirmDialog(null)}
        title="Resend proposal email?"
        description={`Send another email to ${customerLabel} with the proposal link. We'll also make sure the signing envelope is up-to-date.`}
        details={(
          <p className="text-xs text-muted-foreground">
            Use sparingly to avoid bombarding the customer.
          </p>
        )}
        confirmLabel="Resend email"
        onConfirm={() => runSend('resend')}
        isPending={isPending}
      />
    </div>
  )
}
