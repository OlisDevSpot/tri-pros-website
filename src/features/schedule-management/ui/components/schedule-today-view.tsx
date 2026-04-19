'use client'

import type { SwimlaneCombo } from '@/features/schedule-management/lib/today-view-helpers'
import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'

import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import { isSameDay, parseISO } from 'date-fns'
import { motion } from 'motion/react'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { getEventsForBucket, getUniqueCombos, groupEventsByParticipantCombo } from '@/features/schedule-management/lib/today-view-helpers'
import { ScrollBar } from '@/shared/components/ui/scroll-area'
import { TODAY_VIEW_BUCKETS } from '@/shared/constants/today-view-buckets'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'
import { cn } from '@/shared/lib/utils'

const BUCKET_COUNT = TODAY_VIEW_BUCKETS.length
const LABEL_COL_EXPANDED = 140
const LABEL_COL_COLLAPSED = 48
const SCROLL_COLLAPSE_THRESHOLD = 40
const BUCKET_COL_MIN_WIDTH = 380
const TRANSITION = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } as const

function makeGridCols(labelWidth: number): string {
  return `${labelWidth}px repeat(${BUCKET_COUNT}, minmax(${BUCKET_COL_MIN_WIDTH}px, 1fr))`
}

interface ScheduleTodayViewProps {
  events: ScheduleCalendarEvent[]
  currentDate: Date
  renderCard: (event: ScheduleCalendarEvent) => React.ReactNode
}

export function ScheduleTodayView({
  events,
  currentDate,
  renderCard,
}: ScheduleTodayViewProps) {
  const todayEvents = useMemo(
    () => events.filter(e => isSameDay(parseISO(e.startAt), currentDate)),
    [events, currentDate],
  )

  const combos = useMemo(() => getUniqueCombos(todayEvents), [todayEvents])
  const eventsByCombo = useMemo(() => groupEventsByParticipantCombo(todayEvents), [todayEvents])

  const viewportRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState(false)

  const handleScroll = useCallback(() => {
    const el = viewportRef.current
    if (!el) {
      return
    }
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setCollapsed(el.scrollLeft > SCROLL_COLLAPSE_THRESHOLD)
  }, [])

  // Attach scroll listener + reset scroll position when date changes
  useLayoutEffect(() => {
    const el = viewportRef.current
    if (!el) {
      return
    }
    // Reset scroll position on date navigation — handleScroll reads scrollLeft=0 → collapsed=false
    el.scrollLeft = 0
    handleScroll()
    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleScroll)
  }, [currentDate, handleScroll])

  const gridCols = makeGridCols(collapsed ? LABEL_COL_COLLAPSED : LABEL_COL_EXPANDED)
  const gridMinWidth = (collapsed ? LABEL_COL_COLLAPSED : LABEL_COL_EXPANDED) + BUCKET_COUNT * BUCKET_COL_MIN_WIDTH

  if (combos.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-muted-foreground">No events scheduled for this day</span>
      </div>
    )
  }

  return (
    <ScrollAreaPrimitive.Root className="relative h-full" type="always">
      <ScrollAreaPrimitive.Viewport ref={viewportRef} className="size-full rounded-[inherit]">
        <div className="flex min-h-full flex-col" style={{ minWidth: `${gridMinWidth}px` }}>
          {/* Bucket header row */}
          <motion.div
            className="sticky top-0 z-10 grid border-b bg-background"
            initial={false}
            animate={{ gridTemplateColumns: gridCols }}
            transition={TRANSITION}
          >
            {/* Corner cell */}
            <div className="sticky left-0 z-20 overflow-hidden border-r bg-background px-3 py-2">
              <motion.span
                className="text-xs font-medium text-muted-foreground whitespace-nowrap"
                animate={{ opacity: collapsed ? 0 : 1 }}
                transition={TRANSITION}
              >
                Agent
              </motion.span>
            </div>

            {TODAY_VIEW_BUCKETS.map(bucket => (
              <div
                key={bucket.id}
                className="border-r px-3 py-2 text-center last:border-r-0"
              >
                <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
                  {bucket.label}
                </span>
                <span className="text-xs font-medium text-muted-foreground sm:hidden">
                  {bucket.shortLabel}
                </span>
              </div>
            ))}
          </motion.div>

          {/* Swimlane rows — one per unique participant combo */}
          {combos.map(combo => (
            <SwimlaneRow
              key={combo.key}
              combo={combo}
              comboEvents={eventsByCombo.get(combo.key) ?? []}
              renderCard={renderCard}
              collapsed={collapsed}
              gridCols={gridCols}
            />
          ))}

          {/* Filler row — extends vertical column borders to the bottom */}
          <motion.div
            className="grid flex-1"
            initial={false}
            animate={{ gridTemplateColumns: gridCols }}
            transition={TRANSITION}
          >
            <div className="sticky left-0 border-r bg-background" />
            {TODAY_VIEW_BUCKETS.map(bucket => (
              <div key={bucket.id} className="border-r last:border-r-0" />
            ))}
          </motion.div>
        </div>
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar orientation="horizontal" />
      <ScrollBar orientation="vertical" />
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  )
}

interface SwimlaneRowProps {
  combo: SwimlaneCombo
  comboEvents: ScheduleCalendarEvent[]
  renderCard: (event: ScheduleCalendarEvent) => React.ReactNode
  collapsed: boolean
  gridCols: string
}

function SwimlaneRow({ combo, comboEvents, renderCard, collapsed, gridCols }: SwimlaneRowProps) {
  const comboLabel = combo.participants
    .map(p => p.name ?? 'Unknown')
    .join(' · ')

  return (
    <motion.div
      className="grid border-b border-dashed"
      initial={false}
      animate={{ gridTemplateColumns: gridCols }}
      transition={TRANSITION}
    >
      {/* Combo label — sticky left, collapses to avatar-stack-only on scroll */}
      <div className="sticky left-0 z-10 flex items-center gap-2 overflow-hidden border-r bg-background px-3 py-3">
        <UserOverviewCard.Stack users={combo.participants} max={3} size="sm" />
        <motion.span
          className="truncate text-xs font-medium leading-6 whitespace-nowrap"
          animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto' }}
          transition={TRANSITION}
        >
          {comboLabel}
        </motion.span>
      </div>

      {/* Bucket cells */}
      {TODAY_VIEW_BUCKETS.map((bucket) => {
        const bucketEvents = getEventsForBucket(comboEvents, bucket)

        return (
          <div
            key={bucket.id}
            className={cn(
              'border-r p-1.5 last:border-r-0 min-h-24',
              bucketEvents.length === 0 && 'bg-muted/20',
            )}
          >
            <div className={cn(
              'flex h-full gap-2',
              bucketEvents.length <= 1 ? 'flex-col' : 'flex-row',
            )}
            >
              {bucketEvents.map(event => (
                <div
                  key={event.id}
                  className={cn(
                    'min-w-40',
                    bucketEvents.length <= 1 ? 'w-full' : 'flex-1',
                  )}
                >
                  {renderCard(event)}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </motion.div>
  )
}
