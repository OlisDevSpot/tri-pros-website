'use client'

import type { ReactNode } from 'react'

import type { Meeting } from '@/shared/db/schema/meetings'
import type { Proposal } from '@/shared/db/schema/proposals'
import type { SowTradeScope } from '@/shared/entities/proposals/types'

import { format, formatDistanceToNow } from 'date-fns'
import { CalendarIcon, FileTextIcon } from 'lucide-react'
import React, { createContext, useCallback, useMemo } from 'react'

import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Badge } from '@/shared/components/ui/badge'
import {
  MEETING_LIST_STATUS_COLORS,
  MEETING_OUTCOME_DOT_COLORS,
  MEETING_OUTCOME_LABELS,
} from '@/shared/constants/meetings/status-colors'
import { useMeetingActionConfigs } from '@/shared/entities/meetings/hooks/use-meeting-action-configs'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { cn } from '@/shared/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

export type MeetingOverviewCardProposal
  = Pick<Proposal, 'id' | 'status' | 'token' | 'createdAt'>
    & {
      label?: Proposal['label']
      trade?: string | null
      value?: number | null
      viewCount?: number
      sowSummary?: SowTradeScope[]
    }

export type MeetingOverviewCardData
  = Pick<Meeting, 'id'>
    & Partial<Pick<Meeting, 'scheduledFor' | 'createdAt' | 'meetingType' | 'meetingOutcome' | 'ownerId' | 'customerId'>>
    & {
      ownerName?: string | null
      ownerImage?: string | null
      customerName?: string | null
      customerPhone?: string | null
      customerAddress?: string | null
      customerCity?: string | null
      customerState?: string | null
      customerZip?: string | null
      proposals?: MeetingOverviewCardProposal[]
    }

export type MeetingFieldConfig
  = | { field: 'outcome', variant?: 'badge' | 'dot' }
    | { field: 'scheduledDate', format?: 'full' | 'date-only' | 'time-only' | 'relative', onChange?: (date: Date) => void }
    | { field: 'type' }
    | { field: 'proposalCount' }

// ── Context ────────────────────────────────────────────────────────────────────

interface MeetingOverviewCardContextValue {
  meeting: MeetingOverviewCardData
  customerId: string
  actions: ReturnType<typeof useMeetingActionConfigs>['actions']
}

const MeetingOverviewCardContext = createContext<MeetingOverviewCardContextValue | null>(null)

function useMeetingOverviewCard() {
  const ctx = React.use(MeetingOverviewCardContext)
  if (!ctx) {
    throw new Error('MeetingOverviewCard sub-components must be used within <MeetingOverviewCard>')
  }
  return ctx
}

// ── Root ───────────────────────────────────────────────────────────────────────

interface MeetingOverviewCardProps {
  meeting: MeetingOverviewCardData
  customerId: string
  className?: string
  children: ReactNode
  onAssignOwner?: (entity: MeetingOverviewCardData) => void
  onAssignProject?: (entity: MeetingOverviewCardData) => void
}

