import type { ShowcaseMedia, ShowcaseProjectIndex } from '@/features/meeting-flow/types'
import type { ScopeOrAddon } from '@/shared/services/providers/notion/lib/scopes/schema'
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { selectScopeMedia } from '@/features/meeting-flow/lib/select-scope-media'
import { selectStageMedia } from '@/features/meeting-flow/lib/select-stage-media'

/**
 * One photo per work card, keyed by scope id. A scope's own photo wins (its curated photo, else a project
 * tagged with it). Cards still without one borrow from the trade's photos, taking photos no other card shows
 * first and cycling only when the trade has fewer photos than empty cards. Borrowed keys come from
 * `selectStageMedia`, so putting a card's photo on stage always finds it. Null only when the trade has no photos.
 */
export function selectWorkCardMedia(trade: Trade, scopes: ScopeOrAddon[], index: ShowcaseProjectIndex): ReadonlyMap<string, ShowcaseMedia | null> {
  const own = scopes.map(scope => selectScopeMedia(scope, index))
  const shown = new Set(own.flatMap(media => (media ? [media.key] : [])))
  const pool = selectStageMedia(trade, scopes, index)
  const unshown = pool.filter(media => !shown.has(media.key))
  const lender = unshown.length > 0 ? unshown : pool

  const result = new Map<string, ShowcaseMedia | null>()
  let borrowed = 0
  for (const [i, scope] of scopes.entries()) {
    const media = own[i]
    if (media) {
      result.set(scope.id, media)
    }
    else if (lender.length > 0) {
      result.set(scope.id, lender[borrowed % lender.length] ?? null)
      borrowed += 1
    }
    else {
      result.set(scope.id, null)
    }
  }
  return result
}
