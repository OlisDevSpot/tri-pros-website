import type { RepairsRow } from '@/features/trade-scenes/lib/repairs-rows'
import type { BenefitLine, HomeSystemId, SceneSavings } from '@/features/trade-scenes/types'
import type { EfficiencyUpgradeId } from '@/shared/modules/construction/core/constants/efficiency-upgrades'
import type { InstallStyleId } from '@/shared/modules/construction/core/constants/install-styles'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'
import type { HomeFacts } from '@/shared/modules/construction/core/types'

import { TRADE_SYSTEM } from '@/features/trade-scenes/constants/benefit-systems'
import { BENEFITS_COPY, WEAR_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SYSTEM_IDS } from '@/features/trade-scenes/constants/home-systems'
import { SAVINGS_CATEGORIES } from '@/features/trade-scenes/constants/savings-categories'
import { systemCuts } from '@/features/trade-scenes/lib/system-cuts'
import { upgradeRows } from '@/features/trade-scenes/lib/upgrade-rows'
import { BILL_CATEGORY_LABELS } from '@/shared/modules/construction/core/constants/bill-categories'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'
import { HOME_MATERIALS } from '@/shared/modules/construction/core/constants/home-materials'
import { UPGRADE_REGISTRY } from '@/shared/modules/construction/core/constants/upgrade-registry'
import { formatRowClaim } from '@/shared/modules/construction/core/lib/bill-cut-claims'
import { fillBenefitText } from '@/shared/modules/construction/core/lib/fill-benefit-text'
import { installedMaterial } from '@/shared/modules/construction/core/lib/installed-material'

interface BuildBenefitsInput {
  facts: HomeFacts
  picks: Record<HomeSystemId, ScopeId[]>
  savings: SceneSavings
  repairs: readonly RepairsRow[]
  efficiencyUpgrades: readonly EfficiencyUpgradeId[]
  // Absent reads as no style, as the installed material does.
  installStyles?: readonly InstallStyleId[]
}

type UpkeepMaterial = keyof typeof BENEFITS_COPY.upkeep.materials

// The materials that carry repairs are the four the copy names a noun for; their trades are distinct.
function upkeepMaterial(trade: TradeSlug): UpkeepMaterial {
  return HOME_MATERIAL_IDS.find(id => HOME_MATERIALS[id].repairs && HOME_MATERIALS[id].trade === trade) as UpkeepMaterial
}

export function buildBenefits({ facts, picks, savings, repairs, efficiencyUpgrades, installStyles = [] }: BuildBenefitsInput): BenefitLine[] {
  const cuts = systemCuts(savings)
  const rows = upgradeRows(facts, Object.values(picks).flat(), efficiencyUpgrades)

  return HOME_SYSTEM_IDS.flatMap((system): BenefitLine[] => {
    const lines: BenefitLine[] = picks[system].flatMap((scopeId) => {
      const { name, benefits } = UPGRADE_REGISTRY[scopeId]
      const material = installedMaterial(scopeId, efficiencyUpgrades, installStyles)
      return benefits
        .filter(benefit => (benefit.onlyWith === undefined || efficiencyUpgrades.includes(benefit.onlyWith)) && (benefit.onlyWithout === undefined || !efficiencyUpgrades.includes(benefit.onlyWithout)))
        .map(benefit => ({ system, kind: benefit.kind, title: fillBenefitText(benefit.title, material), detail: fillBenefitText(benefit.detail, material), from: name, figure: null, soon: false }))
    })

    const cut = cuts[system]
    if (cut) {
      const earned = SAVINGS_CATEGORIES.flatMap(category => cut[category] ? [{ category, ...cut[category] }] : [])
      const saved = Math.round(earned.reduce((total, { monthly }) => total + monthly, 0))
      lines.push({
        system,
        kind: 'savings',
        title: BENEFITS_COPY.savings.title(earned.map(({ category, percent }) => BENEFITS_COPY.savings.clause(BILL_CATEGORY_LABELS[category], formatRowClaim(Math.round(percent)))).join(', ')),
        detail: BENEFITS_COPY.savings.detail(String(saved), earned.map(({ category }) => BENEFITS_COPY.savings.billAmount(BILL_CATEGORY_LABELS[category], String(Math.round(savings.cuts[category].bill)))).join(BENEFITS_COPY.savings.and)),
        from: null,
        figure: saved,
        soon: false,
      })
    }

    for (const [trade, figure] of Object.entries(savings.repairsByTrade) as [TradeSlug, NonNullable<SceneSavings['repairsByTrade'][TradeSlug]>][]) {
      if (TRADE_SYSTEM[trade] !== system || figure.value <= 0) {
        continue
      }
      const { title, old } = BENEFITS_COPY.upkeep.materials[upkeepMaterial(trade)]
      const typed = figure.source === 'input'
      const wear = repairs.find(row => row.trade === trade)?.wear ?? null
      const amount = String(Math.round(figure.value))
      const condition = typed ? BENEFITS_COPY.upkeep.typed : wear === null ? null : WEAR_LABELS[wear]
      lines.push({
        system,
        kind: 'savings',
        title,
        detail: BENEFITS_COPY.upkeep.detail(old, typed ? BENEFITS_COPY.upkeep.costTyped(amount) : BENEFITS_COPY.upkeep.cost(amount), condition === null ? '' : BENEFITS_COPY.upkeep.condition(condition)),
        from: null,
        figure: Math.round(figure.value / 12),
        soon: false,
      })
    }

    const savesEnergy = rows.some(row => row.id === system && row.rows.some(({ kinds }) => picks[system].some(scopeId => kinds[scopeId] === 'saves-energy')))
    if (savesEnergy) {
      lines.push({ system, kind: 'planet', title: BENEFITS_COPY.planet.title, detail: BENEFITS_COPY.planet.detail, from: null, figure: null, soon: true })
    }
    return lines
  })
}
