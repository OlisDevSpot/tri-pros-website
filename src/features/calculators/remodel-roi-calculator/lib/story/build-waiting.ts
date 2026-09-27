import type { ChapterContent, ReceiptRow, StoryInputs, UsesRow } from '@/features/calculators/remodel-roi-calculator/types'

import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { CURRENT_IS_PLURAL, CURRENT_LABELS, CURRENT_SENTENCE_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import { formatMoney, roundMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { joinWords } from '@/features/calculators/remodel-roi-calculator/lib/join-words'
import { emphasis, plain } from '@/features/calculators/remodel-roi-calculator/lib/story/answer-parts'
import { waitingNames } from '@/features/calculators/remodel-roi-calculator/lib/story/describe-waits'
import { tagFor } from '@/features/calculators/remodel-roi-calculator/lib/story/tag-for'

export function buildWaiting({ projection }: StoryInputs): ChapterContent {
  const { replacements, assumptions } = projection
  const base = { id: 'waiting' as const, question: STORY_COPY.questions.waiting }
  if (!replacements.length) {
    return {
      ...base,
      answer: [plain('Nothing in this project is about to give out, so waiting has no replacement bill attached.')],
      guide: 'The case rests on lower bills and your home\'s added value. If the current one of a trade here is aging, add its age under Trades in the project.',
      equation: '',
      receipt: [],
      uses: [],
      method: 'Only trades whose current one has an age count here. None do.',
    }
  }
  const construction = assumptions.constructionPercent
  const growth = 1 + construction.value / 100
  const total = replacements.reduce((sum, replacement) => sum + replacement.extra, 0)
  const renewals = replacements.filter(replacement => replacement.installs.length > 1)
  const one = replacements[0]
  const it = CURRENT_IS_PLURAL[one.trade] ? 'them' : 'it'
  return {
    ...base,
    answer: [
      ...(replacements.length === 1
        ? [plain(`Waiting doesn't skip the ${CURRENT_SENTENCE_LABELS[one.trade]}. It moves ${it} to about `), emphasis(`year ${one.installs[0].year}`), plain(` and makes ${it} `), emphasis(`${roundMoney(one.extra)} more expensive`, 'wait'), plain('.')]
        : [plain(`Waiting doesn't skip the ${waitingNames(replacements)}. It moves them a few years out and makes them `), emphasis(`${roundMoney(total)} more expensive`, 'wait'), plain(' together.')]),
      ...renewals.map(replacement => plain(` The same kind of ${CURRENT_SENTENCE_LABELS[replacement.trade]} needs doing again in year ${joinWords(replacement.installs.slice(1).map(install => String(install.year)))}.`)),
    ],
    guide: `Building costs keep rising, about ${construction.value}% a year. And a like-for-like replacement saves nothing on your bills.`,
    equation: replacements.map(replacement => `${CURRENT_LABELS[replacement.trade]}: ${formatMoney(replacement.likeForLikePrice.value)} today → ${replacement.installs.map(install => `${formatMoney(install.price)} in year ${install.year}`).join(', ')} + ${formatMoney(replacement.repairsUntil)} repairs`).join(' · '),
    receipt: replacements.flatMap((replacement): ReceiptRow[] => {
      const [first, ...again] = replacement.installs
      return [
        { kind: 'heading', label: CURRENT_LABELS[replacement.trade] },
        { kind: 'line', label: 'Same kind, installed today', value: formatMoney(replacement.likeForLikePrice.value), tag: tagFor(replacement.likeForLikePrice.source) },
        { kind: 'line', label: `Gives out in about ${formatYears(first.year)}`, value: `${replacement.ageYears} of ~${replacement.standardLifeYears} yrs`, tag: 'assumption', note: 'its age, and how long these usually last' },
        { kind: 'line', op: '×', label: `Building costs rise ${construction.value}%/yr for ${formatYears(first.year)}`, value: `×${(growth ** first.year).toFixed(3)}`, tag: tagFor(construction.source) },
        { kind: 'line', op: '=', label: `Price in year ${first.year}`, value: formatMoney(first.price), tag: 'calc' },
        { kind: 'line', op: '+', label: `Repairs until then (${formatMoney(replacement.repairsPerYear.value)}/yr, rising)`, value: formatMoney(replacement.repairsUntil), tag: 'calc' },
        { kind: 'line', op: '=', label: 'Extra cost of waiting', value: formatMoney(replacement.extra), tag: 'calc', strong: 'wait' },
        ...again.map(install => ({ kind: 'line' as const, op: '+' as const, label: `Same kind again in year ${install.year}`, value: formatMoney(install.price), tag: 'calc' as const, note: `these usually last about ${replacement.standardLifeYears} years` })),
      ]
    }),
    uses: [
      ...replacements.flatMap((replacement): UsesRow[] => [
        { label: `${CURRENT_LABELS[replacement.trade]} age`, value: `${replacement.ageYears} yrs`, tag: 'yours', edit: 'trades' },
        { label: `${CURRENT_LABELS[replacement.trade]} price today`, value: formatMoney(replacement.likeForLikePrice.value), tag: tagFor(replacement.likeForLikePrice.source), edit: 'trades' },
        { label: `${CURRENT_LABELS[replacement.trade]} repairs`, value: `${formatMoney(replacement.repairsPerYear.value)}/yr`, tag: tagFor(replacement.repairsPerYear.source), edit: 'trades' },
        { label: `${CURRENT_LABELS[replacement.trade]} usually lasts`, value: `${replacement.standardLifeYears} yrs`, tag: 'assumption', edit: 'assumptions' },
      ]),
      { label: 'Building costs rise', value: `${construction.value}%/yr`, tag: tagFor(construction.source), edit: 'assumptions' },
    ],
    method: 'For each aging one: years left = how long these usually last − its age. Its price when it gives out = today\'s price × (1 + the yearly rise in building costs) raised to the years left. Repairs start at the yearly amount and rise with building costs until it gives out. A like-for-like replacement wears out again after the usual life, so waiting pays for it again if that falls inside the look-ahead.',
  }
}
