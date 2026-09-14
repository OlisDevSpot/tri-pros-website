import type { SelectionCounts } from '@/features/meeting-flow/lib/trade-selection'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { formatCount } from '@/features/meeting-flow/lib/format-count'

export function formatSelectionSummary(counts: SelectionCounts): string {
  const parts: string[] = []
  if (counts.scopes > 0) {
    parts.push(formatCount(counts.scopes, SPECIALTIES_COPY.units.scope))
  }
  if (counts.addons > 0) {
    parts.push(formatCount(counts.addons, SPECIALTIES_COPY.units.addon))
  }
  if (counts.reasons > 0) {
    parts.push(formatCount(counts.reasons, SPECIALTIES_COPY.units.reason))
  }
  return parts.length > 0 ? parts.join(' · ') : SPECIALTIES_COPY.sheet.notOnProject
}
