// LAZY: stand-in for catalog-owned benefit copy (construction catalog design D4; stage-and-rail spec DA3).
// These `BENEFIT_TEMPLATES.byTrade` lines carry numeric claims that are not company constants, so they
// stay out of the homeowner's view until they are re-sourced or dropped. Delete this file when the copy moves.

/** Verbatim bodies from `constants/persona-profile-maps.ts`. */
export const TRADE_BENEFIT_EXCLUSIONS: ReadonlySet<string> = new Set([
  'Solar locks in your energy rate for 25+ years — no more rate hikes, and potential tax credits reduce the upfront cost',
  'ENERGY STAR windows can reduce heating/cooling costs by 12-33%, depending on your climate zone',
  'Insulation upgrades typically pay for themselves within 2-4 years through energy savings alone',
  'A high-efficiency system can cut your heating and cooling costs by 30-50% compared to an aging unit',
  'A modern bathroom remodel returns 60-70% at resale — and you get to enjoy it every single day until then',
  'Kitchen upgrades are the #1 ROI driver in real estate — buyers pay a premium for a move-in-ready kitchen',
  'Drought-resistant landscaping cuts water bills by 50-75% and eliminates maintenance headaches',
])
