'use client'

import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { Modal } from '@/shared/components/dialogs/modals/base-modal'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useParticipantMutations } from '@/shared/entities/meetings/hooks/use-participant-mutations'
import { useTRPC } from '@/trpc/helpers'

import { AddParticipantRow } from './add-participant-row'
import { ParticipantsList } from './participants-list'

interface ManageParticipantsModalProps {
  meetingIds: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

/**
 * Full participant management. Used as a fallback from the inline picker for
 * helper management, and as the dropdown-action target ("Manage participants…").
 *
 * v1: bulk mode iterates manageParticipants per meeting client-side, with
 * per-meeting optimistic cache updates handled by useParticipantMutations.
 */
export function ManageParticipantsModal({
  meetingIds,
  open,
  onOpenChange,
  onSuccess,
}: ManageParticipantsModalProps) {
  const trpc = useTRPC()
  const [search, setSearch] = useState('')

  // For v1 single-meeting fast path. Bulk mode reads first meeting's participants for display reference.
  const primaryMeetingId = meetingIds[0] ?? ''

  const participantsQuery = useQuery({
    ...trpc.meetingsRouter.getParticipants.queryOptions({ meetingId: primaryMeetingId }),
    enabled: open && meetingIds.length === 1 && primaryMeetingId !== '',
  })

  const internalUsersQuery = useQuery({
    ...trpc.meetingsRouter.getInternalUsers.queryOptions(),
    enabled: open,
  })

  // Shared optimistic mutations. The hook owns pendingUserId tracking, cache
  // snapshot/rollback, and per-meeting participants invalidation. `silent: true`
  // suppresses the per-mutation toast so applyToAll can emit a single bulk
  // summary toast instead.
  const { pendingUserId, addMutation, removeMutation, changeRoleMutation } = useParticipantMutations({ silent: true })

  async function applyToAll(
    action: 'add' | 'change_role' | 'remove',
    userId: string,
    role?: 'co_owner' | 'helper' | 'owner',
  ) {
    const total = meetingIds.length
    const results = await Promise.allSettled(
      meetingIds.map((meetingId) => {
        if (action === 'add') {
          return addMutation.mutateAsync({ action: 'add', meetingId, role, userId })
        }
        if (action === 'remove') {
          return removeMutation.mutateAsync({ action: 'remove', meetingId, userId })
        }
        return changeRoleMutation.mutateAsync({ action: 'change_role', meetingId, role, userId })
      }),
    )

    const failures = results
      .map((r, i) => ({ meetingId: meetingIds[i] ?? '', result: r }))
      .filter((r): r is { meetingId: string, result: PromiseRejectedResult } =>
        r.result.status === 'rejected',
      )
    const succeededCount = total - failures.length
    const isBulk = total > 1

    if (failures.length === 0) {
      if (isBulk) {
        toast.success(`Updated participant in ${total} meetings`)
      }
      onSuccess?.()
      return
    }

    // Pick the most representative error message for the summary.
    const firstError = failures[0]?.result.reason
    const errorMessage
      = firstError instanceof Error && firstError.message
        ? firstError.message
        : 'Couldn\'t update participant'

    if (succeededCount === 0) {
      if (isBulk) {
        toast.error(`Failed to update participant in all ${total} meetings: ${errorMessage}`)
      }
      else {
        toast.error(errorMessage)
      }
      return
    }

    toast.warning(
      `Updated ${succeededCount} of ${total} meetings. ${failures.length} failed: ${errorMessage}`,
    )
    // Treat partial success like success for closing — preserves prior behavior
    // where any successful mutation triggered onSuccess.
    onSuccess?.()
  }

  const participants = participantsQuery.data ?? []
  const owner = participants.find(p => p.role === 'owner')
  const coOwner = participants.find(p => p.role === 'co_owner')
  const assignedIds = new Set(participants.map(p => p.userId))

  const available = (internalUsersQuery.data ?? []).filter((u) => {
    if (assignedIds.has(u.id)) {
      return false
    }

    if (!search) {
      return true
    }

    const q = search.toLowerCase()
    return (u.name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q)
  })

  const isMulti = meetingIds.length > 1

  return (
    <Modal
      close={() => onOpenChange(false)}
      description={
        isMulti
          ? 'Changes apply to every selected meeting.'
          : 'Add, remove, or change roles for this meeting\'s participants.'
      }
      isOpen={open}
      title={isMulti ? `Manage participants — ${meetingIds.length} meetings` : 'Manage participants'}
    >
      <div className="w-full space-y-5">
        {!isMulti && (
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Current participants
            </Label>
            <ParticipantsList
              isLastOwner={userId =>
                owner?.userId === userId
                && participants.filter(p => p.role === 'owner').length === 1}
              pendingUserId={pendingUserId}
              rows={participants.map(p => ({
                email: p.userEmail,
                image: p.userImage,
                name: p.userName ?? 'Unknown',
                role: p.role,
                userId: p.userId,
              }))}
              onRemove={userId => applyToAll('remove', userId)}
              onRoleChange={(userId, newRole) => applyToAll('change_role', userId, newRole)}
            />
          </section>
        )}

        <section className="space-y-2">
          <Label
            className="text-xs uppercase tracking-wide text-muted-foreground"
            htmlFor="manage-search"
          >
            Add a participant
          </Label>
          <Input
            id="manage-search"
            placeholder="Search team…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {internalUsersQuery.error && (
              <p className="py-3 text-center text-sm text-muted-foreground">
                You don&apos;t have permission to add participants.
              </p>
            )}
            {!internalUsersQuery.error && available.length === 0 && (
              <p className="py-3 text-center text-sm text-muted-foreground">
                {search ? `No team members match "${search}"` : 'No team members available'}
              </p>
            )}
            {!internalUsersQuery.error
              && available.map(u => (
                <AddParticipantRow
                  key={u.id}
                  coOwnerSlotFilled={!!coOwner}
                  email={u.email}
                  image={u.image}
                  isPending={pendingUserId === u.id}
                  // Disable ALL Add buttons whenever any add is in-flight, so
                  // two near-simultaneous clicks on different rows can't race
                  // past the slot-uniqueness guards. The bulk applyToAll uses
                  // mutateAsync so isPending stays true for the entire bulk run.
                  disabled={addMutation.isPending}
                  name={u.name ?? u.email ?? 'Unknown'}
                  ownerSlotFilled={!!owner}
                  onAdd={role => applyToAll('add', u.id, role)}
                />
              ))}
          </div>
        </section>
      </div>
    </Modal>
  )
}
