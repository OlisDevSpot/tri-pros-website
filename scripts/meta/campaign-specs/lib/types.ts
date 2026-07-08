import { z } from 'zod'

const specKey = z.string().regex(/^[a-z0-9-]+$/, 'spec keys are kebab-case slugs')

export const adSpecSchema = z.object({
  key: specKey, // stable identity — renaming a key = new ad at Meta
  headline: z.string().min(1).max(255),
  primaryText: z.string().min(1),
  description: z.string().optional(),
  /** Filename inside public/funnels/<funnelSlug>/ads/ — sync skips (warns) if missing on disk. */
  imageFile: z.string().min(1),
  // Showcase CTA rules (docs/marketing/showcase-offer.md#rules-for-ads):
  // APPLY_NOW preferred, LEARN_MORE allowed. GET_QUOTE is intentionally NOT in
  // this enum — quote-language contradicts the apply-to-be-chosen reframe.
  ctaType: z.enum(['APPLY_NOW', 'LEARN_MORE']),
})

export const adSetSpecSchema = z.object({
  key: specKey,
  name: z.string().min(1),
  dailyBudgetCents: z.number().int().positive(),
  ageMin: z.number().int().min(18).max(65),
  /** Meta rejects age_max > 65; 65 means "65+" (unbounded upper bucket). */
  ageMax: z.number().int().min(18).max(65),
  /** Maps to promoted_object.custom_event_type — flip LEAD→SCHEDULE to graduate optimization. */
  optimizationEvent: z.enum(['LEAD', 'SCHEDULE']),
  geoZips: z.array(z.string().regex(/^\d{5}$/)).min(1),
})

export const campaignSpecSchema = z.object({
  key: specKey,
  name: z.string().min(1),
  objective: z.literal('OUTCOME_LEADS'),
  funnelSlug: z.enum(['kitchens', 'bathrooms']),
  /** Funnel origin with trailing slash, e.g. https://kitchens.triprosremodeling.com/ */
  landingBaseUrl: z.string().url(),
  adSet: adSetSpecSchema, // v1: exactly one ad set per campaign
  ads: z.array(adSpecSchema).min(1),
}).refine(s => s.adSet.ageMin <= s.adSet.ageMax, { message: 'ageMin must be ≤ ageMax' })

export type AdSpec = z.infer<typeof adSpecSchema>
export type AdSetSpec = z.infer<typeof adSetSpecSchema>
export type CampaignSpec = z.infer<typeof campaignSpecSchema>
export type CampaignSpecInput = z.input<typeof campaignSpecSchema>
