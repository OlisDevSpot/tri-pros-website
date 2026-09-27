'use client'

import type { CalculatorTab } from '@/features/calculators/constants/query-parsers'

import { useQueryState } from 'nuqs'

import { calculatorTabParser } from '@/features/calculators/constants/query-parsers'
import { NetWorthProjectionCalculator } from '@/features/calculators/net-worth-projection-calculator/ui/views/net-worth-projection-calculator'
import { ScopePricingCalculator } from '@/features/calculators/scope-pricing-calculator/ui/views/scope-pricing-calculator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

// Nothing entered here is saved: the calculators are a live aid in the home until results can be kept against a meeting or proposal.
export function CalculatorsView() {
  const [tab, setTab] = useQueryState('tab', calculatorTabParser)

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Calculators</h1>
      </header>

      <Tabs className="flex min-h-0 flex-1 flex-col" onValueChange={value => setTab(value as CalculatorTab)} value={tab}>
        <TabsList>
          <TabsTrigger className="min-h-11" value="net-worth-projection">Net-worth Projection</TabsTrigger>
          <TabsTrigger className="min-h-11" value="scope-pricing">Scope Pricing</TabsTrigger>
        </TabsList>

        <TabsContent className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden" forceMount value="net-worth-projection">
          <NetWorthProjectionCalculator />
        </TabsContent>
        <TabsContent className="min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden" forceMount value="scope-pricing">
          <ScopePricingCalculator />
        </TabsContent>
      </Tabs>
    </div>
  )
}
