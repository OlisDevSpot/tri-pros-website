import { z } from 'zod'
import { ctIdSchema, ctNumberSchema } from './primitives'

// Bulk contact operations — POST /bulk/contacts.json.
// CT cap: ≤10 ops per request. Each op carries a `command_id` (caller-side
// correlation token) + `action` discriminator + per-action `data` payload.
//
// Request body is a TOP-LEVEL ARRAY (not an envelope). The example in swagger
// confirms this shape:
//   [
//     { action: 'add_contact', command_id: '...', data: {...} },
//     { action: 'edit_contact', command_id: '...', data: {...} },
//     { action: 'delete_contact', command_id: '...', data: { id } },
//   ]
//
// see /tmp/ct-swagger.json (POST /bulk/contacts.json example)
// see docs/plans/voip-campaigns/phase-1-implementation.md#w1

const ctBulkAddDataSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  state: z.string().optional(),
  country_id: ctNumberSchema.optional(),
  ContactNumber: z.array(z.object({ public_number: z.union([z.string(), z.number()]) })).optional(),
  ContactEmail: z.array(z.object({ email: z.string() })).optional(),
  ContactsTag: z.array(z.object({ name: z.string() })).optional(),
  ContactAttribute: z.array(
    z.object({ attribute_id: ctIdSchema, value: z.string() }),
  ).optional(),
})

const ctBulkEditDataSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  state: z.string().optional(),
  country_id: ctNumberSchema.optional(),
  ContactNumber: z.array(z.object({ public_number: z.union([z.string(), z.number()]) })).optional(),
  ContactEmail: z.array(z.object({ email: z.string() })).optional(),
  ContactsTag: z.array(z.object({ name: z.string() })).optional(),
  ContactAttribute: z.array(
    z.object({ attribute_id: ctIdSchema, value: z.string() }),
  ).optional(),
})

const ctBulkDeleteDataSchema = z.object({
  id: z.union([z.string(), z.number()]),
})

// Discriminated union per action — keeps each branch's `data` typed.
export const ctBulkContactOpSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('add_contact'),
    command_id: z.string(),
    data: ctBulkAddDataSchema,
  }),
  z.object({
    action: z.literal('edit_contact'),
    command_id: z.string(),
    data: ctBulkEditDataSchema,
  }),
  z.object({
    action: z.literal('delete_contact'),
    command_id: z.string(),
    data: ctBulkDeleteDataSchema,
  }),
])

export type CtBulkContactOp = z.infer<typeof ctBulkContactOpSchema>

// Request body is a bare array; we enforce the ≤10 cap at the runtime layer
// (`lib/bulks.ts`) rather than in the schema so the error message includes
// the actual count for easier debugging.
export const ctBulkContactsRequestSchema = z.array(ctBulkContactOpSchema)

// Response — swagger says `ContactsBulkDataResponse`. We accept a permissive
// shape: status + data with per-op results keyed by command_id.
export const ctBulkContactsResponseSchema = z.object({
  status: ctNumberSchema.optional(),
  data: z.object({
    // Per-op results — exact shape varies (`successful: [...], failed: [...]`
    // or per-command_id keyed). We pass through and let callers inspect.
  }).passthrough().optional(),
}).passthrough()
