'use client'

import type { CalendarViewType } from '@/shared/components/calendar/types'
import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { PipelineScope } from '@/shared/domains/pipelines/ui/pipeline-scope-toggle'

import { PlusIcon, SlidersHorizontalIcon } from 'lucide-react'

import { SyncStatusBadge } from '@/features/schedule-management/ui/components/sync-status-badge'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { Separator } from '@/shared/components/ui/separator'
import { PipelineScopeToggle } from '@/shared/domains/pipelines/ui/pipeline-scope-toggle'

interface ScheduleControlsBarProps {
  scope: PipelineScope
  onScopeChange: (scope: PipelineScope) => void
  activePipeline: Pipeline
  calendarView: CalendarViewType
  onCalendarViewChange: (view: CalendarViewType) => void
  showSaturday: boolean
  onToggleSaturday: () => void
  onNewActivity: () => void
}

export function ScheduleControlsBar({
  scope,
  onScopeChange,
  activePipeline,
  calendarView,
  onCalendarViewChange,
  showSaturday,
  onToggleSaturday,
  onNewActivity,
}: ScheduleControlsBarProps) {
  // Count non-default filter values so users see at-a-glance state
  const activeFilterCount = (showSaturday ? 1 : 0)

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      <PipelineScopeToggle value={scope} onChange={onScopeChange} activePipeline={activePipeline} />

      <div className="flex rounded-md border">
        <Button
          variant={calendarView === 'today' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 rounded-r-none px-2.5 sm:px-3"
          onClick={() => onCalendarViewChange('today')}
        >
          <span className="sm:hidden">D</span>
          <span className="hidden sm:inline">Today</span>
        </Button>
        <Button
          variant={calendarView === 'week' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 rounded-none border-x px-2.5 sm:px-3"
          onClick={() => onCalendarViewChange('week')}
        >
          <span className="sm:hidden">W</span>
          <span className="hidden sm:inline">Week</span>
        </Button>
        <Button
          variant={calendarView === 'month' ? 'default' : 'ghost'}
          size="sm"
          className="h-8 rounded-l-none px-2.5 sm:px-3"
          onClick={() => onCalendarViewChange('month')}
        >
          <span className="sm:hidden">M</span>
          <span className="hidden sm:inline">Month</span>
        </Button>
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            aria-label={
              activeFilterCount > 0
                ? `Schedule filters, ${activeFilterCount} active`
                : 'Schedule filters'
            }
          >
            <SlidersHorizontalIcon className="size-3.5 opacity-80" aria-hidden />
            <span className="hidden sm:inline">Filters</span>
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="px-1.5 text-[10px]">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64 p-0">
          <div className="border-b px-4 py-2.5">
            <p className="text-xs font-semibold tracking-wide text-foreground">Schedule Filters</p>
          </div>

          {calendarView === 'week' && (
            <div className="px-4 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Visible Days
              </p>
              <label className="flex cursor-pointer items-center gap-2">
                <Checkbox checked={showSaturday} onCheckedChange={onToggleSaturday} />
                <span className="text-sm">Show Saturday</span>
              </label>
            </div>
          )}

          {calendarView === 'week' && <Separator />}

          <div className="px-4 py-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Calendar Sync
            </p>
            <SyncStatusBadge />
          </div>
        </PopoverContent>
      </Popover>

      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1.5"
        onClick={onNewActivity}
        aria-label="New activity"
      >
        <PlusIcon size={14} />
        <span className="hidden sm:inline">New Activity</span>
      </Button>
    </div>
  )
}
