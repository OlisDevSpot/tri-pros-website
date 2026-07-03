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

  // Index remote objects by name for adoption fallback (exact match, first wins).
  const remoteCampaignByName = new Map(state.campaigns.map(c => [c.name, c.id]))
  const remoteAdSetByName = new Map(state.adSets.map(a => [a.name, a.id]))
  const remoteAdByName = new Map(state.ads.map(a => [a.name, a.id]))

  // Track which lock keys are backed by an active spec so we can report the rest.
  const specBackedCampaignKeys = new Set<string>()
  const specBackedAdSetKeys = new Set<string>()
  const specBackedAdKeys = new Set<string>()

  for (const spec of specs) {
    // ── campaign ──
    specBackedCampaignKeys.add(spec.key)
    const cLock = lock.campaigns[spec.key]
    if (!cLock || !remoteIds.has(cLock.id)) {
      // Adoption: if a remote campaign already has our deterministic name, update it
      // instead of creating a new one. Closes the crash-between-create-and-writeLock window.
      const adoptId = remoteCampaignByName.get(spec.name)
      if (adoptId)
        ops.push({ op: 'update-campaign', campaignKey: spec.key, id: adoptId })
      else
        ops.push({ op: 'create-campaign', campaignKey: spec.key })
    }
    else if (cLock.fp !== campaignFp(spec)) {
      ops.push({ op: 'update-campaign', campaignKey: spec.key, id: cLock.id })
    }

    // ── ad set (v1: exactly one per campaign) ──
    const asKey = `${spec.key}/${spec.adSet.key}`
    specBackedAdSetKeys.add(asKey)
    const asLock = lock.adSets[asKey]
    if (!asLock || !remoteIds.has(asLock.id)) {
      const adoptId = remoteAdSetByName.get(spec.adSet.name)
      if (adoptId)
        ops.push({ op: 'update-adset', campaignKey: spec.key, id: adoptId })
      else
        ops.push({ op: 'create-adset', campaignKey: spec.key })
    }
    else if (asLock.fp !== adSetFp(spec)) {
      ops.push({ op: 'update-adset', campaignKey: spec.key, id: asLock.id })
    }

    // ── ads ──
    for (const ad of spec.ads) {
      const adLockKey = `${spec.key}/${ad.key}`
      specBackedAdKeys.add(adLockKey)
      const imagePath = adImagePath(spec, ad.imageFile)
      if (!existsSync(imagePath)) {
        ops.push({ op: 'skip-ad-missing-image', campaignKey: spec.key, adKey: ad.key, imagePath })
        continue
      }
      const imageSha = sha256Hex(readFileSync(imagePath))
      const aLock = lock.ads[adLockKey]
      if (!aLock || !remoteIds.has(aLock.id)) {
        const adoptName = `${spec.key} — ${ad.key}`
        const adoptId = remoteAdByName.get(adoptName)
        if (adoptId)
          ops.push({ op: 'refresh-creative', campaignKey: spec.key, adKey: ad.key, adId: adoptId, imageSha })
        else
          ops.push({ op: 'create-ad', campaignKey: spec.key, adKey: ad.key, imageSha })
      }
      else if (aLock.fp !== adFp(spec, ad, imageSha)) {
        ops.push({ op: 'refresh-creative', campaignKey: spec.key, adKey: ad.key, adId: aLock.id, imageSha })
      }
    }
  }

  // ── managed set: all IDs tracked by the lock (spec-backed or not).
  // Spec-less lock entries are added to managedIds so they don't double-report from the
  // remote scan below, but they also emit their own orphan op so the operator can see them.
  const managedIds = new Set([
    ...Object.values(lock.campaigns).map(e => e.id),
    ...Object.values(lock.adSets).map(e => e.id),
    ...Object.values(lock.ads).map(e => e.id),
  ])

  // ── spec-less lock orphans: lock entries whose spec key was removed or renamed.
  // They are in managedIds (so the remote scan below won't double-count them) but have
  // no active spec driving them — report as orphans so the operator can see spending objects.
  for (const [lockKey, entry] of Object.entries(lock.campaigns)) {
    if (!specBackedCampaignKeys.has(lockKey))
      ops.push({ op: 'orphan', kind: 'campaign', id: entry.id, name: `${lockKey} (spec removed; lock-managed)` })
  }
  for (const [lockKey, entry] of Object.entries(lock.adSets)) {
    if (!specBackedAdSetKeys.has(lockKey))
      ops.push({ op: 'orphan', kind: 'adset', id: entry.id, name: `${lockKey} (spec removed; lock-managed)` })
  }
  for (const [lockKey, entry] of Object.entries(lock.ads)) {
    if (!specBackedAdKeys.has(lockKey))
      ops.push({ op: 'orphan', kind: 'ad', id: entry.id, name: `${lockKey} (spec removed; lock-managed)` })
  }

  // ── remote orphans: live account objects not in the lock at all.
  // Anything in the account that is NOT in managedIds is reported (never modified)
  // so old wizard-era objects stay visible.
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
