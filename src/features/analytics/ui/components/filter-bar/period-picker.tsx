'use client'

import { ANALYTICS_PERIODS } from '@/features/analytics/constants/dimensions'
import { PERIOD_LABELS } from '@/features/analytics/constants/labels'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface Props {
  /** "Custom" opens the date picker; the period only changes when dates are applied. */
  onCustom: () => void
  onPreset: () => void
}

export function PeriodPicker({ onCustom, onPreset }: Props) {
  const [{ period }, setUrlState] = useAnalyticsUrlState()
  const choose = (value: string) => {
    // Clicking the selected "Custom" again deselects it (an empty value): treat that as "edit the dates".
    if (value === 'custom' || (value === '' && period === 'custom')) {
      onCustom()
      return
    }
    const next = ANALYTICS_PERIODS.find(p => p === value)
    if (next) {
      onPreset()
      void setUrlState({ period: next, from: null, to: null, interval: null })
    }
  }

  // CSS picks the control, so the server render matches the client at every width.
  return (
    <>
      {/* A custom period leaves the select empty, so choosing "Custom…" again still fires and reopens the dates. */}
      <Select value={period === 'custom' ? '' : period} onValueChange={choose}>
        <SelectTrigger size="sm" className="w-36 border-0 bg-transparent shadow-none xl:hidden dark:bg-transparent" aria-label="Period">
          <SelectValue placeholder={<span className="text-foreground">{PERIOD_LABELS.custom}</span>} />
        </SelectTrigger>
        <SelectContent>
          {ANALYTICS_PERIODS.map(p => <SelectItem key={p} value={p}>{p === 'custom' ? `${PERIOD_LABELS.custom}…` : PERIOD_LABELS[p]}</SelectItem>)}
        </SelectContent>
      </Select>
      <ToggleGroup type="single" size="sm" variant="segmented" value={period} onValueChange={choose} aria-label="Period" className="max-xl:hidden">
        {ANALYTICS_PERIODS.map(p => <ToggleGroupItem key={p} value={p} className="h-7">{PERIOD_LABELS[p]}</ToggleGroupItem>)}
      </ToggleGroup>
    </>
  )
}
