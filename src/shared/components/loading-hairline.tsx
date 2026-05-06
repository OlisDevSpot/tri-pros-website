'use client'

import { cn } from '@/shared/lib/utils'

interface LoadingHairlineProps {
  /** When true, plays the shimmer; when false, renders nothing (parent owns idle border). */
  isLoading: boolean
  /** Optional positioning override; defaults to `absolute -bottom-px inset-x-0`. */
  className?: string
}

/**
 * 1px shimmer overlay used to signal a query in flight on a containing row.
 * Mounts as `absolute` to a `relative` parent (commonly the bottom edge of a
 * toolbar/header), so the parent owns the static idle border and the shimmer
 * just rides on top during fetches.
 *
 * Animation is compositor-only (transform translateX) and gated behind
 * `motion-safe:` — under reduced-motion the element is hidden entirely so
 * the parent's static border carries the `aria-busy` story without movement.
 */
export function LoadingHairline({ isLoading, className }: LoadingHairlineProps) {
  if (!isLoading) {
    return null
  }
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute inset-x-0 -bottom-px h-px overflow-hidden',
        'motion-reduce:hidden',
        className,
      )}
    >
      <div className="h-full w-1/3 bg-foreground/40 animate-toolbar-shimmer" />
    </div>
  )
}
