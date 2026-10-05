import type { StatBarItemConfig } from '@/shared/components/stat-bar/types'
import type { CustomerPipelineItem } from '@/shared/entities/customers/types/pipeline-item'

import { meetingsThisWeekStat, pipelineStatConfig } from '@/features/customer-pipelines/constants/pipeline-stat-config'

/**
 * Fresh pipeline metrics — the shared base plus "Meetings This Week", which only
 * applies where stages include needs_confirmation / meeting_confirmed / meeting_in_progress.
 */
export const freshStatConfig: StatBarItemConfig<CustomerPipelineItem>[] = [
  ...pipelineStatConfig,
  meetingsThisWeekStat,
]
