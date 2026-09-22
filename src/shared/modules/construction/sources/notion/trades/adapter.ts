import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { Trade } from '@/shared/modules/construction/core/schemas'
import { slugifyTradeName } from '@/shared/lib/slugify-trade-name'
import { tradeSchema } from '@/shared/modules/construction/core/schemas'
import { checkbox, relationIds, selectName, titleText } from '../extractors'
import { normalizeNotionId } from '../normalize-id'
import { TRADE_PROPERTIES_MAP } from './properties-map'

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

// see ../../DOCS.md#adapter-returns-entity-or-null
// see ../../DOCS.md#disabled-checkbox-is-extraction-time-gate
export function pageToTrade(page: PageObjectResponse): Trade | null {
  try {
    const p = page.properties

    if (checkbox(p, TRADE_PROPERTIES_MAP.disabled.label)) {
      return null
    }

    const name = titleText(p, TRADE_PROPERTIES_MAP.name.label)

    const raw: Partial<Trade> = {
      id: normalizeNotionId(page.id),
      name,
      slug: slugifyTradeName(name),
      coverImageUrl: extractCoverImageUrl(page),
      category: selectName(p, TRADE_PROPERTIES_MAP.category.label) ?? undefined,
      scopeIds: relationIds(p, TRADE_PROPERTIES_MAP.scopeIds.label).map(normalizeNotionId),
    }

    const valid = tradeSchema.safeParse(raw)

    if (valid.success) {
      return valid.data
    }

    console.warn('[pageToTrade] Skipping invalid trade', {
      id: page.id,
      name,
      issues: valid.error.issues,
    })
    return null
  }
  catch (err) {
    console.warn('[pageToTrade] Failed to extract trade', { id: page.id, error: err })
    return null
  }
}
