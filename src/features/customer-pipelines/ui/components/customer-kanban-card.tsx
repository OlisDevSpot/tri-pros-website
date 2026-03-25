'use client'

import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'
import type { CustomerPipeline } from '@/shared/types/enums'

import { useDraggable } from '@dnd-kit/core'
import { formatDistanceToNow } from 'date-fns'
import {
  CalendarIcon,
  DollarSignIcon,
  ExternalLinkIcon,
  FileTextIcon,
  GripVerticalIcon,
  MapPinIcon,
  MoreHorizontalIcon,
  MoreVerticalIcon,
  Trash2Icon,
  UserIcon,
  UserRoundPenIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { PIPELINE_LABELS } from '@/features/customer-pipelines/constants/pipeline-labels'
import { getMeetingTimeLabel } from '@/features/customer-pipelines/lib/get-meeting-time-label'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { RepProfileSnapshot } from '@/shared/components/rep-profile-snapshot'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent } from '@/shared/components/ui/card'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from '@/shared/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { ROOTS } from '@/shared/config/roots'
import { customerPipelines } from '@/shared/constants/enums'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { formatAddress, formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { useAbility } from '@/shared/permissions/hooks'

interface Props {
  item: CustomerPipelineItem
  currentPipeline: CustomerPipeline
  isDragOverlay?: boolean
  canManagePipeline?: boolean
  onViewProfile: (customerId: string) => void
  onMoveToPipeline?: (customerId: string, pipeline: CustomerPipeline) => void
  onCreateMeeting?: (customerId: string) => void
  onDeleteCustomer?: (customerId: string) => void
  onAssignRep?: (meetingId: string, currentRepId: string | null) => void
}

export function CustomerKanbanCard({
  item,
  currentPipeline,
  isDragOverlay,
  canManagePipeline,
  onViewProfile,
  onMoveToPipeline,
  onCreateMeeting,
  onDeleteCustomer,
  onAssignRep,
}: Props) {
  const isMobile = useIsMobile()
  const ability = useAbility()
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

  const otherPipelines = customerPipelines.filter(p => p !== currentPipeline)
  const meetingLabel = getMeetingTimeLabel(item.nextMeetingAt)
  const hasMeetingContext = item.meetingCount > 0 && (item.assignedRep || meetingLabel)
  const fullAddress = item.address
    ? formatAddress(item.address, item.city, item.state ?? 'CA', item.zip)
    : null

  const cardContent = (
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
                  <CustomerMoreMenu
                    item={item}
                    ability={ability}
                    canManagePipeline={canManagePipeline}
                    otherPipelines={otherPipelines}
                    onViewProfile={onViewProfile}
                    onCreateMeeting={onCreateMeeting}
                    onMoveToPipeline={onMoveToPipeline}
                    onDeleteCustomer={onDeleteCustomer}
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

        {/* ── Meeting context container ── */}
        {hasMeetingContext && (
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
              {!isDragOverlay && item.nextMeetingId && (
                <MeetingMoreMenu
                  item={item}
                  ability={ability}
                  onAssignRep={onAssignRep}
                />
              )}
            </div>

            {/* Proposal count */}
            {item.proposalCount > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <FileTextIcon size={11} />
                <span>
                  {item.proposalCount}
                  {' '}
                  {item.proposalCount === 1 ? 'proposal' : 'proposals'}
                </span>
              </div>
            )}

            {/* Scheduled for badge (bottom of meeting group) */}
            {meetingLabel && (
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
            )}
          </div>
        )}

        {/* ── Pipeline value (if any) ── */}
        {item.totalPipelineValue > 0 && (
          <div className="flex items-center gap-0.5 text-xs font-semibold text-green-700 dark:text-green-400 px-0.5">
            <DollarSignIcon size={12} />
            {formatAsDollars(item.totalPipelineValue)}
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
  )

  if (canManagePipeline && onMoveToPipeline && !isDragOverlay) {
    return (
      <ContextMenu>
        <ContextMenuTrigger asChild>
          {cardContent}
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuSub>
            <ContextMenuSubTrigger>Move to Pipeline</ContextMenuSubTrigger>
            <ContextMenuSubContent>
              {otherPipelines.map(p => (
                <ContextMenuItem
                  key={p}
                  onClick={() => onMoveToPipeline(item.id, p)}
                >
                  {PIPELINE_LABELS[p]}
                </ContextMenuItem>
              ))}
            </ContextMenuSubContent>
          </ContextMenuSub>
        </ContextMenuContent>
      </ContextMenu>
    )
  }

  return cardContent
}

/* ── Sub-components ── */

function CustomerMoreMenu({ item, ability, canManagePipeline, otherPipelines, onViewProfile, onCreateMeeting, onMoveToPipeline, onDeleteCustomer }: {
  item: CustomerPipelineItem
  ability: ReturnType<typeof useAbility>
  canManagePipeline?: boolean
  otherPipelines: CustomerPipeline[]
  onViewProfile: (id: string) => void
  onCreateMeeting?: (id: string) => void
  onMoveToPipeline?: (id: string, p: CustomerPipeline) => void
  onDeleteCustomer?: (id: string) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="shrink-0 p-0.5 rounded-sm hover:bg-background/80 transition-colors cursor-pointer"
          onClick={e => e.stopPropagation()}
        >
          <MoreVerticalIcon size={14} className="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem onClick={() => onViewProfile(item.id)}>
          <UserIcon size={14} />
          View Profile
        </DropdownMenuItem>
        {ability.can('create', 'Meeting') && onCreateMeeting && (
          <DropdownMenuItem onClick={() => onCreateMeeting(item.id)}>
            <CalendarIcon size={14} />
            Schedule Meeting
          </DropdownMenuItem>
        )}
        {canManagePipeline && onMoveToPipeline && otherPipelines.length > 0 && (
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to Pipeline</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {otherPipelines.map(p => (
                <DropdownMenuItem key={p} onClick={() => onMoveToPipeline(item.id, p)}>
                  {PIPELINE_LABELS[p]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        )}
        {ability.can('delete', 'Customer') && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => {
                if (onDeleteCustomer) {
                  onDeleteCustomer(item.id)
                }
                else {
                  toast.info('Delete customer is not yet implemented')
                }
              }}
            >
              <Trash2Icon size={14} />
              Delete Customer
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function MeetingMoreMenu({ item, ability, onAssignRep }: {
  item: CustomerPipelineItem
  ability: ReturnType<typeof useAbility>
  onAssignRep?: (meetingId: string, currentRepId: string | null) => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="shrink-0 p-0.5 rounded-sm hover:bg-background/80 transition-colors cursor-pointer"
          onClick={e => e.stopPropagation()}
        >
          <MoreHorizontalIcon size={14} className="text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        {ability.can('read', 'Meeting') && (
          <DropdownMenuItem asChild>
            <a href={`${ROOTS.dashboard.meetings()}/${item.nextMeetingId}`}>
              <ExternalLinkIcon size={14} />
              Open Meeting
            </a>
          </DropdownMenuItem>
        )}
        {ability.can('assign', 'Meeting') && onAssignRep && item.nextMeetingId && (
          <DropdownMenuItem
            onClick={() => onAssignRep(item.nextMeetingId!, item.assignedRep?.id ?? null)}
          >
            <UserRoundPenIcon size={14} />
            Assign Rep
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
