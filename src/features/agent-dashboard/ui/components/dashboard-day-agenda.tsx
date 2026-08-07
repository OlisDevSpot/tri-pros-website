'use client'

import type { MeetingListRow } from '@/shared/entities/meetings/dal/server/queries'

import { format } from 'date-fns'
import Link from 'next/link'

import { ROOTS } from '@/shared/config/roots'

import { DashboardMeetingCard } from './dashboard-meeting-card'

interface DashboardDayAgendaProps {
  rows: MeetingListRow[]
  selectedDay: Date
}

/**
 * Chronological rail of a single day's meetings — the same time-label +
 * cobalt-dot rail geometry as the (now-superseded) `DashboardTodayTimeline`,
 * generalized to any selected calendar day. `rows` must already be sorted
 * chronologically by the caller's query.
 */
export function DashboardDayAgenda({ rows, selectedDay }: DashboardDayAgendaProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-start gap-0.5 py-2">
        <p className="text-sm text-muted-foreground">
          No meetings on
          {' '}
          {format(selectedDay, 'EEE, MMM d')}
        </p>
        <Link
          href={ROOTS.dashboard.schedule()}
          className="-mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-primary transition-colors duration-200 hover:bg-accent/50"
        >
          Book one →
        </Link>
      </div>
    )
  }

  return (
    <ol className="flex flex-col">
      {rows.map(row => (
        <DayAgendaRow key={row.id} row={row} />
      ))}
    </ol>
  )
}

/** One rail row: time label + hairline/dot + the meeting card. */
function DayAgendaRow({ row }: { row: MeetingListRow }) {
  return (
    <li className="flex gap-3">
      <div className="flex w-12 shrink-0 justify-end pt-2">
        <span className="font-mono text-[0.72rem] tabular-nums text-muted-foreground">
          {format(new Date(row.scheduledFor), 'h:mm a')}
        </span>
      </div>

      <div className="relative shrink-0">
        <div className="h-full w-px bg-border" />
        <span className="absolute left-1/2 top-2.5 size-1.5 -translate-x-1/2 rounded-full bg-primary" />
      </div>

      <div className="flex-1 pb-3 pt-1">
        <DashboardMeetingCard row={row} />
      </div>
    </li>
  )
}
