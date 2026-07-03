import type { AccountState } from '../lib/marketing-api.js'
import type { CampaignSpec } from '../campaign-specs/lib/types.js'
import type { MetaLock } from './lock.js'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'
import { adFp, adSetFp, campaignFp, sha256Hex } from './fingerprint.js'

export type PlanOp =
  | { op: 'create-campaign', campaignKey: string }
  | { op: 'update-campaign', campaignKey: string, id: string }
  | { op: 'create-adset', campaignKey: string }
  | { op: 'update-adset', campaignKey: string, id: string }
  | { op: 'create-ad', campaignKey: string, adKey: string, imageSha: string }
  | { op: 'refresh-creative', campaignKey: string, adKey: string, adId: string, imageSha: string }
  | { op: 'skip-ad-missing-image', campaignKey: string, adKey: string, imagePath: string }
  | { op: 'orphan', kind: 'campaign' | 'adset' | 'ad', id: string, name: string }

export function adImagePath(spec: CampaignSpec, imageFile: string): string {
  return join(process.cwd(), 'public/funnels', spec.funnelSlug, 'ads', imageFile)
}

export function computePlan(specs: CampaignSpec[], lock: MetaLock, state: AccountState): PlanOp[] {
  const ops: PlanOp[] = []
  const remoteIds = new Set([
    ...state.campaigns.map(c => c.id),
    ...state.adSets.map(a => a.id),
    ...state.ads.map(a => a.id),
  ])

  for (const spec of specs) {
    // ── campaign ──
    const cLock = lock.campaigns[spec.key]
    if (!cLock || !remoteIds.has(cLock.id))
      ops.push({ op: 'create-campaign', campaignKey: spec.key })
    else if (cLock.fp !== campaignFp(spec))
      ops.push({ op: 'update-campaign', campaignKey: spec.key, id: cLock.id })

    // ── ad set (v1: exactly one per campaign) ──
    const asKey = `${spec.key}/${spec.adSet.key}`
    const asLock = lock.adSets[asKey]
    if (!asLock || !remoteIds.has(asLock.id))
      ops.push({ op: 'create-adset', campaignKey: spec.key })
    else if (asLock.fp !== adSetFp(spec))
      ops.push({ op: 'update-adset', campaignKey: spec.key, id: asLock.id })

    // ── ads ──
    for (const ad of spec.ads) {
      const imagePath = adImagePath(spec, ad.imageFile)
      if (!existsSync(imagePath)) {
        ops.push({ op: 'skip-ad-missing-image', campaignKey: spec.key, adKey: ad.key, imagePath })
        continue
      }
      const imageSha = sha256Hex(readFileSync(imagePath))
      const adLockKey = `${spec.key}/${ad.key}`
      const aLock = lock.ads[adLockKey]
      if (!aLock || !remoteIds.has(aLock.id))
        ops.push({ op: 'create-ad', campaignKey: spec.key, adKey: ad.key, imageSha })
      else if (aLock.fp !== adFp(spec, ad, imageSha))
        ops.push({ op: 'refresh-creative', campaignKey: spec.key, adKey: ad.key, adId: aLock.id, imageSha })
    }
  }

  // ── orphans: live account objects the lock manages… nothing else is ours to touch.
  // Anything in the account that is NOT in the lock AND NOT just created by specs is
  // reported (never modified) so old wizard-era objects stay visible.
  const managedIds = new Set([
    ...Object.values(lock.campaigns).map(e => e.id),
    ...Object.values(lock.adSets).map(e => e.id),
    ...Object.values(lock.ads).map(e => e.id),
  ])
  for (const c of state.campaigns) {
    if (!managedIds.has(c.id))
      ops.push({ op: 'orphan', kind: 'campaign', id: c.id, name: c.name })
  }
  for (const a of state.adSets) {
    if (!managedIds.has(a.id))
      ops.push({ op: 'orphan', kind: 'adset', id: a.id, name: a.name })
  }
  for (const a of state.ads) {
    if (!managedIds.has(a.id))
      ops.push({ op: 'orphan', kind: 'ad', id: a.id, name: a.name })
  }

  return ops
}
