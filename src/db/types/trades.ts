import type { tradesData } from '@/db/seeds/data/trades'

export type TradeAccessor = (typeof tradesData)[number]['accessor']