function MeetingOverviewCardRoot({
  meeting,
  customerId,
  className,
  children,
  onAssignOwner,
  onAssignProject,
}: MeetingOverviewCardProps) {
  const { open: openModal, setModal } = useModalStore()

  const handleView = useCallback(async () => {
    const { CustomerProfileModal } = await import(
      '@/features/customer-pipelines/ui/components',
    )
    setModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId, defaultTab: 'meetings' as const, highlightMeetingId: meeting.id },
    })
    openModal()
  }, [customerId, meeting.id, setModal, openModal])

  const { actions, DeleteConfirmDialog } = useMeetingActionConfigs({
    onView: handleView,
    onAssignOwner: onAssignOwner
      ? () => onAssignOwner(meeting)
      : undefined,
    onAssignProject: onAssignProject
      ? () => onAssignProject(meeting)
      : undefined,
  })

  const value = useMemo<MeetingOverviewCardContextValue>(
    () => ({ meeting, customerId, actions }),
    [meeting, customerId, actions],
  )

  return (
    <MeetingOverviewCardContext value={value}>
      <DeleteConfirmDialog />
      <div className={className}>
        {children}
      </div>
    </MeetingOverviewCardContext>
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

function Owner({
  size = 'sm',
  showName = false,
  className,
}: {
  size?: 'sm' | 'md'
  showName?: boolean
  className?: string
}) {
  const { meeting } = useMeetingOverviewCard()
  if (!meeting.ownerName) {
    return null
  }

  const initials = meeting.ownerName
    .split(' ')
    .map(n => n.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const avatarSize = size === 'md' ? 'size-6' : 'size-5'

  const avatar = (
    <Avatar className={cn(avatarSize, 'shrink-0')}>
      <AvatarImage src={meeting.ownerImage ?? undefined} alt={meeting.ownerName} />
      <AvatarFallback className={cn(size === 'md' ? 'text-[9px]' : 'text-[8px]', 'font-medium')}>
        {initials}
      </AvatarFallback>
    </Avatar>
  )

  if (showName) {
    return (
      <div className={cn('flex items-center gap-1.5 min-w-0', className)}>
        <HybridPopoverTooltip content={meeting.ownerName}>
          <button type="button" className="shrink-0" onClick={e => e.stopPropagation()}>
            {avatar}
          </button>
        </HybridPopoverTooltip>
        <span className="text-[10px] text-muted-foreground truncate">{meeting.ownerName}</span>
      </div>
    )
  }

  return (
    <HybridPopoverTooltip content={meeting.ownerName}>
      <button type="button" className={cn('shrink-0', className)} onClick={e => e.stopPropagation()}>
        {avatar}
      </button>
    </HybridPopoverTooltip>
  )
}

function CustomerName({ className }: { className?: string }) {
  const { meeting } = useMeetingOverviewCard()
  if (!meeting.customerName) {
    return null
  }
  return (
    <span className={cn('text-sm', className)}>
      {meeting.customerName}
    </span>
  )
}

function CreatedAt({ className }: { className?: string }) {
  const { meeting } = useMeetingOverviewCard()
  if (!meeting.createdAt) {
    return null
  }
  return (
    <span className={cn('text-[10px] text-muted-foreground/60 shrink-0', className)}>
      {formatDistanceToNow(new Date(meeting.createdAt), { addSuffix: true })}
    </span>
  )
}

function Phone({ className }: { className?: string }) {
  const { meeting } = useMeetingOverviewCard()
  if (!meeting.customerPhone) {
    return null
  }
  return (
    <div className={cn('min-w-0 text-muted-foreground', className)} onClick={e => e.stopPropagation()}>
      <PhoneAction phone={meeting.customerPhone} className="text-[11px]" />
    </div>
  )
}

function Address({ children, className }: { children?: ReactNode, className?: string }) {
  const { meeting } = useMeetingOverviewCard()

  const addressLine1 = meeting.customerAddress ?? ''
  const addressLine2 = [meeting.customerCity, meeting.customerState, meeting.customerZip]
    .filter(Boolean)
    .join(', ')
  const fullAddress = [addressLine1, addressLine2].filter(Boolean).join(', ')

  if (!fullAddress) {
    return null
  }

  return (
    <div className={cn('min-w-0 text-muted-foreground', className)} onClick={e => e.stopPropagation()}>
      <AddressAction address={fullAddress} className="text-[11px]">
        {children}
      </AddressAction>
    </div>
  )
}

// ── Fields sub-component ───────────────────────────────────────────────────────

function OutcomeField({ variant = 'badge' }: { variant?: 'badge' | 'dot' }) {
  const { meeting } = useMeetingOverviewCard()
  const outcome = meeting.meetingOutcome ?? 'not_set'

  if (variant === 'dot') {
    return (
      <span
        className={cn(
          'h-2 w-2 shrink-0 rounded-full',
          MEETING_OUTCOME_DOT_COLORS[outcome],
        )}
      />
    )
  }

  return (
    <Badge
      variant="outline"
      className={cn('text-xs', MEETING_LIST_STATUS_COLORS[outcome] ?? '')}
    >
      {MEETING_OUTCOME_LABELS[outcome] ?? outcome.replace(/_/g, ' ')}
    </Badge>
  )
}

function ScheduledDateField({
  format: dateFormat = 'full',
  onChange,
}: {
  format?: 'full' | 'date-only' | 'time-only' | 'relative'
  onChange?: (date: Date) => void
}) {
  const { meeting } = useMeetingOverviewCard()
  if (!meeting.scheduledFor) {
    return null
  }

  const date = new Date(meeting.scheduledFor)
  let display: string
  switch (dateFormat) {
    case 'full':
      display = format(date, 'MMM d, yyyy · h:mm a')
      break
    case 'date-only':
      display = format(date, 'MMM d, yyyy')
      break
    case 'time-only':
      display = format(date, 'h:mm a')
      break
    case 'relative':
      display = formatDistanceToNow(date, { addSuffix: true })
      break
  }

  if (onChange) {
    return (
      <div onClick={e => e.stopPropagation()}>
        <DateTimePicker
          value={date}
          onChange={(d) => {
            if (d) {
              onChange(d)
            }
          }}
          className="h-auto p-0 text-[11px]"
        >
          <Badge variant="secondary" className="gap-1 px-1.5 py-0.5 text-[11px] font-normal hover:bg-secondary/80 cursor-pointer">
            <CalendarIcon className="h-3 w-3 shrink-0" />
            <span>{display}</span>
          </Badge>
        </DateTimePicker>
      </div>
    )
  }

  return (
    <span className="text-xs text-muted-foreground shrink-0">
      {display}
    </span>
  )
}

function TypeField() {
  const { meeting } = useMeetingOverviewCard()
  if (!meeting.meetingType) {
    return null
  }
  return (
    <Badge variant="secondary" className="text-xs font-medium">
      {meeting.meetingType}
    </Badge>
  )
}

function ProposalCountField() {
  const { meeting } = useMeetingOverviewCard()
  const count = meeting.proposals?.length ?? 0
  if (count === 0) {
    return null
  }
  return (
    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
      <FileTextIcon className="size-3" />
      {count}
    </span>
  )
}

function Fields({ fields, className }: { fields: MeetingFieldConfig[], className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-1.5 min-w-0 flex-1', className)}>
      {fields.map((config) => {
        switch (config.field) {
          case 'outcome':
            return <OutcomeField key={config.field} variant={config.variant} />
          case 'scheduledDate':
            return <ScheduledDateField key={config.field} format={config.format} onChange={config.onChange} />
          case 'type':
            return <TypeField key={config.field} />
          case 'proposalCount':
            return <ProposalCountField key={config.field} />
          default:
            return null
        }
      })}
    </div>
  )
}

// ── Trades sub-component ───────────────────────────────────────────────────────

function Trades({ max, className }: { max?: number, className?: string }) {
  const { meeting } = useMeetingOverviewCard()

  const allTrades = useMemo(() => {
    const tradeSet = new Set<string>()
    meeting.proposals?.forEach((p) => {
      p.sowSummary?.forEach((s) => {
        tradeSet.add(s.trade)
      })
    })
    return Array.from(tradeSet)
  }, [meeting.proposals])

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

// ── Proposals sub-component ────────────────────────────────────────────────────

function Proposals({
  renderProposal,
  showHeader = true,
  className,
}: {
  renderProposal?: (proposal: MeetingOverviewCardProposal) => ReactNode
  showHeader?: boolean
  className?: string
}) {
  const { meeting } = useMeetingOverviewCard()
  const proposals = meeting.proposals

  if (!proposals || proposals.length === 0) {
    return null
  }

  return (
    <div className={className}>
      {showHeader && (
        <div className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground mb-1.5">
          <FileTextIcon className="size-3" />
          <span>{`Proposals (${proposals.length})`}</span>
        </div>
      )}
      <div className="space-y-0.5">
        {proposals.map(p => (
          <React.Fragment key={p.id}>
            {renderProposal ? renderProposal(p) : <DefaultProposalRow proposal={p} />}
          </React.Fragment>
        ))}
      </div>
    </div>
  )
}

function DefaultProposalRow({ proposal }: { proposal: MeetingOverviewCardProposal }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
      <FileTextIcon className="size-3 shrink-0" />
      <span className="truncate">{proposal.label ?? format(new Date(proposal.createdAt), 'MMM d')}</span>
      <span className="ml-auto text-[10px]">{proposal.status}</span>
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
  const { meeting, actions } = useMeetingOverviewCard()
  return (
    <EntityActionMenu
      entity={meeting}
      actions={actions}
      mode={mode}
      className={className}
    />
  )
}

// ── ContextMenu sub-component ──────────────────────────────────────────────────
// Wraps children with a right-click context menu using the same actions from context.
// Implementation deferred — renders children passthrough for now.

function ContextMenuWrapper({ children }: { children: ReactNode }) {
  return <>{children}</>
}

// ── Compound export ────────────────────────────────────────────────────────────

export const MeetingOverviewCard = Object.assign(MeetingOverviewCardRoot, {
  Header,
  Body,
  Owner,
  CustomerName,
  CreatedAt,
  Phone,
  Address,
  Fields,
  Trades,
  Proposals,
  Actions,
  ContextMenu: ContextMenuWrapper,
})
