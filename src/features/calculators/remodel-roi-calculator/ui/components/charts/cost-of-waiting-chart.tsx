import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { CURRENT_LABELS } from '@/features/calculators/remodel-roi-calculator/constants/trades'
import { formatMoney } from '@/features/calculators/remodel-roi-calculator/lib/format-money'
import { formatYears } from '@/features/calculators/remodel-roi-calculator/lib/format-years'
import { TipSegment } from '@/features/calculators/remodel-roi-calculator/ui/components/charts/tip-segment'
import { LegendSwatches } from '@/shared/components/charts/legend-swatches'

interface Props {
  projection: RemodelRoiProjection
}

export function CostOfWaitingChart({ projection }: Props) {
  const { replacements, assumptions } = projection
  if (!replacements.length) {
    return null
  }
  const growth = 1 + assumptions.constructionPercent.value / 100
  const max = Math.max(...replacements.flatMap(replacement => replacement.installs.map((install, index) => install.price + (index === 0 ? replacement.repairsUntil : 0))))
  const width = (value: number) => ({ width: `${(value / max) * 100}%` })
  return (
    <div className="grid gap-3">
      <LegendSwatches items={[{ label: 'Price today', swatch: 'bg-muted-foreground/40' }, { label: 'Price when it gives out', swatch: 'bg-warning' }, { label: 'Repairs until then', swatch: 'bg-warning/40' }]} />
      <div className="grid gap-4.5">
        {replacements.map((replacement) => {
          const label = CURRENT_LABELS[replacement.trade]
          return (
            <div className="grid gap-1.5" key={replacement.trade}>
              <p className="text-sm font-extrabold">
                {label}
                <span className="ml-1.5 text-[12.5px] font-semibold text-muted-foreground">
                  gives out in about
                  {formatYears(replacement.installs[0].year)}
                </span>
              </p>
              <div className="grid grid-cols-[4rem_minmax(0,1fr)_5.5rem] items-center gap-2.5">
                <span className="text-[12.5px] font-bold text-muted-foreground">Today</span>
                <span className="flex h-5.5 gap-0.5">
                  <TipSegment className="rounded-r bg-muted-foreground/40" rows={[{ label: 'Same kind, installed today', value: formatMoney(replacement.likeForLikePrice.value) }]} style={width(replacement.likeForLikePrice.value)} title={`${label} · today`} />
                </span>
                <span className="text-right font-sans text-[15px] font-semibold tabular-nums">{formatMoney(replacement.likeForLikePrice.value)}</span>
              </div>
              {replacement.installs.map((install, index) => (
                <div className="grid grid-cols-[4rem_minmax(0,1fr)_5.5rem] items-center gap-2.5" key={install.year}>
                  <span className="text-[12.5px] font-bold text-muted-foreground">
                    Year
                    {install.year}
                  </span>
                  <span className="flex h-5.5 gap-0.5">
                    <TipSegment className={index === 0 ? 'bg-warning' : 'rounded-r bg-warning'} rows={[{ label: 'Price when it gives out', value: formatMoney(install.price) }, { label: `${formatMoney(replacement.likeForLikePrice.value)} × ${(growth ** install.year).toFixed(3)}`, value: '' }]} style={width(install.price)} title={`${label} · year ${install.year}`} />
                    {index === 0 && <TipSegment className="rounded-r bg-warning/40" rows={[{ label: `Repairs, years 1–${install.year}`, value: formatMoney(replacement.repairsUntil) }]} style={width(replacement.repairsUntil)} title={`${label} · repairs`} />}
                  </span>
                  <span className="text-right font-sans text-[15px] font-semibold tabular-nums">{formatMoney(install.price + (index === 0 ? replacement.repairsUntil : 0))}</span>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
