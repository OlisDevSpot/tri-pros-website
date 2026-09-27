import type { ChapterContent, StoryInputs } from '@/features/calculators/remodel-roi-calculator/types'

import { BILL_CATEGORIES, BILL_CATEGORY_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/bill-categories'
import { BILL_RATE_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/rates'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { formatMoney, roundMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { emphasis, plain } from '@/features/calculators/remodel-roi-calculator/lib/story/answer-parts'
import { tagFor } from '@/features/calculators/remodel-roi-calculator/lib/story/tag-for'

export function buildToday({ projection, lookAhead }: StoryInputs): ChapterContent {
  const { cuts, years, assumptions } = projection
  const used = BILL_CATEGORIES.filter(category => cuts[category].bill > 0)
  const today = used.reduce((total, category) => total + cuts[category].bill, 0)
  const mid = Math.min(5, lookAhead)
  const rate = (category: typeof used[number]) => assumptions.ratesPercent[category]
  return {
    id: 'today',
    question: STORY_COPY.questions.today,
    answer: [plain('You pay about '), emphasis(formatMoney(today)), plain(' a month in household bills today.')],
    guide: `If rates keep rising as they have, the same bills cost about ${roundMoney(years[mid].billsNow)} a month in year ${mid} and ${roundMoney(years[lookAhead].billsNow)} in year ${lookAhead}. Hover a bar to see each bill.`,
    equation: used.map(category => `${BILL_CATEGORY_LABELS[category]} ${formatMoney(cuts[category].bill)} +${rate(category).value}%/yr`).join(' · '),
    receipt: [
      ...used.map(category => ({ kind: 'line' as const, label: `${BILL_CATEGORY_LABELS[category]} today`, value: `${formatMoney(cuts[category].bill)}/mo`, tag: 'yours' as const })),
      ...used.map(category => ({ kind: 'line' as const, label: BILL_RATE_LABELS[category], value: `${rate(category).value}%/yr`, tag: tagFor(rate(category).source) })),
      { kind: 'line', op: '=', label: `All bills in year ${lookAhead}`, value: `${formatMoney(years[lookAhead].billsNow)}/mo`, tag: 'calc', note: 'each bill grown by its own rate' },
    ],
    uses: [
      ...used.map(category => ({ label: `${BILL_CATEGORY_LABELS[category]} bill`, value: `${formatMoney(cuts[category].bill)}/mo`, tag: 'yours' as const, edit: 'bills' as const })),
      ...used.map(category => ({ label: BILL_RATE_LABELS[category], value: `${rate(category).value}%/yr`, tag: tagFor(rate(category).source), edit: 'assumptions' as const })),
    ],
    method: 'Adds up the monthly bills you entered. Each bill then grows every year by its own rate, compounding: the bill in year N is today\'s bill × (1 + rate) raised to N − 1. Year 1 is today\'s bill.',
  }
}
