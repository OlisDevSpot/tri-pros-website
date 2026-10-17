'use client'

import { MailIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { COCKPIT_SHARE_ONLY, COCKPIT_SHARE_TOOLBAR } from '@/features/proposal-flow/constants/cockpit-actions'
import { SEND_REFUSAL_COPY } from '@/features/proposal-flow/constants/cockpit-copy'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { firstName } from '@/features/proposal-flow/lib/rep-names'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { Textarea } from '@/shared/components/ui/textarea'
import { ProposalOverviewCard } from '@/shared/modules/proposals/core/components/overview-card'
import { useSendProposal } from '@/shared/modules/proposals/core/hooks/use-send-proposal'

export function SendComposer() {
  const { proposal } = useProposalDocument()
  const first = firstName(proposal.customer?.name ?? '') || 'the homeowner'
  const email = proposal.customer?.email ?? null
  const [note, setNote] = useState(() => `Thanks for having us over, ${first}. Here’s the proposal we walked through.`)
  const [confirming, setConfirming] = useState(false)
  const send = useSendProposal()
  const isResend = proposal.status === 'sent'
  const hasNote = note.trim().length > 0
  const rootRef = useRef<HTMLDivElement>(null)
  const shownConfirm = useRef(false)

  // Each step replaces the button that was pressed, so focus moves to the new step's first button instead of falling to the sheet.
  useEffect(() => {
    if (confirming !== shownConfirm.current) {
      shownConfirm.current = confirming
      rootRef.current?.querySelector('button')?.focus()
    }
  }, [confirming])

  function submit() {
    send.mutate({ proposalId: proposal.id, message: note.trim() || undefined }, {
      onSuccess: () => {
        toast.success(isResend ? 'Proposal resent' : 'Proposal sent')
        setConfirming(false)
      },
      // The service refuses with a reason, so the toast can say which.
      onError: error => toast.error(SEND_REFUSAL_COPY[error.message] ?? 'Couldn’t send the proposal'),
    })
  }

  if (confirming) {
    return (
      <div ref={rootRef} role="alert" className="grid gap-2.5 rounded-lg bg-status-pending-bg p-3 text-sm font-bold text-status-pending-fg">
        {`This emails ${email} ${hasNote ? 'with your note' : 'without a note'}.`}
        <div className="flex gap-2">
          <Button size="sm" onClick={submit} disabled={send.isPending}>{isResend ? 'Resend now' : 'Send now'}</Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
        </div>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="grid gap-2">
      <Label htmlFor="cockpit-note" className="text-sm font-bold text-muted-foreground">{`Note for ${first}`}</Label>
      <Textarea id="cockpit-note" value={note} onChange={e => setNote(e.target.value)} rows={3} className="min-h-19" />
      <div className="flex flex-wrap items-center gap-1">
        <Button size="sm" onClick={() => setConfirming(true)} disabled={!email}>
          <MailIcon className="size-4" />
          {isResend ? 'Resend' : `Send to ${first}`}
        </Button>
        <ProposalOverviewCard.Actions mode="toolbar" roles={COCKPIT_SHARE_TOOLBAR} show={COCKPIT_SHARE_ONLY} className="flex-nowrap" />
      </div>
      <p className="text-xs text-muted-foreground">{email ? `Sends to ${email}` : 'Add the customer’s email to send.'}</p>
    </div>
  )
}
