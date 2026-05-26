'use client'

import { Mail, Send } from 'lucide-react'
import { useState } from 'react'
import { Textarea } from '@/shared/components/ui/textarea'
import { formatDate } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { getProposalStatusBadge } from '../lib/get-status-badge'
import { ActionButtonWithImpact } from './action-button-with-impact'
import { ActionConfirmDialog } from './action-confirm-dialog'

interface ProposalCardProps {
  proposalStatus: string | undefined
  proposalSentAt: string | null | undefined
  customerName: string | null
  onSendProposalEmail?: (message: string) => void
  isSendingEmail: boolean
}

type ConfirmAction = 'send' | 'resend'

/**
 * Card 1 of the agreement section: the proposal email lifecycle.
 *
 * The "proposal" here is the interactive document the customer reviews
 * in our app via a tokenized link — separate from the Zoho Sign envelope
 * managed in Card 2. Acting on one card never affects the other.
 */
export function ProposalCard({
  proposalStatus,
  proposalSentAt,
  customerName,
  onSendProposalEmail,
  isSendingEmail,
}: ProposalCardProps) {
  const [message, setMessage] = useState('')
  const [confirmDialog, setConfirmDialog] = useState<ConfirmAction | null>(null)

  const customerLabel = customerName?.trim() || 'the customer'
  const isSent = proposalStatus === 'sent'
  const isApproved = proposalStatus === 'approved'
  const isDeclined = proposalStatus === 'declined'
  const statusBadge = getProposalStatusBadge(proposalStatus)

  function runConfirmed(action: ConfirmAction) {
    setConfirmDialog(null)
    if (action === 'send' || action === 'resend') {
      onSendProposalEmail?.(message)
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
              disabled={isSendingEmail}
            />
          </div>
        )}

        {/* Actions */}
        {!isSent && !isApproved && !isDeclined && (
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <ActionButtonWithImpact
              variant="default"
              impact="notifies"
              impactCopy={`${customerLabel} will receive an email with the proposal link`}
              icon={<Send className="size-4" />}
              label="Send Proposal Email"
              onClick={() => setConfirmDialog('send')}
              isPending={isSendingEmail}
              disabled={isSendingEmail}
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
              isPending={isSendingEmail}
              disabled={isSendingEmail}
            />
          </div>
        )}
      </div>

      <ActionConfirmDialog
        open={confirmDialog === 'send'}
        onOpenChange={open => !open && setConfirmDialog(null)}
        title="Send proposal email?"
        description={`${customerLabel} will receive an email with a link to view and approve the proposal.`}
        confirmLabel="Send email"
        onConfirm={() => runConfirmed('send')}
        isPending={isSendingEmail}
      />

      <ActionConfirmDialog
        open={confirmDialog === 'resend'}
        onOpenChange={open => !open && setConfirmDialog(null)}
        title="Resend proposal email?"
        description={`Send another email to ${customerLabel} with the proposal link.`}
        details={(
          <p className="text-xs text-muted-foreground">
            Use sparingly to avoid bombarding the customer.
          </p>
        )}
        confirmLabel="Resend email"
        onConfirm={() => runConfirmed('resend')}
        isPending={isSendingEmail}
      />
    </div>
  )
}
