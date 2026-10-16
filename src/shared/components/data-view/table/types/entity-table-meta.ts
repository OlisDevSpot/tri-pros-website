import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'

/** The meta every entity table shares; an entity's meta interface extends it with its own entries. */
export interface EntityTableMeta<TRow> {
  /** The row menu's actions; a value array from `useStableCallbacks`, never a function. */
  rowActions?: EntityActionConfig<TRow>[]
}
