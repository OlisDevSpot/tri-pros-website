import type { CustomerPipeline } from '@/shared/types/enums'

export const PIPELINE_LABELS: Record<CustomerPipeline, string> = {
  active: 'Active',
  rehash: 'Rehash',
  dead: 'Dead',
}
