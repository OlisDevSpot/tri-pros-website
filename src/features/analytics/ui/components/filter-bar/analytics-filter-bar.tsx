'use client'

import { CalendarIcon } from 'lucide-react'
import { useRef, useState } from 'react'

import { FILTER_KEYS } from '@/features/analytics/constants/query-parsers'
import { useAnalyticsRange } from '@/features/analytics/hooks/use-analytics-range'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { ActiveFilterChips } from '@/features/analytics/ui/components/filter-bar/active-filter-chips'
import { AnalyticsFiltersControl } from '@/features/analytics/ui/components/filter-bar/analytics-filters-control'
import { CustomRangePicker } from '@/features/analytics/ui/components/filter-bar/custom-range-picker'
import { PeriodPicker } from '@/features/analytics/ui/components/filter-bar/period-picker'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'

/** Timeframe and filters as one control group: period, the range it resolves to (click to pick your own), then the filters. */
export function AnalyticsFilterBar() {
  const [state, setUrlState] = useAnalyticsUrlState()
  const [picking, setPicking] = useState(false)
  const toolbar = useRef<HTMLDivElement>(null)
  const activeCount = FILTER_KEYS.reduce((count, key) => count + state[key].length, 0)
  const { firstDay, lastDay, label: range } = useAnalyticsRange()
  return (
    <section aria-label="Timeframe and filters" className="flex min-w-0 flex-col items-end gap-2">
      <Popover open={picking} onOpenChange={setPicking}>
        <PopoverAnchor asChild>
          <div ref={toolbar} className="flex max-w-full items-center rounded-lg border border-border bg-card p-0.5 shadow-xs">
            <PeriodPicker onCustom={() => setPicking(true)} onPreset={() => setPicking(false)} />
            <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border" />
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label={`${range}, pick your own dates`}
                className="flex h-7 items-center gap-1.5 rounded-md px-2 text-xs whitespace-nowrap text-muted-foreground tabular-nums outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring max-sm:hidden"
              >
                <CalendarIcon className="size-3.5" aria-hidden="true" />
                {range}
              </button>
            </PopoverTrigger>
            <span aria-hidden="true" className="mx-1 h-5 w-px shrink-0 bg-border max-sm:hidden" />
            <AnalyticsFiltersControl activeCount={activeCount} />
          </div>
        </PopoverAnchor>
        <PopoverContent
          align="end"
          className="w-auto max-w-[calc(100vw-2rem)] p-0"
          // The toolbar opens and closes the picker itself; the phone's select hands focus back to it on close, which must not dismiss it.
          onInteractOutside={(event) => {
            if (event.target instanceof Node && toolbar.current?.contains(event.target)) {
              event.preventDefault()
            }
          }}
        >
          <CustomRangePicker
            firstDay={firstDay}
            lastDay={lastDay}
            onCancel={() => setPicking(false)}
            onApply={(from, to) => {
              setPicking(false)
              void setUrlState({ period: 'custom', from, to, interval: null }, { history: 'push' })
            }}
          />
        </PopoverContent>
      </Popover>
      <ActiveFilterChips />
    </section>
  )
}
