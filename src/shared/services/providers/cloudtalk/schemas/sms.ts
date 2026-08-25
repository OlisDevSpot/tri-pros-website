import { z } from 'zod'
import { phoneE164Schema } from './primitives'

// SMS — the API exposes ONLY POST /sms/send.json. There is NO list endpoint
// (no SMS log retrieval). Inbound SMS arrives via the Messages.Received
// Workflow Automation, not via polling.
//
// see docs/plans/voip-campaigns/cloudtalk-api-research.md "Endpoints that DO NOT EXIST"
// see /tmp/ct-swagger.json (Sms)

// Request: { recipient, message, sender } — all required.
// `country_code` + `images_by_url` etc. are optional (we don't use them Phase 1).
export const ctSmsSendRequestSchema = z.object({
  recipient: phoneE164Schema,
  sender: phoneE164Schema,
  message: z.string().min(1),
  country_code: z.string().optional(),
})

// Response: `{ success: boolean, data: object }`. `data` shape varies — when
// `success === true`, it echoes the send params; when false, it carries an
// error message. We accept either via `.passthrough()` and surface `success`
// to the caller.
export const ctSmsSendResponseSchema = z.object({
  success: z.boolean(),
  data: z.record(z.string(), z.unknown()).optional(),
})
