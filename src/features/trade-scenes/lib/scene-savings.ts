import type { SavingsCategory, SceneSavings, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { BillCutAddOnId } from '@/shared/modules/construction/core/constants/bill-cut-add-ons'
import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'
import type { TradeBillCuts } from '@/shared/modules/construction/core/schemas/bill-cuts'
import type { Assembly, BillCut, ExistingConditions, ResolvedHomeMaterials, ResolvedPart, ScopeInstall } from '@/shared/modules/construction/core/types'

import { CLIMATE_DEFAULT_BILLS } from '@/features/trade-scenes/constants/climate-bills'
import { SAVINGS_CATEGORIES } from '@/features/trade-scenes/constants/savings-categories'
import { repairsFigure } from '@/features/trade-scenes/lib/repairs-figure'
import { HOME_MATERIAL_IDS } from '@/shared/modules/construction/core/constants/home-material-ids'
import { HOME_MATERIALS } from '@/shared/modules/construction/core/constants/home-materials'
import { SCOPE_INSTALLS } from '@/shared/modules/construction/core/constants/scope-installs'
import { billsPaid } from '@/shared/modules/construction/core/lib/bills-paid'
import { combineCuts } from '@/shared/modules/construction/core/lib/combine-cuts'
import { cutFor } from '@/shared/modules/construction/core/lib/cut-for'
import { installKind } from '@/shared/modules/construction/core/lib/install-kind'

interface SceneSavingsInput {
  resolved: readonly { assembly: Assembly, parts: readonly ResolvedPart[], existing: ExistingConditions }[]
  home: ResolvedHomeMaterials
  climate: Climate
  proposedScopeIds: readonly string[]
  bills: TradeSceneInputs['bills']
  repairsOverrides: TradeSceneInputs['repairsOverrides']
}

interface LandedOn {
  baseTrades: TradeSlug[]
  addOns: BillCutAddOnId[]
  addOnTrades: TradeSlug[]
}

interface Landed {
  byCategory: Record<SavingsCategory, LandedOn>
  repairs: { trade: TradeSlug, wear: Wear | null }[]
}

const newByCategory = <T>() => Object.fromEntries(SAVINGS_CATEGORIES.map(category => [category, new Set<T>()])) as Record<SavingsCategory, Set<T>>

// The scene credits only work it draws, part by part. A bill moves only for an installed part that beats what the home has there (a
// like-for-like part earns nothing), while repairs are avoided only by a part that is the material itself (a new gutter is not a new roof), once per material.
function landed({ resolved, home, proposedScopeIds }: SceneSavingsInput, installs: Partial<Record<string, ScopeInstall>>): Landed {
  const baseTrades = newByCategory<TradeSlug>()
  const addOns = newByCategory<BillCutAddOnId>()
  const addOnTrades = newByCategory<TradeSlug>()
  const repairs = new Map<TradeSlug, Wear | null>()
  const credited = new Set<string>()

  for (const { assembly, parts, existing } of resolved) {
    // New ducts save only on a bill the home pays that side on both today and after the build, so a furnace-only home never
    // earns them on electric, and a home whose heat pump takes the furnace out never earns them on gas.
    const paidToday = billsPaid(Object.entries(existing.parts).map(([id, entry]) => ({ id, ...entry })), assembly)
    const paidAfter = billsPaid(parts, assembly)
    const addOnLands = (category: SavingsCategory) => (paidToday?.has(category) ?? true) && (paidAfter?.has(category) ?? true)
    for (const part of parts) {
      if (part.condition !== 'installed' || part.material === null) {
        continue
      }
      const scope = proposedScopeIds.map(id => installs[id]).find(entry => entry?.assembly === assembly.id && entry.installs.some(install => install.part === part.id))
      const definition = assembly.parts.find(candidate => candidate.id === part.id)
      if (!scope || !definition) {
        continue
      }
      const baseLands = (category: SavingsCategory) => definition.materials[part.material!].bills?.includes(category) ?? true
      const saves = (material: string) => installKind(definition, existing.parts[part.id]?.material ?? null, material) === 'saves-energy'
      const { cut, stepUp } = definition.materials[part.material]
      // A step up earns the base only over a home below where it steps up from, so topping off R-30 to R-38 earns the step alone.
      if (stepUp) {
        for (const category of SAVINGS_CATEGORIES) {
          if (saves(stepUp.from) && baseLands(category)) {
            baseTrades[category].add(scope.trade)
          }
          if (saves(part.material) && addOnLands(category)) {
            addOns[category].add(stepUp.cut)
            addOnTrades[category].add(scope.trade)
          }
        }
      }
      else if (saves(part.material)) {
        for (const category of SAVINGS_CATEGORIES) {
          if (cut && addOnLands(category)) {
            addOns[category].add(cut)
            addOnTrades[category].add(scope.trade)
          }
          else if (!cut && baseLands(category)) {
            baseTrades[category].add(scope.trade)
          }
        }
      }
      for (const id of HOME_MATERIAL_IDS) {
        const material = home[id]
        const { repairs: carriesRepairs, trade, repairsEndWith } = HOME_MATERIALS[id]
        if (carriesRepairs && material && !material.absent && !credited.has(id) && repairsEndWith.some(entry => entry.assembly === assembly.id && entry.part === part.id)) {
          credited.add(id)
          repairs.set(trade, material.wear)
        }
      }
    }
  }
  // Cuts read in the assemblies' trade order, whatever order the parts happen to draw in.
  const tradeOrder = resolved.flatMap(({ assembly }) => assembly.trades)
  const inOrder = (trades: Set<TradeSlug>) => [...trades].sort((a, b) => tradeOrder.indexOf(a) - tradeOrder.indexOf(b))
  const byCategory = Object.fromEntries(SAVINGS_CATEGORIES.map(category => [category, { baseTrades: inOrder(baseTrades[category]), addOns: [...addOns[category]], addOnTrades: inOrder(addOnTrades[category]) }])) as Record<SavingsCategory, LandedOn>
  return { byCategory, repairs: [...repairs].map(([trade, wear]) => ({ trade, wear })) }
}

// The same combineCuts and cutFor the ROI calculator runs, so a figure shown in the scene matches the calculator's for the same picks.
export function sceneSavings(input: SceneSavingsInput, cuts: TradeBillCuts, installs: Partial<Record<string, ScopeInstall>> = SCOPE_INSTALLS): SceneSavings {
  const { byCategory, repairs } = landed(input, installs)
  // With no cut earned (always so in the existing view, and for a like-for-like build) a typed cut has nothing to apply to, so the figures stay whole.
  const cutOf = (category: SavingsCategory): BillCut => {
    const bill = { ...input.bills[category], now: input.bills[category].now ?? CLIMATE_DEFAULT_BILLS[input.climate][category] }
    const { baseTrades, addOns, addOnTrades } = byCategory[category]
    if (baseTrades.length === 0 && addOns.length === 0) {
      return cutFor({ ...bill, cut: { mode: 'trades', value: null } }, [], 0)
    }
    const { parts, combined } = combineCuts({ trades: baseTrades, addOns, addOnTrades }, category, cuts)
    return cutFor(bill, parts, combined)
  }
  const cutsByCategory = Object.fromEntries(SAVINGS_CATEGORIES.map(category => [category, cutOf(category)])) as SceneSavings['cuts']

  const { byTrade: repairsByTrade, monthly: repairsMonthly } = repairsFigure(repairs, input.repairsOverrides)

  return { cuts: cutsByCategory, repairsMonthly, repairsByTrade }
}
