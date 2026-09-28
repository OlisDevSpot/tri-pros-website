'use client'

import type { ReportTab } from '@/features/analytics/constants/tabs'
import type { AnalyticsReport } from '@/features/analytics/types'

import { REPORT_TABS } from '@/features/analytics/constants/tabs'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { resolveFocus, resolveGroupBy } from '@/features/analytics/lib/to-report-input'
import { ReportSkeleton } from '@/features/analytics/ui/components/report-skeleton'
import { BreakdownTable } from '@/features/analytics/ui/components/report/breakdown-table'
import { DataToFixPanel } from '@/features/analytics/ui/components/report/data-to-fix-panel'
import { FocusTrendChart } from '@/features/analytics/ui/components/report/focus-trend-chart'
import { HeadlineStrip } from '@/features/analytics/ui/components/report/headline-strip'
import { ErrorState } from '@/shared/components/states/error-state'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface Props {
  tab: ReportTab
  report: AnalyticsReport | undefined
  isError: boolean
  /** The previous report is still on screen while the next one loads. */
  stale: boolean
  onRetry: () => void
}

export function ReportTabContent({ tab, report, isError, stale, onRetry }: Props) {
  const [state, setUrlState] = useAnalyticsUrlState()
  if (!report) {
    if (isError) {
      return (
        <ErrorState title="The report didn't load" description="Nothing was changed. Try again.">
          <Button onClick={onRetry}>Retry</Button>
        </ErrorState>
      )
    }
    return <ReportSkeleton />
  }
  const config = REPORT_TABS[tab]
  const focus = resolveFocus(tab, state.focus)
  return (
    <div aria-busy={stale} className={cn('flex flex-col gap-6 transition-opacity', stale && 'opacity-60')}>
      <HeadlineStrip
        config={config}
        report={report}
        focus={focus}
        onFocus={metric => void setUrlState({ focus: metric })}
        onOpenSpend={() => void setUrlState({ tab: 'spend' })}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <FocusTrendChart metric={focus} report={report} />
        <DataToFixPanel keys={config.hygiene} hygiene={report.hygiene} asOf={report.generatedAt} />
      </div>
      <BreakdownTable config={config} report={report} focus={focus} groupBy={resolveGroupBy(state)} onGroupBy={groupBy => void setUrlState({ groupBy })} />
    </div>
  )
}
