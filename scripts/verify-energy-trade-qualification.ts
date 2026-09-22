/* eslint-disable no-console */
import type { QualificationContext } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { Trade } from '@/shared/modules/construction/core/schemas'
import assert from 'node:assert/strict'
import { isEnergyEfficientTrade } from '@/features/meeting-flow/constants/energy-trades'
import { MEETING_PROGRAMS } from '@/features/meeting-flow/constants/programs'

function trade(id: string, name: string, category: Trade['category']): Trade {
  return { id, name, slug: name.toLowerCase(), coverImageUrl: null, category, scopeIds: [] }
}
function selection(tradeId: string, tradeName: string): TradeSelection {
  return { tradeId, tradeName, selectedScopes: [], painPoints: [] }
}

const SOLAR = trade('6240ca1b-548b-837d-a9c0-01acc1fb530a', 'Solar', 'Energy Efficiency')
const KITCHEN = trade('7351db2c-659c-948e-b0d1-12bdd2ac641b', 'Kitchen', 'General Construction')

assert.equal(isEnergyEfficientTrade(SOLAR), true, 'an Energy Efficiency trade qualifies')
assert.equal(isEnergyEfficientTrade(KITCHEN), false, 'a General Construction trade does not')

const energySaver = MEETING_PROGRAMS.find(p => p.accessor === 'energy-saver-plus')
assert.ok(energySaver, 'the Energy Saver+ program exists')

function ctx(trades: Trade[], selections: TradeSelection[]): QualificationContext {
  return {
    tradeSelections: selections,
    customer: null,
    meetingType: 'Fresh',
    tradesById: new Map(trades.map(t => [t.id, t])),
  } as QualificationContext
}

assert.equal(
  energySaver.qualify(ctx([SOLAR, KITCHEN], [selection(SOLAR.id, 'Solar')])).qualified,
  true,
  'Energy Saver+ qualifies when an energy-efficient trade is selected — the bug this fixes',
)
assert.equal(
  energySaver.qualify(ctx([SOLAR, KITCHEN], [selection(KITCHEN.id, 'Kitchen')])).qualified,
  false,
  'Energy Saver+ does not qualify on a non-energy trade',
)
assert.equal(
  energySaver.qualify(ctx([SOLAR], [selection('not-in-catalog', 'Ghost')])).qualified,
  false,
  'a selection whose trade is missing from the catalog does not qualify, and does not throw',
)

console.log('✅ energy-trade qualification verified')
