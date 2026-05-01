'use client'

import type { MeetingParticipantRole } from '@/shared/constants/enums'
import type { UserOverviewCardUser } from '@/shared/entities/users/components/overview-card'

import { useQuery } from '@tanstack/react-query'
import { CrownIcon, MailIcon, MessageSquareIcon, MoreHorizontalIcon, PhoneIcon, UserMinusIcon, UsersIcon } from 'lucide-react'
import { useState } from 'react'

import { EntityList } from '@/shared/components/entity-list/ui/entity-list'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
import { PARTICIPANT_ROLE_SORT_ORDER } from '@/shared/entities/meetings/constants/participants'
import { useParticipantMutations } from '@/shared/entities/meetings/hooks/use-participant-mutations'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ParticipantLite {
  id: string
  name: string | null
  image: string | null
  role: MeetingParticipantRole
}

interface ParticipantsSlotProps {
  meetingId: string
  variant: 'full' | 'compact'
  /**
   * Optional pre-fetched summary (from `meetingsRouter.list`). When present,
   * the compact variant renders its avatar stack from this without hitting
   * `getParticipants` — the detail query runs lazily only when the popover
   * opens. Full variant always fetches detail (needs email for contact actions).
   */
  initialParticipants?: ParticipantLite[]
  /**
   * Passed to the underlying `EntityList` for the `full` variant. Use `flush`
   * when this slot is rendered inside a parent card that already owns surface
   * chrome. Default: `card`.
   */
  entityListVariant?: 'card' | 'flush'
  className?: string
}

interface ParticipantUserCard extends UserOverviewCardUser {
  role: MeetingParticipantRole
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

function sortParticipants<T extends { role: MeetingParticipantRole, name: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const roleDiff = PARTICIPANT_ROLE_SORT_ORDER[a.role] - PARTICIPANT_ROLE_SORT_ORDER[b.role]
    if (roleDiff !== 0) {
      return roleDiff
    }
    return (a.name ?? '').localeCompare(b.name ?? '')
  })
}

function useMeetingParticipants(meetingId: string, enabled: boolean) {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery({
    ...trpc.meetingsRouter.getParticipants.queryOptions({ meetingId }),
    enabled,
  })

  const participants: ParticipantUserCard[] = sortParticipants(
    (data ?? []).map(p => ({
      id: p.userId,
      name: p.userName,
      image: p.userImage,
      email: p.userEmail,
      role: p.role,
    })),
  )

  return { participants, isLoading }
}

// ── Root dispatcher ────────────────────────────────────────────────────────────

export function ParticipantsSlot({ meetingId, variant, initialParticipants, entityListVariant = 'card', className }: ParticipantsSlotProps) {
  if (variant === 'compact') {
    return (
      <CompactVariant
        meetingId={meetingId}
        initialParticipants={initialParticipants}
        className={className}
      />
    )
  }

  return (
    <FullVariant
      meetingId={meetingId}
      entityListVariant={entityListVariant}
      className={className}
    />
  )
}

// ── Full variant ───────────────────────────────────────────────────────────────

interface FullVariantProps {
  meetingId: string
  entityListVariant?: 'card' | 'flush'
  className?: string
}

function FullVariant({ meetingId, entityListVariant = 'card', className }: FullVariantProps) {
  const ability = useAbility()
  const canManage = ability.can('assign', 'Meeting')
  const [manageOpen, setManageOpen] = useState(false)
  const { participants, isLoading } = useMeetingParticipants(meetingId, true)

  return (
    <>
      <EntityList
        title="Participants"
        icon={UsersIcon}
        items={participants}
        getItemKey={p => p.id}
        isLoading={isLoading}
        renderItem={p => <ParticipantInlineRow meetingId={meetingId} participant={p} />}
        variant={entityListVariant}
        headerAction={canManage && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-5 px-1.5 text-[10px] font-medium uppercase tracking-wide"
            onClick={() => setManageOpen(true)}
          >
            Manage
          </Button>
        )}
        emptyState={{
          message: 'No participants yet.',
          action: canManage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setManageOpen(true)}
            >
              Add participant
            </Button>
          ),
        }}
        className={className}
      />
      {canManage && (
        <ManageParticipantsModal
          meetingIds={[meetingId]}
          open={manageOpen}
          onOpenChange={setManageOpen}
        />
      )}
    </>
  )
}

// ── Shared inline row ──────────────────────────────────────────────────────────

/**
 * Compact single-line row: avatar + name + role indicator + actions dropdown.
 * Role badge sits just before the action menu (trailing-state convention) so
 * the dense right cluster reads "[role] [...]". Avoids sandwiching the badge
 * between name and actions where it competes visually.
 * Matches ProposalOverviewCard's `DefaultProposalRow` typography + density so
 * Participants and Proposals look visually uniform side-by-side.
 */
