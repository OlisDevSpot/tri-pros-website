import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { Button } from '@/shared/components/ui/button'
import { formatDate } from '@/shared/lib/formatters'

interface Props {
  onClick?: () => void
}

export function SendProposalLink(props: Props) {
  const proposal = useCurrentProposal()

  const isSent = proposal.data?.status === 'sent'

  return (
    <div className="flex gap-2">
      <Button
        type="button"
        variant={!isSent ? 'default' : 'outline'}
        onClick={() => {
          props.onClick?.()
        }}
        disabled={isSent}
      >
        {isSent ? `Proposal Link Sent on ${formatDate(proposal.data?.createdAt || '')} ` : 'Send Proposal Link'}
      </Button>
      {isSent && (
        <Button
          variant="link"
          onClick={() => {
            props.onClick?.()
          }}
          size="sm"
          className="pl-2"
        >
          Resend?
        </Button>
      )}
    </div>
  )
}
