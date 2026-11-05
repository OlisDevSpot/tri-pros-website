import { formatRowClaim, tradeCutPercent } from '@/shared/modules/construction/core/lib/bill-cut-claims'

/** Outcome lines by Notion trade slug. Source: docs/sales/in-home-meeting-playbook.md (Outcome lines table). */
export const TRADE_OUTCOMES: Record<string, string> = {
  'roof-and-gutters': 'Your home will be fully protected from weather damage for the next 30 years, and the cool-roof system will reduce attic heat by up to 30%.',
  'attic-and-basement': `You'll notice the difference in comfort within the first month, and our estimate from customer bills is ${formatRowClaim(tradeCutPercent('attic-and-basement', 'electric'))} off the electric bill and ${tradeCutPercent('attic-and-basement', 'gas')}% off gas.`,
  'windows-and-doors': 'No more drafts, no more noise from outside, and your home will hold temperature much more consistently.',
  'hvac': `Your system will be efficient, and our estimate from customer bills is ${formatRowClaim(tradeCutPercent('hvac', 'electric'))} off cooling and ${tradeCutPercent('hvac', 'gas')}% off heating.`,
  'bathroom-remodel': 'You\'ll have a completely updated bathroom that feels brand new — and it adds significantly to your home\'s resale value.',
}
