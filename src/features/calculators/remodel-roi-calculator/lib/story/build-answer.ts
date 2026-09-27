import type { AnswerContent, StoryInputs } from '@/features/calculators/remodel-roi-calculator/types'

import { PROJECTION_YEARS } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { signedMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'

export function buildAnswer({ projection, lookAhead }: StoryInputs): AnswerContent {
  const { paysForItselfYear, costsLessMonthlyYear } = projection.milestones
  const benefit = projection.years[lookAhead].benefit
  const never = `Not within ${PROJECTION_YEARS} years`
  return {
    question: STORY_COPY.questions.answer,
    stats: [
      { label: 'Pays for itself in', value: paysForItselfYear ? `Year ${paysForItselfYear}` : never, sub: 'counting home value and loans', target: 'total' },
      { label: 'Costs less every month from', value: costsLessMonthlyYear ? `Year ${costsLessMonthlyYear}` : never, sub: 'cash out of pocket', target: 'monthly' },
      { label: benefit >= 0 ? `Ahead by year ${lookAhead}` : `Behind at year ${lookAhead}`, value: signedMoney(benefit), sub: 'compared with waiting', target: 'total' },
    ],
    note: costsLessMonthlyYear && paysForItselfYear && costsLessMonthlyYear > paysForItselfYear
      ? 'It pays for itself before it costs less each month because your home\'s added value counts toward what you own, while the monthly figure is only cash.'
      : null,
    method: 'The three figures come from the chapters they link to: the pays-for-itself year and the total from "Adding up", the monthly year from "Monthly". Each year is the first one from which it stays true.',
  }
}
