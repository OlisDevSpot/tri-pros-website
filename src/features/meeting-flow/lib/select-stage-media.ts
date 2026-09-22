import type { ShowcaseMedia, ShowcaseProjectIndex } from '@/features/meeting-flow/types'
import type { Scope, Trade } from '@/shared/modules/construction/core/schemas'
import { SCOPE_PHOTOS, TRADE_PHOTOS } from '@/features/meeting-flow/constants/trade-photos'
import { curatedMedia, projectMedia } from '@/features/meeting-flow/lib/to-showcase-media'

/** Every photo the stage can show for a trade: the curated trade photo, curated scope photos, then portfolio projects. Deduped by key. */
export function selectStageMedia(trade: Trade, scopes: Scope[], index: ShowcaseProjectIndex): ShowcaseMedia[] {
  const list: ShowcaseMedia[] = []
  const seen = new Set<string>()
  const add = (media: ShowcaseMedia) => {
    if (!seen.has(media.key)) {
      seen.add(media.key)
      list.push(media)
    }
  }
  const tradePhoto = TRADE_PHOTOS[trade.slug]
  if (tradePhoto) {
    add(curatedMedia(tradePhoto))
  }
  for (const scope of scopes) {
    const scopePhoto = SCOPE_PHOTOS[scope.name]
    if (scopePhoto) {
      add(curatedMedia(scopePhoto))
    }
  }
  for (const project of index.byTrade.get(trade.id) ?? []) {
    add(projectMedia(project))
  }
  return list
}

/** The media with `key`, else the first; `undefined` when the trade has no photos (the fallback renders). */
export function findStageMedia(list: ShowcaseMedia[], key: string | null): ShowcaseMedia | undefined {
  return (key ? list.find(media => media.key === key) : undefined) ?? list[0]
}
