'use client'

import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { MoreHorizontalIcon, MoreVerticalIcon } from 'lucide-react'

import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'
import { useAbility } from '@/shared/permissions/hooks'

interface EntityActionDropdownProps<TEntity> {
  entity: TEntity
  actions: EntityActionConfig<TEntity>[]
  /** MoreHorizontal or MoreVertical icon */
  orientation?: 'horizontal' | 'vertical'
  /** Additional classes on the trigger button */
  triggerClassName?: string
}

export function EntityActionDropdown<TEntity>({
  entity,
  actions,
  orientation = 'vertical',
  triggerClassName,
}: EntityActionDropdownProps<TEntity>) {
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

  const TriggerIcon = orientation === 'horizontal' ? MoreHorizontalIcon : MoreVerticalIcon

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-6 w-6 shrink-0', triggerClassName)}
          onClick={e => e.stopPropagation()}
        >
          <TriggerIcon className="h-3.5 w-3.5" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        {permitted.map(({ action, onAction, isLoading, isDisabled }) => (
          <EntityActionDropdownItem
            key={action.id}
            action={action}
            entity={entity}
            onAction={onAction}
            isLoading={isLoading}
            isDisabled={isDisabled}
          />
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface ItemProps<TEntity> {
  action: EntityActionConfig<TEntity>['action']
  entity: TEntity
  onAction: (entity: TEntity) => void
  isLoading?: boolean
  isDisabled?: boolean
}

function EntityActionDropdownItem<TEntity>({
  action,
  entity,
  onAction,
  isLoading,
  isDisabled,
}: ItemProps<TEntity>) {
  const Icon = action.icon

  return (
    <>
      {action.separatorBefore && <DropdownMenuSeparator />}
      <DropdownMenuItem
        disabled={isLoading || isDisabled}
        className={cn(action.destructive && 'text-destructive focus:text-destructive')}
        onClick={() => onAction(entity)}
      >
        <Icon className="h-3.5 w-3.5" />
        {action.label}
      </DropdownMenuItem>
    </>
  )
}
