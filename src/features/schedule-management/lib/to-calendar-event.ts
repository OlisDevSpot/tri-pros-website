import type { inferRouterOutputs } from '@trpc/server'

import type { ScheduleActivityEvent } from '../types'

import type { AppRouter } from '@/trpc/routers/app'

type ActivityRow = inferRouterOutputs<AppRouter>['scheduleRouter']['activities']['list']['rows'][number]

/** The calendar windows on `scheduledFor`, so an unscheduled activity has no place on it. */
export function activityToCalendarEvent(activity: ActivityRow): ScheduleActivityEvent | null {
  if (!activity.scheduledFor) {
    return null
  }
  return {
    kind: 'activity',
    id: activity.id,
    activityId: activity.id,
    activityType: activity.type,
    startAt: activity.scheduledFor,
    title: activity.title,
    description: activity.description,
    entityType: activity.entityType,
    entityId: activity.entityId,
    ownerId: activity.ownerId,
    ownerName: activity.ownerName,
    dueAt: activity.dueAt,
    completedAt: activity.completedAt,
  }
}
