'use client'

import type { ComponentProps, ReactNode } from 'react'

import type { Proposal } from '@/shared/db/schema/proposals'
import type { ProposalRowStyle } from '@/shared/modules/proposals/core/constants/proposal-row-styles'
import type { SowTradeScope } from '@/shared/modules/proposals/core/types'

import { formatDistanceToNow } from 'date-fns'
import { DollarSignIcon, EyeIcon } from 'lucide-react'
import React, { createContext, useCallback, useMemo } from 'react'

import { EntityActionMenu } from '@/shared/components/entities/entity-actions/ui/entity-action-menu'
import { Badge } from '@/shared/components/ui/badge'
import { ROOTS } from '@/shared/config/roots'
import { formatBusinessTime } from '@/shared/lib/business-time'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { PROPOSAL_ROW_STYLES } from '@/shared/modules/proposals/core/constants/proposal-row-styles'
import { PROPOSAL_STATUS_DOT_COLORS } from '@/shared/modules/proposals/core/constants/proposal-status-colors'
import { useProposalActionConfigs } from '@/shared/modules/proposals/core/hooks/use-proposal-action-configs'

// ── Types ──────────────────────────────────────────────────────────────────────

export type ProposalOverviewCardData
  = Pick<Proposal, 'id'>
    & {
      token: string | null
      status?: string
      label?: string | null
      createdAt?: string
      sentAt?: string | null
      trade?: string | null
      value?: number | null
      viewCount?: number
      sowSummary?: SowTradeScope[]
    }

export type ProposalFieldConfig
  = | { field: 'status', variant?: 'badge' | 'icon' | 'dot' }
    | { field: 'label' }
    | { field: 'trade' }
    | { field: 'value', showIcon?: boolean }
    | { field: 'viewCount' }
    | { field: 'createdAt', format?: 'full' | 'date-only' | 'relative' }

export interface ScopeRef {
  id: string
  label: string
}

export interface ProposalScopeCoverage {
  /** Captured in the meeting and included in this proposal. */
  covered: ScopeRef[]
  /** Captured in the meeting but left out of this proposal. */
  missing: ScopeRef[]
  /** In this proposal but not captured in the meeting. */
  extra: ScopeRef[]
}

/** Supplied by the parent, so the card never compares itself against another entity. */
export interface ProposalOverviewCardMeta {
  scopeCoverage?: ProposalScopeCoverage
}

// ── Context ────────────────────────────────────────────────────────────────────

interface ProposalOverviewCardContextValue {
  proposal: ProposalOverviewCardData
  actions: ReturnType<typeof useProposalActionConfigs>['actions']
  style: ProposalRowStyle
  meta: ProposalOverviewCardMeta
}

const ProposalOverviewCardContext = createContext<ProposalOverviewCardContextValue | null>(null)

export function useProposalOverviewCard() {
  const ctx = React.use(ProposalOverviewCardContext)
  if (!ctx) {
    throw new Error('ProposalOverviewCard sub-components must be used within <ProposalOverviewCard>')
  }
  return ctx
}

// ── Root ───────────────────────────────────────────────────────────────────────

// The root owns the click, so a caller can't replace it; other div attributes (`data-press`, aria) pass through.
interface ProposalOverviewCardProps extends Omit<ComponentProps<'div'>, 'onClick'> {
  proposal: ProposalOverviewCardData
  children: ReactNode
  onView?: (entity: ProposalOverviewCardData) => void
  onEdit?: (entity: ProposalOverviewCardData) => void
  onAssignOwner?: (entity: ProposalOverviewCardData) => void
  meta?: ProposalOverviewCardMeta
}

function ProposalOverviewCardRoot({
  proposal,
  children,
  onView,
  onEdit,
  onAssignOwner,
  meta,
  ...props
}: ProposalOverviewCardProps) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (onView) {
      onView(proposal)
    }
    else {
      window.open(ROOTS.public.proposalReview(proposal.id), '_blank')
    }
  }, [proposal, onView])

  const { actions, DeleteConfirmDialog } = useProposalActionConfigs({
    onView,
    onEdit,
    onAssignOwner,
  })

  const style = PROPOSAL_ROW_STYLES[proposal.status ?? 'draft'] ?? PROPOSAL_ROW_STYLES.draft

  const value = useMemo<ProposalOverviewCardContextValue>(
    () => ({ proposal, actions, style, meta: meta ?? {} }),
    [proposal, actions, style, meta],
  )

  return (
    <ProposalOverviewCardContext value={value}>
      <DeleteConfirmDialog />
      <div {...props} onClick={handleClick}>
        {children}
      </div>
    </ProposalOverviewCardContext>
  )
}

