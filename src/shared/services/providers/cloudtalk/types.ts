import type z from 'zod'
import type { CloudtalkTagName } from './constants'
import type { ctCallListRowSchema } from './schemas/call'
import type { CtCampaign } from './schemas/campaign'
import type {
  CtContactAttributeDefinition,
  CtContactAttributeValue,
} from './schemas/contact'

// Domain-level types for CT resources used by `services/voip/campaigns/*`.
//
// Split (mirrors twilio/types.ts pattern):
//   - `schemas/*.ts` carries wire-level zod for raw CT request/response
//     shapes (what the API actually returns).
//   - `constants/index.ts` carries domain enums (tag names, dispositions,
//     attribute app-keys) + pricing + host/rate-limit constants.
//   - This file carries (a) consumer-shaped domain types that normalize the
//     raw wire shapes into the field names our app prefers, and (b) thin
//     re-exports of `z.infer<>` types for callers that need the raw shapes
//     (so they don't reach into `schemas/*` directly).
//
// see ./README.md for provider conventions

// ── Consumer-shaped domain types ────────────────────────────────────────────
// These normalize the raw wire shapes (which use nested
// Contact / ContactNumber / ContactsTag / ContactAttribute keys) into flat
// app-friendly objects. Mapping lives in `client.ts`.

export interface CloudtalkContact {
  contactId: string
  phoneE164: string
  name: string
  city?: string
  tags: CloudtalkTagName[]
  // Map from CT attribute_id → value. Caller resolves attribute_id to
  // app-key by joining against voip_contact_attributes.
  attributes: Record<string, string>
  updatedAt: string
}

export interface CloudtalkContactSummary {
  contactId: string
  phoneE164: string
  tags: CloudtalkTagName[]
  updatedAt: string
}

export interface CloudtalkCall {
  callId: string
  callUuid: string
  agentId?: string
  callerE164: string
  didE164?: string
  startedAt: string
  answeredAt?: string
  endedAt?: string
  durationSec?: number
  isVoicemail?: boolean
  recordingUrl?: string
}

// ── Re-exports for callers that need the raw CT wire shapes ─────────────────
// The reconciliation cron + campaign-sync service traffic in raw CT shapes.
// Expose them here so consumers don't reach into schemas/* directly.
export type { CtCampaign, CtContactAttributeDefinition, CtContactAttributeValue }
export type CtCallListRow = z.infer<typeof ctCallListRowSchema>
