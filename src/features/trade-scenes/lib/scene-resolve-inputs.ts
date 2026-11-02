import type { SceneResolveInputs, SceneResolveSelection, TradeSceneInputs } from '@/features/trade-scenes/types'

// The peel follows every pointer move, so only the inputs the scene resolves from may wake the resolver. The home materials are
// spread flat because a shallow compare sees one level: the AC size, the shingle colour and the paint wear only draw, so they are left out.
export function selectResolveInputs(state: TradeSceneInputs): SceneResolveSelection {
  const { wear, gutters, exteriorPaint, ducts, crawlInsulation } = state.homeMaterials
  return {
    property: state.property,
    household: state.household,
    view: state.view,
    weather: state.weather,
    climate: state.climate,
    zoom: state.zoom,
    proposedScopeIds: state.proposedScopeIds,
    efficiencyUpgrades: state.efficiencyUpgrades,
    bills: state.bills,
    repairsOverrides: state.repairsOverrides,
    wear,
    gutters,
    exteriorPaint,
    ducts,
    crawlInsulation,
  }
}

export function resolveInputsOf(selection: SceneResolveSelection): SceneResolveInputs {
  const { wear, gutters, exteriorPaint, ducts, crawlInsulation, ...rest } = selection
  return { ...rest, homeMaterials: { wear, gutters, exteriorPaint, ducts, crawlInsulation } }
}
