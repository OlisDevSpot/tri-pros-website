import type { AnalyticsHygiene } from '@/features/analytics/types'

import Link from 'next/link'

import { HYGIENE_LABELS } from '@/features/analytics/constants/labels'
import { hygieneHref } from '@/features/analytics/lib/hygiene-links'
import { formatAsCount } from '@/shared/lib/formatters'

interface Props {
  keys: readonly (keyof AnalyticsHygiene)[]
  hygiene: AnalyticsHygiene
  asOf: string
}

export function DataToFixPanel({ keys, hygiene, asOf }: Props) {
  return (
    <section aria-labelledby="data-to-fix" className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <div className="flex flex-col gap-0.5">
        <h2 id="data-to-fix" className="text-sm font-semibold">Data to fix</h2>
        <p className="text-xs text-muted-foreground">All records, not narrowed by these filters.</p>
      </div>
      <ul className="flex flex-col divide-y divide-border">
        {keys.map((key) => {
          const count = hygiene[key]
          const href = hygieneHref(key, asOf)
          let value = <span className="tabular-nums text-muted-foreground">0</span>
          if (count > 0) {
            value = href
              ? <Link href={href} className="font-semibold tabular-nums text-primary underline-offset-4 hover:underline">{`${formatAsCount(count)} · Fix`}</Link>
              : <span className="font-semibold tabular-nums text-warning">{formatAsCount(count)}</span>
          }
          return (
            <li key={key} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span>{HYGIENE_LABELS[key]}</span>
              {value}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
