import type { Trade } from '@/shared/modules/construction/sources/notion/trades/schema'

/**
 * Energy-efficient trades are classified by their Notion category, not by a
 * hardcoded id list. The previous list compared Notion page UUIDs against
 * ['insulation','hvac','windows','solar'], so it never matched and the Energy
 * Saver+ program could never qualify — and two of those four keys did not
 * name a real trade either.
 *
 * Landing already classifies on the same field (PILLAR_TYPE_MAP in
 * features/landing/lib/notion-trade-helpers.ts). The construction epic folds
 * both into one module rule at P2 (F11).
 */
export function isEnergyEfficientTrade(trade: Trade): boolean {
  return trade.type === 'Energy Efficiency'
}
