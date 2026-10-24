import type { ReactNode } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { FUNDING_LEDGER_ROW } from '@/features/proposal-flow/constants/funding-ledger'
import { SOW_PRICING_FIGURE, SOW_PRICING_ROW } from '@/features/proposal-flow/constants/sow-pricing-grid'
import { AnimatedCollapsibleContent, Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { cn } from '@/shared/lib/utils'

interface Props {
  label: string
  count?: number
  sub?: ReactNode
  total: ReactNode
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled?: boolean
  // The ledger has no chevron column: its figures share one right edge, so the chevron sits after the label.
  layout?: 'pricing' | 'ledger'
  children: ReactNode
}

export function SowPricingSummaryRow({ label, count, sub, total, open, onOpenChange, disabled, layout = 'pricing', children }: Props) {
  const ledger = layout === 'ledger'
  const chevron = (
    <ChevronDownIcon
      className={cn('size-4 text-muted-foreground transition-transform duration-200', !ledger && 'justify-self-center', open && 'rotate-180')}
      aria-hidden
    />
  )
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger
        disabled={disabled}
        className={cn(
          ledger ? cn(FUNDING_LEDGER_ROW, 'w-full border-t-0 text-left') : cn(SOW_PRICING_ROW, 'rounded-lg px-2 text-left text-sm'),
          'w-full outline-none transition-colors hover:bg-row-hover pressed:bg-row-press focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset disabled:cursor-default disabled:hover:bg-transparent',
          ledger && 'py-2',
        )}
      >
        <span className={cn('flex flex-col', !ledger && 'font-medium')}>
          <span className="flex items-center gap-1.5">
            {/* Inline, so a narrow phone column wraps the words and keeps "· N" whole beside the last one. */}
            <span>
              {label}
              {count != null && <span className="ml-1.5 whitespace-nowrap font-normal text-muted-foreground">{`· ${count}`}</span>}
            </span>
            {ledger && chevron}
          </span>
          {sub && <span className="text-xs font-normal text-muted-foreground">{sub}</span>}
        </span>
        <span className={cn(!ledger && SOW_PRICING_FIGURE, 'tabular-nums', !ledger && 'font-medium')}>{total}</span>
        {!ledger && chevron}
      </CollapsibleTrigger>
      <AnimatedCollapsibleContent open={open}>
        {children}
      </AnimatedCollapsibleContent>
    </Collapsible>
  )
}
