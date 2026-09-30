'use client'

import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { SlidersHorizontalIcon } from 'lucide-react'

import { LOOK_AHEAD_YEARS } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import { TONE_TEXT_CLASSES } from '@/features/calculators/remodel-roi-calculator/constants/story-classes'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { useStoryUi } from '@/features/calculators/remodel-roi-calculator/contexts/story-ui-context'
import { signedMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { Button } from '@/shared/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { cn } from '@/shared/lib/utils'

interface Props {
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
  onLookAheadChange: (years: LookAheadYears) => void
  showInputsButton: boolean
}

export function TopBar({ projection, lookAhead, onLookAheadChange, showInputsButton }: Props) {
  const { openAssumptions, openInputs } = useStoryUi()
  const { paysForItselfYear, costsLessMonthlyYear } = projection.milestones
  return (
    <div className="sticky top-0 z-10 flex h-14 items-center gap-3.5 border-b bg-(--popover-glass) px-8 backdrop-blur-md @max-[44rem]/story:h-auto @max-[44rem]/story:flex-wrap @max-[44rem]/story:py-2" data-slot="story-top-bar">
      {showInputsButton && (
        <Button className="min-h-11" onClick={openInputs} type="button" variant="outline">
          <SlidersHorizontalIcon />
          {STORY_COPY.inputs}
        </Button>
      )}
      <div className="flex min-w-0 flex-1 flex-nowrap gap-x-4.5 text-sm font-semibold text-muted-foreground @max-[58rem]/story:text-xs @max-[44rem]/story:min-w-min @max-[44rem]/story:flex-wrap">
        {projection.ready
          ? (
              <>
                <span className="whitespace-nowrap">
                  <b className="mr-1 font-sans text-base font-semibold text-foreground tabular-nums">{paysForItselfYear ? `Year ${paysForItselfYear}` : '—'}</b>
                  pays for itself
                </span>
                <span className="whitespace-nowrap">
                  <b className="mr-1 font-sans text-base font-semibold text-foreground tabular-nums">{costsLessMonthlyYear ? `Year ${costsLessMonthlyYear}` : '—'}</b>
                  costs less monthly
                </span>
                <span className="whitespace-nowrap">
                  <b className={cn('mr-1 font-sans text-base font-semibold tabular-nums', TONE_TEXT_CLASSES[projection.years[lookAhead].benefit < 0 ? 'wait' : 'now'])}>{signedMoney(projection.years[lookAhead].benefit)}</b>
                  by year
                  {' '}
                  {lookAhead}
                </span>
              </>
            )
          : <span>{STORY_COPY.topBarEmpty}</span>}
      </div>
      <Button aria-label={STORY_COPY.assumptions} className="min-h-11" onClick={openAssumptions} type="button" variant="outline">
        <SlidersHorizontalIcon />
        <span className="@max-[58rem]/story:hidden">{STORY_COPY.assumptions}</span>
      </Button>
      <div className="flex items-center gap-2">
        <span className="whitespace-nowrap text-xs font-bold text-muted-foreground @max-[58rem]/story:hidden">{STORY_COPY.lookAhead}</span>
        <ToggleGroup
          aria-label={STORY_COPY.lookAhead}
          onValueChange={(value) => {
            const years = LOOK_AHEAD_YEARS.find(option => String(option) === value)
            if (years) {
              onLookAheadChange(years)
            }
          }}
          type="single"
          value={String(lookAhead)}
          variant="outline"
        >
          {LOOK_AHEAD_YEARS.map(years => <ToggleGroupItem className="h-11 min-w-11 flex-none px-3" key={years} value={String(years)}>{years === LOOK_AHEAD_YEARS[0] ? `${years} yrs` : years}</ToggleGroupItem>)}
        </ToggleGroup>
      </div>
    </div>
  )
}
