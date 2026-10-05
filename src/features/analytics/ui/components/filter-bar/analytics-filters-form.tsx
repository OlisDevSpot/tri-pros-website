'use client'

import { useAnalyticsLabels } from '@/features/analytics/hooks/use-analytics-labels'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { buildFilterFields } from '@/features/analytics/lib/filter-fields'
import { filterUpdate } from '@/features/analytics/lib/filter-update'
import { MultiSelectFilterControl } from '@/shared/components/query-toolbar/ui/filter-controls/multi-select-filter-control'
import { Label } from '@/shared/components/ui/label'

export function AnalyticsFiltersForm() {
  const [state, setUrlState] = useAnalyticsUrlState()
  const labels = useAnalyticsLabels()
  return (
    <div className="flex flex-col gap-4">
      {buildFilterFields(labels.options, labels.closers).map(({ key, definition }) => (
        <div key={key} className="flex flex-col gap-1.5">
          <Label>{definition.label}</Label>
          <MultiSelectFilterControl
            definition={definition}
            value={state[key]}
            onChange={values => void setUrlState(filterUpdate(key, values ?? []))}
          />
        </div>
      ))}
    </div>
  )
}
