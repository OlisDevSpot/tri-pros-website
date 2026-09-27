import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'

interface ToolbarRoles {
  primaryId: string
  promotedIds?: readonly string[]
}

/**
 * Picks the buttons for one toolbar surface without touching the shared action constants,
 * whose own `primary` still drives every other surface.
 */
export function withToolbarRoles<TEntity>(
  actions: EntityActionConfig<TEntity>[],
  { primaryId, promotedIds = [] }: ToolbarRoles,
): EntityActionConfig<TEntity>[] {
  return actions.map(config => ({
    ...config,
    action: {
      ...config.action,
      primary: config.action.id === primaryId,
      promoted: promotedIds.includes(config.action.id),
    },
  }))
}
