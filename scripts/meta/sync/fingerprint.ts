import type { Buffer } from 'node:buffer'
import type { AdSetSpec, AdSpec, CampaignSpec } from '../campaign-specs/lib/types.js'
import { createHash } from 'node:crypto'
import { AD_SET_DELIVERY_SETTINGS } from '../lib/marketing-api.js'
import { buildUrlTags } from './ad-link.js'

export function sha256Hex(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex')
}

/** Spec filename → sha256(file bytes) for every asset an ad references (image(s), video, thumbnail). */
export type AdAssetShas = Record<string, string>

export function campaignFp(spec: CampaignSpec): string {
  return sha256Hex(JSON.stringify({ name: spec.name, objective: spec.objective }))
}

export function adSetFp(adSet: AdSetSpec): string {
  return sha256Hex(JSON.stringify({
    name: adSet.name,
    dailyBudgetCents: adSet.dailyBudgetCents,
    ageMin: adSet.ageMin,
    ageMax: adSet.ageMax,
    optimizationEvent: adSet.optimizationEvent,
    zips: [...adSet.geoZips].sort(),
    // Engine-level delivery invariants (attribution window, Advantage+ audience):
    // hashing them means editing the constant triggers update-adset for every
    // managed ad set on next sync — no silent drift.
    deliverySettings: AD_SET_DELIVERY_SETTINGS,
  }))
}

export function adFp(campaignKey: string, adSet: AdSetSpec, ad: AdSpec, assetShas: AdAssetShas): string {
  if (ad.format === 'carousel') {
    return sha256Hex(JSON.stringify({
      primaryTexts: ad.primaryTexts,
      ctaType: ad.ctaType,
      cards: ad.cards.map(c => ({
        imageSha: assetShas[c.imageFile],
        headline: c.headline,
        description: c.description ?? null,
      })),
      link: adSet.landingBaseUrl,
      urlTags: buildUrlTags(campaignKey, ad.key),
      multiShareOptimized: ad.multiShareOptimized,
    }))
  }
  if (ad.format === 'video') {
    return sha256Hex(JSON.stringify({
      headlines: ad.headlines,
      primaryTexts: ad.primaryTexts,
      descriptions: ad.descriptions ?? null,
      ctaType: ad.ctaType,
      videoSha: assetShas[ad.videoFile],
      thumbnailSha: assetShas[ad.thumbnailFile],
      link: adSet.landingBaseUrl,
      urlTags: buildUrlTags(campaignKey, ad.key),
    }))
  }
  return sha256Hex(JSON.stringify({
    headlines: ad.headlines,
    primaryTexts: ad.primaryTexts,
    descriptions: ad.descriptions ?? null,
    ctaType: ad.ctaType,
    imageSha: assetShas[ad.imageFile],
    link: adSet.landingBaseUrl,
    urlTags: buildUrlTags(campaignKey, ad.key),
  }))
}
