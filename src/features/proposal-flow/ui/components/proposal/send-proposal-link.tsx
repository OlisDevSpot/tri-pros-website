import { Button } from '@/shared/components/ui/button'

interface Props {
  onClick?: () => void
}

export function SendProposalLink(props: Props) {
  return (
    <Button
      type="button"
      onClick={() => {
        props.onClick?.()
      }}
    >
      Send Proposal Link
    </Button>
  )
}
