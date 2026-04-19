'use client'

import type { ReactNode } from 'react'

import type { Proposal } from '@/shared/db/schema/proposals'
import type { ProposalRowStyle } from '@/shared/entities/proposals/constants/proposal-row-styles'
import type { SowTradeScope } from '@/shared/entities/proposals/types'

import { format, formatDistanceToNow } from 'date-fns'
import { DollarSignIcon, EyeIcon } from 'lucide-react'
import React, { createContext, useCallback, useMemo } from 'react'

import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Badge } from '@/shared/components/ui/badge'
import { ROOTS } from '@/shared/config/roots'
import { PROPOSAL_ROW_STYLES } from '@/shared/entities/proposals/constants/proposal-row-styles'
import { useProposalActionConfigs } from '@/shared/entities/proposals/hooks/use-proposal-action-configs'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

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

// ── Context ────────────────────────────────────────────────────────────────────

interface ProposalOverviewCardContextValue {
  proposal: ProposalOverviewCardData
  actions: ReturnType<typeof useProposalActionConfigs>['actions']
  style: ProposalRowStyle
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

interface ProposalOverviewCardProps {
  proposal: ProposalOverviewCardData
  className?: string
  children: ReactNode
  onView?: (entity: ProposalOverviewCardData) => void
  onEdit?: (entity: ProposalOverviewCardData) => void
  onAssignOwner?: (entity: ProposalOverviewCardData) => void
}

function ProposalOverviewCardRoot({
  proposal,
  className,
  children,
  onView,
  onEdit,
  onAssignOwner,
}: ProposalOverviewCardProps) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (onView) {
      onView(proposal)
    }
    else {
      window.open(`${ROOTS.public.proposals()}/proposal/${proposal.id}`, '_blank')
    }
  }, [proposal, onView])

  const { actions, DeleteConfirmDialog } = useProposalActionConfigs({
    onView,
    onEdit,
    onAssignOwner,
  })

  const style = PROPOSAL_ROW_STYLES[proposal.status ?? 'draft'] ?? PROPOSAL_ROW_STYLES.draft

  const value = useMemo<ProposalOverviewCardContextValue>(
    () => ({ proposal, actions, style }),
    [proposal, actions, style],
  )

  return (
    <ProposalOverviewCardContext value={value}>
      <DeleteConfirmDialog />
      <div className={className} onClick={handleClick}>
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
 * Status icon wrapped in a square tile with a status-colored border.
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
 *
 * The tile inherits its color from `style.iconClass`, so the border
 * (`border-current/25`) and icon share the status hue without needing a
 * separate borderClass token.
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
        'flex aspect-square h-full items-center justify-center rounded-md border border-current/25 bg-background/40',
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
  const dotColors: Record<string, string> = {
    draft: 'bg-slate-400',
    sent: 'bg-amber-500',
    approved: 'bg-green-500',
    declined: 'bg-red-500',
  }
  const dotColor = dotColors[proposal.status ?? 'draft'] ?? 'bg-slate-400'
  return <span className={cn('h-2 w-2 shrink-0 rounded-full', dotColor, className)} />
}

function Label({ className }: { className?: string }) {
  const { proposal, style } = useProposalOverviewCard()
  const text = proposal.label
    || (proposal.createdAt ? format(new Date(proposal.createdAt), 'MMM d') : 'Untitled')
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
      display = format(date, 'MMM d, yyyy')
      break
    case 'date-only':
      display = format(date, 'MMM d')
      break
    case 'relative':
      display = formatDistanceToNow(date, { addSuffix: true })
      break
  }
  return (
    <span className={cn('text-xs text-muted-foreground shrink-0', className)}>
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
        <Badge key={trade} variant="outline" className="text-[10px] font-normal">
          {trade}
        </Badge>
      ))}
      {remaining > 0 && (
        <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
          {`+${remaining}`}
        </Badge>
      )}
    </div>
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
  Actions,
})
