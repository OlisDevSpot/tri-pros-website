import type { CustomerPipelineStage } from '../constants/active-pipeline-stages'
import type { CustomerPipelineItem } from '../types'

import { customerPipelineStages } from '../constants/active-pipeline-stages'

export function groupCustomersByStage(
  items: CustomerPipelineItem[],
): Record<CustomerPipelineStage, CustomerPipelineItem[]> {
  const grouped = Object.fromEntries(
    customerPipelineStages.map(stage => [stage, [] as CustomerPipelineItem[]]),
  ) as Record<CustomerPipelineStage, CustomerPipelineItem[]>

  for (const item of items) {
    const stage = item.stage as string
    if (stage in grouped) {
      grouped[stage as CustomerPipelineStage].push(item)
    }
  }

  return grouped
}
