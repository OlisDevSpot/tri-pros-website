import { CheckCircle, Loader2 } from 'lucide-react'
import { Button } from '@/shared/components/ui/button'

interface Props {
  onClick?: () => void
  isPending?: boolean
  isSuccess?: boolean
}

export function AgreementLink(props: Props) {
  if (props.isSuccess) {
    return (
      <div className="flex items-center gap-2 text-green-600">
        <CheckCircle className="size-5" />
        <span>Agreement sent to your email!</span>
      </div>
    )
  }

  return (
    <Button
      type="button"
      disabled={props.isPending}
      onClick={() => {
        props.onClick?.()
      }}
    >
      {props.isPending
        ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Sending...
            </>
          )
        : 'Get Agreement Link'}
    </Button>
  )
}
