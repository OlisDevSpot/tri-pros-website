'use client'

import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

import type { AppRouter } from '@/trpc/routers/app'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

type ParticipantsCache = inferRouterOutputs<AppRouter>['meetingsRouter']['getParticipants']
type ManageParticipantsInput = inferRouterInputs<AppRouter>['meetingsRouter']['manageParticipants']
type ParticipantRole = 'co_owner' | 'helper' | 'owner'

interface UseParticipantMutationsArgs {
  /**
   * Optional default meetingId for callers that always operate on a single meeting
   * (e.g. the inline picker). Bulk callers (e.g. the modal) can omit this and pass
   * `meetingId` per-mutation instead.
   */
  meetingId?: string
  /**
   * Suppress the per-mutation error toast. Set this when the caller aggregates
   * results across multiple meetings (e.g. the modal's bulk apply) and emits its
   * own summary toast. Defaults to false — the picker relies on the per-mutation toast.
   */
  silent?: boolean
}

interface MutationContext {
  previous: ParticipantsCache | undefined
  meetingId: string
}

/**
 * Generalized participant mutations hook used by both the inline ParticipantPicker
 * and the ManageParticipantsModal. Handles optimistic updates for the per-meeting
 * `getParticipants` cache so the UI updates instantly while the server call runs.
 *
 * The optimistic update for `changeRoleMutation` mirrors the server semantics in
 * `meetingsRouter.manageParticipants` (see src/trpc/routers/meetings.router.ts):
 *  - to 'owner': demote current owner → co_owner, UNLESS a different co_owner
 *    already exists, in which case the outgoing owner is removed entirely.
 *  - to 'co_owner': just update (server will reject with CONFLICT if a different
 *    user already holds the slot — the rollback handles the failure).
 *  - to 'helper': just update.
 *
 * Tracks per-user pending state so the affected row can render a spinner.
 */
