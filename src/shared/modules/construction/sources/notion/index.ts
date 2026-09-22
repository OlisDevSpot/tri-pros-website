import type { PageObjectResponse } from '@notionhq/client'
import type { ConstructionCatalogSource } from '../types'
import { pageToTiptapJson } from './page-to-tiptap'
import { pageToPainPoint } from './pain-points/adapter'
import { queryNotionDatabase } from './query'
import { pageToScope } from './scopes/adapter'
import { pageToSowTemplate } from './sows/adapter'
import { pageToTrade } from './trades/adapter'

/**
 * The Notion-backed catalog source. The only file that assembles the Notion
 * implementation; nothing outside `sources/` imports `sources/notion/*`.
 *
 * Every list read drops invalid rows rather than throwing, and warns with a
 * count — see ../../DOCS.md#adapter-returns-entity-or-null (P0).
 */
function readAll<T>(
  label: string,
  raw: PageObjectResponse[] | undefined,
  adapt: (page: PageObjectResponse) => T | null,
): T[] {
  if (!raw) {
    return []
  }
  const rows = raw.flatMap(page => adapt(page) ?? [])
  if (rows.length < raw.length) {
    console.warn(`[notionCatalogSource.${label}] dropped ${raw.length - rows.length} of ${raw.length} rows`)
  }
  return rows
}

export const notionCatalogSource: ConstructionCatalogSource = {
  getTrades: async () => readAll(
    'getTrades',
    await queryNotionDatabase('trades', { sortBy: { property: 'name', direction: 'ascending' } }),
    pageToTrade,
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
