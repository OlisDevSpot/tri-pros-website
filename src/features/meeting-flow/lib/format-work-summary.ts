import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'

export function formatWorkSummary(entry: TradeSelection): string {
  const [first, ...rest] = entry.selectedScopes
  if (!first) {
    return SPECIALTIES_COPY.panel.noWork
  }
  return rest.length > 0 ? SPECIALTIES_COPY.panel.workSummary(first.label, rest.length) : first.label
}
