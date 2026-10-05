import type { MissingSpend } from '@/features/analytics/lib/analytics-rules'
import type { LeadSourceSpendMode } from '@/shared/constants/enums/lead-sources'
import type { LeadSourceSpendEntry } from '@/shared/entities/lead-sources/dal/server/spend'

export interface SpendGridSource {
  id: string
  name: string
  spendMode: LeadSourceSpendMode
  archived: boolean
}

/**
 * Paid sources get a row. An archived paid source keeps its row while it still
 * owes spend or has spend entered in these months, or its warning could never
 * be cleared. Free sources are listed apart; archived free ones are hidden.
 */
export function spendGridRows(
  sources: readonly SpendGridSource[],
  entries: readonly LeadSourceSpendEntry[],
  missing: readonly MissingSpend[],
): { tracked: SpendGridSource[], free: SpendGridSource[] } {
  const stillRelevant = new Set([...missing.map(m => m.leadSourceId), ...entries.map(e => e.leadSourceId)])
  return {
    tracked: sources.filter(s => s.spendMode === 'manual' && (!s.archived || stillRelevant.has(s.id))),
    free: sources.filter(s => s.spendMode === 'none' && !s.archived),
  }
}
