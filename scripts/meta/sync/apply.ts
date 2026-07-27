// scripts/meta/sync/apply.ts
import type { AdSetSpec, AdSpec, CampaignSpec } from '../campaign-specs/lib/types.js'
import type { AdAssetShas } from './fingerprint.js'
import type { MetaLock } from './lock.js'
import type { PlanOp } from './diff.js'
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import process from 'node:process'
import { toMetaZips } from '../campaign-specs/lib/geo.js'
import {
  createAd,
  createAdSet,
  createCampaign,
  createCarouselAdCreative,
  createLinkAdCreative,
  createVideoAdCreative,
  setAdCreative,
  updateAdSet,
  updateCampaignName,
  uploadAdImage,
  uploadAdVideo,
} from '../lib/marketing-api.js'
import { printInfo, printSuccess } from '../lib/formatters.js'
import { buildUrlTags } from './ad-link.js'
import { adImagePath, adVideoPath } from './diff.js'
import { adFp, adSetFp, campaignFp } from './fingerprint.js'
import { writeLock } from './lock.js'

const AUDIT_PATH = join(process.cwd(), 'scripts/meta/logs/sync-history.jsonl')

function audit(entry: Record<string, unknown>): void {
  mkdirSync(dirname(AUDIT_PATH), { recursive: true })
  appendFileSync(AUDIT_PATH, `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)
}

function specByKey(specs: CampaignSpec[], key: string): CampaignSpec {
  const spec = specs.find(s => s.key === key)
  if (!spec)
    throw new Error(`No spec for campaign key ${key}`)
  return spec
}

function adSetByKey(spec: CampaignSpec, adSetKey: string): AdSetSpec {
  const adSet = spec.adSets.find(a => a.key === adSetKey)
  if (!adSet)
    throw new Error(`No ad set ${adSetKey} in campaign ${spec.key}`)
  return adSet
}

/** Upload image if its sha isn't in the lock yet; returns Meta image_hash. */
async function ensureImage(lock: MetaLock, path: string, imageSha: string): Promise<string> {
  const existing = lock.images[imageSha]
  if (existing)
    return existing
  const hash = await uploadAdImage(readFileSync(path))
  lock.images[imageSha] = hash
  writeLock(lock)
  return hash
}

/** Upload + wait-for-processed if the video sha isn't in the lock yet; returns Meta video id. */
async function ensureVideo(lock: MetaLock, path: string, videoSha: string): Promise<string> {
  const existing = lock.videos[videoSha]
  if (existing)
    return existing
  const videoId = await uploadAdVideo(path)
  lock.videos[videoSha] = videoId
  writeLock(lock)
  return videoId
}

/** Format dispatch: upload the ad's assets (lock-deduped) and create its creative. */
async function createCreativeForAd(lock: MetaLock, campaignKey: string, adSet: AdSetSpec, ad: AdSpec, assetShas: AdAssetShas): Promise<string> {
  const base = {
    name: `${campaignKey}/${ad.key}`,
    baseUrl: adSet.landingBaseUrl,
    urlTags: buildUrlTags(campaignKey, ad.key),
  }

  if (ad.format === 'carousel') {
    const cards = []
    for (const card of ad.cards) {
      const imageHash = await ensureImage(lock, adImagePath(adSet.funnelSlug, card.imageFile), assetShas[card.imageFile])
      cards.push({ imageHash, headline: card.headline, description: card.description })
    }
    return createCarouselAdCreative({
      ...base,
      primaryTexts: ad.primaryTexts,
      multiShareOptimized: ad.multiShareOptimized,
      cards,
      ctaType: ad.ctaType,
    })
  }

  if (ad.format === 'video') {
    const videoId = await ensureVideo(lock, adVideoPath(adSet.funnelSlug, ad.videoFile), assetShas[ad.videoFile])
    const thumbnailHash = await ensureImage(lock, adImagePath(adSet.funnelSlug, ad.thumbnailFile), assetShas[ad.thumbnailFile])
    return createVideoAdCreative({
      ...base,
      headlines: ad.headlines,
      primaryTexts: ad.primaryTexts,
      descriptions: ad.descriptions,
      videoId,
      thumbnailHash,
      ctaType: ad.ctaType,
    })
  }

  const imageHash = await ensureImage(lock, adImagePath(adSet.funnelSlug, ad.imageFile), assetShas[ad.imageFile])
  return createLinkAdCreative({
    ...base,
    headlines: ad.headlines,
    primaryTexts: ad.primaryTexts,
    descriptions: ad.descriptions,
    imageHash,
    ctaType: ad.ctaType,
  })
}

export async function applyPlan(plan: PlanOp[], specs: CampaignSpec[], lock: MetaLock): Promise<void> {
  // Order matters: campaigns → ad sets → ads (creations reference parent ids).
  const order: Record<PlanOp['op'], number> = {
    'create-campaign': 0,
    'update-campaign': 0,
    'create-adset': 1,
    'update-adset': 1,
    'create-ad': 2,
    'refresh-creative': 2,
    'skip-ad-missing-asset': 3,
    'orphan': 3,
  }
  const sorted = [...plan].sort((a, b) => order[a.op] - order[b.op])

  for (const op of sorted) {
    if (op.op === 'skip-ad-missing-asset' || op.op === 'orphan')
      continue // reported by the printer; never acted on here

    const spec = specByKey(specs, op.campaignKey)

    if (op.op === 'create-campaign') {
      const id = await createCampaign(spec.name)
      lock.campaigns[spec.key] = { id, fp: campaignFp(spec) }
      writeLock(lock)
      printSuccess(`campaign created (PAUSED): ${spec.name} → ${id}`)
      audit({ op: op.op, key: spec.key, id })
      continue
    }

    if (op.op === 'update-campaign') {
      await updateCampaignName(op.id, spec.name)
      lock.campaigns[spec.key] = { id: op.id, fp: campaignFp(spec) }
      writeLock(lock)
      printSuccess(`campaign updated: ${spec.name}`)
      audit({ op: op.op, key: spec.key, id: op.id })
      continue
    }

    // remaining op kinds (create-adset | update-adset | create-ad | refresh-creative) all carry adSetKey.
    const adSet = adSetByKey(spec, op.adSetKey)
    const adSetInput = {
      name: adSet.name,
      campaignId: lock.campaigns[spec.key]?.id ?? '',
      dailyBudgetCents: adSet.dailyBudgetCents,
      ageMin: adSet.ageMin,
      ageMax: adSet.ageMax,
      optimizationEvent: adSet.optimizationEvent,
      metaZips: toMetaZips(adSet.geoZips),
    }
    const asKey = `${spec.key}/${adSet.key}`

    if (op.op === 'create-adset') {
      if (!adSetInput.campaignId)
        throw new Error(`Cannot create ad set for ${asKey}: campaign id missing from lock`)
      const id = await createAdSet(adSetInput)
      lock.adSets[asKey] = { id, fp: adSetFp(adSet) }
      writeLock(lock)
      printSuccess(`ad set created (PAUSED): ${adSet.name} → ${id}`)
      audit({ op: op.op, key: asKey, id })
      continue
    }

    if (op.op === 'update-adset') {
      await updateAdSet(op.id, adSetInput)
      lock.adSets[asKey] = { id: op.id, fp: adSetFp(adSet) }
      writeLock(lock)
      printSuccess(`ad set updated: ${adSet.name}`)
      audit({ op: op.op, key: asKey, id: op.id })
      continue
    }

    // create-ad | refresh-creative
    const ad = adSet.ads.find(a => a.key === op.adKey)
    if (!ad)
      throw new Error(`No ad spec ${op.adKey} in campaign ${spec.key}`)
    const adLockKey = `${spec.key}/${ad.key}`

    // Validate adSetId BEFORE any billable API calls (asset uploads + creative creation).
    // A missing adSetId from a hand-corrupted lock would otherwise strand an orphan
    // creative and uploaded assets at Meta with no ad to attach them to.
    if (op.op === 'create-ad') {
      const adSetId = lock.adSets[asKey]?.id
      if (!adSetId)
        throw new Error(`Cannot create ad ${adLockKey}: ad set id missing from lock`)
    }

    const creativeId = await createCreativeForAd(lock, spec.key, adSet, ad, op.assetShas)

    if (op.op === 'create-ad') {
      const adSetId = lock.adSets[asKey]!.id // already validated above
      const id = await createAd({ name: `${spec.key} — ${ad.key}`, adSetId, creativeId })
      lock.ads[adLockKey] = { id, creativeId, fp: adFp(spec.key, adSet, ad, op.assetShas) }
      writeLock(lock)
      printSuccess(`ad created (PAUSED): ${adLockKey} → ${id}`)
      audit({ op: op.op, key: adLockKey, id, creativeId })
    }
    else {
      await setAdCreative(op.adId, creativeId)
      lock.ads[adLockKey] = { id: op.adId, creativeId, fp: adFp(spec.key, adSet, ad, op.assetShas) }
      writeLock(lock)
      printSuccess(`creative refreshed: ${adLockKey}`)
      audit({ op: op.op, key: adLockKey, id: op.adId, creativeId })
    }
  }
  printInfo('Apply complete. Lock file updated — commit scripts/meta/meta.lock.json.')
}
