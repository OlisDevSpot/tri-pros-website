import type { ProjectStatus, ProjectVisibility } from '@/shared/constants/enums'
import type { FilterDefinition } from '@/shared/dal/client/query/types'

import { DEFAULT_TIME_PRESETS } from '@/shared/components/data-table/constants/time-filter-presets'
import { projectStatuses, projectVisibilities } from '@/shared/constants/enums'

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  completed: 'Completed',
  on_hold: 'On Hold',
}

const VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  public: 'Public',
  draft: 'Draft',
}

/**
 * Filter config for the projects table. Ids match `projectsRouter.crud.list`'s
 * `filters` shape on the server.
 */
export const PROJECT_FILTER_CONFIG = [
  {
    id: 'status',
    type: 'multi-select',
    label: 'Status',
    options: projectStatuses.map(s => ({ label: STATUS_LABELS[s], value: s })),
  },
  {
    id: 'visibility',
    type: 'select',
    label: 'Visibility',
    options: projectVisibilities.map(v => ({ label: VISIBILITY_LABELS[v], value: v })),
  },
  {
    id: 'completedAt',
    type: 'date-range',
    label: 'Completed',
    presets: DEFAULT_TIME_PRESETS,
  },
  {
    id: 'createdAt',
    type: 'date-range',
    label: 'Created',
    presets: DEFAULT_TIME_PRESETS,
  },
] as const satisfies readonly FilterDefinition[]
