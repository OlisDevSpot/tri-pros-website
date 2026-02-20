import type { ScopeAccessor, TradeAccessor } from '../db/types'

export interface SOW {
  title: string
  scopes: ScopeAccessor[]
  trade: TradeAccessor
  html: string
}
