'use client'

import type { ReactNode } from 'react'
import type { RepairsRow } from '@/features/trade-scenes/lib/repairs-rows'
import type { BenefitLine, FutureYear, HomeSystemId, MonthlyCosts, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { Resolved } from '@/shared/lib/resolve-overridable'
import type { ScopeId } from '@/shared/modules/construction/core/constants/scope-ids'
import type { TradeSlug } from '@/shared/modules/construction/core/constants/trade-slugs'

import { createContext, useMemo } from 'react'
import { useShallow } from 'zustand/react/shallow'

import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { buildBenefits } from '@/features/trade-scenes/lib/build-benefits'
import { currentYear } from '@/features/trade-scenes/lib/current-year'
import { futureYear } from '@/features/trade-scenes/lib/future-year'
import { pickedUpgrades } from '@/features/trade-scenes/lib/picked-upgrades'
import { repairsFigure } from '@/features/trade-scenes/lib/repairs-figure'
import { repairsRows } from '@/features/trade-scenes/lib/repairs-rows'
import { afterCosts, todayCosts } from '@/features/trade-scenes/lib/today-costs'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'

export interface BenefitsFigures {
  today: MonthlyCosts
  after: MonthlyCosts
  // Year 1 as shown, worked out once: the readout, the Savings kind head, the rail and the "?" print the same saving.
  now: FutureYear
  repairs: RepairsRow[]
  repairsResolved: Partial<Record<TradeSlug, Resolved>>
  lines: BenefitLine[]
  picks: Record<HomeSystemId, ScopeId[]>
  // Nothing picked in any system: the matrix shows its note and the band only the Without columns.
  empty: boolean
}

export const BenefitsFiguresContext = createContext<BenefitsFigures | null>(null)

function selectFigureInputs(state: TradeSceneInputs) {
  return {
    property: state.property,
    homeMaterials: state.homeMaterials,
    proposedScopeIds: state.proposedScopeIds,
    efficiencyUpgrades: state.efficiencyUpgrades,
    installStyles: state.installStyles,
    repairsOverrides: state.repairsOverrides,
  }
}

interface BenefitsFiguresProviderProps {
  children: ReactNode
}

// The head and the body read the same figures, worked out once per store write rather than once per reader.
export function BenefitsFiguresProvider({ children }: BenefitsFiguresProviderProps) {
  const { property, homeMaterials, proposedScopeIds, efficiencyUpgrades, installStyles, repairsOverrides } = useSceneInputs(useShallow(selectFigureInputs))
  const { home, savings } = useSceneTargets()

  const figures = useMemo<BenefitsFigures>(() => {
    const facts = { property, materials: homeMaterials, year: currentYear() }
    // Today's materials as the scene already resolved them, not a second resolve.
    const repairs = repairsRows(property, home)
    const picks = pickedUpgrades(facts, proposedScopeIds, efficiencyUpgrades)
    const today = todayCosts(savings, repairs, repairsOverrides)
    const after = afterCosts(savings, repairs, repairsOverrides)
    return {
      today,
      after,
      now: futureYear(today, after, 1),
      repairs,
      repairsResolved: repairsFigure(repairs, repairsOverrides).byTrade,
      lines: buildBenefits({ facts, picks, savings, repairs, efficiencyUpgrades, installStyles }),
      picks,
      empty: Object.values(picks).every(scopeIds => scopeIds.length === 0),
    }
  }, [property, homeMaterials, proposedScopeIds, efficiencyUpgrades, installStyles, repairsOverrides, home, savings])

  return <BenefitsFiguresContext value={figures}>{children}</BenefitsFiguresContext>
}
