import type { LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'

import type { Button } from '@/shared/components/ui/button'
import type { AppActions, AppSubjects } from '@/shared/permissions/types'

// ── Legacy standalone button props (kept for backward compat) ────────────────

export interface EntityActionButtonProps extends Omit<ComponentProps<typeof Button>, 'children' | 'asChild'> {
  icon?: LucideIcon
  label?: string
  showLabel?: boolean
  href?: string
  external?: boolean
}

// ── Standardized entity action system ────────────────────────────────────────

/** Describes a single action that can be performed on an entity. */
export interface EntityAction {
  id: string
  label: string
  icon: LucideIcon
  /** CASL permission check: [action, subject]. If undefined, always visible. */
  permission?: [AppActions, AppSubjects]
  /** If true, render with destructive (red) styling */
  destructive?: boolean
  /** If true, this is the primary action shown as a button in bar mode */
  primary?: boolean
  /** If true, show a separator before this action in the dropdown */
  separatorBefore?: boolean
}

/** A static option for sub-menu (select) actions. */
export interface EntityActionOption {
  label: string
  value: string
  /** Optional color class for visual indicator (dot/badge) */
  color?: string
}

/** Standard click action — fires onAction with the entity. */
export interface EntityActionClickConfig<TEntity> {
  action: EntityAction
  onAction: (entity: TEntity) => void
  /** Optional loading state (e.g., duplicate in progress) */
  isLoading?: boolean
  /** Optional disabled state */
  isDisabled?: boolean
}

/** Sub-menu (select) action — shows options in a flyout, fires onSelect with entity + value. */
export interface EntityActionSelectConfig<TEntity> {
  action: EntityAction
  type: 'select'
  options: readonly EntityActionOption[]
  /** Current value — shows checkmark next to the matching option */
  getCurrentValue: (entity: TEntity) => string
  onSelect: (entity: TEntity, value: string) => void
  isLoading?: boolean
  isDisabled?: boolean
}

/** Union of all action config types. */
export type EntityActionConfig<TEntity>
  = EntityActionClickConfig<TEntity>
    | EntityActionSelectConfig<TEntity>

/** Type guard: is this a select (sub-menu) action? */
export function isSelectAction<TEntity>(config: EntityActionConfig<TEntity>): config is EntityActionSelectConfig<TEntity> {
  return 'type' in config && config.type === 'select'
}