// ── Layout sub-components ──────────────────────────────────────────────────────

function Header({ className, children }: { className?: string, children: ReactNode }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {children}
    </div>
  )
}

function Body({ className, children }: { className?: string, children: ReactNode }) {
  return (
    <div className={className}>
      {children}
    </div>
  )
}

// ── Data display sub-components ────────────────────────────────────────────────

function StatusIcon({
  size = 'sm',
  className,
}: {
  size?: 'sm' | 'md'
  className?: string
}) {
  const { style } = useProposalOverviewCard()
  const Icon = style.icon
  const iconSize = size === 'md' ? 14 : 11
  return <Icon size={iconSize} className={cn('shrink-0', style.iconClass, className)} />
}

/**
 * Status icon wrapped in a square tile.
 *
 * Designed to sit at the leading edge of a full-height proposal row using a
 * CSS grid layout. Grid cells have deterministic block-size when the parent
 * uses `items-stretch`, which lets `h-full aspect-square` compute width from
 * height reliably (a quirk that fails in pure flex since the inline-size is
 * resolved before the aspect-ratio kicks in):
 *
 *   <ProposalOverviewCard className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-stretch ... p-2">
 *     <ProposalOverviewCard.StatusIconTile />
 *     ...
 *   </ProposalOverviewCard>
 */
function StatusIconTile({
  iconSize = 18,
  className,
}: {
  iconSize?: number
  className?: string
}) {
  const { style } = useProposalOverviewCard()
  const Icon = style.icon
  return (
    <div
      aria-hidden="true"
      className={cn(
        'flex aspect-square h-full items-center justify-center rounded-md border border-border bg-muted',
        style.iconClass,
        className,
      )}
    >
      <Icon size={iconSize} className="shrink-0" />
    </div>
  )
}

function StatusBadge({ className }: { className?: string }) {
  const { proposal, style } = useProposalOverviewCard()
  if (!proposal.status) {
    return null
  }
  return (
    <Badge variant="outline" className={cn('text-xs shrink-0', style.textClass, className)}>
      {proposal.status}
    </Badge>
  )
}

function StatusDot({ className }: { className?: string }) {
  const { proposal } = useProposalOverviewCard()
  const dotColors: Record<string, string> = PROPOSAL_STATUS_DOT_COLORS
  const dotColor = dotColors[proposal.status ?? 'draft'] ?? PROPOSAL_STATUS_DOT_COLORS.draft
  return <span className={cn('h-2 w-2 shrink-0 rounded-full', dotColor, className)} />
}

function Label({ className }: { className?: string }) {
  const { proposal, style } = useProposalOverviewCard()
  const text = proposal.label
    || (proposal.createdAt ? formatBusinessTime(proposal.createdAt, { month: 'short', day: 'numeric' }) : 'Untitled')
  return (
    <span className={cn('truncate', style.textClass, className)}>
      {text}
    </span>
  )
}

function Trade({ className }: { className?: string }) {
  const { proposal } = useProposalOverviewCard()
  if (!proposal.trade) {
    return null
  }
  return (
    <span className={cn('text-xs text-muted-foreground truncate', className)}>
      {proposal.trade}
    </span>
  )
}

function Value({
  showIcon = false,
  fallback,
  className,
}: {
  showIcon?: boolean
  fallback?: ReactNode
  className?: string
}) {
  const { proposal, style } = useProposalOverviewCard()
  if (proposal.value == null || proposal.value <= 0) {
    return fallback ?? null
  }
  return (
    <span className={cn('font-semibold flex items-center gap-0.5 shrink-0', style.valueClass, className)}>
      {showIcon && <DollarSignIcon size={12} />}
      {formatAsDollars(proposal.value)}
    </span>
  )
}

function ViewCount({ className }: { className?: string }) {
  const { proposal } = useProposalOverviewCard()
  if (!proposal.viewCount || proposal.viewCount <= 0) {
    return null
  }
  return (
    <span className={cn('flex items-center gap-1 text-xs text-muted-foreground', className)}>
      <EyeIcon className="size-3" />
      {proposal.viewCount}
    </span>
  )
}

