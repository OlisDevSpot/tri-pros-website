import { z } from 'zod'
import { ctIdSchema, ctNumberSchema, ctOneOrMany, ctTimestampSchema } from './primitives'

// Campaign resource. Two endpoints we use:
//   - GET /campaigns/index.json → list w/ pagination
//   - POST /campaigns/edit/{id}.json → status toggle (active/inactive) +
//     optionally many other fields (we only push status from app code)
//
// Campaign membership is TAG-DRIVEN (corrected 2026-05-31). There is NO
// "add contact to campaign" or "list campaign contacts" endpoint. Each
// campaign is configured in CT's dashboard to filter by ONE tag name; CT
// auto-includes any contact carrying that tag.
//
// see docs/plans/voip-campaigns/cloudtalk-api-research.md "Endpoints that DO NOT EXIST"
// see /tmp/ct-swagger.json (CampaignList)

// Campaign row from /campaigns/index.json — `CampaignList` is the primary
// shape. We extend the swagger schema with the fields we actually consume.
export const ctCampaignSchema = z.object({
  id: ctIdSchema,
  name: z.string(),
  // 'active' | 'inactive' — `inactive` is the pause state.
  status: z.string().optional(),
  has_schedule_date: z.boolean().optional(),
  // CT returns these as `null` (not omitted) when `has_schedule_date` is false,
  // so they must be nullish — a bare `.optional()` rejects the null and fails
  // the whole list parse. Verified live 2026-06-09.
  schedule_start_date: z.string().nullish(),
  schedule_start_time: z.string().nullish(),
  // Cadence config — we mirror these into voip_campaigns table during Resync.
  answer_wait_time: ctNumberSchema.optional(),
  after_call_dialing_auto: z.boolean().optional(),
  after_call_time: ctNumberSchema.optional(),
  is_recording: z.boolean().optional(),
  // Created / updated timestamps for drift detection.
  created: ctTimestampSchema.optional(),
  modified: ctTimestampSchema.optional(),
})

export type CtCampaign = z.infer<typeof ctCampaignSchema>

// Each row of /campaigns/index.json data[] has nested sibling keys
// (ContactsTag, Group, Button, Agent). We accept them loosely — only
// ContactsTag matters for the membership-tag identity bridge.
export const ctCampaignListRowSchema = z.object({
  Campaign: ctCampaignSchema,
  // ContactsTag carries the membership tag(s) we addTags() against. CT returns
  // it as an array (verified live 2026-06-04: `[{ id, name: 'Campaign-MetaAds' }]`)
  // — the campaign's dashboard contact-list filter tag. The app's one-tag-per-
  // campaign model reads the first entry.
  ContactsTag: ctOneOrMany(z.object({
    id: ctIdSchema.optional(),
    name: z.string().optional(),
  })).optional(),
  Group: z.unknown().optional(),
  Button: z.unknown().optional(),
  Agent: z.unknown().optional(),
})

export const ctCampaignListResponseSchema = z.object({
  itemsCount: ctNumberSchema.optional(),
  pageCount: ctNumberSchema.optional(),
  pageNumber: ctNumberSchema.optional(),
  limit: ctNumberSchema.optional(),
  data: z.array(ctCampaignListRowSchema),
})

// POST /campaigns/edit/{id}.json — swagger lists `name` and `Button` as
// required, but in practice CT accepts a status-only edit for pause/resume.
// We send only the fields we want to change; CT preserves the rest.
export const ctCampaignEditRequestSchema = z.object({
  name: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
}).passthrough()

export const ctCampaignEditResponseSchema = z.object({
  status: ctNumberSchema.optional(),
})
