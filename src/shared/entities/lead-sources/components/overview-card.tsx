'use client'

import type { ReactNode } from 'react'

import { createContext, useContext, useMemo } from 'react'

import { cn } from '@/shared/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface LeadSourceOverviewCardSource {
  id: string
  name: string
  slug: string
  isActive: boolean
  totalLeads?: number
  leadsThisMonth?: number
}

interface ContextValue {
  source: LeadSourceOverviewCardSource
}

const Ctx = createContext<ContextValue | null>(null)

function useCard(): ContextValue {
  const v = useContext(Ctx)
  if (!v) {
    throw new Error('LeadSourceOverviewCard subcomponent used outside of root')
  }
  return v
}

// ── Root ───────────────────────────────────────────────────────────────────────

interface RootProps {
  source: LeadSourceOverviewCardSource
  /** Visual selection state (truthy → primary-tinted surface). */
  isSelected?: boolean
  onClick?: () => void
  children: ReactNode
  className?: string
}

function Root({ source, isSelected, onClick, children, className }: RootProps) {
  const value = useMemo<ContextValue>(() => ({ source }), [source])
  const Tag = onClick ? 'button' : 'div'

  return (
    <Ctx.Provider value={value}>
      <Tag
        type={onClick ? 'button' : undefined}
        onClick={onClick}
        aria-current={isSelected ? 'true' : undefined}
        className={cn(
          'group/card flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left motion-safe:transition-colors',
          // The one primary-color moment in the list — the selected card.
          isSelected
            ? 'bg-primary/5 ring-1 ring-inset ring-primary/15'
            : 'hover:bg-muted/60 focus-visible:bg-muted/60',
          !source.isActive && !isSelected && 'opacity-75',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
          className,
        )}
      >
        {children}
      </Tag>
    </Ctx.Provider>
  )
}

// ── Indicator (active/inactive status dot) ────────────────────────────────────

function Indicator({ className }: { className?: string }) {
  const { source } = useCard()
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        source.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/30',
        className,
      )}
    />
  )
}

// ── Name ──────────────────────────────────────────────────────────────────────

function Name({ className }: { className?: string }) {
  const { source } = useCard()
  return (
    <span className={cn('truncate text-sm font-medium text-foreground', className)}>
      {source.name}
    </span>
  )
}

// ── Slug (small, muted — for the list where the URL is the canonical ID) ─────

function Slug({ className }: { className?: string }) {
  const { source } = useCard()
  return (
    <span className={cn('truncate text-xs text-muted-foreground tabular-nums', className)}>
      /
      {source.slug}
    </span>
  )
}

// ── Stat (inline glance stat — e.g. "134 this month") ────────────────────────

interface StatProps {
  /** The count to display. */
  value: number | undefined
  /** Tiny label below the number ("this month", "total"). */
  label: string
  className?: string
}

function Stat({ value, label, className }: StatProps) {
  return (
    <div className={cn('flex flex-col items-end gap-px tabular-nums', className)}>
      <span className="text-sm font-semibold text-foreground">{value ?? 0}</span>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  )
}

// ── Actions (reserved slot — consumer renders EntityActions here) ────────────

function Actions({ children, className }: { children: ReactNode, className?: string }) {
  return (
    <span
      className={cn('inline-flex shrink-0 items-center', className)}
      onClick={e => e.stopPropagation()}
    >
      {children}
    </span>
  )
}

// ── Row helper (name + slug stacked) ─────────────────────────────────────────

function Identity({ className }: { className?: string }) {
  return (
    <span className={cn('flex min-w-0 flex-1 flex-col gap-px overflow-hidden', className)}>
      <Name />
      <Slug />
    </span>
  )
}

export const LeadSourceOverviewCard = Object.assign(Root, {
  Indicator,
  Name,
  Slug,
  Identity,
  Stat,
  Actions,
})
