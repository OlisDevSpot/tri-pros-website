import { z } from 'zod'

// Per-campaign automated-SMS cadence config. Stored as a typed JSONB column on
// voip_campaigns (app-authored; never CT-mirrored). Each message is armed by a
// dial-attempt threshold; the orchestrator advances the ladder one step at a
// time, gated by maxMessages + oneSmsPerDay.
// see docs/superpowers/specs/2026-06-17-voip-campaigns-sms-cadence-design.md

export const smsCadenceMessageSchema = z.object({
  // Dial-attempt count at/after which this message is eligible. Minimum 1 — the
  // opener arms after the first dial (no enrollment-time send; the from-DID is
  // read off the call.ended event).
  afterAttempts: z.number().int().min(1),
  // SMS body. Supports {{first_name}}, {{city}}, {{primary_trade}} merge tokens.
  body: z.string().min(1),
})

export type SmsCadenceMessage = z.infer<typeof smsCadenceMessageSchema>

export const smsCadenceSchema = z.object({
  enabled: z.boolean().default(false),
  maxMessages: z.number().int().positive().default(5),
  oneSmsPerDay: z.boolean().default(true),
  messages: z.array(smsCadenceMessageSchema).max(5).default([]),
})

export type SmsCadence = z.infer<typeof smsCadenceSchema>
