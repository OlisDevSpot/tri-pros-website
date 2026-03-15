import type { CustomerPipelineStage } from '../constants/customer-pipeline-stages'
import type { CustomerPipelineItem } from '../types'

import { customerPipelineStages } from '../constants/customer-pipeline-stages'

export function groupCustomersByStage(
  items: CustomerPipelineItem[],
): Record<CustomerPipelineStage, CustomerPipelineItem[]> {
  const grouped = Object.fromEntries(
    customerPipelineStages.map(stage => [stage, [] as CustomerPipelineItem[]]),
  ) as Record<CustomerPipelineStage, CustomerPipelineItem[]>

  for (const item of items) {
    if (item.stage in grouped) {
      grouped[item.stage].push(item)
    }
  }

  return grouped
}
