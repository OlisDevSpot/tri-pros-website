import { GiftIcon } from 'lucide-react'
import { formatLedgerAmount } from '@/features/proposal-flow/lib/format-ledger-amount'
import { cn } from '@/shared/lib/utils'

interface Props {
  starting: number | null
  final: number | null
  struck: boolean
  className?: string
}

export function SectionPrice({ starting, final, struck, className }: Props) {
  if (final === null) {
    return null
  }
  return (
    <span className={cn('inline-flex items-baseline gap-1.5 text-sm font-semibold tabular-nums', className)}>
      {struck && starting !== null && (
        <>
          <s className="font-medium text-muted-foreground max-md:hidden">
            <span className="sr-only">was </span>
            {formatLedgerAmount(starting)}
          </s>
          {/* A phone row has no room for both prices; the mark says the figure is already after incentives. */}
          <GiftIcon aria-hidden className="size-3.5 shrink-0 self-center text-muted-foreground md:hidden" />
          <span className="sr-only md:hidden">after incentives, </span>
        </>
      )}
      <span>
        {struck && <span className="sr-only">now </span>}
        {formatLedgerAmount(final)}
      </span>
    </span>
  )
}
