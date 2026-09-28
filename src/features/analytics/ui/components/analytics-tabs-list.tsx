'use client'

import { WalletIcon } from 'lucide-react'

import { ANALYTICS_TABS, TAB_LABELS } from '@/features/analytics/constants/tabs'
import { TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

interface Props {
  spendMissing: boolean
}

/** Report tabs read the numbers; Spend, set apart at the end, is where they are entered. */
export function AnalyticsTabsList({ spendMissing }: Props) {
  return (
    <div className="-mx-4 overflow-x-auto overflow-y-hidden px-4 [scrollbar-width:none] md:mx-0 md:px-0">
      <TabsList variant="underline" className="min-w-max">
        {ANALYTICS_TABS.filter(t => t !== 'spend').map(t => (
          <TabsTrigger key={t} value={t} className="min-h-11 md:min-h-10">{TAB_LABELS[t]}</TabsTrigger>
        ))}
        <span aria-hidden="true" className="mx-3 h-5 w-px self-center bg-border md:ml-auto" />
        <TabsTrigger value="spend" className="min-h-11 gap-1.5 md:min-h-10">
          <WalletIcon className="size-4" aria-hidden="true" />
          {TAB_LABELS.spend}
          {spendMissing && <span role="img" aria-label="Spend missing for some months" className="size-2 rounded-full bg-warning" />}
        </TabsTrigger>
      </TabsList>
    </div>
  )
}
