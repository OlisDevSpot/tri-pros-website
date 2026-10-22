import { PART_STATE_TEXT } from '@/features/proposal-flow/constants/form-parts'
import { cn } from '@/shared/lib/utils'

interface Props {
  dirty: boolean
  error: boolean
}

// Always laid out, so a row's text never shifts when the dot appears.
export function PartDot({ dirty, error }: Props) {
  const stateText = error ? PART_STATE_TEXT.error : dirty ? PART_STATE_TEXT.dirty : null

  return (
    <>
      <span
        aria-hidden
        className={cn(
          'size-[7px] shrink-0 rounded-full',
          error ? 'bg-status-danger-dot' : dirty ? 'bg-status-attention-dot' : 'invisible',
        )}
      />
      {stateText && <span className="sr-only">{stateText}</span>}
    </>
  )
}
