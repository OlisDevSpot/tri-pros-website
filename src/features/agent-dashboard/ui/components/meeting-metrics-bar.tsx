'use client'

import type { MeetingPipelineItem } from '@/shared/dal/server/dashboard/get-pipeline-items'

import { Card, CardContent } from '@/shared/components/ui/card'

interface Props {
  items: MeetingPipelineItem[]
}

function isSameDay(dateStr: string, target: Date): boolean {
  const d = new Date(dateStr)
  return d.getFullYear() === target.getFullYear()
    && d.getMonth() === target.getMonth()
    && d.getDate() === target.getDate()
}

function isThisWeek(dateStr: string, now: Date): boolean {
  const d = new Date(dateStr)
  const startOfWeek = new Date(now)
  startOfWeek.setDate(now.getDate() - now.getDay())
  startOfWeek.setHours(0, 0, 0, 0)
  const endOfWeek = new Date(startOfWeek)
  endOfWeek.setDate(startOfWeek.getDate() + 7)
  return d >= startOfWeek && d < endOfWeek
}

export function MeetingMetricsBar({ items }: Props) {
  const now = new Date()
  const dateFor = (m: MeetingPipelineItem) => m.scheduledFor ?? m.createdAt
  const todayCount = items.filter(m => isSameDay(dateFor(m), now)).length
  const weekCount = items.filter(m => isThisWeek(dateFor(m), now)).length

  return (
    <div className="grid grid-cols-2 gap-3">
      <Card>
        <CardContent className="py-3 text-center">
          <span className="text-2xl font-bold">{todayCount}</span>
          <p className="text-xs text-muted-foreground mt-0.5">Meetings Today</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="py-3 text-center">
          <span className="text-2xl font-bold">{weekCount}</span>
          <p className="text-xs text-muted-foreground mt-0.5">This Week</p>
        </CardContent>
      </Card>
    </div>
  )
}
