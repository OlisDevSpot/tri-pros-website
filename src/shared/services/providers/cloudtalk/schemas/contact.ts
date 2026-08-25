import { z } from 'zod'
import { ctIdSchema, ctNumberSchema, ctOneOrMany, ctTimestampSchema, phoneE164Schema } from './primitives'

// Contact resource. Derived from swagger components/schemas/Contact (full
// shape) + per-endpoint response envelopes.
//
// Field decisions:
//   - We use CT's built-in `name` (full) + `city` rather than custom attrs
//     per the 2026-05-31 lock. V1 verification (template engine merge against
//     built-in fields) is pending — if fails, we'll add custom attrs later.
//   - `ContactAttribute` writes carry { attribute_id, value }; reads carry
//     { attribute_id, title, value }. Same structure both ways.
//
// see docs/plans/voip-campaigns/EPIC.md decisions log 2026-05-31
// see /tmp/ct-swagger.json (Contact, ContactAttribute, ContactNumber, ContactsTag)

// ── ContactAttribute (read + write value shape) ─────────────────────────────
// On the WRITE side, callers pass { attribute_id, value }. On the READ side,
// CT may include `title` as well — accepted but optional.
export const ctContactAttributeValueSchema = z.object({
  attribute_id: ctIdSchema,
  title: z.string().optional(),
  value: z.string(),
})

export type CtContactAttributeValue = z.infer<typeof ctContactAttributeValueSchema>

// Pre-defined ContactAttribute DEFINITION (not value). Returned by
// GET /contacts/attributes.json under `responseData[*].ContactAttribute`.
export const ctContactAttributeDefinitionSchema = z.object({
  id: ctIdSchema,
  title: z.string(),
})

export type CtContactAttributeDefinition = z.infer<typeof ctContactAttributeDefinitionSchema>

// ── Nested contact sub-resources ────────────────────────────────────────────
export const ctContactNumberSchema = z.object({
  public_number: phoneE164Schema,
})

export const ctContactEmailSchema = z.object({
  // CT returns an email *record* with a null value for number-only contacts.
  email: z.string().nullable(),
})

export const ctContactTagSchema = z.object({
  name: z.string(),
})

// ── Contact (full read) ─────────────────────────────────────────────────────
// Returned at the `Contact` key of GET /contacts/show/{contactId}.json
// (alongside ContactNumber, ContactEmail, ContactsTag, ContactAttribute as
// sibling top-level keys). Only fields we actually consume are required;
// everything else is optional so we don't reject valid responses.
export const ctContactSchema = z.object({
  id: ctIdSchema,
  name: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  state: z.string().optional(),
  country_id: ctNumberSchema.optional(),
  // Q3 inversion 2026-05-31: we never write this; only read it for
  // diagnostic visibility into CT-side dashboard state.
  favorite_agent: ctNumberSchema.nullable().optional(),
  type: z.string().optional(),
  created: ctTimestampSchema.optional(),
  modified: ctTimestampSchema.optional(),
})

export type CtContact = z.infer<typeof ctContactSchema>

// Envelope for GET /contacts/show/{contactId}.json — top-level keys are
// sibling resource names (Contact + ContactNumber + ContactsTag + ContactAttribute).
export const ctContactShowResponseSchema = z.object({
  Contact: ctContactSchema,
  ContactNumber: ctOneOrMany(ctContactNumberSchema).optional(),
  ContactEmail: ctOneOrMany(ctContactEmailSchema).optional(),
  ContactsTag: ctOneOrMany(ctContactTagSchema).optional(),
  ContactAttribute: ctOneOrMany(ctContactAttributeValueSchema).optional(),
})

// Envelope for GET /contacts/index.json — each `data[i]` row is one of these.
export const ctContactListRowSchema = z.object({
  Contact: ctContactSchema,
  ContactNumber: ctOneOrMany(ctContactNumberSchema).optional(),
  ContactEmail: ctOneOrMany(ctContactEmailSchema).optional(),
  ContactsTag: ctOneOrMany(ctContactTagSchema).optional(),
  ContactAttribute: ctOneOrMany(ctContactAttributeValueSchema).optional(),
})

export const ctContactListResponseSchema = z.object({
  itemsCount: ctNumberSchema.optional(),
  pageCount: ctNumberSchema.optional(),
  pageNumber: ctNumberSchema.optional(),
  limit: ctNumberSchema.optional(),
  data: z.array(ctContactListRowSchema),
})

// ── Write shapes ────────────────────────────────────────────────────────────
// PUT /contacts/add.json — `name` is the only required field per swagger.
// We always include ContactNumber + ContactAttribute + ContactsTag when present.
export const ctContactAddRequestSchema = z.object({
  name: z.string(),
  title: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  zip: z.string().optional(),
  state: z.string().optional(),
  country_id: ctNumberSchema.optional(),
  ContactNumber: z.array(ctContactNumberSchema).optional(),
  ContactEmail: z.array(ctContactEmailSchema).optional(),
  ContactsTag: z.array(ctContactTagSchema).optional(),
  ContactAttribute: z.array(
    z.object({ attribute_id: ctIdSchema, value: z.string() }),
  ).optional(),
})

export type CtContactAddRequest = z.infer<typeof ctContactAddRequestSchema>

// Response from PUT /contacts/add.json — { status, data: { id } }. CT envelope
// strip happens at the client layer; this is the unwrapped shape.
export const ctContactAddResponseSchema = z.object({
  status: ctNumberSchema.optional(),
  data: z.object({ id: ctIdSchema }),
})

// POST /contacts/edit/{contactId}.json — same request shape as add (name required).
export const ctContactEditRequestSchema = ctContactAddRequestSchema

// PUT /contacts/addTags/{contactId}.json + DELETE /contacts/removeTags/{contactId}.json
// share the same body shape: `{ tags: [name, ...] }`.
export const ctContactTagsRequestSchema = z.object({
  tags: z.array(z.string()),
})

// Tag op response (both add + remove): same shape.
export const ctContactTagsResponseSchema = z.object({
  status: ctNumberSchema.optional(),
  message: z.string().optional(),
  data: z.object({
    tags: z.array(z.object({ id: ctIdSchema.optional(), name: z.string() })).optional(),
  }).optional(),
})

// PUT /notes/add/{contactId}.json — attach a Note to a contact. This is the
// "Notes" surface agents read on the CT contact card (distinct from the
// Activities timeline). Body requires `note` (the text). Response 201:
// { status, data: { id } }. Kept lenient (id optional) — the note is
// fire-and-forget, we don't depend on the returned note id.
export const ctNoteAddResponseSchema = z.object({
  status: ctNumberSchema.optional(),
  message: z.string().optional(),
  data: z.object({ id: ctIdSchema.optional() }).optional(),
})

// GET /contacts/attributes.json — `responseData` is a BARE ARRAY of attribute
// definitions, each wrapped in a `ContactAttribute` key (verified live
// 2026-06-04 — NOT a `{ data: [...] }` envelope like the other /index endpoints).
export const ctAttributesListResponseSchema = z.array(z.object({
  ContactAttribute: ctContactAttributeDefinitionSchema,
}))
