import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { CustomerPipelineItem } from '@/shared/entities/customers/types/pipeline-item'

import { freshStatConfig } from '@/features/customer-pipelines/constants/fresh-stat-config'
import { pipelineStatConfig } from '@/features/customer-pipelines/constants/pipeline-stat-config'
import { projectsStatConfig } from '@/features/customer-pipelines/constants/projects-stat-config'
import { StatBar } from '@/shared/components/stat-bar/ui/stat-bar'
import { useAbility } from '@/shared/domains/permissions/client'

interface Props {
  items: CustomerPipelineItem[]
  pipeline: Pipeline
  isLoading?: boolean
}

export function CustomerPipelineMetricsBar({ items, pipeline, isLoading }: Props) {
  const ability = useAbility()
  // Projects get "Total Signed" + "Total Opened"; fresh adds "Meetings This
  // Week"; every other pipeline shows the shared base stats.
  let config = pipelineStatConfig
  if (pipeline === 'projects') {
    config = projectsStatConfig
  }
  else if (pipeline === 'fresh') {
    config = freshStatConfig
  }
  // The pipeline value is summed from proposals; a viewer who reads none would see a false $0.
  if (ability.cannot('read', 'Proposal')) {
    config = config.filter(stat => stat.key !== 'value')
  }
  return <StatBar items={config} data={items} isLoading={isLoading} />
}
