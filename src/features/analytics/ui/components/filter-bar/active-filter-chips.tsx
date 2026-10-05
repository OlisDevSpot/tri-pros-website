'use client'

import { XIcon } from 'lucide-react'

import { CLEARED_FILTERS, FILTER_KEYS } from '@/features/analytics/constants/query-parsers'
import { useAnalyticsLabels } from '@/features/analytics/hooks/use-analytics-labels'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { filterUpdate } from '@/features/analytics/lib/filter-update'
import { filterValueLabel } from '@/features/analytics/lib/format-analytics'
import { Button } from '@/shared/components/ui/button'

export function ActiveFilterChips() {
  const [state, setUrlState] = useAnalyticsUrlState()
  const labels = useAnalyticsLabels()
  const chips = FILTER_KEYS.flatMap((key) => {
    const values: readonly string[] = state[key]
    return values.map(value => ({ key, value, rest: values.filter(v => v !== value), label: filterValueLabel(key, value, labels) }))
  })
  if (chips.length === 0) {
    return null
  }
  return (
    <ul aria-label="Active filters" className="flex flex-wrap gap-2">
      {chips.map(chip => (
        <li key={`${chip.key}:${chip.value}`}>
          <Button
            variant="secondary"
            size="sm"
            className="h-7 gap-1 rounded-full"
            aria-label={`Remove ${chip.label}`}
            onClick={() => void setUrlState(filterUpdate(chip.key, chip.rest))}
          >
            {chip.label}
            <XIcon className="size-3" aria-hidden="true" />
          </Button>
        </li>
      ))}
      <li>
        <Button variant="ghost" size="sm" className="h-7" onClick={() => void setUrlState(CLEARED_FILTERS)}>
          Clear all
        </Button>
      </li>
    </ul>
  )
}
