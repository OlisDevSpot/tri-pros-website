'use client'

import type { EntityActionClickConfig, EntityActionConfig } from '@/shared/components/entity-actions/types'

import { isCustomAction, isSelectAction } from '@/shared/components/entity-actions/types'
import { EntityActionDropdown } from '@/shared/components/entity-actions/ui/entity-action-dropdown'
import { Button } from '@/shared/components/ui/button'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { cn } from '@/shared/lib/utils'

interface EntityActionMenuProps<TEntity> {
  entity: TEntity
  actions: EntityActionConfig<TEntity>[]
  /** 'bar' = primary button + overflow dropdown. 'compact' = dropdown only. */
  mode?: 'bar' | 'compact'
  className?: string
}

export function EntityActionMenu<TEntity>({
  entity,
  actions,
  mode = 'bar',
  className,
}: EntityActionMenuProps<TEntity>) {
  const ability = useAbility()

  const permitted = actions.filter(({ action }) => {
    if (!action.permission) {
      return true
    }
    return ability.can(action.permission[0], action.permission[1])
  })

  if (permitted.length === 0) {
    return null
  }

  // Compact mode: single dropdown trigger, always visible
  if (mode === 'compact') {
    return (
      <div className={cn('shrink-0', className)} onClick={e => e.stopPropagation()}>
        <EntityActionDropdown
          entity={entity}
          actions={permitted}
          orientation="horizontal"
        />
      </div>
    )
  }

  // Bar mode: primary action as button + overflow dropdown for the rest.
  // Only click actions can be primary (select/custom actions need a sub-menu).
  const primary = permitted.find((c): c is EntityActionClickConfig<TEntity> => c.action.primary === true && !isSelectAction(c) && !isCustomAction(c))
  const overflow = permitted.filter(c => c !== primary)

  const PrimaryIcon = primary?.action.icon

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      onClick={e => e.stopPropagation()}
    >
      {primary && PrimaryIcon && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 text-xs"
          disabled={primary.isLoading || primary.isDisabled}
          onClick={() => primary.onAction(entity)}
        >
          <PrimaryIcon className="h-3.5 w-3.5" />
          {primary.action.label}
        </Button>
      )}

      {overflow.length > 0 && (
        <EntityActionDropdown
          entity={entity}
          actions={overflow}
          orientation="horizontal"
          triggerClassName={cn(
            'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity',
          )}
        />
      )}
    </div>
  )
}