export function useParticipantMutations({ meetingId: defaultMeetingId, silent = false }: UseParticipantMutationsArgs = {}) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { invalidateMeeting } = useInvalidation()
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  function getQueryOpts(meetingId: string) {
    return trpc.meetingsRouter.getParticipants.queryOptions({ meetingId })
  }

  // Shared cache lifecycle. `mutateCache` runs after snapshotting; it should
  // perform the optimistic mutation (insert / remove / role swap) on a fresh
  // cache value. `extraInvalidate` runs in addition to the per-meeting
  // participants invalidation when the mutation settles.
  function makeOptions(opts: {
    mutateCache: (input: ManageParticipantsInput, old: ParticipantsCache) => ParticipantsCache
    extraInvalidate?: () => void
  }) {
    return {
      onMutate: async (input: ManageParticipantsInput): Promise<MutationContext> => {
        setPendingUserId(input.userId)
        const queryOpts = getQueryOpts(input.meetingId)
        await qc.cancelQueries(queryOpts)
        const previous = qc.getQueryData(queryOpts.queryKey)
        qc.setQueryData(queryOpts.queryKey, (old: ParticipantsCache | undefined) => {
          if (!old) {
            return old
          }
          return opts.mutateCache(input, old)
        })
        return { previous, meetingId: input.meetingId }
      },
      onError: (
        err: { message?: string },
        _vars: ManageParticipantsInput,
        context: MutationContext | undefined,
      ) => {
        if (context?.previous && context.meetingId) {
          qc.setQueryData(getQueryOpts(context.meetingId).queryKey, context.previous)
        }
        if (!silent) {
          toast.error(err.message || 'Couldn\'t update participant')
        }
      },
      onSettled: (
        _data: unknown,
        _err: unknown,
        _vars: ManageParticipantsInput,
        context: MutationContext | undefined,
      ) => {
        setPendingUserId(null)
        if (context?.meetingId) {
          void qc.invalidateQueries(getQueryOpts(context.meetingId))
        }
        opts.extraInvalidate?.()
      },
    }
  }

  // addMutation triggers full meeting invalidation: new participants reshape
  // swimlane combos, participant-avatar stacks, and any list surface that
  // embeds meeting participants (schedule getAll, customer pipeline, dashboard).
  const addMutation = useMutation(
    trpc.meetingsRouter.manageParticipants.mutationOptions(
      makeOptions({
        extraInvalidate: invalidateMeeting,
        mutateCache: (input, old) => {
          // Guard: role is required for add. If absent, skip the optimistic
          // insert — the server will reject with BAD_REQUEST and rollback runs.
          if (!input.role) {
            return old
          }
          return [
            ...old,
            // Placeholder: userName/userEmail are '' until the server responds.
            // Satisfies the non-nullable inferred type from the inner-join query.
            {
              id: `optimistic-${input.userId}`,
              userId: input.userId,
              role: input.role,
              userName: '',
              userEmail: '',
              userImage: null,
            } satisfies ParticipantsCache[number],
          ]
        },
      }),
    ),
  )

  // removeMutation triggers full meeting invalidation: when removing the owner,
  // the co-owner is promoted (or the system user takes over), which cascades to
  // ownerId-dependent displays (meeting list rows, meeting header, etc.)
  const removeMutation = useMutation(
    trpc.meetingsRouter.manageParticipants.mutationOptions(
      makeOptions({
        extraInvalidate: invalidateMeeting,
        mutateCache: (input, old) => {
          // Mirror server: removing the owner with a co-owner present promotes
          // the co-owner. Without a co-owner, the server backfills with the
          // system user — we don't have its profile, so let the refetch fill it in.
          const owner = old.find(p => p.role === 'owner')
          const coOwner = old.find(p => p.role === 'co_owner')
          const removingOwner = owner?.userId === input.userId

          if (removingOwner && coOwner) {
            return old
              .filter(p => p.userId !== input.userId)
              .map(p => p.userId === coOwner.userId ? { ...p, role: 'owner' as const } : p)
          }

          return old.filter(p => p.userId !== input.userId)
        },
      }),
    ),
  )

  // changeRole triggers full meeting invalidation: owner changes cascade to
  // ownerId-dependent displays (meeting list rows, meeting header, etc.)
  const changeRoleMutation = useMutation(
    trpc.meetingsRouter.manageParticipants.mutationOptions(
      makeOptions({
        extraInvalidate: invalidateMeeting,
        mutateCache: (input, old) => {
          if (!input.role) {
            return old
          }
          const newRole = input.role

          if (newRole === 'owner') {
            // Mirror server: if a different co_owner exists who isn't the user
            // being promoted, the outgoing owner is REMOVED. Otherwise the
            // outgoing owner is demoted to co_owner.
            const currentOwner = old.find(p => p.role === 'owner')
            const existingCoOwner = old.find(p => p.role === 'co_owner')
            const dropOutgoingOwner
              = !!currentOwner
                && currentOwner.userId !== input.userId
                && !!existingCoOwner
                && existingCoOwner.userId !== input.userId

            return old
              .filter(p => !(dropOutgoingOwner && currentOwner !== undefined && p.userId === currentOwner.userId))
              .map((p) => {
                if (p.userId === input.userId) {
                  return { ...p, role: 'owner' as const }
                }
                if (!dropOutgoingOwner && p.role === 'owner' && p.userId !== input.userId) {
                  return { ...p, role: 'co_owner' as const }
                }
                return p
              })
          }

          // 'co_owner' or 'helper': straight role update on the targeted user.
          // Server enforces the co_owner uniqueness constraint; if it rejects,
          // rollback restores the cache.
          return old.map(p => p.userId === input.userId ? { ...p, role: newRole } : p)
        },
      }),
    ),
  )

  function resolveMeetingId(meetingId?: string): string {
    const resolved = meetingId ?? defaultMeetingId
    if (!resolved) {
      throw new Error('useParticipantMutations: meetingId required (pass via hook args or per-call)')
    }
    return resolved
  }

  return {
    pendingUserId,
    addMutation,
    removeMutation,
    changeRoleMutation,
    /** Convenience wrapper — uses the hook's default meetingId if not provided. */
    add: (userId: string, role: ParticipantRole, meetingId?: string) => {
      addMutation.mutate({ meetingId: resolveMeetingId(meetingId), userId, role, action: 'add' })
    },
    /** Convenience wrapper — uses the hook's default meetingId if not provided. */
    remove: (userId: string, meetingId?: string) => {
      removeMutation.mutate({ meetingId: resolveMeetingId(meetingId), userId, action: 'remove' })
    },
    /** Convenience wrapper — uses the hook's default meetingId if not provided. */
    changeRole: (userId: string, newRole: ParticipantRole, meetingId?: string) => {
      changeRoleMutation.mutate({ meetingId: resolveMeetingId(meetingId), userId, role: newRole, action: 'change_role' })
    },
    /** Specific case of changeRole — picker's promote-to-owner crown button. */
    promoteToOwner: (userId: string, meetingId?: string) => {
      changeRoleMutation.mutate({ meetingId: resolveMeetingId(meetingId), userId, role: 'owner', action: 'change_role' })
    },
  }
}
