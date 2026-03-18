import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { Trade } from './schema'
import { slugifyTradeName } from '@/shared/lib/slugify-trade-name'
import { relationIds, selectName, titleText } from '../extractors'
import { TRADE_PROPERTIES_MAP } from './properties-map'
import { tradeSchema } from './schema'

function extractCoverImageUrl(page: PageObjectResponse): string | null {
  const cover = page.cover
  if (!cover) {
    return null
  }

  if (cover.type === 'external') {
    return cover.external.url
  }

  if (cover.type === 'file') {
    return cover.file.url
  }

  return null
}

export function pageToTrade(page: PageObjectResponse): Trade {
  const p = page.properties
  const name = titleText(p, TRADE_PROPERTIES_MAP.name.label)

  const raw: Partial<Trade> = {
    id: page.id,
    name,
    slug: slugifyTradeName(name),
    coverImageUrl: extractCoverImageUrl(page),
    homeOrLot: selectName<'Home' | 'Lot'>(p, TRADE_PROPERTIES_MAP.homeOrLot.label) ?? undefined,
    type: selectName(p, TRADE_PROPERTIES_MAP.type.label) ?? undefined,
    relatedScopes: relationIds(p, TRADE_PROPERTIES_MAP.relatedScopes.label),
  }

  const valid = tradeSchema.safeParse(raw)

  if (valid.success) {
    return valid.data
  }

  throw new Error(valid.error.message)
}
