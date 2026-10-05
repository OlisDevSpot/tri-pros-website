import type { ChapterContent, StoryInputs } from '@/features/calculators/remodel-roi-calculator/types'

import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { formatMoney, roundMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { emphasis, plain } from '@/features/calculators/remodel-roi-calculator/lib/story/answer-parts'
import { tagFor } from '@/features/calculators/remodel-roi-calculator/lib/story/tag-for'

export function buildValue({ projection, lookAhead }: StoryInputs): ChapterContent {
  const { project, valueAddedToday, years, assumptions, replacements } = projection
  const at = years[lookAhead]
  const share = assumptions.valueAddedPercent
  const appreciation = assumptions.homeAppreciationPercent
  return {
    id: 'value',
    question: STORY_COPY.questions.value,
    answer: [plain('Upgrading adds about '), emphasis(roundMoney(valueAddedToday), 'now'), plain(' to your home\'s value today, and it grows with your home: about '), emphasis(roundMoney(at.valueNow), 'now'), plain(` by year ${lookAhead}.`)],
    guide: replacements.length ? `Waiting adds some value too, once the replacement is in: about ${roundMoney(at.valueWait)} by year ${lookAhead}.` : 'Leaving the house as it is adds nothing.',
    equation: `${formatMoney(project.price)} × ${share.value}% = ${formatMoney(valueAddedToday)} today, growing ${appreciation.value}%/yr`,
    receipt: [
      { kind: 'line', label: 'Project price', value: formatMoney(project.price), tag: 'yours' },
      { kind: 'line', op: '×', label: 'Share of the price the upgrade adds to your home', value: `${share.value}%`, tag: tagFor(share.source) },
      { kind: 'line', op: '=', label: 'Value added today', value: formatMoney(valueAddedToday), tag: 'calc' },
      { kind: 'line', op: '×', label: `Homes here rise ${appreciation.value}%/yr for ${formatYears(lookAhead)}`, value: `×${((1 + appreciation.value / 100) ** lookAhead).toFixed(3)}`, tag: tagFor(appreciation.source) },
      { kind: 'line', op: '=', label: `Value added by year ${lookAhead}`, value: formatMoney(at.valueNow), tag: 'calc', strong: 'now' },
      ...(replacements.length
        ? [
            { kind: 'line' as const, op: '−' as const, label: 'Value the replacements would add by then', value: formatMoney(at.valueWait), tag: 'calc' as const, note: `${share.value}% of each one's price, from the year it goes in` },
            { kind: 'line' as const, op: '=' as const, label: 'Extra value from upgrading', value: formatMoney(at.valueNow - at.valueWait), tag: 'calc' as const },
          ]
        : []),
    ],
    uses: [
      { label: 'Project price', value: formatMoney(project.price), tag: 'yours', edit: 'project' },
      { label: 'Share of the price added to the home', value: `${share.value}%`, tag: tagFor(share.source), edit: 'assumptions' },
      { label: 'Homes here rise in value', value: `${appreciation.value}%/yr`, tag: tagFor(appreciation.source), edit: 'assumptions' },
    ],
    method: 'Value added = project price × the share it adds to the home. From then on it grows each year with home values. On the wait path, each replacement adds the same share of its own price, starting the year it goes in; a later like-for-like replacement takes the place of the one before it.',
  }
}
