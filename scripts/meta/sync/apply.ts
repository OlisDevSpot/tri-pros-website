// scripts/meta/sync/apply.ts
import type { CampaignSpec } from '../campaign-specs/lib/types.js'
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
  createLinkAdCreative,
  setAdCreative,
  updateAdSet,
  updateCampaignName,
  uploadAdImage,
} from '../lib/marketing-api.js'
import { printInfo, printSuccess } from '../lib/formatters.js'
import { buildAdLink } from './ad-link.js'
import { adImagePath } from './diff.js'
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

export async function applyPlan(plan: PlanOp[], specs: CampaignSpec[], lock: MetaLock): Promise<void> {
  // Order matters: campaigns → ad sets → ads (creations reference parent ids).
  const order: Record<PlanOp['op'], number> = {
    'create-campaign': 0,
    'update-campaign': 0,
    'create-adset': 1,
    'update-adset': 1,
    'create-ad': 2,
    'refresh-creative': 2,
    'skip-ad-missing-image': 3,
    'orphan': 3,
  }
  const sorted = [...plan].sort((a, b) => order[a.op] - order[b.op])

  for (const op of sorted) {
    if (op.op === 'skip-ad-missing-image' || op.op === 'orphan')
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

    const adSetInput = {
      name: spec.adSet.name,
      campaignId: lock.campaigns[spec.key]?.id ?? '',
      dailyBudgetCents: spec.adSet.dailyBudgetCents,
      ageMin: spec.adSet.ageMin,
      ageMax: spec.adSet.ageMax,
      optimizationEvent: spec.adSet.optimizationEvent,
      metaZips: toMetaZips(spec.adSet.geoZips),
    }
    const asKey = `${spec.key}/${spec.adSet.key}`

    if (op.op === 'create-adset') {
      if (!adSetInput.campaignId)
        throw new Error(`Cannot create ad set for ${spec.key}: campaign id missing from lock`)
      const id = await createAdSet(adSetInput)
      lock.adSets[asKey] = { id, fp: adSetFp(spec) }
      writeLock(lock)
      printSuccess(`ad set created (PAUSED): ${spec.adSet.name} → ${id}`)
      audit({ op: op.op, key: asKey, id })
      continue
    }

    if (op.op === 'update-adset') {
      await updateAdSet(op.id, adSetInput)
      lock.adSets[asKey] = { id: op.id, fp: adSetFp(spec) }
      writeLock(lock)
      printSuccess(`ad set updated: ${spec.adSet.name}`)
      audit({ op: op.op, key: asKey, id: op.id })
      continue
    }

    // create-ad | refresh-creative
    const ad = spec.ads.find(a => a.key === op.adKey)
    if (!ad)
      throw new Error(`No ad spec ${op.adKey} in campaign ${spec.key}`)
    const adLockKey = `${spec.key}/${ad.key}`

    // Validate adSetId BEFORE any billable API calls (image upload + creative creation).
    // A missing adSetId from a hand-corrupted lock would otherwise strand an orphan
    // creative and uploaded image at Meta with no ad to attach them to.
    if (op.op === 'create-ad') {
      const adSetId = lock.adSets[asKey]?.id
      if (!adSetId)
        throw new Error(`Cannot create ad ${adLockKey}: ad set id missing from lock`)
    }

    const imagePath = adImagePath(spec, ad.imageFile)
    const imageHash = await ensureImage(lock, imagePath, op.imageSha)
    const creativeId = await createLinkAdCreative({
      name: `${spec.key}/${ad.key}`,
      link: buildAdLink(spec, ad),
      headline: ad.headline,
      primaryText: ad.primaryText,
      description: ad.description,
      imageHash,
      ctaType: ad.ctaType,
    })

    if (op.op === 'create-ad') {
      const adSetId = lock.adSets[asKey]!.id // already validated above
      const id = await createAd({ name: `${spec.key} — ${ad.key}`, adSetId, creativeId })
      lock.ads[adLockKey] = { id, creativeId, fp: adFp(spec, ad, op.imageSha) }
      writeLock(lock)
      printSuccess(`ad created (PAUSED): ${adLockKey} → ${id}`)
      audit({ op: op.op, key: adLockKey, id, creativeId })
    }
    else {
      await setAdCreative(op.adId, creativeId)
      lock.ads[adLockKey] = { id: op.adId, creativeId, fp: adFp(spec, ad, op.imageSha) }
      writeLock(lock)
      printSuccess(`creative refreshed: ${adLockKey}`)
      audit({ op: op.op, key: adLockKey, id: op.adId, creativeId })
    }
  }
  printInfo('Apply complete. Lock file updated — commit scripts/meta/meta.lock.json.')
}
