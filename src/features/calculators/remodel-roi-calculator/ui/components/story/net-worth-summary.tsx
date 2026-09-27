import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { PATH_BAR_CLASSES } from '@/features/calculators/remodel-roi-calculator/constants/story-classes'
import { STORY_COPY } from '@/features/calculators/remodel-roi-calculator/constants/story-copy'
import { roundMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { cn } from '@/shared/lib/utils'

interface Props {
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
}

export function NetWorthSummary({ projection, lookAhead }: Props) {
  const net = projection.years[lookAhead].netWorth
  if (!net) {
    return null
  }
  return (
    <div className="grid gap-2.5 rounded-xl border bg-card p-5">
      <p className="text-[13px] font-extrabold">
        Your net worth in year
        {lookAhead}
      </p>
      <div className="grid grid-cols-2 gap-3">
        {(['now', 'wait'] as const).map(path => (
          <div className="flex items-center gap-2.5" key={path}>
            <span aria-hidden className={cn('h-9 w-1 rounded-full', PATH_BAR_CLASSES[path])} />
            <div className="grid">
              <span className="text-xs font-extrabold text-muted-foreground">{STORY_COPY.paths[path]}</span>
              <b className="font-sans text-2xl font-semibold tabular-nums">{roundMoney(path === 'now' ? net.now : net.wait)}</b>
            </div>
          </div>
        ))}
      </div>
      <p className="text-[12.5px] leading-snug text-muted-foreground">
        What you own minus what you owe: your home (
        {roundMoney(net.home)}
        ) plus the value each path adds, minus every loan still owed (
        {roundMoney(net.owed)}
        {' '}
        on your current loans).
      </p>
    </div>
  )
}
