import { z } from 'zod'

// Shared primitive schemas for CT API payloads. Kept in one file so the same
// regex/transform lives everywhere — change here and every endpoint adapts.
//
// see ../../README.md for provider conventions
// see /tmp/ct-swagger.json for the swagger this is derived from

// E.164 phone number. CT sometimes returns numbers WITHOUT a leading `+`
// (especially in nested ContactNumber objects), so we accept either form and
// normalize on the way in. Callers MUST pass E.164 with `+` on the way out.
export const phoneE164Schema = z.string().regex(/^\+?\d{10,15}$/)

// CT timestamps are ISO 8601 in UTC (per swagger). We don't `.datetime()`
// validate because some endpoints return looser formats (e.g.
// `'2026-05-31 12:34:56'` instead of full ISO). Accept any non-empty string.
export const ctTimestampSchema = z.string().min(1)

// CT IDs come back as `number` in most schemas but `string` in some envelope
// fields. We coerce to string at the boundary so downstream code never has to
// branch on number-vs-string.
export const ctIdSchema = z.union([z.string(), z.number()]).transform(String)

// CT's classic API returns resource-level numerics as STRINGS in the body
// (e.g. `answer_wait_time: "35"`, `country_id: "1"`, `billsec: "42"`) even
// though swagger types them as `number`. Pagination envelope fields, by
// contrast, come back as real numbers. `z.coerce.number()` accepts both forms
// ("35" → 35 and 35 → 35), so it's the safe default everywhere — never use a
// bare `z.number()` in a CT response schema. Mirrors `ctIdSchema`'s rationale.
// Chain `.int()/.optional()/.nullable()` as needed (it returns a ZodNumber).
export const ctNumberSchema = z.coerce.number()

// CT returns a sibling relation (ContactNumber, ContactEmail, etc.) as a bare
// OBJECT when there's exactly one row, an ARRAY when many, and omits the key
// when none. Normalize to an array at the boundary so consumers always get
// `T[]`. Use instead of `z.array(item)` for any CT response relation field.
export function ctOneOrMany<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess(v => (v == null ? undefined : Array.isArray(v) ? v : [v]), z.array(item))
}

// Pagination envelope returned by `/index.json` endpoints.
export const ctPaginationSchema = z.object({
  itemsCount: ctNumberSchema.optional(),
  pageCount: ctNumberSchema.optional(),
  pageNumber: ctNumberSchema.optional(),
  limit: ctNumberSchema.optional(),
})
