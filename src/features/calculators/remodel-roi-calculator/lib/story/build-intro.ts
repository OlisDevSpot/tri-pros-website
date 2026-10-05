import type { IntroContent, StoryInputs } from '@/features/calculators/remodel-roi-calculator/types'

import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { CURRENT_IS_PLURAL, CURRENT_SENTENCE_LABELS, NEAR_END_OF_LIFE_YEARS } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { joinWords } from '@/features/calculators/remodel-roi-calculator/lib/join-words'
import { installYears, waitingArePlural, waitingNames } from '@/features/calculators/remodel-roi-calculator/lib/story/describe-waits'

export function buildIntro({ projection, lookAhead }: StoryInputs): IntroContent {
  const { replacements, project } = projection
  const financed = project.paymentMode === 'financed'
  const terms = `financed over ${project.termYears} years at ${project.aprPercent.value}%`
  const span = formatYears(lookAhead)
  const one = replacements[0]
  const near = replacements.filter(replacement => replacement.installs[0].year <= NEAR_END_OF_LIFE_YEARS)
  const plural = waitingArePlural(near)
  const facts = [
    ...(near.length ? [`Your ${waitingNames(near)} ${plural ? 'are' : 'is'} near the end of ${plural ? 'their' : 'its'} life.`] : []),
    ...replacements.filter(replacement => !near.includes(replacement)).map((replacement) => {
      const many = CURRENT_IS_PLURAL[replacement.trade]
      return `Your ${CURRENT_SENTENCE_LABELS[replacement.trade]} ${many ? 'are' : 'is'} ${formatYears(replacement.ageYears)} old and usually ${many ? 'last' : 'lasts'} about ${formatYears(replacement.standardLifeYears)}, so ${many ? 'they give' : 'it gives'} out in about year ${replacement.installs[0].year}.`
    }),
  ]
  return {
    question: STORY_COPY.questions.intro,
    title: STORY_COPY.introTitle,
    body: replacements.length
      ? `${facts.join(' ')} Here is what each path costs you over the next ${span}, using your own bills and today's prices.`
      : `Here is what this project costs and returns over the next ${span}, compared with leaving the house as it is, using your own bills and today's prices.`,
    now: project.hasLoan
      ? `Do the project today, ${terms}. Your bills drop right away.`
      : project.netPrice === 0
        ? 'Do the project today; incentives cover the price. Your bills drop right away.'
        : `Do the project today, ${financed ? 'paid up front' : 'paid in cash'}. Your bills drop right away.`,
    wait: replacements.length
      ? `Keep things as they are. Repair ${joinWords(replacements.map(replacement => `the ${CURRENT_SENTENCE_LABELS[replacement.trade]} until ${CURRENT_IS_PLURAL[replacement.trade] ? 'they give' : 'it gives'} out (${installYears(replacement)})`))}, then replace ${replacements.length > 1 ? 'each' : CURRENT_IS_PLURAL[one.trade] ? 'them' : 'it'} with the same kind at that year's price, ${financed ? project.hasLoan ? 'financed the same way' : terms : 'paid in cash'}.`
      : 'Keep things as they are. Your bills keep rising with utility rates.',
  }
}
