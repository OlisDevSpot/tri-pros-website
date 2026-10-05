import type { BasisContent, ReceiptRow, StoryInputs } from '@/features/calculators/remodel-roi-calculator/types'

import { BILL_CATEGORIES } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { BILL_RATE_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/rates'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { CUT_SOURCE_LABELS, TRADE_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import { formatCuts } from '@/features/calculators/remodel-roi-calculator/lib/format-cuts'
import { changeVerb } from '@/features/calculators/remodel-roi-calculator/lib/story/describe-change'
import { tagFor } from '@/features/calculators/remodel-roi-calculator/lib/story/tag-for'

export function buildBasis({ projection, config }: StoryInputs): BasisContent {
  const { cuts, assumptions, replacements, project, trades, ducts } = projection
  const used = BILL_CATEGORIES.filter(category => cuts[category].bill > 0)
  const receipt: ReceiptRow[] = [
    { kind: 'line', label: 'Bills, project price, financing, ages', value: 'Entered here', tag: 'yours' },
    ...used.map(category => ({ kind: 'line' as const, label: BILL_RATE_LABELS[category], value: `${assumptions.ratesPercent[category].value}%/yr`, tag: tagFor(assumptions.ratesPercent[category].source) })),
    { kind: 'line', label: `Building costs ${changeVerb(assumptions.constructionPercent.value)}`, value: `${Math.abs(assumptions.constructionPercent.value)}%/yr`, tag: tagFor(assumptions.constructionPercent.source) },
    { kind: 'line', label: 'Homes here rise in value', value: `${assumptions.homeAppreciationPercent.value}%/yr`, tag: tagFor(assumptions.homeAppreciationPercent.source) },
    { kind: 'line', label: 'Share of the price added to your home', value: `${assumptions.valueAddedPercent.value}%`, tag: tagFor(assumptions.valueAddedPercent.source) },
    ...trades.map(trade => ({ kind: 'line' as const, label: `${TRADE_LABELS[trade]} cuts`, value: formatCuts(config.trades[trade].cutsPercent), tag: 'assumption' as const })),
    ...(ducts && trades.includes('hvac') ? [{ kind: 'line' as const, label: `${CUT_SOURCE_LABELS.ducts} cut`, value: formatCuts(config.trades.hvac.ductsCutsPercent), tag: 'assumption' as const }] : []),
    ...trades.map(trade => ({ kind: 'line' as const, label: `New ${TRADE_LABELS[trade]} lasts`, value: config.trades[trade].newLifeYears == null ? 'the life of the home' : `${config.trades[trade].newLifeYears} yrs`, tag: 'assumption' as const })),
    ...(replacements.length ? [{ kind: 'line' as const, label: 'Waiting replaces like-for-like', value: project.paymentMode === 'cash' ? 'Paid in cash' : project.hasLoan ? 'Financed the same way' : `Financed at ${project.aprPercent.value}% over ${project.termYears} yrs`, tag: 'assumption' as const }] : []),
  ]
  return { question: STORY_COPY.questions.basis, answer: STORY_COPY.basisAnswer, guide: STORY_COPY.basisGuide, receipt }
}
