'use client'

import { FILTER_KEYS } from '@/features/analytics/constants/query-parsers'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { formatDayRange } from '@/features/analytics/lib/format-analytics'
import { ActiveFilterChips } from '@/features/analytics/ui/components/filter-bar/active-filter-chips'
import { AnalyticsFiltersControl } from '@/features/analytics/ui/components/filter-bar/analytics-filters-control'
import { PeriodPicker } from '@/features/analytics/ui/components/filter-bar/period-picker'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'

interface Props {
  firstDay: string | undefined
  lastDay: string | undefined
}

export function AnalyticsFilterBar({ firstDay, lastDay }: Props) {
  const [state, setUrlState] = useAnalyticsUrlState()
  const activeCount = FILTER_KEYS.reduce((count, key) => count + state[key].length, 0)
  return (
    <section aria-label="Filters" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <PeriodPicker firstDay={firstDay} lastDay={lastDay} />
        {firstDay && lastDay && <span className="text-sm tabular-nums text-muted-foreground">{formatDayRange(firstDay, lastDay)}</span>}
        <div className="ml-auto">
          <AnalyticsFiltersControl activeCount={activeCount} />
        </div>
      </div>
      {state.period === 'custom' && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="analytics-from">From</Label>
            <Input id="analytics-from" type="date" className="w-44" value={state.from} onChange={e => void setUrlState({ from: e.target.value })} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="analytics-to">To</Label>
            <Input id="analytics-to" type="date" className="w-44" value={state.to} onChange={e => void setUrlState({ to: e.target.value })} />
          </div>
        </div>
      )}
      <ActiveFilterChips />
    </section>
  )
}
