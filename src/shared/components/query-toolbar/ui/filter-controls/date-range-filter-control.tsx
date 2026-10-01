'use client'

import type { DateRange as ReactDayPickerRange } from 'react-day-picker'

import type { FilterDefinition } from '@/shared/dal/client/lib/types'
import type { DateRange } from '@/shared/dal/lib/query/range-schemas'

import { CalendarIcon } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import { Calendar } from '@/shared/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { formatBusinessTime } from '@/shared/lib/business-time'
import { cn } from '@/shared/lib/utils'

interface Props {
  definition: Extract<FilterDefinition, { type: 'date-range' }>
  value: DateRange | undefined
  onChange: (value: DateRange | undefined) => void
}

const RANGE_LABEL_DATE: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' }

function fmtRangeLabel(value: DateRange | undefined, fallback: string): string {
  if (!value) {
    return fallback
  }
  const fromStr = value.from ? formatBusinessTime(value.from, RANGE_LABEL_DATE) : '…'
  const toStr = value.to ? formatBusinessTime(value.to, RANGE_LABEL_DATE) : '…'
  return `${fromStr} → ${toStr}`
}

export function DateRangeFilterControl({ definition, value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()

  const calendarSelected: ReactDayPickerRange | undefined = value
    ? {
        from: value.from ? new Date(value.from) : undefined,
        to: value.to ? new Date(value.to) : undefined,
      }
    : undefined

  function handlePreset(presetValue: string) {
    const preset = definition.presets?.find(p => p.value === presetValue)
    if (!preset) {
      return
    }
    onChange(preset.getRange())
  }

  function handleCalendarChange(range: ReactDayPickerRange | undefined) {
    if (!range || (!range.from && !range.to)) {
      onChange(undefined)
      return
    }
    onChange({
      from: range.from?.toISOString(),
      to: range.to?.toISOString(),
    })
  }

  const hasPresets = (definition.presets?.length ?? 0) > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn('w-full justify-start text-left', !value && 'text-muted-foreground')}
        >
          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
          <span className="truncate">{fmtRangeLabel(value, 'Pick dates')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        {hasPresets && (
          <div className="flex items-center justify-between gap-2 border-b border-border/50 p-2">
            <Select onValueChange={handlePreset}>
              <SelectTrigger size="sm" className="flex-1">
                <SelectValue placeholder="Quick range…" />
              </SelectTrigger>
              <SelectContent>
                {definition.presets!.map(preset => (
                  <SelectItem key={preset.value} value={preset.value}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {value && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(undefined)}
              >
                Clear
              </Button>
            )}
          </div>
        )}
        <Calendar
          mode="range"
          selected={calendarSelected}
          onSelect={handleCalendarChange}
          numberOfMonths={isMobile ? 1 : 2}
          showOutsideDays={isMobile}
        />
      </PopoverContent>
    </Popover>
  )
}