function CreatedAt({
  format: dateFormat = 'date-only',
  className,
}: {
  format?: 'full' | 'date-only' | 'relative'
  className?: string
}) {
  const { proposal } = useProposalOverviewCard()
  if (!proposal.createdAt) {
    return null
  }
  const date = new Date(proposal.createdAt)
  let display: string
  switch (dateFormat) {
    case 'full':
      display = formatBusinessTime(date, { month: 'short', day: 'numeric', year: 'numeric' })
      break
    case 'date-only':
      display = formatBusinessTime(date, { month: 'short', day: 'numeric' })
      break
    case 'relative':
      display = formatDistanceToNow(date, { addSuffix: true })
      break
  }
  return (
    <span className={cn('text-xs text-muted-foreground shrink-0', className)} suppressHydrationWarning={dateFormat === 'relative'}>
      {display}
    </span>
  )
}

// ── Fields sub-component ───────────────────────────────────────────────────────

function StatusFieldRenderer({ variant = 'badge' }: { variant?: 'badge' | 'icon' | 'dot' }) {
  switch (variant) {
    case 'icon':
      return <StatusIcon />
    case 'dot':
      return <StatusDot />
    default:
      return <StatusBadge />
  }
}

function Fields({ fields, className }: { fields: ProposalFieldConfig[], className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 min-w-0 flex-1', className)}>
      {fields.map((config) => {
        switch (config.field) {
          case 'status':
            return <StatusFieldRenderer key={config.field} variant={config.variant} />
          case 'label':
            return <Label key={config.field} />
          case 'trade':
            return <Trade key={config.field} />
          case 'value':
            return <Value key={config.field} showIcon={config.showIcon} />
          case 'viewCount':
            return <ViewCount key={config.field} />
          case 'createdAt':
            return <CreatedAt key={config.field} format={config.format} />
          default:
            return null
        }
      })}
    </div>
  )
}

// ── Trades sub-component ───────────────────────────────────────────────────────

function Trades({ max, className }: { max?: number, className?: string }) {
  const { proposal } = useProposalOverviewCard()

  const allTrades = useMemo(() => {
    const tradeSet = new Set<string>()
    proposal.sowSummary?.forEach(s => tradeSet.add(s.trade))
    return Array.from(tradeSet)
  }, [proposal.sowSummary])

  if (allTrades.length === 0) {
    return null
  }

  const visible = max ? allTrades.slice(0, max) : allTrades
  const remaining = max ? allTrades.length - max : 0

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {visible.map(trade => (
        <Badge key={trade} variant="outline" className="text-xs font-normal">
          {trade}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
          {`+${remaining}`}
        </Badge>
      )}
    </div>
  )
}

// ── Scope coverage sub-component ───────────────────────────────────────────────

function ScopeCoverage({ className }: { className?: string }) {
  const { meta } = useProposalOverviewCard()
  const coverage = meta.scopeCoverage
  if (!coverage || coverage.covered.length + coverage.missing.length + coverage.extra.length === 0) {
    return null
  }
  return (
    <ul aria-label="Scope coverage" className={cn('flex flex-wrap gap-1', className)}>
      {coverage.covered.map(scope => (
        <li key={`covered-${scope.id}`}>
          <Badge variant="outline" className="text-xs font-normal">{scope.label}</Badge>
        </li>
      ))}
      {coverage.missing.map(scope => (
        <li key={`missing-${scope.id}`}>
          <Badge variant="outline" className="text-xs font-normal text-muted-foreground line-through">
            <span className="sr-only">Not included: </span>
            {scope.label}
          </Badge>
        </li>
      ))}
      {coverage.extra.map(scope => (
        <li key={`extra-${scope.id}`}>
          <Badge variant="outline" className="border-dashed text-xs font-normal">
            <span aria-hidden="true">+ </span>
            <span className="sr-only">Added: </span>
            {scope.label}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

// ── Actions sub-component ──────────────────────────────────────────────────────

function Actions({
  mode = 'compact',
  className,
}: {
  mode?: 'compact' | 'bar'
  className?: string
}) {
  const { proposal, actions } = useProposalOverviewCard()
  return (
    <EntityActionMenu
      entity={proposal}
      actions={actions}
      mode={mode}
      className={className}
    />
  )
}

// ── Compound export ────────────────────────────────────────────────────────────

export const ProposalOverviewCard = Object.assign(ProposalOverviewCardRoot, {
  Header,
  Body,
  StatusIcon,
  StatusIconTile,
  StatusBadge,
  StatusDot,
  Label,
  Trade,
  Value,
  ViewCount,
  CreatedAt,
  Fields,
  Trades,
  ScopeCoverage,
  Actions,
})
