import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'
import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { freshStatConfig } from '@/features/customer-pipelines/constants/fresh-stat-config'
import { pipelineStatConfig } from '@/features/customer-pipelines/constants/pipeline-stat-config'
import { projectsStatConfig } from '@/features/customer-pipelines/constants/projects-stat-config'
import { StatBar } from '@/shared/components/stat-bar/ui/stat-bar'

interface Props {
  items: CustomerPipelineItem[]
  pipeline: Pipeline
  isLoading?: boolean
}

export function CustomerPipelineMetricsBar({ items, pipeline, isLoading }: Props) {
  // Projects get "Total Signed" + "Total Opened"; fresh adds "Meetings This
  // Week"; every other pipeline shows the shared base stats.
  let config = pipelineStatConfig
  if (pipeline === 'projects') {
    config = projectsStatConfig
  }
  else if (pipeline === 'fresh') {
    config = freshStatConfig
  }
  return <StatBar items={config} data={items} isLoading={isLoading} />
}
