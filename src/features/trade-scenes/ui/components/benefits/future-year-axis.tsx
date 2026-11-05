'use client'

import { BENEFITS_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { LOOK_AHEAD } from '@/features/trade-scenes/constants/look-ahead'
import { TWO_FUTURES_CHART } from '@/features/trade-scenes/constants/two-futures-chart'
import { useBenefits } from '@/features/trade-scenes/hooks/use-benefits'
import { yearLabel } from '@/features/trade-scenes/lib/year-label'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { cn } from '@/shared/lib/utils'

interface FutureYearAxisProps {
  portrait: boolean
}

const YEARS = Array.from({ length: LOOK_AHEAD.max - LOOK_AHEAD.min + 1 }, (_, index) => LOOK_AHEAD.min + index)

// Each year is a transparent radio over its drawn label, as the value menus' rows are, so the label and the phone's tick
// stay plain elements. The keys are taken before Radix's own: it moves focus a tick late and checks the year only if the
// key is still down by then, so quick presses on a busy frame leave focus and the checked year apart.
export function FutureYearAxis({ portrait }: FutureYearAxisProps) {
  const { lookAhead, setLookAhead } = useBenefits()
  // Every key Radix's roving focus answers on a horizontal group (it ignores ArrowUp and ArrowDown there), so none reaches
  // it to move focus off the picked year.
  const keyed: Partial<Record<string, number>> = {
    ArrowLeft: Math.max(LOOK_AHEAD.min, lookAhead - 1),
    ArrowRight: Math.min(LOOK_AHEAD.max, lookAhead + 1),
    Home: LOOK_AHEAD.min,
    PageUp: LOOK_AHEAD.min,
    End: LOOK_AHEAD.max,
    PageDown: LOOK_AHEAD.max,
  }

  return (
    <RadioGroup
      data-futures-axis
      aria-label={BENEFITS_COPY.futures.axis}
      orientation="horizontal"
      loop={false}
      value={String(lookAhead)}
      onValueChange={value => setLookAhead(Number(value))}
      onKeyDownCapture={(event) => {
        const year = keyed[event.key]
        if (year === undefined) {
          return
        }
        // Prevented, so the radio's own roving handler stands down.
        event.preventDefault()
        setLookAhead(year)
        event.currentTarget.querySelector<HTMLButtonElement>(`[role="radio"][value="${year}"]`)!.focus()
      }}
      className="grid-cols-10 gap-0"
    >
      {YEARS.map((year) => {
        const label = yearLabel(year)
        const tickOnly = portrait && !TWO_FUTURES_CHART.labelledOnPhone.includes(year)
        return (
          <span key={year} data-futures-stop={year} className={cn('relative grid place-items-center', portrait ? 'h-7.5' : 'h-10')}>
            <RadioGroupItem
              value={String(year)}
              aria-label={label}
              className="peer absolute inset-0 aspect-auto size-auto cursor-pointer rounded-lg border-0 bg-transparent shadow-none focus-visible:ring-[3px] focus-visible:ring-ring/50 *:data-[slot=radio-group-indicator]:hidden"
            />
            <span
              data-futures-label
              className={cn(
                'pointer-events-none rounded-full text-xs font-bold text-muted-foreground tabular-nums transition-colors duration-160 ease-(--futures-ease) peer-hover:text-foreground peer-aria-checked:bg-muted peer-aria-checked:text-foreground peer-aria-checked:inset-ring peer-aria-checked:inset-ring-primary motion-reduce:transition-none',
                portrait ? 'px-1.25 py-0.5' : 'px-2.25 py-0.75',
                tickOnly && 'hidden peer-aria-checked:block',
              )}
            >
              {label}
            </span>
            {tickOnly && <span aria-hidden className="pointer-events-none h-2 w-0.5 rounded-xs bg-border-strong peer-aria-checked:hidden" />}
          </span>
        )
      })}
    </RadioGroup>
  )
}
