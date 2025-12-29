import { Button } from '@/shared/components/ui/button'

interface Props {
  onClick?: () => void
}

export function AgreementLink(props: Props) {
  return (
    <Button
      type="button"
      onClick={() => {
        props.onClick?.()
      }}
    >
      Get Agreement Link
    </Button>
  )
}
