import { z } from 'zod'

const specKey = z.string().regex(/^[a-z0-9-]+$/, 'spec keys are kebab-case slugs')

// Showcase CTA rules (docs/marketing/showcase-offer.md#rules-for-ads):
// APPLY_NOW preferred, LEARN_MORE allowed. GET_QUOTE is intentionally NOT in
// this enum — quote-language contradicts the apply-to-be-chosen reframe.
const ctaTypeSchema = z.enum(['APPLY_NOW', 'LEARN_MORE'])

export const singleImageAdSpecSchema = z.object({
  key: specKey, // stable identity — renaming a key = new ad at Meta
  /** Defaulted so pre-format specs (no `format` field) parse unchanged. */
  format: z.literal('single-image').default('single-image'),
  /** 1–5 headline variants (Meta `titles`, ≤255 chars each). */
  headlines: z.array(z.string().min(1).max(255)).min(1).max(5),
  /** 1–5 primary-text variants (Meta `bodies`, ≤1024 chars each) — multiple options reduce creative fatigue. */
  primaryTexts: z.array(z.string().min(1).max(1024)).min(1).max(5),
  /** 0–5 link-description variants (≤255 chars each). */
  descriptions: z.array(z.string().min(1).max(255)).max(5).optional(),
  /** Filename inside public/funnels/<funnelSlug>/ads/ — sync skips (warns) if missing on disk. */
  imageFile: z.string().min(1),
  ctaType: ctaTypeSchema,
})

export const carouselCardSchema = z.object({
  /** Filename inside public/funnels/<funnelSlug>/ads/ — sync skips (warns) if missing on disk. */
  imageFile: z.string().min(1),
  /** Card headline — ≤40 chars recommended (longer truncates in most placements); Meta hard cap 255. */
  headline: z.string().min(1).max(255),
  description: z.string().min(1).max(255).optional(),
})

export const carouselAdSpecSchema = z.object({
  key: specKey,
  format: z.literal('carousel'),
  /** 1–5 primary-text variants — carousel creatives use primaryTexts[0] only (see createCarouselAdCreative). */
  primaryTexts: z.array(z.string().min(1).max(1024)).min(1).max(5),
  ctaType: ctaTypeSchema,
  /** 2–10 cards, all linking to the campaign's landingBaseUrl. Card 1 is the strongest hook by design. */
  cards: z.array(carouselCardSchema).min(2).max(10),
  /** false (default) = Meta must NOT auto-reorder cards by predicted performance. */
  multiShareOptimized: z.boolean().default(false),
})

export const videoAdSpecSchema = z.object({
  key: specKey,
  format: z.literal('video'),
  /** 1–5 headline variants (Meta `titles`, ≤255 chars each). */
  headlines: z.array(z.string().min(1).max(255)).min(1).max(5),
  /** 1–5 primary-text variants (Meta `bodies`, ≤1024 chars each). */
  primaryTexts: z.array(z.string().min(1).max(1024)).min(1).max(5),
  /** 0–5 link-description variants (≤255 chars each). */
  descriptions: z.array(z.string().min(1).max(255)).max(5).optional(),
  /** Filename inside public/funnels/<funnelSlug>/ads/videos/ — gitignored (too large to commit); sync skips (warns) if missing on disk. */
  videoFile: z.string().min(1),
  /** Image filename inside public/funnels/<funnelSlug>/ads/ — Meta video creatives require a thumbnail. */
  thumbnailFile: z.string().min(1),
  ctaType: ctaTypeSchema,
})

// Plain z.union, NOT z.discriminatedUnion: Zod 4's discriminated union cannot
// resolve an ABSENT discriminator even when it carries a .default() (verified
// empirically), and pre-format specs omit `format` entirely. The variants'
// required fields (imageFile / cards / videoFile) disambiguate reliably.
export const adSpecSchema = z.union([singleImageAdSpecSchema, carouselAdSpecSchema, videoAdSpecSchema])

export const adSetSpecSchema = z.object({
  key: specKey,
  name: z.string().min(1),
  /** Which funnel's assets + landing page this ad set sells. Assets under public/funnels/<funnelSlug>/ads/. */
  funnelSlug: z.enum(['kitchens', 'bathrooms']),
  /** Funnel origin with trailing slash, e.g. https://kitchens.triprosremodeling.com/ */
  landingBaseUrl: z.string().url(),
  dailyBudgetCents: z.number().int().positive(),
  ageMin: z.number().int().min(18).max(65),
  /** Meta rejects age_max > 65; 65 means "65+" (unbounded upper bucket). */
  ageMax: z.number().int().min(18).max(65),
  /** Maps to promoted_object.custom_event_type. */
  optimizationEvent: z.enum(['LEAD', 'SCHEDULE']),
  geoZips: z.array(z.string().regex(/^\d{5}$/)).min(1),
  ads: z.array(adSpecSchema).min(1),
})

export const campaignSpecSchema = z.object({
  key: specKey,
  name: z.string().min(1),
  objective: z.literal('OUTCOME_LEADS'),
  /** campaign = offer; one ad set per product. */
  adSets: z.array(adSetSpecSchema).min(1),
})
  .refine(s => s.adSets.every(a => a.ageMin <= a.ageMax), { message: 'ageMin must be ≤ ageMax' })
  .refine((s) => {
    const keys = s.adSets.flatMap(a => a.ads.map(ad => ad.key))
    return new Set(keys).size === keys.length
  }, { message: 'ad keys must be unique across the whole campaign (they key the lock as <campaignKey>/<adKey>)' })
  .refine((s) => {
    const keys = s.adSets.map(a => a.key)
    return new Set(keys).size === keys.length
  }, { message: 'ad set keys must be unique within the campaign' })

export type AdSpec = z.infer<typeof adSpecSchema>
export type SingleImageAdSpec = z.infer<typeof singleImageAdSpecSchema>
export type CarouselAdSpec = z.infer<typeof carouselAdSpecSchema>
export type VideoAdSpec = z.infer<typeof videoAdSpecSchema>
export type AdSetSpec = z.infer<typeof adSetSpecSchema>
export type CampaignSpec = z.infer<typeof campaignSpecSchema>
export type CampaignSpecInput = z.input<typeof campaignSpecSchema>
