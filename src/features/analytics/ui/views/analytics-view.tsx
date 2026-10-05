'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { ANALYTICS_TABS, REPORT_TAB_KEYS } from '@/features/analytics/constants/tabs'
import { useAnalyticsRange } from '@/features/analytics/hooks/use-analytics-range'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { toReportInput } from '@/features/analytics/lib/to-report-input'
import { AnalyticsTabsList } from '@/features/analytics/ui/components/analytics-tabs-list'
import { AnalyticsFilterBar } from '@/features/analytics/ui/components/filter-bar/analytics-filter-bar'
import { ProjectsPlaceholder } from '@/features/analytics/ui/components/projects-placeholder'
import { ReportTabContent } from '@/features/analytics/ui/components/report/report-tab-content'
import { SpendGrid } from '@/features/analytics/ui/components/spend/spend-grid'
import { PageBar } from '@/shared/components/page-bar'
import { Tabs, TabsContent } from '@/shared/components/ui/tabs'
import { useHydrationParityCheck } from '@/shared/dal/client/hooks/use-hydration-parity-check'
import { useTRPC } from '@/trpc/helpers'

export function AnalyticsView() {
  const trpc = useTRPC()
  const [urlState, setUrlState] = useAnalyticsUrlState()
  const { label: range } = useAnalyticsRange()
  const reportOptions = trpc.analyticsRouter.report.queryOptions(toReportInput(urlState))
  useHydrationParityCheck(reportOptions.queryKey)
  const report = useQuery({ ...reportOptions, placeholderData: keepPreviousData })

  const changeTab = (value: string) => {
    const next = ANALYTICS_TABS.find(t => t === value)
    if (next) {
      void setUrlState({ tab: next, groupBy: null, focus: null, series: null })
    }
  }

  return (
    // The template pads the page; this view owns the scroll so the controls stay put above the data.
    <Tabs value={urlState.tab} onValueChange={changeTab} className="flex h-full min-h-0 flex-col gap-(--gutter)">
      <PageBar className="shrink-0">
        <header className="flex flex-col gap-3">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
            {/* As tall as the toolbar, so the title lines up with it when filter chips add a row underneath. */}
            <div className="flex min-h-[2.375rem] min-w-0 flex-col justify-center gap-0.5">
              <h1 className="text-2xl font-medium text-foreground">Analytics</h1>
              <p className="text-xs text-muted-foreground max-2xl:sr-only">How the lead chain is doing, from lead to sale, per source and in total.</p>
              {/* On a phone the toolbar has no room for the dates, so they sit under the title. */}
              <p className="text-xs text-muted-foreground tabular-nums sm:hidden">{range}</p>
            </div>
            <AnalyticsFilterBar />
          </div>
          <AnalyticsTabsList spendMissing={(report.data?.spendMissing.length ?? 0) > 0} />
        </header>
      </PageBar>
      <div className="-mr-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 pb-0 scrollbar-gutter-stable">
        {REPORT_TAB_KEYS.map(tab => (
          <TabsContent key={tab} value={tab}>
            <ReportTabContent tab={tab} report={report.data} isError={report.isError} stale={report.isPlaceholderData} onRetry={() => void report.refetch()} />
          </TabsContent>
        ))}
        <TabsContent value="projects">
          <ProjectsPlaceholder />
        </TabsContent>
        <TabsContent value="spend">
          <SpendGrid
            months={report.data?.spendGridMonths}
            missing={report.data?.spendMissing ?? []}
            isError={report.isError && !report.data}
            onRetry={() => void report.refetch()}
          />
        </TabsContent>
      </div>
    </Tabs>
  )
}
