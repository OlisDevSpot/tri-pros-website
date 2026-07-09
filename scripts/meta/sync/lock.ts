// terraform-state-lite: maps spec keys → Meta IDs + the fingerprint each object
// was last synced with. Committed to git — the audit trail of what we manage.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

export interface LockEntry {
  id: string
  fp: string
}

export interface AdLockEntry extends LockEntry {
  creativeId: string
}

export interface MetaLock {
  campaigns: Record<string, LockEntry>
  adSets: Record<string, LockEntry>
  ads: Record<string, AdLockEntry>
  /** sha256(image file bytes) → Meta image_hash (upload dedup) */
  images: Record<string, string>
  /** sha256(video file bytes) → Meta video id (upload dedup; video files are gitignored, so the lock is the only durable mapping) */
  videos: Record<string, string>
}

const LOCK_PATH = join(process.cwd(), 'scripts/meta/meta.lock.json')

// readLock spreads EMPTY under the parsed file, so pre-`videos` committed locks
// keep parsing (missing sections default to {}) and gain the field on next write.
const EMPTY: MetaLock = { campaigns: {}, adSets: {}, ads: {}, images: {}, videos: {} }

export function readLock(): MetaLock {
  if (!existsSync(LOCK_PATH))
    return structuredClone(EMPTY)
  return { ...structuredClone(EMPTY), ...JSON.parse(readFileSync(LOCK_PATH, 'utf8')) as MetaLock }
}

export function writeLock(lock: MetaLock): void {
  writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`)
}
