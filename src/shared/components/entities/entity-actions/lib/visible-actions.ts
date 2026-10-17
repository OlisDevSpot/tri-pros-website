import type { EntityAction, EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { isGroupAction } from '@/shared/components/entities/entity-actions/types'

export function isActionPermitted(action: EntityAction, ability: AppAbility): boolean {
  return !action.permission || ability.can(...action.permission)
}

/**
 * The actions this viewer may run on this entity: the CASL permission first, then the action's own `hidden` rule.
 * A group keeps only the items that pass the same checks, and drops out when none is left.
 */
export function getVisibleActions<TEntity>(
  configs: EntityActionConfig<TEntity>[],
  ability: AppAbility,
  entity: TEntity,
): EntityActionConfig<TEntity>[] {
  return configs.flatMap<EntityActionConfig<TEntity>>((config) => {
    if (!isActionPermitted(config.action, ability) || config.hidden?.(entity)) {
      return []
    }
    if (!isGroupAction(config)) {
      return [config]
    }
    const items = config.items.filter(item => isActionPermitted(item.action, ability) && !item.hidden?.(entity))
    return items.length > 0 ? [{ ...config, items }] : []
  })
}
