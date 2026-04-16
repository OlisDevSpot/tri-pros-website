'use client'

import type { ScheduleTableTab } from '@/features/schedule-management/types'
import type { CalendarViewType } from '@/shared/components/calendar/types'
import type { DataViewType } from '@/shared/components/data-view-type-toggle'
import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { PipelineScope } from '@/shared/domains/pipelines/ui/pipeline-scope-toggle'

import { FilterIcon, PlusIcon } from 'lucide-react'

import { SyncStatusBadge } from '@/features/schedule-management/ui/components/sync-status-badge'
import { DataViewTypeToggle } from '@/shared/components/data-view-type-toggle'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { PipelineScopeToggle } from '@/shared/domains/pipelines/ui/pipeline-scope-toggle'

interface ScheduleControlsBarProps {
  layout: DataViewType
  onLayoutChange: (layout: DataViewType) => void
  scope: PipelineScope
  onScopeChange: (scope: PipelineScope) => void
  activePipeline: Pipeline
  calendarView: CalendarViewType
  onCalendarViewChange: (view: CalendarViewType) => void
  showSaturday: boolean
  onToggleSaturday: () => void
  tableTab: ScheduleTableTab
  onTableTabChange: (tab: ScheduleTableTab) => void
  onNewActivity: () => void
}

export function ScheduleControlsBar({
  layout,
  onLayoutChange,
  scope,
  onScopeChange,
  activePipeline,
  calendarView,
  onCalendarViewChange,
  showSaturday,
  onToggleSaturday,
  tableTab,
  onTableTabChange,
  onNewActivity,
}: ScheduleControlsBarProps) {
  return (
    <div className="flex w-full items-center justify-between gap-2 lg:w-auto lg:justify-end">
      <PipelineScopeToggle value={scope} onChange={onScopeChange} activePipeline={activePipeline} />

      {layout === 'calendar' && (
        <>
          <div className="flex rounded-md border lg:order-1">
            <Button
              variant={calendarView === 'today' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-r-none"
              onClick={() => onCalendarViewChange('today')}
            >
              Today
            </Button>
            <Button
              variant={calendarView === 'week' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none border-x"
              onClick={() => onCalendarViewChange('week')}
            >
              Week
            </Button>
            <Button
              variant={calendarView === 'month' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-l-none"
              onClick={() => onCalendarViewChange('month')}
            >
              Month
            </Button>
          </div>

          {calendarView === 'week' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5 lg:order-0">
                  <FilterIcon size={14} />
                  <span className="hidden sm:inline">Days</span>
                  <Badge variant="secondary" className="px-1.5 text-[10px]">
                    {showSaturday ? '7' : '6'}
                  </Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-48 p-3">
                <p className="mb-3 text-sm font-medium">Visible Days</p>
                <label className="flex cursor-pointer items-center gap-2">
                  <Checkbox
                    checked={showSaturday}
                    onCheckedChange={onToggleSaturday}
                  />
                  <span className="text-sm">Show Saturday</span>
                </label>
              </PopoverContent>
            </Popover>
          )}
        </>
      )}

      {layout === 'table' && (
        <div className="flex rounded-md border lg:order-1">
          <Button
            variant={tableTab === 'meetings' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-r-none"
            onClick={() => onTableTabChange('meetings')}
          >
            Meetings
          </Button>
          <Button
            variant={tableTab === 'activities' ? 'default' : 'ghost'}
            size="sm"
            className="rounded-l-none"
            onClick={() => onTableTabChange('activities')}
          >
            Activities
          </Button>
        </div>
      )}

      <DataViewTypeToggle
        value={layout}
        onChange={onLayoutChange}
        availableViews={['calendar', 'table']}
        className="ml-auto lg:order-2 lg:ml-0"
      />

      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 lg:order-3"
        onClick={onNewActivity}
      >
        <PlusIcon size={14} />
        <span className="hidden sm:inline">New Activity</span>
      </Button>

      <div className="lg:order-4">
        <SyncStatusBadge />
      </div>
    </div>
  )
}
