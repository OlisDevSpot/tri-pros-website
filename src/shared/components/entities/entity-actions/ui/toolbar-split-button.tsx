'use client'

import type { EntityActionGroupConfig } from '@/shared/components/entities/entity-actions/types'

import { ChevronDownIcon } from 'lucide-react'

import { EntityActionClickItem } from '@/shared/components/entities/entity-actions/ui/entity-action-click-item'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'

interface ToolbarSplitButtonProps<TEntity> {
  config: EntityActionGroupConfig<TEntity>
  entity: TEntity
}

// Every item runs its action inside its own click handler: iPad Safari drops a clipboard write once the user activation is gone.
export function ToolbarSplitButton<TEntity>({ config, entity }: ToolbarSplitButtonProps<TEntity>) {
  const [main] = config.items
  if (!main) {
    return null
  }

  const Icon = config.action.icon
  const mainReason = main.getDisabledReason?.(entity) ?? null

  const mainButton = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="rounded-r-none"
      disabled={config.isDisabled || main.isLoading || main.isDisabled || mainReason != null}
      onClick={() => main.onAction(entity)}
    >
      <Icon className="size-3.5" />
      {config.action.label}
    </Button>
  )

  return (
    <span className="inline-flex" data-toolbar-role="promoted">
      {mainReason
        ? (
            // A disabled button fires no pointer events, so the reason anchors to a focusable wrapper.
            <HybridPopoverTooltip content={mainReason}>
              <span tabIndex={0} className="inline-flex">{mainButton}</span>
            </HybridPopoverTooltip>
          )
        : mainButton}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-l-none border-l-0 px-2"
            aria-label={`${config.action.label} options`}
            disabled={config.isDisabled}
          >
            <ChevronDownIcon className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" onClick={e => e.stopPropagation()}>
          {config.items.map(item => (
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
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  )
}
