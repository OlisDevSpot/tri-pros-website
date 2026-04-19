'use client'

import { useQuery } from '@tanstack/react-query'
import { Lock, Settings2 } from 'lucide-react'
import { useState } from 'react'

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandList,
} from '@/shared/components/ui/command'
import { useParticipantMutations } from '@/shared/entities/meetings/hooks/use-participant-mutations'
import { useTRPC } from '@/trpc/helpers'

import { AvailableParticipantRow } from './available-participant-row'
import { CurrentParticipantRow } from './current-participant-row'

interface ParticipantPickerContentProps {
  meetingId: string
  /** Called when user clicks the manage-participants link in the footer. */
  onOpenManageModal: () => void
}

export function ParticipantPickerContent({ meetingId, onOpenManageModal }: ParticipantPickerContentProps) {
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

  const helperCount = participants.filter(p => p.role === 'helper').length
  const slotsFull = !!owner && !!coOwner

  // "Available" candidates: internal users not already in the meeting
  const assignedUserIds = new Set(participants.map(p => p.userId))
  const available = (internalUsersQuery.data ?? []).filter(u => !assignedUserIds.has(u.id))

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
              name={owner.userName ?? 'Unknown'}
              email={owner.userEmail}
              image={owner.userImage}
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
              name={coOwner.userName ?? 'Unknown'}
              email={coOwner.userEmail}
              image={coOwner.userImage}
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

      {/* Search + results — only when there's an open slot.
          When both slots are filled, helpers must be added via the modal. */}
      {slotsFull
        ? (
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
          )
        : (
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
                        Use Manage Participants for full controls.
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
                              name={u.name ?? u.email ?? 'Unknown'}
                              email={u.email}
                              image={u.image}
                              inferredRole={owner ? 'co_owner' : 'owner'}
                              // Disable ALL Add buttons whenever any add is in-flight,
                              // so two near-simultaneous clicks on different rows can't
                              // race past the slot-uniqueness guards.
                              disabled={addMutation.isPending}
                              isPending={pendingUserId === u.id}
                              onAdd={() => add(u.id, owner ? 'co_owner' : 'owner')}
                            />
                          ))}
                        </CommandGroup>
                      </>
                    )}
              </CommandList>
            </>
          )}

      {/* Footer */}
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
    </Command>
  )
}
