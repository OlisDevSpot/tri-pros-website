/** Trades/scopes/SOW from Notion — stable interface over existing Notion DAL */
function createConstructionDataService() {
  return {
    getTrades: async (): Promise<unknown[]> => {
      throw new Error('constructionDataService.getTrades not implemented')
    },

    getScopesByTrade: async (_params: { tradeId: string }): Promise<unknown[]> => {
      throw new Error('constructionDataService.getScopesByTrade not implemented')
    },

    getSOWTemplates: async (_params: { scopeIds: string[] }): Promise<unknown[]> => {
      throw new Error('constructionDataService.getSOWTemplates not implemented')
    },
  }
}

export type ConstructionDataService = ReturnType<typeof createConstructionDataService>
export const constructionDataService = createConstructionDataService()
