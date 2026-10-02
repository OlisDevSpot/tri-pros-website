import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { ProjectColumnKey } from '@/shared/modules/projects/core/lib/columns-registry'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'

export const PROJECTS_RECORDS_TABLE_VIEW = {
  tableId: 'projects',
  query: {
    fields: PROJECT_FIELDS,
    paramPrefix: 'pj',
    toolbar: ['statusBucket', 'visibility', 'completedAt', 'createdAt'],
    defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
    window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
  },
  columns: ['title', 'customerName', 'status', 'city', 'isPublic', 'completedAt', 'createdAt'],
} as const satisfies EntityTableView<ProjectColumnKey, typeof PROJECT_FIELDS>
