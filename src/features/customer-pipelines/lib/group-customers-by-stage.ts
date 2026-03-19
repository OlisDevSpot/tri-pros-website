import type { CustomerPipelineItem } from '../types'

export function groupCustomersByStage<T extends string>(
  items: CustomerPipelineItem[],
  stages: readonly T[],
): Record<T, CustomerPipelineItem[]> {
  const grouped = Object.fromEntries(
    stages.map(stage => [stage, [] as CustomerPipelineItem[]]),
  ) as Record<T, CustomerPipelineItem[]>

  for (const item of items) {
    const stage = item.stage as string
    if (stage in grouped) {
      grouped[stage as T].push(item)
    }
  }

  return grouped
}
