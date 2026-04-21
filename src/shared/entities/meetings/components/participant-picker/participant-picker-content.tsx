'use client'

import { useQuery } from '@tanstack/react-query'
import { Loader2, Settings2, X } from 'lucide-react'
import { useId, useState } from 'react'

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
   * 'picker' (default): compact popover used from the meeting's inline
   * participants control (e.g. the meetings table column). Shows owner +
   * co-owner slots. When both are filled, the search is replaced by a
   * redirect to the full modal; a footer "Manage participants" link is
   * always available.
   * 'modal': embedded in ManageParticipantsModal. The search stays open,
   * inferred role falls through to 'helper' when slots are full, a Helpers
   * section appears, and the footer link is suppressed.
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
  const lockHintId = useId()

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

  const assignedUserIds = new Set(participants.map(p => p.userId))
  const available = (internalUsersQuery.data ?? []).filter(u => !assignedUserIds.has(u.id))

  // Role inference differs per variant:
  // - picker: owner → co_owner, then blocked (helpers only via modal).
  // - modal: owner → co_owner → helper, no block.
  const inferredAddRole: 'owner' | 'co_owner' | 'helper'
    = !owner ? 'owner' : !coOwner ? 'co_owner' : 'helper'
  const searchOpen = isModal || !slotsFull

  return (
    <Command
      className={cn(
        'w-full bg-transparent',
        // Contain touch scrolls inside the modal so overscroll doesn't bleed to
        // the underlying page. `touch-action: manipulation` removes the legacy
        // 300ms tap delay on older mobile browsers.
        isModal && 'overscroll-contain touch-manipulation',
      )}
      shouldFilter={true}
    >
      {/* Current section — one of two primary regions. Flat surface, no nested
          card wrapper. Spacing + typography establish hierarchy. */}
      <section
        aria-label="Current participants"
        className={cn(
          // Announce cache mutations (add / remove / promote) politely so
          // assistive tech picks up the role change without stealing focus.
          'contents',
        )}
      >
        <div className="flex items-baseline justify-between px-1 pb-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground tabular-nums">
            {`Current · ${(owner ? 1 : 0) + (coOwner ? 1 : 0)} of 2`}
          </h3>
        </div>
        <div aria-live="polite" className="space-y-2">
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
              removeDisabledHintId={!coOwner ? lockHintId : undefined}
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
            <p className="rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
              No one assigned. Search below to pick an owner.
            </p>
          )}
        </div>
        {owner && !coOwner && (
          <p
            id={lockHintId}
            className="mt-3 px-1 text-[11px] leading-relaxed text-muted-foreground"
          >
            Add a co-owner below to make this owner removable.
          </p>
        )}
      </section>

      {/* Helpers section — modal variant only. Animates in via grid-template-rows
          so content mounts/unmounts without layout jump. */}
      {isModal && (
        <div
          data-helpers-open={helperCount > 0}
          className="grid grid-rows-[0fr] motion-safe:transition-[grid-template-rows] motion-safe:duration-200 ease-out data-[helpers-open=true]:grid-rows-[1fr]"
        >
          <section aria-label="Helpers" className="overflow-hidden">
            <div className="pt-5">
              <div className="flex items-baseline justify-between px-1 pb-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground tabular-nums">
                  {`Helpers · ${helperCount}`}
                </h3>
              </div>
              <div aria-live="polite" className="space-y-2">
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
          </section>
        </div>
      )}

      {/* Search + available list — open in modal variant always; in picker
          variant, closed when both slots are filled (helpers via modal). */}
      {searchOpen
        ? (
            <section aria-label="Add participant" className="mt-5 space-y-2">
              <label
                htmlFor="participant-search"
                className="block px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
              >
                Add participant
              </label>
              <CommandInput
                id="participant-search"
                placeholder="Search team by name or email…"
                value={search}
                onValueChange={setSearch}
                aria-label="Search team to add participants"
                autoComplete="off"
                spellCheck={false}
              />
              <CommandList className="max-h-72">
                {internalUsersQuery.error
                  ? (
                      <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                        You don’t have permission to add participants here.
                        {!isModal && ' Use Manage Participants for full controls.'}
                      </p>
                    )
                  : (
                      <>
                        <CommandEmpty>
                          No team members match
                          {' '}
                          <span className="font-medium">{`“${search}”`}</span>
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
            </section>
          )
        : (
            <p className="mt-5 rounded-lg border border-dashed border-border/60 px-3 py-4 text-center text-xs text-muted-foreground">
              Both slots are filled.
              {' '}
              <button
                type="button"
                onClick={onOpenManageModal}
                className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
              >
                Manage participants
              </button>
              {' '}
              to add helpers.
            </p>
          )}

      {/* Footer — picker variant only. In modal variant the caller provides
          its own chrome. */}
      {!isModal && (
        <div className="mt-3 flex items-center justify-between border-t border-border/60 px-1 pt-3">
          <span className="text-xs text-muted-foreground tabular-nums">
            {helperCount > 0 ? `+ ${helperCount} helper${helperCount === 1 ? '' : 's'}` : 'No helpers'}
          </span>
          <button
            type="button"
            onClick={onOpenManageModal}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-foreground/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:transition-colors"
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
// semantics, so CurrentParticipantRow (owner/co_owner only) doesn't apply.
// Kept inline to avoid a single-use sibling component file.
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
        'group/row flex items-center gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2.5 focus-within:ring-1 focus-within:ring-ring/60',
        isPending && 'pointer-events-none opacity-60',
      )}
    >
      <UserOverviewCard.Avatar size="sm" className="size-8" />
      <div className="flex min-w-0 flex-1 flex-col gap-px overflow-hidden">
        <UserOverviewCard.Name className="truncate text-sm font-medium text-foreground" />
        <div className="truncate text-xs text-muted-foreground">
          <span className="font-medium text-foreground/70">Helper</span>
          {user.email != null && user.email !== '' && (
            <>
              <span aria-hidden="true" className="mx-1.5 text-muted-foreground/50">·</span>
              <span>{user.email}</span>
            </>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onRemove}
        disabled={isPending}
        aria-label={`Remove ${name} from this meeting`}
        className="inline-flex size-11 items-center justify-center rounded-md text-destructive/60 hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:transition-colors"
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />}
      </button>
    </UserOverviewCard>
  )
}
