import type { inferRouterOutputs } from '@trpc/server'

import type { ScheduleActivityEvent } from '../types'

import type { AppRouter } from '@/trpc/routers/app'

type ActivityRow = inferRouterOutputs<AppRouter>['scheduleRouter']['activities']['list']['rows'][number]

export function activityToCalendarEvent(activity: ActivityRow): ScheduleActivityEvent {
  return {
    kind: 'activity',
    id: activity.id,
    activityId: activity.id,
    activityType: activity.type,
    startAt: activity.scheduledFor ?? activity.dueAt ?? activity.createdAt,
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
