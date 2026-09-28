'use client'

import type { MetricKey } from '@/features/analytics/constants/metrics'
import type { ReportTabConfig } from '@/features/analytics/constants/tabs'
import type { AnalyticsReport } from '@/features/analytics/types'

import { AlertTriangleIcon } from 'lucide-react'

import { readMetric } from '@/features/analytics/lib/read-metric'
import { HeadlineFigure } from '@/features/analytics/ui/components/report/headline-figure'
import { Button } from '@/shared/components/ui/button'

interface Props {
  config: ReportTabConfig
  report: AnalyticsReport
  focus: MetricKey
  onFocus: (metric: MetricKey) => void
  onOpenSpend: () => void
}

export function HeadlineStrip({ config, report, focus, onFocus, onOpenSpend }: Props) {
  const reasons = report.notApplicable.headline
  const shown = config.figures.flatMap(f => (f.sub ? [f.metric, f.sub] : [f.metric]))
  const notApplicable = [...new Set(shown.map(key => readMetric(key, report.headline, reasons)).flatMap(d => (d.kind === 'not_applicable' ? [d.reason] : [])))]
  const missing = report.headline.cost.status === 'missing' ? report.headline.cost.missing : []
  return (
    <section aria-label="Headline figures" className="flex flex-col gap-2">
      <div className="grid grid-cols-2 divide-border border-y border-border md:flex md:divide-x">
        {config.figures.map(figure => (
          <HeadlineFigure
            key={figure.metric}
            figure={figure}
            row={report.headline}
            reasons={reasons}
            selected={figure.metric === focus}
            onSelect={() => onFocus(figure.metric)}
          />
        ))}
      </div>
      {notApplicable.map(reason => (
        <p key={reason} className="text-xs text-muted-foreground">
          n/a:
          {' '}
          {reason}
        </p>
      ))}
      {missing.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          className="h-auto self-start border-warning text-left whitespace-normal text-warning"
          aria-label={`Spend missing for ${missing.length} source-${missing.length === 1 ? 'month' : 'months'} — open the Spend tab`}
          onClick={onOpenSpend}
        >
          <AlertTriangleIcon className="size-3.5" aria-hidden="true" />
          Spend missing ·
          {' '}
          <span className="tabular-nums">{missing.length}</span>
        </Button>
      )}
    </section>
  )
}
