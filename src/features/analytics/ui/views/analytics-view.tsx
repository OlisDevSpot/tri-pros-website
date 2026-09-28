'use client'

import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { ANALYTICS_TABS, REPORT_TAB_KEYS } from '@/features/analytics/constants/tabs'
import { useAnalyticsUrlState } from '@/features/analytics/hooks/use-analytics-url-state'
import { toReportInput } from '@/features/analytics/lib/to-report-input'
import { AnalyticsTabsList } from '@/features/analytics/ui/components/analytics-tabs-list'
import { AnalyticsFilterBar } from '@/features/analytics/ui/components/filter-bar/analytics-filter-bar'
import { ProjectsPlaceholder } from '@/features/analytics/ui/components/projects-placeholder'
import { ReportSkeleton } from '@/features/analytics/ui/components/report-skeleton'
import { Tabs, TabsContent } from '@/shared/components/ui/tabs'
import { useHydrationParityCheck } from '@/shared/dal/client/hooks/use-hydration-parity-check'
import { useTRPC } from '@/trpc/helpers'

export function AnalyticsView() {
  const trpc = useTRPC()
  const [urlState, setUrlState] = useAnalyticsUrlState()
  const reportOptions = trpc.analyticsRouter.report.queryOptions(toReportInput(urlState))
  useHydrationParityCheck(reportOptions.queryKey)
  const report = useQuery({ ...reportOptions, placeholderData: keepPreviousData })

  const changeTab = (value: string) => {
    const next = ANALYTICS_TABS.find(t => t === value)
    if (next) {
      void setUrlState({ tab: next, groupBy: null, focus: null })
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground">How the lead chain is doing, from lead to sale, per source and in total.</p>
      </header>
      <AnalyticsFilterBar firstDay={report.data?.firstDay} lastDay={report.data?.lastDay} />
      <Tabs value={urlState.tab} onValueChange={changeTab} className="flex flex-col gap-6">
        <AnalyticsTabsList spendMissing={(report.data?.spendMissing.length ?? 0) > 0} />
        {REPORT_TAB_KEYS.map(tab => (
          <TabsContent key={tab} value={tab}>
            <ReportSkeleton />
          </TabsContent>
        ))}
        <TabsContent value="projects">
          <ProjectsPlaceholder />
        </TabsContent>
        <TabsContent value="spend">
          <p className="text-sm text-muted-foreground">Spend entry arrives in Task 9.</p>
        </TabsContent>
      </Tabs>
    </div>
  )
}
