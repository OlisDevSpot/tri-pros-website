// LAZY: stand-in for catalog-owned benefit copy (construction catalog design D4; stage-and-rail spec DA3).
// These `BENEFIT_TEMPLATES.byTrade` lines carry numeric claims; three now read the bill-cut table and the rest are
// not company constants, so all stay out of the homeowner's view until the owner lifts them or the copy moves.
// Delete this file when the copy moves.

import {
  BATHROOM_RESALE_BENEFIT,
  DRYSCAPING_WATER_CUT_BENEFIT,
  HVAC_BILL_CUT_BENEFIT,
  INSULATION_PAYBACK_BENEFIT,
  KITCHEN_RESALE_BENEFIT,
  SOLAR_RATE_LOCK_BENEFIT,
  WINDOWS_BILL_CUT_BENEFIT,
} from '@/features/meeting-flow/constants/persona-profile-maps'

/** The same values `constants/persona-profile-maps.ts` renders, so a reworded line cannot slip past the set. */
export const TRADE_BENEFIT_EXCLUSIONS: ReadonlySet<string> = new Set([
  SOLAR_RATE_LOCK_BENEFIT,
  WINDOWS_BILL_CUT_BENEFIT,
  INSULATION_PAYBACK_BENEFIT,
  HVAC_BILL_CUT_BENEFIT,
  BATHROOM_RESALE_BENEFIT,
  KITCHEN_RESALE_BENEFIT,
  DRYSCAPING_WATER_CUT_BENEFIT,
])
