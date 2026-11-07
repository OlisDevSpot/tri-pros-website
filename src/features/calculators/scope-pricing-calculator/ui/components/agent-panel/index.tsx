'use client'

import type { ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'
import type { QuoteResult, SolveMultiplierResult } from '@/features/calculators/scope-pricing-calculator/types'

import { SlidersHorizontalIcon } from 'lucide-react'
import { useFormContext, useWatch } from 'react-hook-form'

import { tradesInQuote } from '@/features/calculators/scope-pricing-calculator/lib/trades-in-quote'
import { AgentReadouts } from '@/features/calculators/scope-pricing-calculator/ui/components/agent-panel/agent-readouts'
import { MultiplierControl } from '@/features/calculators/scope-pricing-calculator/ui/components/agent-panel/multiplier-control'
import { ScopeMultiplierOverrides } from '@/features/calculators/scope-pricing-calculator/ui/components/agent-panel/scope-multiplier-overrides'
import { TargetPriceControl } from '@/features/calculators/scope-pricing-calculator/ui/components/agent-panel/target-price-control'
import { UnitCostsList } from '@/features/calculators/scope-pricing-calculator/ui/components/agent-panel/unit-costs-list'
import { Button } from '@/shared/components/ui/button'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'

interface Props {
  config: ScopePricingConfig
  quote: QuoteResult
  solved: SolveMultiplierResult | null
}

export function AgentPanel({ config, quote, solved }: Props) {
  const { control } = useFormContext<ScopePricingFormValues>()
  // Quote lines carry no pricing key or override, so the form is the source for both.
  const lines = useWatch({ control, name: 'lines' })
  const pricingKeys = lines.flatMap(line => line.kind === 'formula' ? [line.pricingKey] : [])

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button aria-label="Open agent tools" className="size-11 shrink-0 text-muted-foreground" size="icon" type="button" variant="ghost">
          <SlidersHorizontalIcon />
        </Button>
      </SheetTrigger>
      <SheetContent className="overflow-y-auto" data-agent-only side="right">
        <SheetHeader>
          <SheetTitle>Agent tools</SheetTitle>
          <SheetDescription>Only you see this panel.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-6 px-4 pb-6">
          <AgentReadouts quote={quote} />
          <MultiplierControl appliedMultiplier={quote.multiplier} config={config} pricingKeys={pricingKeys} targetActive={solved != null && 'multiplier' in solved} />
          <TargetPriceControl floor={config.multiplier.floor} solved={solved} />
          <ScopeMultiplierOverrides config={config} lines={lines} quote={quote} />
          <UnitCostsList config={config} trades={tradesInQuote(quote)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
