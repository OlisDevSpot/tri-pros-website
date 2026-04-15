'use client'

import type { CustomerPipelineItem, PipelineItemProjectMeeting, PipelineItemProposal } from '@/features/customer-pipelines/types'
import type { MeetingOverviewCardProposal } from '@/shared/entities/meetings/components/overview-card'

import { useDraggable } from '@dnd-kit/core'
import { format, formatDistanceToNow } from 'date-fns'
import {
  CalendarIcon,
  DollarSignIcon,
  FolderOpenIcon,
  GripVerticalIcon,
  MapPinIcon,
} from 'lucide-react'
import { useCallback } from 'react'

import { PROPOSAL_ROW_STYLES } from '@/features/customer-pipelines/constants/proposal-row-styles'
import { getMeetingTimeLabel } from '@/features/customer-pipelines/lib/get-meeting-time-label'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import { Separator } from '@/shared/components/ui/separator'
import { ROOTS } from '@/shared/config/roots'
import { useCustomerActionConfigs } from '@/shared/entities/customers/hooks/use-customer-action-configs'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'
import { useProjectActionConfigs } from '@/shared/entities/projects/hooks/use-project-action-configs'
import { useProposalActionConfigs } from '@/shared/entities/proposals/hooks/use-proposal-action-configs'
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

  // -- Project entity actions (for the project container in projects pipeline) --
  const projectEntity = item.project ? { id: item.project.id } : null

  const handleViewProject = useCallback(() => {
    if (item.project) {
      window.location.href = ROOTS.dashboard.projects.byId(item.project.id)
    }
  }, [item.project])

  const { actions: projectActions, DeleteConfirmDialog: ProjectDeleteDialog } = useProjectActionConfigs({
    onView: handleViewProject,
    onEdit: handleViewProject,
  })

  return (
    <>
      <CustomerDeleteDialog />
      <ProjectDeleteDialog />
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
            <div className="rounded-md border border-green-500/20 bg-green-500/5 p-2.5 space-y-1.5 shadow-sm dark:border-green-500/15 dark:bg-green-500/8">
              {/* Project header: title + actions */}
              <div className="flex items-center gap-1.5 min-w-0">
                <FolderOpenIcon size={14} className="shrink-0 text-green-600 dark:text-green-400" />
                <span className="text-xs font-semibold truncate flex-1">{item.project.title}</span>
                {!isDragOverlay && projectEntity && (
                  <EntityActionMenu
                    entity={projectEntity}
                    actions={projectActions}
                    mode="compact"
                  />
                )}
              </div>

              {/* Started date + total approved value */}
              <div className="flex items-center gap-2 text-[11px]">
                {item.project.startedAt && (
                  <span className="text-muted-foreground">
                    {format(new Date(item.project.startedAt), 'MMM d, yyyy')}
                  </span>
                )}
                {item.project.totalValue > 0 && (
                  <span className="font-bold text-green-700 dark:text-green-400">
                    {formatAsDollars(item.project.totalValue)}
                  </span>
                )}
              </div>

              {/* Meetings separated by dividers, each with avatar + actions + proposals */}
              {item.project.meetings.length > 0 && (
                <div className="space-y-0">
                  {item.project.meetings.map((mtg, idx) => (
                    <KanbanProjectMeeting key={mtg.id} meeting={mtg} customerId={item.id} isFirst={idx === 0} isDragOverlay={isDragOverlay} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Meeting context container (fresh pipeline) ── */}
          {!item.project && hasMeetingContext && item.nextMeetingId && (
            <div className="rounded-md border border-border/50 bg-accent/50 p-2.5 space-y-1.5 shadow-sm dark:bg-accent/30">
              <MeetingOverviewCard
                meeting={{
                  id: item.nextMeetingId,
                  scheduledFor: item.meetingScheduledFor ?? undefined,
                  ownerId: item.assignedRep?.id,
                  ownerName: item.assignedRep?.name,
                  ownerImage: item.assignedRep?.image,
                  proposals: item.proposals as MeetingOverviewCardProposal[],
                }}
                customerId={item.id}
                onAssignOwner={onAssignRep
                  ? () => onAssignRep(item.nextMeetingId!, item.assignedRep?.id ?? null)
                  : undefined}
                className="space-y-1.5"
              >
                {/* Rep + actions */}
                <MeetingOverviewCard.Header className="gap-1.5 min-w-0">
                  <MeetingOverviewCard.Owner size="sm" showName className="flex-1 min-w-0" />
                  {!isDragOverlay && (
                    <MeetingOverviewCard.Actions mode="compact" />
                  )}
                </MeetingOverviewCard.Header>

                {/* Meeting time badge — preserved from original kanban rendering */}
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
                <MeetingOverviewCard.Proposals
                  showHeader={false}
                  renderProposal={p => <KanbanProposalRow key={p.id} proposal={p as PipelineItemProposal} />}
                />
              </MeetingOverviewCard>
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

function KanbanProjectMeeting({ meeting, customerId, isFirst, isDragOverlay }: { meeting: PipelineItemProjectMeeting, customerId: string, isFirst: boolean, isDragOverlay?: boolean }) {
  return (
    <>
      {!isFirst && <Separator className="my-1.5" />}
      <MeetingOverviewCard
        meeting={{
          id: meeting.id,
          ownerId: meeting.ownerId,
          ownerName: meeting.ownerName,
          ownerImage: meeting.ownerImage,
          proposals: meeting.proposals as MeetingOverviewCardProposal[],
        }}
        customerId={customerId}
        className="space-y-1"
      >
        {/* Meeting header: avatar + actions */}
        <MeetingOverviewCard.Header className="gap-1.5">
          <MeetingOverviewCard.Owner size="sm" showName className="flex-1 min-w-0" />
          {!isDragOverlay && (
            <MeetingOverviewCard.Actions mode="compact" className="opacity-60 hover:opacity-100 transition-opacity" />
          )}
        </MeetingOverviewCard.Header>

        {/* Proposals */}
        <MeetingOverviewCard.Proposals
          showHeader={false}
          className="flex flex-col gap-0.5"
          renderProposal={p => <KanbanProposalRow key={p.id} proposal={p as PipelineItemProposal} />}
        />
      </MeetingOverviewCard>
    </>
  )
}

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

  const style = PROPOSAL_ROW_STYLES[proposal.status] ?? PROPOSAL_ROW_STYLES.draft
  const StatusIcon = style.icon

  return (
    <>
      <DeleteConfirmDialog />
      <div
        className={cn(
          'group/proposal flex items-center justify-between gap-2 rounded-md px-1.5 py-1.5 transition-colors min-h-8',
          style.bg,
        )}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <StatusIcon size={11} className={cn('shrink-0', style.iconClass)} />
          <span className={cn('text-[11px] truncate', style.textClass)}>
            {format(new Date(proposal.createdAt), 'MMM d')}
          </span>
          {proposal.value != null && proposal.value > 0
            ? (
                <span className={cn('text-xs font-semibold flex items-center gap-0.5 ml-auto shrink-0', style.valueClass)}>
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
