'use client'

import type { EntityActionConfig, EntityActionSelectConfig } from '@/shared/components/entity-actions/types'

import { CheckIcon, MoreHorizontalIcon, MoreVerticalIcon } from 'lucide-react'

import { isSelectAction } from '@/shared/components/entity-actions/types'

import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
        {permitted.map(config =>
          isSelectAction(config)
            ? (
                <EntityActionSelectItem
                  key={config.action.id}
                  config={config}
                  entity={entity}
                />
              )
            : (
                <EntityActionClickItem
                  key={config.action.id}
                  action={config.action}
                  entity={entity}
                  onAction={config.onAction}
                  isLoading={config.isLoading}
                  isDisabled={config.isDisabled}
                />
              ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Click action item ────────────────────────────────────────────────────────

interface ClickItemProps<TEntity> {
  action: EntityActionConfig<TEntity>['action']
  entity: TEntity
  onAction: (entity: TEntity) => void
  isLoading?: boolean
  isDisabled?: boolean
}

function EntityActionClickItem<TEntity>({
  action,
  entity,
  onAction,
  isLoading,
  isDisabled,
}: ClickItemProps<TEntity>) {
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

// ── Select (sub-menu) action item ────────────────────────────────────────────

interface SelectItemProps<TEntity> {
  config: EntityActionSelectConfig<TEntity>
  entity: TEntity
}

function EntityActionSelectItem<TEntity>({
  config,
  entity,
}: SelectItemProps<TEntity>) {
  const { action, options, getCurrentValue, onSelect, isLoading, isDisabled } = config
  const Icon = action.icon
  const currentValue = getCurrentValue(entity)

  return (
    <>
      {action.separatorBefore && <DropdownMenuSeparator />}
      <DropdownMenuSub>
        <DropdownMenuSubTrigger disabled={isLoading || isDisabled}>
          <Icon className="h-3.5 w-3.5" />
          {action.label}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          {options.map(option => (
            <DropdownMenuItem
              key={option.value}
              className={cn(option.value === currentValue && 'font-medium')}
              onClick={() => onSelect(entity, option.value)}
            >
              <CheckIcon
                className={cn(
                  'h-3 w-3 shrink-0',
                  option.value === currentValue ? 'opacity-100' : 'opacity-0',
                )}
              />
              {option.color && (
                <span className={cn('h-2 w-2 shrink-0 rounded-full', option.color)} />
              )}
              {option.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuSubContent>
      </DropdownMenuSub>
    </>
  )
}
