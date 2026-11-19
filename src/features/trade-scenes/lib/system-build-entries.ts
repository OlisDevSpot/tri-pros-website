import type { WorkDetailsKind } from '@/features/trade-scenes/lib/work-details-kind'
import type { HomeSystemRow } from '@/features/trade-scenes/types'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'

import { upgradeRowState } from '@/features/trade-scenes/lib/upgrade-row-state'
import { workDetailsKind } from '@/features/trade-scenes/lib/work-details-kind'

export type BuildSwitchId = 'replace:fascia' | 'upgrade:cool-roof' | 'upgrade:r8-ducts' | 'upgrade:cool-paint' | 'upgrade:r38-insulation' | 'style:batts'

interface SystemBuildEntry {
  row: HomeSystemRow
  picked: string | null
  kind: WorkDetailsKind | null
  switches: BuildSwitchId[]
}

// A row that holds an upgrade always lists its switch, taken or not yet; the cool roof and Cool Life move into a pick's
// details once one is made. The fascia sits beside the repaint, the one row on the walls. A blocked row has no switches.
export function systemBuildEntries(rows: HomeSystemRow[], picks: readonly string[], upgrades: readonly EfficiencyUpgradeId[]): SystemBuildEntry[] {
  return rows.map((row) => {
    if (row.blocked !== null) {
      return { row, picked: null, kind: null, switches: [] }
    }
    const { picked, holdsCoolRoof, holdsR8, holdsCoolPaint, holdsR38, holdsBatts } = upgradeRowState(row, picks, upgrades)
    const kind = workDetailsKind(picked)
    const switches: (BuildSwitchId | false)[] = [
      row.part === 'paint' && 'replace:fascia',
      holdsCoolRoof && kind === null && 'upgrade:cool-roof',
      holdsR8 && 'upgrade:r8-ducts',
      holdsCoolPaint && kind === null && 'upgrade:cool-paint',
      holdsR38 && 'upgrade:r38-insulation',
      holdsBatts && 'style:batts',
    ]
    return { row, picked, kind, switches: switches.filter(id => id !== false) }
  })
}
