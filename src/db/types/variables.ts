import type { TradeAccessor } from './trades'
import type { variablesData } from '@/db/seeds/data/variables'

export type VariablesData = typeof variablesData
export type VariablesKeys<Trade extends TradeAccessor> = VariablesData[Trade][number]['key']
