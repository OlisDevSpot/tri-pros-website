'use client'

import type { DateRange } from 'react-day-picker'

import { useState } from 'react'

import { dateToDay, dayToDate } from '@/features/analytics/lib/calendar-days'
import { formatDayRange } from '@/features/analytics/lib/format-analytics'
import { Button } from '@/shared/components/ui/button'
import { Calendar } from '@/shared/components/ui/calendar'
import { useIsMobile } from '@/shared/hooks/use-mobile'

interface Props {
  firstDay: string
  lastDay: string
  onApply: (from: string, to: string) => void
  onCancel: () => void
}

/** A draft range: nothing changes on the page until Apply, so picking two days never loads a half-chosen report. */
export function CustomRangePicker({ firstDay, lastDay, onApply, onCancel }: Props) {
  const isMobile = useIsMobile()
  const [draft, setDraft] = useState<DateRange | undefined>(() => ({ from: dayToDate(firstDay), to: dayToDate(lastDay) }))
  const from = draft?.from ? dateToDay(draft.from) : null
  const to = draft?.to ? dateToDay(draft.to) : null
  return (
    <div className="flex flex-col">
      <Calendar
        mode="range"
        selected={draft}
        onSelect={setDraft}
        defaultMonth={draft?.from}
        numberOfMonths={isMobile ? 1 : 2}
        showOutsideDays={isMobile}
      />
      <div className="flex items-center justify-between gap-3 border-t border-border px-3 py-2.5">
        <span className="text-xs text-muted-foreground tabular-nums">
          {from && to ? formatDayRange(from, to) : from ? 'Pick the last day' : 'Pick the first day'}
        </span>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button type="button" size="sm" disabled={!from || !to} onClick={() => from && to && onApply(from, to)}>Apply</Button>
        </div>
      </div>
    </div>
  )
}
