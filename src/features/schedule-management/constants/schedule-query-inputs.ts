/**
 * Shared query inputs for the schedule view. Imported by BOTH
 * `schedule-view.tsx` (client: `useSuspenseQueries`) and
 * `dashboard/schedule/page.tsx` (server: `prefetch`) — one object per query,
 * one query key each. Do not inline these values at either call site.
 */
export const SCHEDULE_MEETINGS_LIST_INPUT = { pagination: { limit: 500, offset: 0 } } as const
export const SCHEDULE_ACTIVITIES_LIST_INPUT = { pagination: { limit: 500, offset: 0 } } as const
