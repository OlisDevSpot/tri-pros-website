import type { ReactNode } from 'react'
import { ChevronDownIcon } from 'lucide-react'
import { SOW_PRICING_FIGURE, SOW_PRICING_ROW } from '@/features/proposal-flow/constants/sow-pricing-grid'
import { AnimatedCollapsibleContent, Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { cn } from '@/shared/lib/utils'

interface Props {
  label: string
  count: number
  total: string
  open: boolean
  onOpenChange: (open: boolean) => void
  children: ReactNode
}

export function SowPricingSummaryRow({ label, count, total, open, onOpenChange, children }: Props) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger
        className={cn(SOW_PRICING_ROW, 'w-full rounded-lg px-2 text-left text-sm transition-colors hover:bg-row-hover pressed:bg-row-press')}
      >
        <span className="font-medium">
          {label}
          <span className="ml-1 font-normal text-muted-foreground">
            {`· ${count}`}
          </span>
        </span>
        <span className={cn(SOW_PRICING_FIGURE, 'font-medium')}>{total}</span>
        <ChevronDownIcon
          className={cn('size-4 justify-self-center text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
          aria-hidden
        />
      </CollapsibleTrigger>
      <AnimatedCollapsibleContent open={open}>
        {children}
      </AnimatedCollapsibleContent>
    </Collapsible>
  )
}
