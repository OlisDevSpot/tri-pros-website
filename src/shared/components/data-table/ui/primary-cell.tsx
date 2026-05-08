'use client'

import type { ReactNode } from 'react'

import type { EntityActionConfig } from '@/shared/components/entity-actions/types'

import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/components/ui/tooltip'

interface PrimaryCellProps<TEntity> {
  title: ReactNode
  subtitle?: ReactNode
  entity?: TEntity
  actions?: EntityActionConfig<TEntity>[]
  tooltipContent?: ReactNode
}

export function PrimaryCell<TEntity>({
  title,
  subtitle,
  entity,
  actions,
  tooltipContent,
}: PrimaryCellProps<TEntity>) {
  const stack = (
    <div className="min-w-0 max-w-55 space-y-0.5">
      {typeof title === 'string'
        ? (
            <p className="truncate text-sm font-medium leading-tight text-foreground">{title}</p>
          )
        : title}
      {subtitle != null && (
        typeof subtitle === 'string'
          ? <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
          : subtitle
      )}
    </div>
  )

  return (
    <div className="flex items-center justify-between gap-4">
      {tooltipContent
        ? (
            <Tooltip>
              <TooltipTrigger asChild>{stack}</TooltipTrigger>
              <TooltipContent side="top" align="start">{tooltipContent}</TooltipContent>
            </Tooltip>
          )
        : stack}
      {entity != null && actions != null && (
        <EntityActionMenu
          entity={entity}
          actions={actions}
          mode="compact"
          className="opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100"
        />
      )}
    </div>
  )
}
