import type { tradesData } from '@/shared/db/seeds/data/trades'

export type TradeAccessor = (typeof tradesData)[number]['accessor']
