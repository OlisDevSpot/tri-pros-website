import type { scopesData } from '@/shared/db/seeds/data/scopes'

export type ScopeAccessor = typeof scopesData[keyof typeof scopesData][number]['accessor']
export type ScopeAccessorOfTrade<T extends keyof typeof scopesData> = typeof scopesData[T][number]['accessor']

export type JoinTableAccessors = 'benefits' | 'variables'
