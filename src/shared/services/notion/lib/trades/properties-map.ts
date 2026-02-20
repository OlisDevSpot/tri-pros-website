import type { Trade } from './schema'

export const TRADE_PROPERTIES_MAP = {
  name: 'Trade',
  type: 'Type',
  homeOrLot: 'Home or Lot',
  relatedScopes: 'Scopes',
} as const satisfies Omit<Record<keyof Trade, string>, 'id'>
