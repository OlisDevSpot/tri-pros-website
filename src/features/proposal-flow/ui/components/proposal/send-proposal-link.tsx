import { useState } from 'react'
import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { formatDate } from '@/shared/lib/formatters'

interface Props {
  onClick?: (message: string) => void
}

export function SendProposalLink(props: Props) {
  const proposal = useCurrentProposal()
  const [message, setMessage] = useState('')

  const isSent = proposal.data?.status === 'sent'
  const firstName = proposal.data?.customer?.name?.split(' ')[0] ?? 'your customer'

  return (
    <div className="flex flex-col gap-3">
      {!isSent && (
        <div className="flex flex-col gap-1.5">
          <label className="text-sm text-muted-foreground">Personal note (optional)</label>
          <Textarea
            placeholder={`Add a personal note for ${firstName}…`}
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
          onClick={() => {
            props.onClick?.(message)
          }}
          disabled={isSent}
        >
          {isSent ? `Proposal Link Sent on ${formatDate(proposal.data?.createdAt || '')} ` : 'Send Proposal Link'}
        </Button>
        {isSent && (
          <Button
            variant="link"
            onClick={() => {
              props.onClick?.(message)
            }}
            size="sm"
            className="pl-2"
          >
            Resend?
          </Button>
        )}
      </div>
    </div>
  )
}
