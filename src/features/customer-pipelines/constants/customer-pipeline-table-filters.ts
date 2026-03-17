import type { DataTableFilterConfig } from '@/shared/components/data-table/types'

import { customerStageConfig } from '@/features/customer-pipelines/constants/customer-pipeline-stages'

export const pipelineTableFilters: DataTableFilterConfig[] = [
  {
    id: 'name-search',
    type: 'search',
    label: 'Customer',
    columnId: 'name',
    placeholder: 'Search customers...',
  },
  {
    id: 'stage-filter',
    type: 'select',
    label: 'Stage',
    columnId: 'stage',
    placeholder: 'All stages',
    options: customerStageConfig.map(s => ({ label: s.label, value: s.key })),
  },
]
