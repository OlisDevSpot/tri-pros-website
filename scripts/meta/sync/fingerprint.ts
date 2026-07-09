import type { Buffer } from 'node:buffer'
import type { AdSpec, CampaignSpec } from '../campaign-specs/lib/types.js'
import { createHash } from 'node:crypto'
import { buildUrlTags } from './ad-link.js'

export function sha256Hex(input: Buffer | string): string {
  return createHash('sha256').update(input).digest('hex')
}

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

export function adFp(spec: CampaignSpec, ad: AdSpec, imageSha: string): string {
  return sha256Hex(JSON.stringify({
    headlines: ad.headlines,
    primaryTexts: ad.primaryTexts,
    descriptions: ad.descriptions ?? null,
    ctaType: ad.ctaType,
    imageSha,
    link: spec.landingBaseUrl,
    urlTags: buildUrlTags(spec, ad),
  }))
}
