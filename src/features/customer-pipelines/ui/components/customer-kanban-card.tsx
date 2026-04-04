'use client'

import type { CustomerPipelineItem, PipelineItemProposal } from '@/features/customer-pipelines/types'

import { useDraggable } from '@dnd-kit/core'
import { format, formatDistanceToNow } from 'date-fns'
import {
  CalendarIcon,
  CheckCircle2Icon,
  DollarSignIcon,
  FileTextIcon,
  FolderOpenIcon,
  GripVerticalIcon,
  MapPinIcon,
} from 'lucide-react'
import { useCallback } from 'react'

import { useCustomerActionConfigs } from '@/features/customer-pipelines/hooks/use-customer-action-configs'
import { getMeetingTimeLabel } from '@/features/customer-pipelines/lib/get-meeting-time-label'
import { useMeetingActionConfigs } from '@/features/meetings/hooks/use-meeting-action-configs'
import { useProposalActionConfigs } from '@/features/proposal-flow/hooks/use-proposal-action-configs'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { RepProfileSnapshot } from '@/shared/components/rep-profile-snapshot'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { ROOTS } from '@/shared/config/roots'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { formatAddress, formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface Props {
  item: CustomerPipelineItem
  isDragOverlay?: boolean
  onViewProfile: (customerId: string) => void
  onCreateMeeting?: (customerId: string) => void
  onAssignRep?: (meetingId: string, currentRepId: string | null) => void
}

export function CustomerKanbanCard({
  item,
  isDragOverlay,
  onViewProfile,
  onCreateMeeting,
  onAssignRep,
}: Props) {
  const isMobile = useIsMobile()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: item,
  })

  const cardDragProps = !isDragOverlay && !isMobile ? { ...attributes, ...listeners } : {}
  const handleDragProps = !isDragOverlay && isMobile ? { ...attributes, ...listeners } : {}

  function handleClick() {
    if (!isDragging && !isDragOverlay) {
      onViewProfile(item.id)
    }
  }

  const meetingLabel = getMeetingTimeLabel(item.nextMeetingAt)
  const isScheduledOrInProgress = item.stage === 'meeting_scheduled' || item.stage === 'meeting_in_progress'
  const hasMeetingContext = item.meetingCount > 0
  const fullAddress = item.address
    ? formatAddress(item.address, item.city, item.state ?? 'CA', item.zip)
    : null

  // -- Customer entity actions --
  const handleViewCustomer = useCallback(() => {
    onViewProfile(item.id)
  }, [item.id, onViewProfile])

  const handleScheduleMeeting = useCallback(() => {
    onCreateMeeting?.(item.id)
  }, [item.id, onCreateMeeting])

  const { actions: customerActions, DeleteConfirmDialog: CustomerDeleteDialog } = useCustomerActionConfigs<CustomerPipelineItem>({
    onView: handleViewCustomer,
    onScheduleMeeting: handleScheduleMeeting,
  })

  // -- Meeting entity actions (for the next meeting on this customer) --
  const meetingEntity = item.nextMeetingId ? { id: item.nextMeetingId } : null

  const handleAssignOwner = useCallback(() => {
    if (item.nextMeetingId) {
      onAssignRep?.(item.nextMeetingId, item.assignedRep?.id ?? null)
    }
  }, [item.nextMeetingId, item.assignedRep, onAssignRep])

  const { actions: meetingActions, DeleteConfirmDialog: MeetingDeleteDialog } = useMeetingActionConfigs({
    onAssignOwner: handleAssignOwner,
  })

  return (
    <>
      <CustomerDeleteDialog />
      <MeetingDeleteDialog />
      <Card
        ref={!isDragOverlay ? setNodeRef : undefined}
        className={cn(
          'cursor-pointer transition-colors duration-200 hover:bg-primary/5 pt-0 pb-0',
          isDragging && !isDragOverlay && 'opacity-30',
          isDragOverlay && 'shadow-lg rotate-1 scale-105',
        )}
        onClick={handleClick}
        {...cardDragProps}
      >
        <CardContent className="p-2.5 space-y-2">
          {/* ── Customer info container ── */}
          <div className="rounded-md border border-border/60 bg-muted/30 p-2.5 space-y-1.5 shadow-sm dark:bg-muted/20">
            {/* Name + created timestamp + more menu */}
            <div className="flex items-start gap-1.5 min-w-0">
              {!isDragOverlay && (
                <span
                  className="shrink-0 cursor-grab active:cursor-grabbing touch-none mt-0.5"
                  {...handleDragProps}
                >
                  <GripVerticalIcon size={14} className="text-muted-foreground/40" />
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className="font-semibold text-sm truncate uppercase tracking-wide">
                    {item.name}
                  </span>
                  {!isDragOverlay && (
                    <EntityActionMenu
                      entity={item}
                      actions={customerActions}
                      mode="compact"
                    />
                  )}
                </div>
                {item.latestActivityAt && (
                  <p className="text-[11px] text-muted-foreground/70 leading-tight">
                    {'Created '}
                    {formatDistanceToNow(new Date(item.latestActivityAt), { addSuffix: true })}
                  </p>
                )}
              </div>
            </div>

            {/* Contact details */}
            <div
              className="flex flex-col gap-1.5 text-xs text-muted-foreground"
              onClick={e => e.stopPropagation()}
            >
              {item.phone && <PhoneAction phone={item.phone} className="text-xs" />}
              {fullAddress && (
                <AddressAction address={fullAddress}>
                  <button
                    type="button"
                    className="flex items-start gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer text-left"
                    onClick={e => e.stopPropagation()}
                  >
                    <MapPinIcon size={14} className="shrink-0 mt-0.5" />
                    <span className="whitespace-pre-line leading-snug">{fullAddress}</span>
                  </button>
                </AddressAction>
              )}
            </div>
          </div>

          {/* ── Project context container (projects pipeline) ── */}
          {item.project && (
            <div className="rounded-md border border-border/50 bg-accent/50 p-2.5 space-y-1.5 shadow-sm dark:bg-accent/30">
              {/* Project title + rep */}
              <div className="flex items-center gap-1.5 min-w-0">
                <FolderOpenIcon size={14} className="shrink-0 text-primary/70" />
                <span className="text-xs font-semibold truncate flex-1">{item.project.title}</span>
                {!isDragOverlay && meetingEntity && (
                  <EntityActionMenu
                    entity={meetingEntity}
                    actions={meetingActions}
                    mode="compact"
                  />
                )}
              </div>

              {/* Assigned rep */}
              {item.assignedRep && (
                <RepProfileSnapshot
                  name={item.assignedRep.name}
                  image={item.assignedRep.image}
                  subtitle={item.assignedRep.email}
                />
              )}

              {/* Project stats */}
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CalendarIcon size={10} />
                  {item.project.meetingCount}
                  {' mtgs'}
                </span>
                <span className="flex items-center gap-1">
                  <FileTextIcon size={10} />
                  {item.project.proposalCount}
                  {' props'}
                </span>
                {item.project.totalValue > 0 && (
                  <span className="flex items-center gap-0.5 text-green-700 dark:text-green-400 font-semibold">
                    <DollarSignIcon size={10} />
                    {formatAsDollars(item.project.totalValue)}
                  </span>
                )}
              </div>

              {/* Project proposals */}
              {item.proposals.length > 0 && (
                <div className="flex flex-col gap-1">
                  {item.proposals.map(p => (
                    <KanbanProposalRow key={p.id} proposal={p} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Meeting context container (fresh pipeline) ── */}
          {!item.project && hasMeetingContext && (
            <div className="rounded-md border border-border/50 bg-accent/50 p-2.5 space-y-1.5 shadow-sm dark:bg-accent/30">
              {/* Rep (top) + meeting more menu */}
              <div className="flex items-center gap-1.5 min-w-0">
                <div className="flex-1 min-w-0">
                  {item.assignedRep && (
                    <RepProfileSnapshot
                      name={item.assignedRep.name}
                      image={item.assignedRep.image}
                      subtitle={item.assignedRep.email}
                    />
                  )}
                </div>
                {!isDragOverlay && meetingEntity && (
                  <EntityActionMenu
                    entity={meetingEntity}
                    actions={meetingActions}
                    mode="compact"
                  />
                )}
              </div>

              {/* Meeting time badge — always shown when meeting exists */}
              {isScheduledOrInProgress && meetingLabel
                ? (
                    <Badge
                      variant="outline"
                      className={cn(
                        'gap-1 text-[11px] font-normal w-fit',
                        meetingLabel.variant === 'active' && 'border-yellow-500/30 bg-yellow-500/10 text-yellow-700 dark:border-yellow-500/20 dark:bg-yellow-500/10 dark:text-yellow-300',
                        meetingLabel.variant === 'upcoming' && 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-300',
                        meetingLabel.variant === 'past' && 'border-muted-foreground/20 text-muted-foreground',
                      )}
                    >
                      <CalendarIcon size={10} />
                      {meetingLabel.text}
                    </Badge>
                  )
                : item.meetingScheduledFor
                  ? (
                      <Badge
                        variant="outline"
                        className="gap-1 text-[11px] font-normal w-fit border-muted-foreground/20 text-muted-foreground"
                      >
                        <CalendarIcon size={10} />
                        {formatDistanceToNow(new Date(item.meetingScheduledFor), { addSuffix: true })}
                      </Badge>
                    )
                  : null}

              {/* Individual proposal rows */}
              {item.proposals.length > 0 && (
                <div className="flex flex-col gap-1">
                  {item.proposals.map(p => (
                    <KanbanProposalRow key={p.id} proposal={p} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* CTA: Schedule Meeting for needs_confirmation */}
          {item.stage === 'needs_confirmation' && onCreateMeeting && (
            <Button
              size="sm"
              className="w-full"
              onClick={(e) => {
                e.stopPropagation()
                onCreateMeeting(item.id)
              }}
            >
              + Schedule Meeting
            </Button>
          )}
        </CardContent>
      </Card>
    </>
  )
}

/* ── Sub-components ── */

function KanbanProposalRow({ proposal }: { proposal: PipelineItemProposal }) {
  const handleView = useCallback(() => {
    window.open(`${ROOTS.public.proposals()}/proposal/${proposal.id}`, '_blank')
  }, [proposal.id])

  const handleEdit = useCallback(() => {
    window.location.href = ROOTS.dashboard.proposals.byId(proposal.id)
  }, [proposal.id])

  const { actions: proposalActions, DeleteConfirmDialog } = useProposalActionConfigs<PipelineItemProposal>({
    onView: handleView,
    onEdit: handleEdit,
  })

  const isApproved = proposal.status === 'approved'

  return (
    <>
      <DeleteConfirmDialog />
      <div
        className={cn(
          'group/proposal flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 transition-colors min-h-8',
          isApproved
            ? 'bg-green-500/8 hover:bg-green-500/12 dark:bg-green-500/10 dark:hover:bg-green-500/15'
            : 'hover:bg-background/50',
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          {isApproved
            ? <CheckCircle2Icon size={11} className="shrink-0 text-green-600 dark:text-green-400" />
            : <FileTextIcon size={11} className="shrink-0 text-muted-foreground" />}
          <span className={cn('text-[11px] truncate', isApproved ? 'text-green-700 dark:text-green-400 font-medium' : 'text-muted-foreground')}>
            {format(new Date(proposal.createdAt), 'MMM d')}
          </span>
          {proposal.value != null && proposal.value > 0
            ? (
                <span className={cn(
                  'text-xs font-semibold flex items-center gap-0.5 ml-auto shrink-0',
                  isApproved ? 'text-green-700 dark:text-green-400' : 'text-green-700 dark:text-green-400',
                )}
                >
                  <DollarSignIcon size={12} />
                  {formatAsDollars(proposal.value)}
                </span>
              )
            : <span className="text-[11px] text-muted-foreground italic ml-auto shrink-0">No price</span>}
        </div>
        <EntityActionMenu
          entity={proposal}
          actions={proposalActions}
          mode="compact"
          className="opacity-100 sm:opacity-0 sm:group-hover/proposal:opacity-100 transition-opacity"
        />
      </div>
    </>
  )
}
