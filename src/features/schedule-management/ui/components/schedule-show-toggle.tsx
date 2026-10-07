'use client'

import type { ScheduleShow } from '@/features/schedule-management/constants/schedule-queries'

import { SCHEDULE_SHOW_LABELS, SCHEDULE_SHOW_VALUES } from '@/features/schedule-management/constants/schedule-queries'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface ScheduleShowToggleProps {
  value: ScheduleShow
  onChange: (value: ScheduleShow) => void
}

export function ScheduleShowToggle({ value, onChange }: ScheduleShowToggleProps) {
  return (
    <ToggleGroup
      type="single"
      variant="segmented"
      value={value}
      onValueChange={(next) => {
        const show = SCHEDULE_SHOW_VALUES.find(candidate => candidate === next)
        if (show) {
          onChange(show)
        }
      }}
      aria-label="Show"
      className="shrink-0"
    >
      {SCHEDULE_SHOW_VALUES.map(show => (
        <ToggleGroupItem key={show} value={show} className="h-9.5 px-3 lg:h-7.5">
          {SCHEDULE_SHOW_LABELS[show]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
