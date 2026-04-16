export const activityTypes = ['note', 'reminder', 'task', 'event'] as const
export type ActivityType = (typeof activityTypes)[number]

export const activityEntityTypes = ['customer', 'meeting', 'project', 'proposal'] as const
export type ActivityEntityType = (typeof activityEntityTypes)[number]

/** Activity types that sync to Google Calendar (must have scheduledFor) */
export const gcalSyncableActivityTypes = ['event', 'reminder'] as const
export type GCalSyncableActivityType = (typeof gcalSyncableActivityTypes)[number]

export const activityTaskPriorities = ['low', 'medium', 'high'] as const
export type ActivityTaskPriority = (typeof activityTaskPriorities)[number]

export const activityNoteSources = ['agent', 'system'] as const
export type ActivityNoteSource = (typeof activityNoteSources)[number]
