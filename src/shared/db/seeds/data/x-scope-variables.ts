import type { ScopeAccessorOfTrade } from '@/shared/db/types'
import type { TradeAccessor } from '@/shared/db/types/trades'
import type { VariablesKeys } from '@/shared/db/types/variables'

interface XScopeVariablesSingle<Trade extends TradeAccessor> {
  scopeAccessor: ScopeAccessorOfTrade<Trade>
  variableKey: VariablesKeys<Trade>
}

export const xScopeVariablesData = {
  solar: [
    {
      scopeAccessor: 'installPanels',
      variableKey: 'numPanels',
    },
    {
      scopeAccessor: 'installPanels',
      variableKey: 'wattsPerPanel',
    },
    {
      scopeAccessor: 'installPanels',
      variableKey: 'inverterType',
    },
    {
      scopeAccessor: 'installBattery',
      variableKey: 'numBatteries',
    },
    {
      scopeAccessor: 'rnrPanels',
      variableKey: 'numPanels',
    },
  ],
  roof: [
    {
      scopeAccessor: 'overlay',
      variableKey: 'numPitchedBSQ',
    },
    {
      scopeAccessor: 'overlay',
      variableKey: 'numFlatBSQ',
    },
    {
      scopeAccessor: 'tearOff',
      variableKey: 'numPitchedBSQ',
    },
    {
      scopeAccessor: 'tearOff',
      variableKey: 'numFlatBSQ',
    },
    {
      scopeAccessor: 'tearOff',
      variableKey: 'numLayers',
    },
    {
      scopeAccessor: 'tearOff',
      variableKey: 'desiredRoofType',
    },
    {
      scopeAccessor: 'tearOff',
      variableKey: 'percentFreeDeckReplacement',
    },
    {
      scopeAccessor: 'redeck',
      variableKey: 'numFlatBSQ',
    },
    {
      scopeAccessor: 'redeck',
      variableKey: 'numPitchedBSQ',
    },
    {
      scopeAccessor: 'redeck',
      variableKey: 'numLayers',
    },
    {
      scopeAccessor: 'tileReset',
      variableKey: 'numPitchedBSQ',
    },
  ],
  hvac: [
    {
      scopeAccessor: 'replaceSplitSystem',
      variableKey: 'systemTonnage',
    },
    {
      scopeAccessor: 'replaceFurnace',
      variableKey: 'systemTonnage',
    },
    {
      scopeAccessor: 'replaceAC',
      variableKey: 'systemTonnage',
    },
    {
      scopeAccessor: 'installMiniSplit',
      variableKey: 'systemTonnage',
    },
    {
      scopeAccessor: 'installMiniSplit',
      variableKey: 'numMiniSplits',
    },
  ],
  windows: [
    {
      scopeAccessor: 'replaceWindows',
      variableKey: 'numSmallWindows',
    },
    {
      scopeAccessor: 'replaceWindows',
      variableKey: 'numLargeWindows',
    },
    {
      scopeAccessor: 'replaceSlidingDoor',
      variableKey: 'numStandardSliders',
    },
    {
      scopeAccessor: 'replaceSlidingDoor',
      variableKey: 'numSpecialSliders',
    },
  ],
  atticBasement: [
    {
      scopeAccessor: 'rnrAttic',
      variableKey: 'sqft',
    },
    {
      scopeAccessor: 'topOffAttic',
      variableKey: 'sqft',
    },
    {
      scopeAccessor: 'installCrawlSpaceInsulation',
      variableKey: 'sqft',
    },
  ],
  exteriorPaintSiding: [
    {
      scopeAccessor: 'installExteriorPaint',
      variableKey: 'paintType',
    },
    {
      scopeAccessor: 'installExteriorPaint',
      variableKey: 'homeSqFt',
    },
    {
      scopeAccessor: 'installExteriorPaint',
      variableKey: 'garageSqFt',
    },
  ],
  dryscapingHardscaping: [
    {
      scopeAccessor: 'installArtificial',
      variableKey: 'installSqFt',
    },
    {
      scopeAccessor: 'installConcrete',
      variableKey: 'installSqFt',
    },
    {
      scopeAccessor: 'installGravel',
      variableKey: 'installSqFt',
    },
    {
      scopeAccessor: 'installMulch',
      variableKey: 'installSqFt',
    },
    {
      scopeAccessor: 'installPavers',
      variableKey: 'installSqFt',
    },
  ],
  electricals: [
    {
      scopeAccessor: 'mpu',
      variableKey: 'relocationRequired',
    },
  ],
} as const satisfies Partial<{ [Key in TradeAccessor]: XScopeVariablesSingle<Key>[] }>
