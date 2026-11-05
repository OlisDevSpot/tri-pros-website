import type { SavingsCategory } from '@/features/trade-scenes/types'

export const SAVINGS_CATEGORIES = ['electric', 'gas'] as const satisfies readonly SavingsCategory[]
