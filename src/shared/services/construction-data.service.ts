import type { ScopeOrAddon } from '@/shared/services/providers/notion/lib/scopes/schema'
import type { SOW } from '@/shared/services/providers/notion/lib/sows/schema'
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
import { queryNotionDatabase } from '@/shared/services/providers/notion/dal/query-notion-database'
import { pageToTiptapJson } from '@/shared/services/providers/notion/lib/page-to-tiptap-json'
import { pageToScope } from '@/shared/services/providers/notion/lib/scopes/adapter'
import { pageToSOW } from '@/shared/services/providers/notion/lib/sows/adapter'
import { pageToTrade } from '@/shared/services/providers/notion/lib/trades/adapter'

/** Trades/scopes/SOW from Notion — stable interface over existing Notion DAL */
function createConstructionDataService() {
  return {
    getTrades: async (): Promise<Trade[]> => {
      const raw = await queryNotionDatabase('trades', {
        sortBy: { property: 'name', direction: 'ascending' },
      })
      if (!raw) {
        return []
      }
      const trades = raw.flatMap((page) => {
        const trade = pageToTrade(page)
        return trade ? [trade] : []
      })
      if (trades.length < raw.length) {
        console.warn(`[constructionDataService.getTrades] dropped ${raw.length - trades.length} of ${raw.length} trades`)
      }
      return trades
    },

    getAllScopes: async (): Promise<ScopeOrAddon[]> => {
      const raw = await queryNotionDatabase('scopes')
      if (!raw) {
        return []
      }
      const scopes = raw.flatMap(page => pageToScope(page) ?? [])
      if (scopes.length < raw.length) {
        console.warn(`[constructionDataService.getAllScopes] dropped ${raw.length - scopes.length} of ${raw.length} scopes`)
      }
      return scopes
    },

    getScopesByQuery: async (params: {
      query?: string
      filterProperty?: string
      sortBy?: { property: string, direction: 'ascending' | 'descending' }
    }): Promise<ScopeOrAddon[]> => {
      const raw = await queryNotionDatabase('scopes', params as Parameters<typeof queryNotionDatabase<'scopes'>>[1])
      if (!raw) {
        return []
      }
      const scopes = raw.flatMap(page => pageToScope(page) ?? [])
      if (scopes.length < raw.length) {
        console.warn(`[constructionDataService.getScopesByQuery] dropped ${raw.length - scopes.length} of ${raw.length} scopes`)
      }
      return scopes
    },

    getSOWsByScope: async (params: { scopeId: string }): Promise<SOW[]> => {
      const raw = await queryNotionDatabase('sows', {
        filterProperty: 'relatedScope',
        query: params.scopeId,
      })
      if (!raw) {
        return []
      }
      const sows = raw.flatMap(page => pageToSOW(page) ?? [])
      if (sows.length < raw.length) {
        console.warn(`[constructionDataService.getSOWsByScope] dropped ${raw.length - sows.length} of ${raw.length} sows`)
      }
      return sows
    },

    getSOWContent: async (params: { sowId: string }): Promise<string> => {
      return pageToTiptapJson(params.sowId)
    },
  }
}

export type ConstructionDataService = ReturnType<typeof createConstructionDataService>
export const constructionDataService = createConstructionDataService()
