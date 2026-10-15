import type { ReactNode } from 'react'

import type { UseColumnVisibilityResult } from '@/shared/components/data-table/lib/use-column-visibility'
import type { DataTableProps } from '@/shared/components/data-table/ui/data-table'
import type { DataViewQueryResult } from '@/shared/dal/client/lib/types'
import type { FieldList, ToolbarFilterId } from '@/shared/dal/lib/query/field-list'

/** What an entity table hook returns: `useEntityTable`'s result plus the entity's dialogs. */
export interface EntityTableResult<TRow extends { id: string }, TMeta, F extends FieldList, T extends ToolbarFilterId<F>> {
  query: DataViewQueryResult<TRow, F, T>
  visibility: UseColumnVisibilityResult
  dataTableProps: DataTableProps<TRow, TMeta>
  dialogs: ReactNode
}
