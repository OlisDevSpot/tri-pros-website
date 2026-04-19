'use client'

import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

interface EntityListEmptyState {
  /** Concise, scannable message. Rendered as muted secondary text. */
  message: string
  /** Optional call-to-action (usually a Button) rendered beneath the message. */
  action?: ReactNode
}

interface EntityListProps<T> {
  /** Label shown in the header, e.g. "Participants", "Proposals". */
  title: string
  /** Optional leading icon in the header. */
  icon?: LucideIcon
  /** Entities to render. */
  items: readonly T[]
  /** Render one item. Typically wraps `item` in its entity's OverviewCard compound. */
  renderItem: (item: T) => ReactNode
  /** Stable key extractor. */
  getItemKey: (item: T) => string
  /** Optional right-aligned header affordance (e.g. inline "Manage" / "+ Add"). */
  headerAction?: ReactNode
  /** Override the count shown next to title. Defaults to `items.length`. */
  count?: number
  /** Loading state — shows a one-line placeholder instead of items or empty state. */
  isLoading?: boolean
  /** Rendered when `items` is empty and not loading. */
  emptyState?: EntityListEmptyState
  /** Space between items. Matches Proposals/Participants rhythm by default. */
  itemsClassName?: string
  /**
   * Chrome strategy:
   * - `card` (default) — rounded border + `bg-card` + padding. Use standalone.
   * - `flush` — no border, no padding, transparent. Use when EntityList is a
   *   child of another container that already owns the surface treatment
   *   (e.g. sibling lists under one outer card with a divider between them).
   */
  variant?: 'card' | 'flush'
  className?: string
}

/**
 * Generic list primitive for rendering any entity type inside a meeting (or
 * similar parent) context. The rendering strategy — which OverviewCard to use,
 * which slots to compose — is delegated to `renderItem`, keeping EntityList
 * non-divergent: it handles container chrome (header, count, action, empty
 * state) while the caller owns the per-entity presentation via the entity's
 * compound component.
 *
 * Typography + density match `MeetingOverviewCard.Proposals`'s existing
 * treatment so sibling lists (Participants vs Proposals) feel visually
 * uniform inside the same detail view.
 */
export function EntityList<T>({
  title,
  icon: Icon,
  items,
  renderItem,
  getItemKey,
  headerAction,
  count,
  isLoading = false,
  emptyState,
  itemsClassName,
  variant = 'card',
  className,
}: EntityListProps<T>) {
  const resolvedCount = count ?? items.length
  const showEmpty = !isLoading && items.length === 0 && !!emptyState
  const chromeClasses = variant === 'card' ? 'rounded-md border bg-card p-3' : ''

  return (
    <div className={cn('space-y-1', chromeClasses, className)}>
      <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground mb-1.5">
        {Icon && <Icon className="size-3" aria-hidden="true" />}
        <span>{`${title} (${resolvedCount})`}</span>
        {headerAction && (
          <span className="ml-auto inline-flex items-center">{headerAction}</span>
        )}
      </div>

      {isLoading && (
        <p className="text-xs text-muted-foreground">Loading…</p>
      )}

      {showEmpty && (
        <div className="flex flex-col items-start gap-2 py-1">
          <p className="text-xs text-muted-foreground">{emptyState.message}</p>
          {emptyState.action}
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className={cn('space-y-0.5', itemsClassName)}>
          {items.map(item => (
            <div key={getItemKey(item)}>
              {renderItem(item)}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
