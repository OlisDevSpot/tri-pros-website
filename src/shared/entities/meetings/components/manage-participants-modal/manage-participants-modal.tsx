'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { Modal } from '@/shared/components/dialogs/modals/base-modal'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
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
 * v1: bulk mode iterates manageParticipants per meeting client-side.
 */
export function ManageParticipantsModal({
  meetingIds,
  open,
  onOpenChange,
  onSuccess,
}: ManageParticipantsModalProps) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { invalidateMeeting } = useInvalidation()
  const [search, setSearch] = useState('')
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

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

  const mutation = useMutation(
    trpc.meetingsRouter.manageParticipants.mutationOptions({
      onError: (err) => {
        toast.error(err.message || 'Couldn\'t update participant')
      },
      onMutate: ({ userId }) => {
        setPendingUserId(userId)
      },
      onSuccess: () => {
        onSuccess?.()
      },
      onSettled: () => {
        setPendingUserId(null)
        if (meetingIds.length === 1) {
          void qc.invalidateQueries(
            trpc.meetingsRouter.getParticipants.queryOptions({ meetingId: primaryMeetingId }),
          )
        }
        invalidateMeeting()
      },
    }),
  )

  function applyToAll(
    action: 'add' | 'change_role' | 'remove',
    userId: string,
    role?: 'co_owner' | 'helper' | 'owner',
  ) {
    for (const meetingId of meetingIds) {
      mutation.mutate({ action, meetingId, role, userId })
    }
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
