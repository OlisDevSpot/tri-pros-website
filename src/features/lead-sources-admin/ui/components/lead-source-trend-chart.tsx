'use client'

import type { TimeRangeChip } from '@/features/lead-sources-admin/constants/time-ranges'
import type { Bucket } from '@/features/lead-sources-admin/lib/format-bucket-label'

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { formatBucketLabel, formatBucketRange } from '@/features/lead-sources-admin/lib/format-bucket-label'
import { formatTimeRangeClause } from '@/features/lead-sources-admin/lib/format-time-range-clause'
import { formatAsCount } from '@/shared/lib/formatters'

interface TrendPoint {
  bucketStart: string
  leads: number
  meetings: number
  signed: number
}

interface Props {
  trend: TrendPoint[]
  bucket: Bucket
  chip: TimeRangeChip
}

export function LeadSourceTrendChart({ trend, bucket, chip }: Props) {
  return (
    <section aria-label="Activity over time" className="space-y-2">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {`Activity over time · ${formatTimeRangeClause(chip)}`}
      </h3>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="bucketStart"
              tickFormatter={v => formatBucketLabel(v, bucket)}
              className="text-xs"
              stroke="var(--muted-foreground)"
            />
            <YAxis
              tickFormatter={formatAsCount}
              allowDecimals={false}
              className="text-xs"
              stroke="var(--muted-foreground)"
            />
            <Tooltip content={<TrendTooltip bucket={bucket} />} />
            <Legend wrapperStyle={{ fontSize: 12 }} iconType="line" />
            <Line type="monotone" dataKey="leads" stroke="var(--foreground)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Leads" />
            <Line type="monotone" dataKey="meetings" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Meetings" />
            <Line type="monotone" dataKey="signed" stroke="var(--chart-1)" strokeWidth={2} dot={false} activeDot={{ r: 4 }} name="Signatures" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}

interface TooltipProps {
  active?: boolean
  payload?: Array<{ payload: TrendPoint, value: number, name: string, color: string }>
  bucket: Bucket
}

function TrendTooltip({ active, payload, bucket }: TooltipProps) {
  if (!active || !payload?.length) {
    return null
  }
  const point = payload[0].payload
  const signedRate = point.leads > 0 ? Math.round((point.signed / point.leads) * 100) : 0
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">{formatBucketRange(point.bucketStart, bucket)}</div>
      <div className="grid grid-cols-[auto_auto] gap-x-3 gap-y-0.5 tabular-nums">
        <span className="text-muted-foreground">Leads</span>
        <span className="text-right">{formatAsCount(point.leads)}</span>
        <span className="text-muted-foreground">Meetings</span>
        <span className="text-right">{formatAsCount(point.meetings)}</span>
        <span className="text-muted-foreground">Signatures</span>
        <span className="text-right">{formatAsCount(point.signed)}</span>
        <span className="text-muted-foreground">Signed-rate</span>
        <span className="text-right">{`${signedRate}%`}</span>
      </div>
    </div>
  )
}
