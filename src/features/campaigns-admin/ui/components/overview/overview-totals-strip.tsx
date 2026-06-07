'use client'

interface OverviewTotalsStripProps {
  dnc: number
  eligible: number
  enrolled: number
}

export function OverviewTotalsStrip({ dnc, eligible, enrolled }: OverviewTotalsStripProps) {
  const stats = [
    { label: 'Enrolled', tone: 'text-green-600 dark:text-green-400', value: enrolled },
    { label: 'Eligible', tone: 'text-foreground', value: eligible },
    { label: 'DNC', tone: 'text-red-600 dark:text-red-400', value: dnc },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {stats.map(s => (
        <div
          key={s.label}
          className="flex flex-col gap-1 rounded-lg border border-border bg-card p-4"
        >
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {s.label}
          </span>
          <span className={`text-2xl font-semibold tabular-nums ${s.tone}`}>
            {s.value.toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}
