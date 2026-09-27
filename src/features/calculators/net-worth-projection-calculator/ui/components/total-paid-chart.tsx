'use client'

import type { ProjectionYear } from '@/features/calculators/net-worth-projection-calculator/types'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  years: ProjectionYear[]
}

export function TotalPaidChart({ years }: Props) {
  return (
    <section aria-label="Total paid over time" className="flex flex-col gap-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total paid over time</h3>
      <div className="h-56 w-full">
        <ResponsiveContainer height="100%" width="100%">
          <LineChart data={years} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis className="text-xs" dataKey="t" stroke="var(--muted-foreground)" tickFormatter={t => `Yr ${t}`} />
            <YAxis className="text-xs" stroke="var(--muted-foreground)" tickFormatter={value => formatAsDollars(Number(value))} width={88} />
            <Tooltip formatter={value => formatAsDollars(Number(value))} labelFormatter={t => `Year ${t}`} />
            <Legend iconType="line" wrapperStyle={{ fontSize: 12 }} />
            <Line activeDot={{ r: 4 }} dataKey="cumulativeCostBefore" dot={false} name="Without the project" stroke="var(--muted-foreground)" strokeWidth={2} type="monotone" />
            <Line activeDot={{ r: 4 }} dataKey="cumulativeCostAfter" dot={false} name="With the project" stroke="var(--chart-1)" strokeWidth={2} type="monotone" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
