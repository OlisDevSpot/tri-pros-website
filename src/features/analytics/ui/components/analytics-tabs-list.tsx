'use client'

import { ANALYTICS_TABS, TAB_LABELS } from '@/features/analytics/constants/tabs'
import { TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

interface Props {
  spendMissing: boolean
}

export function AnalyticsTabsList({ spendMissing }: Props) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 md:mx-0 md:px-0">
      <TabsList className="w-full min-w-max justify-start">
        {ANALYTICS_TABS.filter(t => t !== 'spend').map(t => (
          <TabsTrigger key={t} value={t} className="min-h-11">{TAB_LABELS[t]}</TabsTrigger>
        ))}
        <TabsTrigger value="spend" className="ml-auto min-h-11 gap-1.5">
          {TAB_LABELS.spend}
          {spendMissing && <span role="img" aria-label="Spend missing for some months" className="size-2 rounded-full bg-warning" />}
        </TabsTrigger>
      </TabsList>
    </div>
  )
}
