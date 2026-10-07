'use client'

import type { CalendarViewType } from '@/shared/constants/enums'

import { PlusIcon, SettingsIcon } from 'lucide-react'

import { CALENDAR_VIEW_LABELS } from '@/features/schedule-management/constants/calendar-view-labels'
import { SyncStatusBadge } from '@/features/schedule-management/ui/components/sync-status-badge'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Separator } from '@/shared/components/ui/separator'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { calendarViewTypes } from '@/shared/constants/enums'

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
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              View
            </p>
            <ToggleGroup
              type="single"
              variant="segmented"
              size="sm"
              value={calendarView}
              onValueChange={(next) => {
                const view = calendarViewTypes.find(candidate => candidate === next)
                if (view) {
                  onCalendarViewChange(view)
                }
              }}
              aria-label="View"
              className="w-full"
            >
              {calendarViewTypes.map(view => (
                <ToggleGroupItem key={view} value={view} className="h-8 flex-1">
                  {CALENDAR_VIEW_LABELS[view]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          {calendarView === 'week' && (
            <>
              <Separator />
              <div className="px-4 py-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
