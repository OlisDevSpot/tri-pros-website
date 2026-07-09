import type { Buffer } from 'node:buffer'
import type { AdSpec, CampaignSpec } from '../campaign-specs/lib/types.js'
import { createHash } from 'node:crypto'
import { buildUrlTags } from './ad-link.js'

export function sha256Hex(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex')
}

/** Spec filename → sha256(file bytes) for every asset an ad references (image(s), video, thumbnail). */
export type AdAssetShas = Record<string, string>

export function campaignFp(spec: CampaignSpec): string {
  return sha256Hex(JSON.stringify({ name: spec.name, objective: spec.objective }))
}

export function adSetFp(spec: CampaignSpec): string {
  const a = spec.adSet
  return sha256Hex(JSON.stringify({
    name: a.name,
    dailyBudgetCents: a.dailyBudgetCents,
    ageMin: a.ageMin,
    ageMax: a.ageMax,
    optimizationEvent: a.optimizationEvent,
    zips: [...a.geoZips].sort(),
  }))
}

export function adFp(spec: CampaignSpec, ad: AdSpec, assetShas: AdAssetShas): string {
  if (ad.format === 'carousel') {
    return sha256Hex(JSON.stringify({
      primaryTexts: ad.primaryTexts,
      ctaType: ad.ctaType,
      cards: ad.cards.map(c => ({
        imageSha: assetShas[c.imageFile],
        headline: c.headline,
        description: c.description ?? null,
      })),
      link: spec.landingBaseUrl,
      urlTags: buildUrlTags(spec, ad),
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
      link: spec.landingBaseUrl,
      urlTags: buildUrlTags(spec, ad),
    }))
  }
  // single-image: the hash input must stay BYTE-IDENTICAL to the pre-format
  // engine so live ads keep their lock fingerprints (zero-op dry run).
  return sha256Hex(JSON.stringify({
    headlines: ad.headlines,
    primaryTexts: ad.primaryTexts,
    descriptions: ad.descriptions ?? null,
    ctaType: ad.ctaType,
    imageSha: assetShas[ad.imageFile],
    link: spec.landingBaseUrl,
    urlTags: buildUrlTags(spec, ad),
  }))
}
