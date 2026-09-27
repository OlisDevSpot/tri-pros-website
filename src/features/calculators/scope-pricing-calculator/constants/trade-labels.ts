import type { PermitTrade, PricingTrade } from '@/features/calculators/scope-pricing-calculator/schemas/config'

export const PRICING_TRADES = [
  'roof',
  'hvac',
  'windowsAndDoors',
  'atticBasement',
  'dryscapingHardscaping',
  'electricals',
  'exteriorPaintSiding',
] as const satisfies readonly PricingTrade[]

export const TRADE_LABELS = {
  roof: 'Roof',
  hvac: 'HVAC',
  windowsAndDoors: 'Windows & Doors',
  atticBasement: 'Attic & Basement',
  dryscapingHardscaping: 'Dryscaping & Hardscaping',
  electricals: 'Electricals',
  exteriorPaintSiding: 'Exterior Paint & Siding',
} as const satisfies Record<PricingTrade, string>

export const PERMIT_TRADES = ['roof', 'hvac'] as const satisfies readonly PermitTrade[]
