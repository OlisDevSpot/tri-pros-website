import type { PageObjectResponse } from '@notionhq/client'
import type { ConstructionCatalogSource } from '../types'
import { pageToTiptapJson } from './page-to-tiptap'
import { pageToPainPoint } from './pain-points/adapter'
import { queryNotionDatabase } from './query'
import { pageToScope } from './scopes/adapter'
import { pageToSowTemplate } from './sows/adapter'
import { isDisabledTrade, pageToTrade } from './trades/adapter'

/**
 * The Notion-backed catalog source. The only file that assembles the Notion
 * implementation; nothing outside `sources/` imports `sources/notion/*`.
 *
 * Every list read drops invalid rows rather than throwing, and warns with a
 * count. Rows hidden on purpose (a disabled trade) are filtered first, so
 * the count only ever means rows someone has to fix in Notion.
 */
function readAll<T>(
  label: string,
  raw: PageObjectResponse[] | undefined,
  adapt: (page: PageObjectResponse) => T | null,
  isHidden: (page: PageObjectResponse) => boolean = () => false,
): T[] {
  if (!raw) {
    return []
  }
  const shown = raw.filter(page => !isHidden(page))
  const rows = shown.flatMap(page => adapt(page) ?? [])
  if (rows.length < shown.length) {
    console.warn(`[notionCatalogSource.${label}] dropped ${shown.length - rows.length} invalid of ${shown.length} rows`)
  }
  return rows
}

export const notionCatalogSource: ConstructionCatalogSource = {
  getTrades: async () => readAll(
    'getTrades',
    await queryNotionDatabase('trades', { sortBy: { property: 'name', direction: 'ascending' } }),
    pageToTrade,
    isDisabledTrade,
  ),

  getScopes: async () => readAll('getScopes', await queryNotionDatabase('scopes'), pageToScope),

  getSowTemplatesByScope: async scopeId => readAll(
    'getSowTemplatesByScope',
    await queryNotionDatabase('sows', { filterProperty: 'scopeIds', query: scopeId }),
    pageToSowTemplate,
  ),

  getSowContent: async sowId => pageToTiptapJson(sowId),

  getPainPoints: async () => readAll('getPainPoints', await queryNotionDatabase('painPoints'), pageToPainPoint),
}
