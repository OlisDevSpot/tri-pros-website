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

/** Wires an EntityAction to a callback for a specific context. */
export interface EntityActionConfig<TEntity> {
  action: EntityAction
  onAction: (entity: TEntity) => void
  /** Optional loading state (e.g., duplicate in progress) */
  isLoading?: boolean
  /** Optional disabled state */
  isDisabled?: boolean
}
