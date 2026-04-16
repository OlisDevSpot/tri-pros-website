import z from 'zod'

import { activityNoteSources, activityTaskPriorities } from '@/shared/constants/enums'

// ── Type-specific meta schemas (discriminated by activity type) ──────────────

export const noteMetaSchema = z.object({
  source: z.enum(activityNoteSources).optional(),
})
export type NoteMeta = z.infer<typeof noteMetaSchema>

export const reminderMetaSchema = z.object({
  reminderMinutesBefore: z.number().int().min(0).optional(),
})
export type ReminderMeta = z.infer<typeof reminderMetaSchema>

export const taskMetaSchema = z.object({
  priority: z.enum(activityTaskPriorities).optional(),
})
export type TaskMeta = z.infer<typeof taskMetaSchema>

export const eventMetaSchema = z.object({
  location: z.string().optional(),
  allDay: z.boolean().optional(),
})
export type EventMeta = z.infer<typeof eventMetaSchema>

/** Discriminated union — validate metaJSON based on activity type */
export const activityMetaSchemas = {
  note: noteMetaSchema,
  reminder: reminderMetaSchema,
  task: taskMetaSchema,
  event: eventMetaSchema,
} as const
