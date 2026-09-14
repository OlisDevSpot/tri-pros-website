import type { TradeScopeGroup } from '@/features/meeting-flow/types'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { formatCount } from '@/features/meeting-flow/lib/format-count'

export function formatTradeMeta(group: TradeScopeGroup | undefined): string {
  const parts: string[] = []
  if (group && group.scopes.length > 0) {
    parts.push(formatCount(group.scopes.length, SPECIALTIES_COPY.units.scope))
  }
  if (group && group.addons.length > 0) {
    parts.push(formatCount(group.addons.length, SPECIALTIES_COPY.units.addon))
  }
  return parts.length > 0 ? parts.join(' · ') : SPECIALTIES_COPY.catalog.scopesToDefine
}
