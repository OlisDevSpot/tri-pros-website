'use client'

import type { EntityActionGroupConfig } from '@/shared/components/entities/entity-actions/types'

import { EntityActionClickItem } from '@/shared/components/entities/entity-actions/ui/entity-action-click-item'
import {
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from '@/shared/components/ui/dropdown-menu'

interface EntityActionGroupItemProps<TEntity> {
  config: EntityActionGroupConfig<TEntity>
  entity: TEntity
}

export function EntityActionGroupItem<TEntity>({ config, entity }: EntityActionGroupItemProps<TEntity>) {
  const { action, items, isDisabled } = config
  const Icon = action.icon

  return (
    <>
      {action.separatorBefore && <DropdownMenuSeparator />}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={isDisabled}>
          <Icon className="size-3.5" />
          {action.label}
        </DropdownMenuSubTrigger>
        {/* On a phone neither side of a centred menu fits the submenu, so it narrows and wraps instead of running off screen. */}
        <DropdownMenuSubContent className="max-w-(--radix-dropdown-menu-content-available-width)" collisionPadding={8}>
          {items.map(item => (
            <EntityActionClickItem
              key={item.action.id}
              action={item.action}
              entity={entity}
              onAction={item.onAction}
              isLoading={item.isLoading}
              isDisabled={item.isDisabled}
              disabledReason={item.getDisabledReason?.(entity) ?? null}
            />
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  )
}
