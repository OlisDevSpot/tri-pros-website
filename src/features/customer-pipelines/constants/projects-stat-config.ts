import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'
import type { StatBarItemConfig } from '@/shared/components/stat-bar/types'

import { BanknoteIcon, DollarSignIcon } from 'lucide-react'

import { pipelineStatConfig } from '@/features/customer-pipelines/constants/pipeline-stat-config'

/**
 * Project stages whose value never reaches the bank — a cancelled job is dead,
 * an on-hold job is paused indefinitely. Excluded from "Total Opened".
 */
const NON_BANKABLE_PROJECT_STAGES: string[] = ['cancelled', 'on_hold']

/**
 * Total Signed — every project's value regardless of stage (includes cancelled
 * and on-hold). The theoretical maximum revenue across all signed contracts.
 * This is the former shared "Active Pipeline Value" stat, renamed for projects.
 */
const totalSignedStat: StatBarItemConfig<CustomerPipelineItem> = {
  key: 'total-signed',
  label: 'Total Signed',
  icon: DollarSignIcon,
  getValue: data => data.reduce((sum, item) => sum + item.totalPipelineValue, 0),
  renderValue: v => `$${v.toLocaleString()}`,
}

/**
 * Total Opened — project value excluding cancelled / on-hold jobs: the money
 * actually expected to hit the bank. Only these two non-bankable stages are
 * subtracted from Total Signed; every other stage still counts.
 */
const totalOpenedStat: StatBarItemConfig<CustomerPipelineItem> = {
  key: 'total-opened',
  label: 'Total Opened',
  icon: BanknoteIcon,
  getValue: data =>
    data
      .filter(item => !NON_BANKABLE_PROJECT_STAGES.includes(item.stage))
      .reduce((sum, item) => sum + item.totalPipelineValue, 0),
  renderValue: v => `$${v.toLocaleString()}`,
}

/**
 * Projects pipeline metrics. Mirrors the shared customer-pipeline stat bar but
 * swaps the single "Active Pipeline Value" stat for the project-specific
 * "Total Signed" (gross) + "Total Opened" (bankable) pair.
 */
export const projectsStatConfig: StatBarItemConfig<CustomerPipelineItem>[] = pipelineStatConfig.flatMap(
  stat => (stat.key === 'value' ? [totalSignedStat, totalOpenedStat] : [stat]),
)
