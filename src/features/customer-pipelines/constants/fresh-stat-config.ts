import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'
import type { StatBarItemConfig } from '@/shared/components/stat-bar/types'

import { meetingsThisWeekStat, pipelineStatConfig } from '@/features/customer-pipelines/constants/pipeline-stat-config'

/**
 * Fresh pipeline metrics — the shared base plus "Meetings This Week", which only
 * applies where stages include meeting_scheduled / meeting_in_progress.
 */
export const freshStatConfig: StatBarItemConfig<CustomerPipelineItem>[] = [
  ...pipelineStatConfig,
  meetingsThisWeekStat,
]
