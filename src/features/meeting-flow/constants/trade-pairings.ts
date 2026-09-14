import type { TradePairing } from '@/features/meeting-flow/types'

/** Natural scope pairings by Notion trade slug. Source: docs/sales/in-home-meeting-playbook.md (Natural Scope Pairings). */
export const TRADE_PAIRINGS: Record<string, TradePairing> = {
  'roof-and-gutters': { pairedSlug: 'attic-and-basement', reason: 'attic is already accessible' },
  'attic-and-basement': { pairedSlug: 'hvac', reason: 'energy savings compound' },
  'hvac': { pairedSlug: 'attic-and-basement', reason: 'energy savings compound' },
  'windows-and-doors': { pairedSlug: 'attic-and-basement', reason: 'envelope sealing — complete comfort story' },
}
