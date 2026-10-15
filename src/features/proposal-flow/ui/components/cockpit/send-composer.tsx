'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { useSendProposal } from '@/shared/modules/proposals/core/hooks/use-send-proposal'

export function SendComposer() {
  const { proposal } = useProposalDocument()
  const [message, setMessage] = useState('')
  const send = useSendProposal()
  const isSent = proposal.status === 'sent'
  const email = proposal.customer?.email ?? null

  function submit() {
    if (!email) {
      return
    }
    send.mutate(
      { proposalId: proposal.id, customerName: proposal.customer?.name ?? '', email, message: message.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(isSent ? 'Proposal resent' : 'Proposal sent')
          setMessage('')
        },
        onError: () => toast.error('Couldn’t send the proposal'),
      },
    )
  }

  return (
    <div className="grid w-full gap-2">
      <Textarea aria-label="Note to send with the proposal" value={message} onChange={e => setMessage(e.target.value)} placeholder={`A note for ${proposal.customer?.name?.split(' ')[0] ?? 'the homeowner'} (optional)`} rows={3} />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={!email || send.isPending}>
          {isSent ? (message.trim() ? 'Resend with note' : 'Resend') : 'Send'}
        </Button>
      </div>
      {!email && <p className="text-xs text-muted-foreground">Add the customer’s email to send.</p>}
    </div>
  )
}
