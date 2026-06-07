import type { AppRouterOutputs } from '@/trpc/routers/app'

export type SourceSummary = AppRouterOutputs['voipCampaignsRouter']['getSourceCampaignSummaries'][number]

export interface PartitionedSummaries {
  actionable: SourceSummary[]
  idle: SourceSummary[]
}

/**
 * Split source summaries into actionable (has eligible leads) and idle (none).
 * Actionable sources are sorted by eligible count desc so the most urgent lead the list.
 */
export function partitionSourceSummaries(summaries: SourceSummary[]): PartitionedSummaries {
  const actionable: SourceSummary[] = []
  const idle: SourceSummary[] = []

  for (const summary of summaries) {
    if (summary.eligibleCount > 0) {
      actionable.push(summary)
    }
    else {
      idle.push(summary)
    }
  }

  actionable.sort((a, b) => b.eligibleCount - a.eligibleCount)

  return { actionable, idle }
}
