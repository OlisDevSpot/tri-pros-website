'use client'

import { ANALYTICS_PERIODS } from '@/features/analytics/constants/dimensions'
import { PERIOD_LABELS } from '@/features/analytics/constants/labels'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { useIsMobile } from '@/shared/hooks/use-mobile'

interface Props {
  firstDay: string | undefined
  lastDay: string | undefined
}

export function PeriodPicker({ firstDay, lastDay }: Props) {
  const [{ period }, setUrlState] = useAnalyticsUrlState()
  const isMobile = useIsMobile()
  const choose = (value: string) => {
    const next = ANALYTICS_PERIODS.find(p => p === value)
    if (!next) {
      return
    }
    // A custom period starts from the range on screen, so switching never jumps the numbers.
    void setUrlState(next === 'custom' ? { period: next, from: firstDay ?? '', to: lastDay ?? '' } : { period: next, from: null, to: null })
  }

  if (isMobile) {
    return (
      <Select value={period} onValueChange={choose}>
        <SelectTrigger className="w-44" aria-label="Period">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ANALYTICS_PERIODS.map(p => <SelectItem key={p} value={p}>{PERIOD_LABELS[p]}</SelectItem>)}
        </SelectContent>
      </Select>
    )
  }
  return (
    <ToggleGroup type="single" size="sm" variant="outline" value={period} onValueChange={choose} aria-label="Period">
      {ANALYTICS_PERIODS.map(p => <ToggleGroupItem key={p} value={p}>{PERIOD_LABELS[p]}</ToggleGroupItem>)}
    </ToggleGroup>
  )
}
