import type { VariableDef } from '@/features/calculators/scope-pricing-calculator/types'

// Inputs that only shape SOW text (desired roof type, free deck %, inverter type, insulation types, demo area, duct replacement) are left out because none of them changes a price.
export const VARIABLES = {
  numFlatBSQ: { trade: 'roof', label: 'Number of flat BSQ', kind: 'number', unit: 'BSQ', min: 0, max: 200, default: 0 },
  numPitchedBSQ: { trade: 'roof', label: 'Number of pitched BSQ', kind: 'number', unit: 'BSQ', min: 0, max: 200, default: 0 },
  numLayers: { trade: 'roof', label: 'Number of current roof layers', kind: 'select', unit: null, options: [1, 2, 3], default: 1 },
  numPanels: { trade: 'solar', label: 'Number of panels', kind: 'number', unit: 'count', min: 0, max: 200 },
  wattsPerPanel: { trade: 'solar', label: 'Watts per panel', kind: 'number', unit: 'W', min: 100, max: 700 },
  numBatteries: { trade: 'solar', label: 'Number of batteries', kind: 'select', unit: null, options: [0, 1, 2, 3], default: 0 },
  kWhPerBattery: { trade: 'solar', label: 'kWh per battery', kind: 'select', unit: 'kWh', options: [5, 10], default: 5 },
  systemTonnage: { trade: 'hvac', label: 'System tonnage', kind: 'select', unit: 'tons', options: [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5], default: 3 },
  numMiniSplits: { trade: 'hvac', label: 'Number of mini splits', kind: 'select', unit: 'count', options: [1, 2, 3, 4, 5, 6, 7, 8], default: 1 },
  numSmallWindows: { trade: 'windowsAndDoors', label: 'Number of small windows', kind: 'number', unit: 'count', min: 0, max: 100, default: 0 },
  numLargeWindows: { trade: 'windowsAndDoors', label: 'Number of large windows', kind: 'number', unit: 'count', min: 0, max: 100, default: 0 },
  numStandardSliders: { trade: 'windowsAndDoors', label: 'Number of standard sliding doors', kind: 'number', unit: 'count', min: 0, max: 100, default: 0 },
  numSpecialSliders: { trade: 'windowsAndDoors', label: 'Number of special sliding doors', kind: 'number', unit: 'count', min: 0, max: 100, default: 0 },
  numFrenchDoors: { trade: 'windowsAndDoors', label: 'Number of french doors', kind: 'number', unit: 'count', min: 0, max: 100, default: 0 },
  sqft: { trade: 'atticBasement', label: 'Square feet of insulation', kind: 'number', unit: 'sqft', min: 0, max: 10000 },
  installSqFt: { trade: 'dryscapingHardscaping', label: 'Square feet of installation', kind: 'number', unit: 'sqft', min: 0, max: 20000 },
  relocationRequired: { trade: 'electricals', label: 'Relocation required?', kind: 'boolean', unit: null, default: false },
  paintType: { trade: 'exteriorPaintSiding', label: 'Paint type', kind: 'select', unit: null, options: ['coolLife', 'water'], optionLabels: { coolLife: 'CoolLife', water: 'Water' } },
  homeSqFt: { trade: 'exteriorPaintSiding', label: 'Home square footage', kind: 'number', unit: 'sqft', min: 0, max: 20000 },
  garageSqFt: { trade: 'exteriorPaintSiding', label: 'Garage square footage', kind: 'number', unit: 'sqft', min: 0, max: 20000 },
} as const satisfies Record<string, VariableDef>
