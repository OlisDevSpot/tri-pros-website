import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'
import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { pipelineStatConfig } from '@/features/customer-pipelines/constants/pipeline-stat-config'
import { projectsStatConfig } from '@/features/customer-pipelines/constants/projects-stat-config'
import { StatBar } from '@/shared/components/stat-bar/ui/stat-bar'

interface Props {
  items: CustomerPipelineItem[]
  pipeline: Pipeline
  isLoading?: boolean
}

export function CustomerPipelineMetricsBar({ items, pipeline, isLoading }: Props) {
  // Projects get "Total Signed" + "Total Opened"; every other pipeline keeps
  // the shared customer-funnel stats.
  const config = pipeline === 'projects' ? projectsStatConfig : pipelineStatConfig
  return <StatBar items={config} data={items} isLoading={isLoading} />
}
