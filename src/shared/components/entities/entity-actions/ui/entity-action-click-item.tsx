'use client'

import type { EntityActionConfig } from '@/shared/components/entities/entity-actions/types'

import { DropdownMenuItem, DropdownMenuSeparator } from '@/shared/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'

interface ClickItemProps<TEntity> {
  action: EntityActionConfig<TEntity>['action']
  entity: TEntity
  onAction: (entity: TEntity) => void
  isLoading?: boolean
  isDisabled?: boolean
  disabledReason?: string | null
}

export function EntityActionClickItem<TEntity>({
  action,
  entity,
  onAction,
  isLoading,
  isDisabled,
  disabledReason,
}: ClickItemProps<TEntity>) {
  const Icon = action.icon
  const disabled = isLoading || isDisabled || disabledReason != null

  const item = (
    <DropdownMenuItem
      disabled={disabled}
      className={cn(action.destructive && 'text-destructive focus:text-destructive')}
      onClick={() => onAction(entity)}
    >
      <Icon className="h-3.5 w-3.5" />
      {action.label}
    </DropdownMenuItem>
  )

  return (
    <>
      {action.separatorBefore && <DropdownMenuSeparator />}
      {disabledReason
        ? (
            // Radix disables pointer events on a disabled item, so wrap the row
            // in a focusable span the tooltip can anchor to.
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0} className="block">{item}</span>
              </TooltipTrigger>
              <TooltipContent>{disabledReason}</TooltipContent>
            </Tooltip>
          )
        : item}
    </>
  )
}
