'use client'

import type { EntityActionClickConfig, EntityActionConfig } from '@/shared/components/entities/entity-actions/types'

import { getVisibleActions } from '@/shared/components/entities/entity-actions/lib/visible-actions'
import { isClickAction, isCustomAction, isSelectAction } from '@/shared/components/entities/entity-actions/types'
import { EntityActionDropdown } from '@/shared/components/entities/entity-actions/ui/entity-action-dropdown'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import { Button } from '@/shared/components/ui/button'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { cn } from '@/shared/lib/utils'

interface EntityActionMenuProps<TEntity> {
  entity: TEntity
  actions: EntityActionConfig<TEntity>[]
  /** 'bar' = primary button + overflow dropdown. 'compact' = dropdown only. 'toolbar' = filled primary, outline promoted, labeled More. */
  mode?: 'bar' | 'compact' | 'toolbar'
  className?: string
}

export function EntityActionMenu<TEntity>({
  entity,
  actions,
  mode = 'bar',
  className,
}: EntityActionMenuProps<TEntity>) {
  const ability = useAbility()

  const permitted = getVisibleActions(actions, ability, entity)

  if (permitted.length === 0) {
    return null
  }

  // Compact mode: single dropdown trigger. The passed className (layout + any
  // hover/group-hover reveal) goes straight onto the Radix trigger — NOT a
  // wrapper — so `data-[state=open]:opacity-100` keeps the icon visible while
  // its menu is open (the pointer leaves the card, dropping group-hover). The
  // trigger already stops click propagation, so no wrapper is needed.
  if (mode === 'compact') {
    return (
      <EntityActionDropdown
        entity={entity}
        actions={permitted}
        orientation="horizontal"
        triggerClassName={cn('shrink-0 data-[state=open]:opacity-100', className)}
      />
    )
  }

  if (mode === 'toolbar') {
    const primary = permitted.find((c): c is EntityActionClickConfig<TEntity> => c.action.primary === true && isClickAction(c))
    const promoted = permitted.filter((c): c is EntityActionClickConfig<TEntity> => c.action.promoted === true && c !== primary && isClickAction(c))
    const overflow = permitted.filter(c => c !== primary && !promoted.includes(c as EntityActionClickConfig<TEntity>))

    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)} onClick={e => e.stopPropagation()}>
        {primary && <ToolbarButton config={primary} entity={entity} variant="default" toolbarRole="primary" />}
        {promoted.map(config => (
          <ToolbarButton key={config.action.id} config={config} entity={entity} variant="outline" toolbarRole="promoted" />
        ))}
        {overflow.length > 0 && (
          <EntityActionDropdown entity={entity} actions={overflow} orientation="horizontal" triggerLabel="More" />
        )}
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

interface ToolbarButtonProps<TEntity> {
  config: EntityActionClickConfig<TEntity>
  entity: TEntity
  variant: 'default' | 'outline'
  toolbarRole: 'primary' | 'promoted'
}

function ToolbarButton<TEntity>({ config, entity, variant, toolbarRole }: ToolbarButtonProps<TEntity>) {
  const Icon = config.action.icon
  const disabledReason = config.getDisabledReason?.(entity) ?? null

  const button = (
    <Button
      type="button"
      variant={variant}
      size="sm"
      data-toolbar-role={toolbarRole}
      disabled={config.isLoading || config.isDisabled || disabledReason != null}
      onClick={() => config.onAction(entity)}
    >
      <Icon className="size-3.5" />
      {config.action.label}
    </Button>
  )

  if (!disabledReason) {
    return button
  }

  // A disabled button fires no pointer events, so the reason anchors to a focusable wrapper.
  return (
    <HybridPopoverTooltip content={disabledReason}>
      <span tabIndex={0} data-toolbar-role={toolbarRole} className="inline-flex">
        {button}
      </span>
    </HybridPopoverTooltip>
  )
}
