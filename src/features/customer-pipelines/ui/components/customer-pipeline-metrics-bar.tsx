import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'

import { pipelineStatConfig } from '@/features/customer-pipelines/constants/pipeline-stat-config'
import { StatBar } from '@/shared/components/stat-bar/ui/stat-bar'

interface Props {
  items: CustomerPipelineItem[]
  isLoading?: boolean
}

export function CustomerPipelineMetricsBar({ items, isLoading }: Props) {
  return <StatBar items={pipelineStatConfig} data={items} isLoading={isLoading} />
}
