'use client'

import type { CalendarViewType } from '@/shared/components/calendar/types'

import { PlusIcon, SettingsIcon } from 'lucide-react'

import { SyncStatusBadge } from '@/features/schedule-management/ui/components/sync-status-badge'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Separator } from '@/shared/components/ui/separator'

interface ScheduleControlsBarProps {
  calendarView: CalendarViewType
  onCalendarViewChange: (view: CalendarViewType) => void
  showSaturday: boolean
  onToggleSaturday: () => void
  onNewActivity: () => void
}

export function ScheduleControlsBar({
  calendarView,
  onCalendarViewChange,
  showSaturday,
  onToggleSaturday,
  onNewActivity,
}: ScheduleControlsBarProps) {
  return (
    <div className="flex items-center gap-1.5">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            aria-label="Schedule settings"
          >
            <SettingsIcon className="size-4 opacity-80" aria-hidden />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-0">
          <div className="border-b px-4 py-2.5">
            <p className="text-xs font-semibold tracking-wide text-foreground">Schedule Settings</p>
          </div>

          <div className="px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              View
            </p>
            <div className="flex rounded-md border">
              <Button
                variant={calendarView === 'today' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 flex-1 rounded-r-none"
                onClick={() => onCalendarViewChange('today')}
              >
                Day
              </Button>
              <Button
                variant={calendarView === 'week' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 flex-1 rounded-none border-x"
                onClick={() => onCalendarViewChange('week')}
              >
                Week
              </Button>
              <Button
                variant={calendarView === 'month' ? 'default' : 'ghost'}
                size="sm"
                className="h-8 flex-1 rounded-l-none"
                onClick={() => onCalendarViewChange('month')}
              >
                Month
              </Button>
            </div>
          </div>

          {calendarView === 'week' && (
            <>
              <Separator />
              <div className="px-4 py-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Visible Days
                </p>
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox checked={showSaturday} onCheckedChange={onToggleSaturday} />
                  <span className="text-sm">Show Saturday</span>
                </label>
              </div>
            </>
          )}

          <Separator />

          <div className="px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Calendar Sync
            </p>
            <SyncStatusBadge />
          </div>
        </PopoverContent>
      </Popover>

      <Button
        size="icon"
        variant="outline"
        className="h-8 w-8"
        onClick={onNewActivity}
        aria-label="New activity"
      >
        <PlusIcon className="size-4" />
      </Button>
    </div>
  )
}
