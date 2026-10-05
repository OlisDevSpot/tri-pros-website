import { getAnalyticsFilterOptions } from '@/features/analytics/dal/server/get-analytics-filter-options'
import { getAnalyticsReport } from '@/features/analytics/dal/server/get-analytics-report'
import { analyticsReportInputSchema } from '@/features/analytics/schemas/report-input-schema'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { createTRPCRouter, superAdminProcedure } from '../init'

export const analyticsRouter = createTRPCRouter({
  report: superAdminProcedure
    .input(analyticsReportInputSchema)
    .query(async ({ input }) => dalToTrpc(await getAnalyticsReport(input, new Date()))),

  filterOptions: superAdminProcedure
    .query(async () => dalToTrpc(await getAnalyticsFilterOptions(new Date()))),
})
