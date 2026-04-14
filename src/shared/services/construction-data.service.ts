import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import type { SOW } from '@/shared/services/notion/lib/sows/schema'
import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'
import { pageToTiptapJson } from '@/shared/services/notion/lib/page-to-tiptap-json'
import { pageToScope } from '@/shared/services/notion/lib/scopes/adapter'
import { pageToSOW } from '@/shared/services/notion/lib/sows/adapter'
import { pageToTrade } from '@/shared/services/notion/lib/trades/adapter'

/** Trades/scopes/SOW from Notion — stable interface over existing Notion DAL */
function createConstructionDataService() {
  return {
    getTrades: async (): Promise<Trade[]> => {
      const raw = await queryNotionDatabase('trades', {
        sortBy: { property: 'name', direction: 'ascending' },
      })
      return raw ? raw.map(pageToTrade) : []
    },

    getTradesByQuery: async (params: { query: string }): Promise<Trade[]> => {
      const raw = await queryNotionDatabase('trades', {
        query: params.query,
        filterProperty: 'name',
        sortBy: { property: 'name', direction: 'ascending' },
      })
      return raw ? raw.map(pageToTrade) : []
    },

    getAllScopes: async (): Promise<ScopeOrAddon[]> => {
      const raw = await queryNotionDatabase('scopes')
      return raw ? raw.map(pageToScope) : []
    },

    getScopesByQuery: async (params: {
      query?: string
      filterProperty?: string
      sortBy?: { property: string, direction: 'ascending' | 'descending' }
    }): Promise<ScopeOrAddon[]> => {
      const raw = await queryNotionDatabase('scopes', params as Parameters<typeof queryNotionDatabase<'scopes'>>[1])
      return raw ? raw.map(pageToScope) : []
    },

    getScopesByTrade: async (params: { tradeId: string }): Promise<ScopeOrAddon[]> => {
      const raw = await queryNotionDatabase('scopes', {
        query: params.tradeId,
        filterProperty: 'relatedTrade',
      })
      return raw ? raw.map(pageToScope) : []
    },

    getSOWsByScope: async (params: { scopeId: string }): Promise<SOW[]> => {
      const raw = await queryNotionDatabase('sows', {
        filterProperty: 'relatedScope',
        query: params.scopeId,
      })
      return raw ? raw.map(pageToSOW) : []
    },

    getSOWContent: async (params: { sowId: string }): Promise<string> => {
      return pageToTiptapJson(params.sowId)
    },
  }
}

export type ConstructionDataService = ReturnType<typeof createConstructionDataService>
export const constructionDataService = createConstructionDataService()