function ParticipantInlineRow({ meetingId, participant }: { meetingId: string, participant: ParticipantUserCard }) {
  return (
    <UserOverviewCard
      user={participant}
      meta={{ role: participant.role }}
      className="flex items-center gap-2 text-xs py-0.5"
    >
      <UserOverviewCard.Avatar size="xs" />
      <UserOverviewCard.Name className="truncate flex-1" />
      <UserOverviewCard.Role className="shrink-0" />
      <ParticipantActionsMenu meetingId={meetingId} participant={participant} />
    </UserOverviewCard>
  )
}

function ParticipantActionsMenu({
  meetingId,
  participant,
  className,
}: {
  meetingId: string
  participant: ParticipantUserCard
  className?: string
}) {
  const ability = useAbility()
  const canManage = ability.can('assign', 'Meeting')
  const { promoteToOwner, remove, pendingUserId } = useParticipantMutations({ meetingId })

  const hasEmail = !!participant.email
  const hasPhone = !!participant.phone
  const canPromote = canManage && participant.role !== 'owner'
  const isPending = pendingUserId === participant.id

  // Hide the menu entirely only when there's literally nothing actionable —
  // no contact methods AND no management permission.
  if (!hasEmail && !hasPhone && !canManage) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            className,
          )}
          aria-label={`Actions for ${participant.name ?? 'participant'}`}
          onClick={e => e.stopPropagation()}
          disabled={isPending}
        >
          <MoreHorizontalIcon className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {hasPhone && (
          <DropdownMenuItem asChild>
            <a href={`tel:${participant.phone}`}>
              <PhoneIcon className="size-3.5" />
              Call
            </a>
          </DropdownMenuItem>
        )}
        {hasPhone && (
          <DropdownMenuItem asChild>
            <a href={`sms:${participant.phone}`}>
              <MessageSquareIcon className="size-3.5" />
              Text
            </a>
          </DropdownMenuItem>
        )}
        {hasEmail && (
          <DropdownMenuItem asChild>
            <a href={`mailto:${participant.email}`}>
              <MailIcon className="size-3.5" />
              Email
            </a>
          </DropdownMenuItem>
        )}
        {canManage && (hasEmail || hasPhone) && <DropdownMenuSeparator />}
        {canPromote && (
          <DropdownMenuItem onClick={() => promoteToOwner(participant.id)}>
            <CrownIcon className="size-3.5" />
            Make primary owner
          </DropdownMenuItem>
        )}
        {canManage && (
          <DropdownMenuItem
            variant="destructive"
            onClick={() => remove(participant.id)}
          >
            <UserMinusIcon className="size-3.5" />
            Remove from meeting
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ── Compact variant ────────────────────────────────────────────────────────────

interface CompactVariantProps {
  meetingId: string
  initialParticipants?: ParticipantLite[]
  className?: string
}

/**
 * Inline "[stacked avatars] Oliver / Sean" — clickable to open a detail
 * popover. Rendered inside schedule meeting cards where vertical space is
 * tight but participant awareness is critical (swimlane combos, overlapping
 * co-ownership). Stable per-user colors let reps recognize themselves at a
 * glance across the week view.
 */
function CompactVariant({ meetingId, initialParticipants, className }: CompactVariantProps) {
  const ability = useAbility()
  const canManage = ability.can('assign', 'Meeting')
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [manageOpen, setManageOpen] = useState(false)

  const shouldFetch = popoverOpen || !initialParticipants
  const { participants: fetched } = useMeetingParticipants(meetingId, shouldFetch)

  const thumbnail: ParticipantLite[] = fetched.length > 0
    ? fetched.map(p => ({ id: p.id, name: p.name, image: p.image, role: p.role }))
    : (initialParticipants ? sortParticipants([...initialParticipants]) : [])

  if (thumbnail.length === 0) {
    return null
  }

  const stackUsers: UserOverviewCardUser[] = thumbnail.map(p => ({
    id: p.id,
    name: p.name,
    image: p.image,
  }))

  return (
    <>
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-1 py-0.5 -mx-1 hover:bg-accent/50 transition-colors min-w-0',
              className,
            )}
            aria-label={`Participants: ${thumbnail.map(p => p.name ?? 'Unknown').join(', ')}`}
            onClick={e => e.stopPropagation()}
          >
            <UserOverviewCard.InlineList users={stackUsers} separator="/" size="xs" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-64 p-0"
          onClick={e => e.stopPropagation()}
        >
          <EntityList
            title="Participants"
            icon={UsersIcon}
            items={fetched}
            getItemKey={p => p.id}
            isLoading={fetched.length === 0}
            renderItem={p => <ParticipantInlineRow meetingId={meetingId} participant={p} />}
            headerAction={canManage && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] font-medium uppercase tracking-wide"
                onClick={() => {
                  setPopoverOpen(false)
                  setManageOpen(true)
                }}
              >
                Manage
              </Button>
            )}
            itemsClassName="max-h-64 overflow-y-auto"
            className="border-0 rounded-none shadow-none"
          />
        </PopoverContent>
      </Popover>
      {canManage && (
        <ManageParticipantsModal
          meetingIds={[meetingId]}
          open={manageOpen}
          onOpenChange={setManageOpen}
        />
      )}
    </>
  )
}
