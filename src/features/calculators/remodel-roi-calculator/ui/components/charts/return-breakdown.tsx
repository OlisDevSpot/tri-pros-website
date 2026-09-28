import type { LookAheadYears } from '@/features/calculators/remodel-roi-calculator/constants/look-ahead'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { formatMoney, signedMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { TipSegment } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/tip-segment'
import { cn } from '@/shared/lib/utils'

interface Props {
  projection: RemodelRoiProjection
  lookAhead: LookAheadYears
}

export function ReturnBreakdown({ projection, lookAhead }: Props) {
  const parts = projection.years[lookAhead].returnParts
  const rows = [
    { label: 'Lower bills', value: parts.billsSaved, detail: `${formatYears(lookAhead)} of smaller bills` },
    { label: 'Repairs you skip', value: parts.repairsSkipped, detail: 'repairs on the aging ones' },
    { label: 'Replacements you skip', value: parts.replacementsSkipped, detail: 'the like-for-like price each time it gives out' },
    { label: 'Interest you skip', value: parts.interestSkipped, detail: 'interest on the replacement loans' },
    { label: 'Home\'s added value', value: parts.valueGain, detail: 'upgrade value minus replacement value' },
    { label: 'Project price', value: parts.projectPrice, detail: 'what you pay for the project' },
    { label: 'Interest on your loan', value: parts.projectInterest, detail: `interest paid and owed by year ${lookAhead}` },
  ].filter(row => Math.abs(row.value) > 0.5)
  let running = 0
  const spans = rows.map((row) => {
    const from = running
    running += row.value
    return { ...row, from, to: running }
  })
  const low = Math.min(0, ...spans.flatMap(span => [span.from, span.to]))
  const high = Math.max(0, ...spans.flatMap(span => [span.from, span.to]))
  const at = (value: number) => ((value - low) / (high - low || 1)) * 100
  const zero = at(0)
  return (
    <div className="grid grid-cols-[9.5rem_minmax(0,1fr)_auto] gap-x-3 gap-y-1 @max-md/story:grid-cols-[7rem_minmax(0,1fr)_auto]">
      <p className="col-span-full text-[13px] font-extrabold">
        Where the return comes from, by year
        {' '}
        {lookAhead}
      </p>
      {spans.map(span => (
        <div className="col-span-full grid min-h-8 grid-cols-subgrid items-center" key={span.label}>
          <span className="text-[13.5px] font-bold">{span.label}</span>
          <span className="relative h-4.5">
            <TipSegment
              className={cn('absolute inset-y-0 rounded-sm', span.value >= 0 ? 'bg-primary' : 'bg-muted-foreground/50')}
              rows={[{ label: span.detail, value: `${span.value > 0 ? '+' : ''}${formatMoney(span.value)}` }, { label: 'Running total', value: formatMoney(span.to) }]}
              style={{ left: `${at(Math.min(span.from, span.to))}%`, width: `${Math.max(0.6, Math.abs(at(span.to) - at(span.from)))}%` }}
              title={span.label}
            />
            <b aria-hidden className="absolute -inset-y-1 w-px bg-muted-foreground" style={{ left: `${zero}%` }} />
          </span>
          <span className="text-right font-sans text-[14.5px] font-semibold tabular-nums">{signedMoney(span.value)}</span>
        </div>
      ))}
      <div className="col-span-full mt-1 grid min-h-8 grid-cols-subgrid items-center border-t pt-2">
        <span className="text-[13.5px] font-extrabold">
          Where you stand in year
          {' '}
          {lookAhead}
        </span>
        <span className="relative h-4.5">
          <TipSegment className="absolute inset-y-0 rounded-sm bg-foreground" rows={[{ label: 'All the parts above', value: formatMoney(running) }]} style={{ left: `${at(Math.min(0, running))}%`, width: `${Math.abs(at(running) - zero)}%` }} title={`Where you stand in year ${lookAhead}`} />
          <b aria-hidden className="absolute -inset-y-1 w-px bg-muted-foreground" style={{ left: `${zero}%` }} />
        </span>
        <span className="text-right font-sans text-[14.5px] font-extrabold tabular-nums">{signedMoney(running)}</span>
      </div>
    </div>
  )
}
