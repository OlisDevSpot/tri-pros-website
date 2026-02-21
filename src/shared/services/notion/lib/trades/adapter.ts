import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { Trade } from './schema'
import { relationIds, selectName, titleText } from '../extractors'
import { TRADE_PROPERTIES_MAP } from './properties-map'
import { tradeSchema } from './schema'

export function pageToTrade(page: PageObjectResponse): Trade {
  const p = page.properties

  const raw: Partial<Trade> = {
    id: page.id,
    name: titleText(p, TRADE_PROPERTIES_MAP.name.label),
    homeOrLot: selectName<'Home' | 'Lot'>(p, TRADE_PROPERTIES_MAP.homeOrLot.label) ?? undefined,
    type: selectName(p, TRADE_PROPERTIES_MAP.type.label) ?? undefined,
    relatedScopes: relationIds(p, TRADE_PROPERTIES_MAP.relatedScopes.label),
  }

  const valid = tradeSchema.safeParse(raw)

  if (valid.success)
    return valid.data

  throw new Error(valid.error.message)
}
