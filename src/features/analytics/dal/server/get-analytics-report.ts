import type { AnalyticsReportInput } from '@/features/analytics/schemas/report-input-schema'
import type { AnalyticsReport } from '@/features/analytics/types'
import type { DalReturn } from '@/shared/dal/server/types'

import { loadAnalyticsFacts } from '@/features/analytics/dal/server/load-analytics-facts'
import { analyticsReportWindow, buildAnalyticsReport } from '@/features/analytics/lib/build-analytics-report'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { listLeadSources } from '@/shared/entities/lead-sources/dal/server/queries'
import { listLeadSourceSpend } from '@/shared/entities/lead-sources/dal/server/spend'

export async function getAnalyticsReport(input: AnalyticsReportInput, now: Date): Promise<DalReturn<AnalyticsReport>> {
  return dalDbOperation(async () => {
    const { spendMonths } = analyticsReportWindow(input, now)
    const [facts, sources, spend] = await Promise.all([loadAnalyticsFacts(), listLeadSources(), listLeadSourceSpend(spendMonths)])
    return buildAnalyticsReport({
      facts: dalVerifySuccess(facts),
      sources: dalVerifySuccess(sources).map(s => ({ id: s.id, spendMode: s.spendMode })),
      spend: dalVerifySuccess(spend),
    }, input, now)
  })
}
