import type { StoryContent, StoryInputs } from '@/features/calculators/remodel-roi-calculator/types'

import { buildAnswer } from '@/features/calculators/remodel-roi-calculator/lib/story/build-answer'
import { buildBasis } from '@/features/calculators/remodel-roi-calculator/lib/story/build-basis'
import { buildIntro } from '@/features/calculators/remodel-roi-calculator/lib/story/build-intro'
import { buildMonthly } from '@/features/calculators/remodel-roi-calculator/lib/story/build-monthly'
import { buildToday } from '@/features/calculators/remodel-roi-calculator/lib/story/build-today'
import { buildTotal } from '@/features/calculators/remodel-roi-calculator/lib/story/build-total'
import { buildValue } from '@/features/calculators/remodel-roi-calculator/lib/story/build-value'
import { buildWaiting } from '@/features/calculators/remodel-roi-calculator/lib/story/build-waiting'

export function buildStory(inputs: StoryInputs): StoryContent {
  return {
    intro: buildIntro(inputs),
    answer: buildAnswer(inputs),
    today: buildToday(inputs),
    monthly: buildMonthly(inputs),
    waiting: buildWaiting(inputs),
    value: buildValue(inputs),
    total: buildTotal(inputs),
    basis: buildBasis(inputs),
  }
}
