'use client'

import type { MeetingCalendarEvent } from '@/features/meetings/types'

import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area'
import { isSameDay, parseISO } from 'date-fns'
import { motion, useMotionValueEvent, useScroll } from 'motion/react'
import { useMemo, useRef, useState } from 'react'

import { TODAY_VIEW_BUCKETS } from '@/features/meetings/constants/today-view-buckets'
import { getEventsForBucket, getUniqueOwners, groupEventsByOwner } from '@/features/meetings/lib/today-view-helpers'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { ScrollBar } from '@/shared/components/ui/scroll-area'
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

interface MeetingTodayViewProps {
  events: MeetingCalendarEvent[]
  currentDate: Date
  renderCard: (event: MeetingCalendarEvent) => React.ReactNode
}

export function MeetingTodayView({
  events,
  currentDate,
  renderCard,
}: MeetingTodayViewProps) {
  const todayEvents = useMemo(
    () => events.filter(e => isSameDay(parseISO(e.startAt), currentDate)),
    [events, currentDate],
  )

  const owners = useMemo(() => getUniqueOwners(todayEvents), [todayEvents])
  const eventsByOwner = useMemo(() => groupEventsByOwner(todayEvents), [todayEvents])

  const viewportRef = useRef<HTMLDivElement>(null)
  const { scrollX } = useScroll({ container: viewportRef })
  const [collapsed, setCollapsed] = useState(false)

  useMotionValueEvent(scrollX, 'change', (x) => {
    const shouldCollapse = x > SCROLL_COLLAPSE_THRESHOLD
    if (shouldCollapse !== collapsed) {
      setCollapsed(shouldCollapse)
    }
  })

  const gridCols = makeGridCols(collapsed ? LABEL_COL_COLLAPSED : LABEL_COL_EXPANDED)
  const gridMinWidth = (collapsed ? LABEL_COL_COLLAPSED : LABEL_COL_EXPANDED) + BUCKET_COUNT * BUCKET_COL_MIN_WIDTH

  if (owners.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-muted-foreground">No meetings scheduled for this day</span>
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

          {/* Swimlane rows */}
          {owners.map(owner => (
            <SwimlaneRow
              key={owner.id}
              owner={owner}
              ownerEvents={eventsByOwner.get(owner.id) ?? []}
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
  owner: { id: string, name: string | null, image: string | null }
  ownerEvents: MeetingCalendarEvent[]
  renderCard: (event: MeetingCalendarEvent) => React.ReactNode
  collapsed: boolean
  gridCols: string
}

function SwimlaneRow({ owner, ownerEvents, renderCard, collapsed, gridCols }: SwimlaneRowProps) {
  const initials = (owner.name ?? 'U')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <motion.div
      className="grid border-b border-dashed"
      initial={false}
      animate={{ gridTemplateColumns: gridCols }}
      transition={TRANSITION}
    >
      {/* Owner label — sticky left, collapses to avatar-only on scroll */}
      <div className="sticky left-0 z-10 flex items-center gap-2 overflow-hidden border-r bg-background px-3 py-3">
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarImage src={owner.image ?? undefined} alt={owner.name ?? 'User'} />
          <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
        </Avatar>
        <motion.span
          className="truncate text-xs font-medium leading-6 whitespace-nowrap"
          animate={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : 'auto' }}
          transition={TRANSITION}
        >
          {owner.name ?? 'Unknown'}
        </motion.span>
      </div>

      {/* Bucket cells */}
      {TODAY_VIEW_BUCKETS.map((bucket) => {
        const bucketEvents = getEventsForBucket(ownerEvents, bucket)

        return (
          <div
            key={bucket.id}
            className={cn(
              'border-r p-1.5 last:border-r-0 min-h-[6rem]',
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
                    'min-w-[10rem]',
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
