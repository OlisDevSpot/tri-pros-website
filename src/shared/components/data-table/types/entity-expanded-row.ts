import type { ReactNode } from 'react'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'

/** What an entity table hands its expanded row: the same action list its row menu uses. */
export interface EntityExpandedRowContext<TRow> {
  actions: EntityActionConfig<TRow>[]
}

/** Define it at module level, so its identity is stable and the table's props don't churn. */
export type RenderExpandedRow<TRow> = (row: TRow, ctx: EntityExpandedRowContext<TRow>) => ReactNode
