import { z } from 'zod'
import { ctIdSchema, ctNumberSchema, ctTimestampSchema } from './primitives'

// CT Call resource. Two distinct shapes:
//   - GET /calls/index.json → list of `Cdr` rows (with Cdr+Call+Agent+Number
//     sibling keys per row)
//   - GET /calls/{callId} → single `Call` schema (NOT enveloped in
//     responseData; the path is the only one that doesn't end in .json)
//
// We model both: a flexible row shape for the list endpoint and a getById
// shape that mirrors the swagger Call component.
//
// see /tmp/ct-swagger.json (Cdr, Call)

// Cdr — single call record from /calls/index.json.
export const ctCdrSchema = z.object({
  id: ctIdSchema,
  uuid: z.string().optional(),
  // Public-internal = agent number (E.164); public-external = caller number (E.164).
  public_external: z.string().optional(),
  public_internal: z.string().optional(),
  // Call type: 'incoming' | 'outgoing' | 'internal'.
  type: z.string().optional(),
  billsec: ctNumberSchema.optional(),
  talking_time: ctNumberSchema.optional(),
  is_voicemail: z.boolean().optional(),
  recorded: z.boolean().optional(),
  recording_url: z.string().optional(),
  started_at: ctTimestampSchema.optional(),
  answered_at: ctTimestampSchema.optional(),
  ended_at: ctTimestampSchema.optional(),
  user_id: ctNumberSchema.optional(),
})

// Row from /calls/index.json — Cdr is the primary key; other fields are
// sibling resources joined by call ID.
export const ctCallListRowSchema = z.object({
  Cdr: ctCdrSchema,
  // Agentless calls (missed / unanswered) carry `Agent: { id: null }`.
  Agent: z.object({ id: ctIdSchema.nullable() }).nullable().optional(),
  Number: z.object({ public_number: z.string() }).optional(),
  ContactNumber: z.object({ public_number: z.string() }).optional(),
  Disposition: z.object({ name: z.string() }).optional(),
})

export const ctCallListResponseSchema = z.object({
  itemsCount: ctNumberSchema.optional(),
  pageCount: ctNumberSchema.optional(),
  pageNumber: ctNumberSchema.optional(),
  limit: ctNumberSchema.optional(),
  data: z.array(ctCallListRowSchema),
})

// GET /calls/{callId} — returns full Call schema. Path is the only endpoint
// in the API that does NOT end in `.json` (audited 2026-05-31).
// Fields we don't use are accepted but unmodeled to keep this lean.
export const ctCallSchema = z.object({
  id: ctIdSchema.optional(),
  uuid: z.string().optional(),
  started_at: ctTimestampSchema.optional(),
  answered_at: ctTimestampSchema.optional(),
  ended_at: ctTimestampSchema.optional(),
  talking_time: ctNumberSchema.optional(),
  is_voicemail: z.boolean().optional(),
  recording_url: z.string().optional(),
  public_external: z.string().optional(),
  public_internal: z.string().optional(),
}).passthrough()
