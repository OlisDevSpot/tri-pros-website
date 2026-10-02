import type { EntityAction, EntityActionConfig } from '@/shared/components/entities/entity-actions/types'
import type { AppAbility } from '@/shared/domains/permissions/types'

export function isActionPermitted(action: EntityAction, ability: AppAbility): boolean {
  return !action.permission || ability.can(action.permission[0], action.permission[1])
}

/** The actions this viewer may run on this entity: the CASL permission first, then the action's own `hidden` rule. */
export function getVisibleActions<TEntity>(
  configs: EntityActionConfig<TEntity>[],
  ability: AppAbility,
  entity: TEntity,
): EntityActionConfig<TEntity>[] {
  return configs.filter(config => isActionPermitted(config.action, ability) && !config.hidden?.(entity))
}
