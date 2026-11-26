import type { ResolvedPart, ScopeInstall } from '@/shared/modules/construction/core/types'

export function hasPart(existing: readonly ResolvedPart[], id: string): boolean {
  return existing.some(part => part.id === id && part.condition !== 'absent')
}

export function scopeFitsHome(entry: ScopeInstall, existing: readonly ResolvedPart[]): boolean {
  const { has = [], lacks = [] } = entry.onlyWhere ?? {}
  return has.every(id => hasPart(existing, id)) && lacks.every(id => !hasPart(existing, id))
}
