import z from 'zod'
import { intakeModes } from '@/shared/constants/enums'

export const leadSourceFormConfigSchema = z.object({
  mode: z.enum(intakeModes).optional().default('customer_only'),

  // Field visibility
  showEmail: z.boolean(),
  requireEmail: z.boolean(),
  showNotes: z.boolean(),

  // Meeting-mode-specific (ignored in customer_only mode)
  showMeetingScheduler: z.boolean().optional(),
  requireMeetingScheduler: z.boolean().optional(),
  showMp3Upload: z.boolean().optional(),
  closedByOptions: z.array(z.string()).optional(),
})

export type LeadSourceFormConfig = z.infer<typeof leadSourceFormConfigSchema>

// ── voipConfigJSON — per-source VoIP policy ─────────────────────────────────
// Shared field; each EPIC owns a sub-object. APP-side policy only — CT-runtime
// identity lives in the voip_campaigns + voip_contact_attributes tables.
// see docs/plans/voip/INTEGRATION-SEAM.md §9

// voip-campaigns sub-object (CloudTalk-side policy). Shape per §9.
export const voipCampaignsPolicySchema = z.object({
  enabled: z.boolean().default(true), // per-source kill switch
  autoEnroll: z.boolean().default(false), // bina=true, home_depot=false
  dailyDialVolumeCap: z.number().int().positive().optional(),
  messageTemplateOverrides: z.record(z.string(), z.string()).optional(),
})
export type VoipCampaignsPolicy = z.infer<typeof voipCampaignsPolicySchema>

// voip-in-house sub-object (Twilio-side policy for post-conversion comms
// inheriting from this lead source).
export const voipInHousePolicySchema = z.object({
  enabled: z.boolean().default(true), // per-source kill switch for in-house comms
  transactionalSmsTemplates: z.record(z.string(), z.string()).optional(),
  callingHoursOverride: z.object({
    weekdayStart: z.string(), // 'HH:MM' local time
    weekdayEnd: z.string(),
    weekendStart: z.string().optional(),
    weekendEnd: z.string().optional(),
    timezone: z.string(), // IANA TZ
  }).optional(),
})
export type VoipInHousePolicy = z.infer<typeof voipInHousePolicySchema>

export const voipConfigSchema = z.object({
  campaigns: voipCampaignsPolicySchema.optional(),
  inHouse: voipInHousePolicySchema.optional(),
})
export type VoipConfig = z.infer<typeof voipConfigSchema>
