'use client'

import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'

import { SpinnerLoader } from '@/shared/components/loaders/spinner-loader'
import { Card, CardContent } from '@/shared/components/ui/card'

interface Props {
  items: CustomerPipelineItem[]
  isLoading?: boolean
}

export function CustomerPipelineMetricsBar({ items, isLoading }: Props) {
  const totalCustomers = items.length
  const activePipelineValue = items
    .filter(i => i.stage !== 'declined' && i.stage !== 'approved')
    .reduce((sum, i) => sum + i.totalPipelineValue, 0)
  const approvedCount = items.filter(i => i.stage === 'approved').length
  const sentOrHigher = items.filter(i =>
    i.stage === 'proposal_sent'
    || i.stage === 'contract_sent'
    || i.stage === 'approved',
  ).length
  const conversionRate = sentOrHigher > 0 ? approvedCount / sentOrHigher : 0
  const meetingsThisWeek = items.filter((i) => {
    const d = new Date(i.latestActivityAt)
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    return d >= weekAgo && (i.stage === 'meeting_scheduled' || i.stage === 'meeting_in_progress')
  }).length

  const metrics = [
    { label: 'Total Customers', value: String(totalCustomers) },
    { label: 'Active Pipeline', value: `$${activePipelineValue.toLocaleString()}` },
    { label: 'Conversion Rate', value: `${(conversionRate * 100).toFixed(1)}%` },
    { label: 'Meetings This Week', value: String(meetingsThisWeek) },
  ]

  return (
    <>
      {/* Mobile: 2x2 grid */}
      <div className="grid grid-cols-2 gap-1.5 lg:hidden">
        {metrics.map(m => (
          <div
            key={m.label}
            className="flex flex-col items-center justify-center px-2 py-2 rounded-lg border border-border/50 bg-card"
          >
            <span className="h-5 flex items-center text-sm font-bold tabular-nums">
              {isLoading ? <SpinnerLoader /> : m.value}
            </span>
            <span className="text-[10px] text-muted-foreground mt-0.5">{m.label}</span>
          </div>
        ))}
      </div>

      {/* Desktop: card grid */}
      <div className="hidden lg:grid lg:grid-cols-4 gap-3">
        {metrics.map(m => (
          <Card key={m.label}>
            <CardContent className="py-3 text-center">
              <span className="h-8 flex items-center justify-center text-2xl font-bold tabular-nums">
                {isLoading ? <SpinnerLoader /> : m.value}
              </span>
              <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  )
}
