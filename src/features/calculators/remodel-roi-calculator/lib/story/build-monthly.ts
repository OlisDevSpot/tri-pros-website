import type { AnswerPart, ChapterContent, ReceiptRow, StoryInputs } from '@/features/calculators/remodel-roi-calculator/types'

import { BILL_CATEGORIES, BILL_CATEGORY_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { PROJECTION_YEARS } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import { BILL_RATE_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/rates'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { CURRENT_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import { formatMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { emphasis, plain } from '@/features/calculators/remodel-roi-calculator/lib/story/answer-parts'
import { tagFor } from '@/features/calculators/remodel-roi-calculator/lib/story/tag-for'

function percentText(share: number): string {
  return `${Math.round(share * 1000) / 10}%`
}

export function buildMonthly({ projection, lookAhead }: StoryInputs): ChapterContent {
  const { years, milestones, project, cuts, replacements, assumptions } = projection
  const financed = project.paymentMode === 'financed'
  const used = BILL_CATEGORIES.filter(category => cuts[category].bill > 0)
  const first = years[1]
  const from = milestones.costsLessMonthlyYear
  const early = first.monthlyNow - first.monthlyWait
  const most = from == null ? 0 : Math.max(0, ...years.slice(1, from).map(year => year.monthlyNow - year.monthlyWait))
  const late = years[lookAhead].monthlyWait - years[lookAhead].monthlyNow
  let answer: AnswerPart[]
  if (from == null) {
    answer = [plain(`Within ${PROJECTION_YEARS} years, upgrading doesn't settle below waiting each month. The return comes from your home's added value.`)]
  }
  else if (from === 1) {
    answer = [plain('Upgrading costs '), emphasis(`${formatMoney(-early)} less`, 'now'), plain(' a month from the very first month.')]
  }
  else {
    answer = [
      plain(`For the first ${formatYears(from - 1)}, upgrading costs up to about `),
      emphasis(`${formatMoney(most)} more`),
      plain(' a month. From '),
      emphasis(`year ${from}`, 'now'),
      plain(', it costs less every month'),
      ...(from <= lookAhead ? [plain(': '), emphasis(`${formatMoney(late)} less`, 'now'), plain(` by year ${lookAhead}.`)] : [plain('.')]),
    ]
  }
  const receipt: ReceiptRow[] = [
    { kind: 'heading', label: 'Upgrade now, year 1' },
    ...used.map(category => ({ kind: 'line' as const, label: `${BILL_CATEGORY_LABELS[category]} after the upgrade`, value: `${formatMoney(cuts[category].after)}/mo`, tag: 'calc' as const, note: cuts[category].combined ? `${formatMoney(cuts[category].bill)} − ${percentText(cuts[category].combined)}` : 'no cut' })),
    ...(financed ? [{ kind: 'line' as const, op: '+' as const, label: 'Loan payment', value: `${formatMoney(project.payment)}/mo`, tag: 'calc' as const, note: `${formatMoney(project.principal)} over ${project.termYears} years at ${project.aprPercent.value}%` }] : []),
    { kind: 'line', op: '=', label: STORY_COPY.paths.now, value: `${formatMoney(first.monthlyNow)}/mo`, tag: 'calc', strong: 'now' },
    { kind: 'heading', label: 'Wait and replace, year 1' },
    { kind: 'line', label: 'Your bills as they are', value: `${formatMoney(first.billsNow)}/mo`, tag: 'yours' },
    ...(first.repairsMonthly ? [{ kind: 'line' as const, op: '+' as const, label: 'Repairs on the aging ones', value: `${formatMoney(first.repairsMonthly)}/mo`, tag: 'calc' as const, note: replacements.map(replacement => `${CURRENT_LABELS[replacement.trade]} ${formatMoney(replacement.repairsPerYear.value)}/yr`).join(' · ') }] : []),
    { kind: 'line', op: '=', label: STORY_COPY.paths.wait, value: `${formatMoney(first.monthlyWait)}/mo`, tag: 'calc', strong: 'wait' },
  ]
  return {
    id: 'monthly',
    question: STORY_COPY.questions.monthly,
    answer,
    guide: financed
      ? `Your loan payment stays at ${formatMoney(project.payment)} for ${formatYears(project.termYears)}. Your utility bills keep rising.${milestones.payoffYear && milestones.payoffYear < lookAhead ? ` After year ${milestones.payoffYear} the loan is paid off and the gap jumps.` : ''}`
      : 'You paid for the project up front, so only your bills change from here.',
    equation: `Year 1: ${formatMoney(first.billsAfter)} bills + ${formatMoney(first.projectPayment)} loan = ${formatMoney(first.monthlyNow)} upgrading · ${formatMoney(first.billsNow)} bills${first.repairsMonthly ? ` + ${formatMoney(first.repairsMonthly)} repairs` : ''} = ${formatMoney(first.monthlyWait)} waiting`,
    receipt,
    uses: [
      ...used.map(category => ({ label: `${BILL_CATEGORY_LABELS[category]} bill`, value: `${formatMoney(cuts[category].bill)} → ${formatMoney(cuts[category].after)}`, tag: 'yours' as const, edit: 'bills' as const })),
      { label: 'Project price', value: formatMoney(project.price), tag: 'yours', edit: 'project' },
      { label: 'Financing', value: financed ? `${project.aprPercent.value}% · ${project.termYears} yrs` : 'Cash', tag: financed ? tagFor(project.aprPercent.source) : 'yours', edit: 'project' },
      ...replacements.map(replacement => ({ label: `${CURRENT_LABELS[replacement.trade]} repairs`, value: `${formatMoney(replacement.repairsPerYear.value)}/yr`, tag: tagFor(replacement.repairsPerYear.source), edit: 'trades' as const })),
      ...used.map(category => ({ label: BILL_RATE_LABELS[category], value: `${assumptions.ratesPercent[category].value}%/yr`, tag: tagFor(assumptions.ratesPercent[category].source), edit: 'assumptions' as const })),
      { label: 'Building costs rise', value: `${assumptions.constructionPercent.value}%/yr`, tag: tagFor(assumptions.constructionPercent.source), edit: 'assumptions' },
    ],
    method: 'Upgrade now = your bills after the cut + the loan payment, which stays fixed for the term. Wait and replace = your bills as they are + repairs on each aging one until it gives out + the payment on its replacement loan after that. Bills on both paths grow with the same rates. Upgrading costs less every month from the first year it is lower and stays lower.',
  }
}
