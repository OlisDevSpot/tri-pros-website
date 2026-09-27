import type { ChapterContent, StoryInputs } from '@/features/calculators/remodel-roi-calculator/types'

import { PROJECTION_YEARS } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { formatMoney, roundMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { emphasis, plain } from '@/features/calculators/remodel-roi-calculator/lib/story/answer-parts'
import { tagFor } from '@/features/calculators/remodel-roi-calculator/lib/story/tag-for'

export function buildTotal({ projection, lookAhead }: StoryInputs): ChapterContent {
  const { years, milestones, project, homeValue, liabilities } = projection
  const benefit = years[lookAhead].benefit
  const parts = years[lookAhead].returnParts
  const later = lookAhead < PROJECTION_YEARS ? years[PROJECTION_YEARS].benefit : null
  const payback = milestones.paysForItselfYear
  const skipped = parts.repairsSkipped + parts.replacementsSkipped + parts.interestSkipped
  const paid = -parts.projectPrice - parts.projectInterest
  const financed = project.paymentMode === 'financed'
  return {
    id: 'total',
    question: STORY_COPY.questions.total,
    answer: benefit >= 0
      ? [plain(`By year ${lookAhead}, upgrading leaves you about `), emphasis(`${roundMoney(benefit)} ahead`, 'now'), plain('.'), ...(payback ? [plain(' It pays for itself in '), emphasis(`year ${payback}`, 'now'), plain('.')] : [])]
      : [plain(`By year ${lookAhead}, upgrading is still about `), emphasis(`${roundMoney(-benefit)} behind`), plain('.'), ...(payback ? [plain(' It pays for itself in '), emphasis(`year ${payback}`, 'now'), plain('.')] : [plain(` It does not pay for itself within ${PROJECTION_YEARS} years.`)])],
    guide: later != null && later > benefit
      ? `The longer you stay, the more it pays: about ${roundMoney(later)} ahead by year ${PROJECTION_YEARS}.`
      : 'Counting lower bills, skipped repairs and replacements, and your home\'s added value, minus what you pay for the project.',
    equation: `${roundMoney(parts.billsSaved)} bills + ${roundMoney(skipped)} skipped + ${roundMoney(parts.valueGain)} value − ${roundMoney(paid)} project and interest = ${roundMoney(benefit)}`,
    receipt: [
      { kind: 'line', op: '+', label: `Lower bills over ${formatYears(lookAhead)}`, value: formatMoney(parts.billsSaved), tag: 'calc' },
      ...(parts.repairsSkipped ? [{ kind: 'line' as const, op: '+' as const, label: 'Repairs you skip', value: formatMoney(parts.repairsSkipped), tag: 'calc' as const }] : []),
      ...(parts.replacementsSkipped ? [{ kind: 'line' as const, op: '+' as const, label: 'Replacements you skip', value: formatMoney(parts.replacementsSkipped), tag: 'calc' as const }] : []),
      ...(parts.interestSkipped ? [{ kind: 'line' as const, op: '+' as const, label: 'Interest you would pay on them', value: formatMoney(parts.interestSkipped), tag: 'calc' as const }] : []),
      { kind: 'line', op: '+', label: 'Your home\'s added value', value: formatMoney(parts.valueGain), tag: 'calc' },
      { kind: 'line', op: '−', label: project.incentives ? 'Project price, after incentives' : 'Project price', value: formatMoney(parts.projectPrice), tag: 'yours' },
      ...(parts.projectInterest ? [{ kind: 'line' as const, op: '−' as const, label: 'Interest on your loan', value: formatMoney(parts.projectInterest), tag: 'calc' as const }] : []),
      { kind: 'line', op: '=', label: `Where you stand in year ${lookAhead}`, value: formatMoney(benefit), tag: 'calc', strong: 'now' },
    ],
    uses: [
      { label: 'Project price and financing', value: `${formatMoney(project.price)} · ${financed ? `${project.aprPercent.value}%` : 'cash'}`, tag: financed ? tagFor(project.aprPercent.source) : 'yours', edit: 'project' },
      ...(homeValue ? [{ label: 'Home value and loans', value: `${formatMoney(homeValue)} · ${liabilities.length} ${liabilities.length === 1 ? 'loan' : 'loans'}`, tag: 'yours' as const, edit: 'home' as const }] : []),
      { label: 'Everything in chapters 3 to 6', value: '', tag: 'calc' },
    ],
    method: 'Where you stand = what waiting costs you in cash − what upgrading costs you in cash + the difference in home value between the paths − the difference in what is still owed on each path\'s loans. It pays for itself from the first year this turns positive and stays positive. Your home\'s value and your other loans are the same on both paths, so they only change the net-worth totals, not the comparison.',
  }
}
