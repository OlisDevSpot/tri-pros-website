'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, Lock, Settings2, X } from 'lucide-react'
import { useState } from 'react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from '@/shared/components/ui/command'
import { useParticipantMutations } from '@/shared/entities/meetings/hooks/use-participant-mutations'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

import { AvailableParticipantRow } from './available-participant-row'
import { CurrentParticipantRow } from './current-participant-row'

interface ParticipantPickerContentProps {
  meetingId: string
  /**
   * 'picker' (default): compact popover used from the meeting actions submenu.
   *   - Owner + co-owner slots only. When both are filled, search is replaced
   *     with a "Both slots filled → Manage participants" redirect.
   *   - Footer exposes a "Manage participants" link that opens the full modal.
   * 'modal': embedded directly in the ManageParticipantsModal.
   *   - Shows a Helpers section.
   *   - When both slots are filled, the search list stays open and new adds
   *     go in as helpers (no redirect).
   *   - No footer link (we ARE the modal).
   */
  variant?: 'picker' | 'modal'
  /** Required in 'picker' variant; unused in 'modal' variant. */
  onOpenManageModal?: () => void
}

export function ParticipantPickerContent({
  meetingId,
  variant = 'picker',
  onOpenManageModal,
}: ParticipantPickerContentProps) {
  const isModal = variant === 'modal'
  const trpc = useTRPC()
  const [search, setSearch] = useState('')

  const participantsQuery = useQuery(
    trpc.meetingsRouter.getParticipants.queryOptions({ meetingId }),
  )
  const internalUsersQuery = useQuery(
    trpc.meetingsRouter.getInternalUsers.queryOptions(),
  )

  const { pendingUserId, addMutation, add, remove, promoteToOwner } = useParticipantMutations({ meetingId })

  const participants = participantsQuery.data ?? []

  // Filter out optimistic placeholder rows (userName === '') to avoid a flash of empty text
  // while the add mutation is in-flight and the cache hasn't been refetched yet.
  const owner = participants.find(p => p.role === 'owner' && p.userName !== '') ?? null
  const coOwner = participants.find(p => p.role === 'co_owner' && p.userName !== '') ?? null

  const helpers = participants.filter(p => p.role === 'helper' && p.userName !== '')
  const helperCount = helpers.length
  const slotsFull = !!owner && !!coOwner

  // "Available" candidates: internal users not already in the meeting
  const assignedUserIds = new Set(participants.map(p => p.userId))
  const available = (internalUsersQuery.data ?? []).filter(u => !assignedUserIds.has(u.id))

  // Role inference differs per variant:
  // - picker: owner first, then co_owner. Blocked when slots full.
  // - modal: owner → co_owner → helper (falls through past full slots).
  const inferredAddRole: 'owner' | 'co_owner' | 'helper'
    = !owner ? 'owner' : !coOwner ? 'co_owner' : 'helper'
  const searchOpen = isModal || !slotsFull

  return (
    <Command className="w-full" shouldFilter={true}>
      {/* Current section — static layout, not part of the searchable list */}
      <div className="border-b border-border bg-muted/40 p-2">
        <div className="flex items-center justify-between px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground tabular-nums">
          <span>{`Current · ${(owner ? 1 : 0) + (coOwner ? 1 : 0)} of 2 max`}</span>
        </div>
        <div className="space-y-1">
          {owner && (
            <CurrentParticipantRow
              user={{
                id: owner.userId,
                name: owner.userName,
                image: owner.userImage,
                email: owner.userEmail,
              }}
              role="owner"
              removeDisabled={!coOwner}
              removeDisabledReason={!coOwner ? 'Add a co-owner first to promote' : undefined}
              removeTooltip={coOwner ? 'Removes owner and promotes co-owner' : undefined}
              isPending={pendingUserId === owner.userId}
              onPromote={() => {}}
              onRemove={() => remove(owner.userId)}
            />
          )}
          {coOwner && (
            <CurrentParticipantRow
              user={{
                id: coOwner.userId,
                name: coOwner.userName,
                image: coOwner.userImage,
                email: coOwner.userEmail,
              }}
              role="co_owner"
              removeDisabled={false}
              isPending={pendingUserId === coOwner.userId}
              onPromote={() => promoteToOwner(coOwner.userId)}
              onRemove={() => remove(coOwner.userId)}
            />
          )}
          {!owner && !coOwner && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">
              No one assigned yet — search below to add.
            </p>
          )}
        </div>
        {owner && coOwner == null && (
          <p className="mt-1.5 flex items-center gap-1 px-1 text-[11px] text-muted-foreground">
            <Lock aria-hidden="true" className="size-3" />
            Owner can only be removed once a co-owner is added.
          </p>
        )}
      </div>

      {/* Helpers section — modal variant only. Sits between the slots and the
          search so helpers have a visible, removable presence. */}
      {isModal && helperCount > 0 && (
        <div className="border-b border-border p-2">
          <div className="flex items-center justify-between px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground tabular-nums">
            <span>{`Helpers · ${helperCount}`}</span>
          </div>
          <div className="space-y-1">
            {helpers.map(h => (
              <HelperRow
                key={h.userId}
                user={{
                  id: h.userId,
                  name: h.userName,
                  image: h.userImage,
                  email: h.userEmail,
                }}
                isPending={pendingUserId === h.userId}
                onRemove={() => remove(h.userId)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Search + results — open in modal variant always; in picker variant,
          closed when both slots are filled (helpers must be added via modal). */}
      {searchOpen
        ? (
            <>
              <CommandInput
                placeholder="Search team to add…"
                value={search}
                onValueChange={setSearch}
                aria-label="Search team to add participants"
              />
              <CommandList>
                {internalUsersQuery.error
                  ? (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                        You don't have permission to add participants here.
                        {' '}
                        {!isModal && 'Use Manage Participants for full controls.'}
                      </p>
                    )
                  : (
                      <>
                        <CommandEmpty>
                          No team members match
                          {' '}
                          <span className="font-medium">{`"${search}"`}</span>
                          .
                        </CommandEmpty>
                        <CommandGroup>
                          {available.map(u => (
                            <AvailableParticipantRow
                              key={u.id}
                              user={{
                                id: u.id,
                                name: u.name,
                                image: u.image,
                                email: u.email,
                              }}
                              inferredRole={inferredAddRole}
                              // Disable ALL Add buttons whenever any add is in-flight,
                              // so two near-simultaneous clicks on different rows can't
                              // race past the slot-uniqueness guards.
                              disabled={addMutation.isPending}
                              isPending={pendingUserId === u.id}
                              onAdd={() => add(u.id, inferredAddRole)}
                            />
                          ))}
                        </CommandGroup>
                      </>
                    )}
              </CommandList>
            </>
          )
        : (
            <p className="px-3 py-3 text-center text-xs text-muted-foreground">
              Both slots filled.
              {' '}
              <button
                type="button"
                onClick={onOpenManageModal}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Manage participants
              </button>
              {' '}
              to add helpers.
            </p>
          )}

      {/* Footer — picker variant only. In modal variant the caller provides
          its own chrome and we skip the redundant "Manage participants" link. */}
      {!isModal && (
        <div className="flex items-center justify-between border-t border-border bg-muted/40 px-3 py-2">
          <span className="text-xs text-muted-foreground tabular-nums">
            {helperCount > 0 ? `+ ${helperCount} helper${helperCount === 1 ? '' : 's'}` : 'No helpers'}
          </span>
          <button
            type="button"
            onClick={onOpenManageModal}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Settings2 className="size-3.5" />
            Manage participants
          </button>
        </div>
      )}
    </Command>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers row — modal-variant only. Helpers have no slot-uniqueness or promote
// semantics, so the picker's `CurrentParticipantRow` (owner/co_owner only)
// doesn't apply. Kept inline to avoid a single-use sibling component.
// ─────────────────────────────────────────────────────────────────────────────

interface HelperRowProps {
  user: { id: string, name: string | null, image: string | null, email: string | null }
  isPending: boolean
  onRemove: () => void
}

function HelperRow({ user, isPending, onRemove }: HelperRowProps) {
  const name = user.name ?? 'Unknown'
  return (
    <UserOverviewCard
      user={user}
      meta={{ role: 'helper' }}
      className={cn(
        'flex items-center gap-2 rounded-md border border-border bg-card p-2',
        isPending && 'pointer-events-none opacity-60',
      )}
    >
      <UserOverviewCard.Avatar size="sm" className="size-6" />
      <div className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden">
        <UserOverviewCard.Name className="text-sm font-medium text-foreground" />
        <div className="truncate text-xs text-muted-foreground">
          <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Helper
          </span>
          {user.email}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={isPending}
        aria-label={`Remove ${name} from this meeting`}
        className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:transition-colors"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
      </button>
    </UserOverviewCard>
  )
}
