import { z } from 'zod'

// zod's .datetime() accepts year 0000, which Postgres rejects with a 500; an out-of-range
// value fails validation so the filter collapses to inactive on both the parser and procedure paths.
const pgSafeDatetime = z.string().datetime().refine((s) => {
  const t = Date.parse(s)
  return Number.isFinite(t) && t >= Date.UTC(1970, 0, 1) && t <= Date.UTC(2200, 0, 1)
}, 'Date out of supported range')

/** Inclusive on both ends. */
export const dateRangeSchema = z.object({
  from: pgSafeDatetime.optional(),
  to: pgSafeDatetime.optional(),
})

export type DateRange = z.infer<typeof dateRangeSchema>

/** Inclusive on both ends; `undefined` on a side means open-ended. */
export const numberRangeSchema = z.object({
  min: z.number().optional(),
  max: z.number().optional(),
})

export type NumberRange = z.infer<typeof numberRangeSchema>
