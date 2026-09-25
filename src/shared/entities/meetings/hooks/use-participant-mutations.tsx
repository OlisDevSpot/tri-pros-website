'use client'

import type { inferRouterInputs, inferRouterOutputs } from '@trpc/server'

import type { AppRouter } from '@/trpc/routers/app'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

type ParticipantsCache = inferRouterOutputs<AppRouter>['meetingsRouter']['participants']['getParticipants']
type ManageParticipantsInput = inferRouterInputs<AppRouter>['meetingsRouter']['participants']['manageParticipants']
type ParticipantRole = 'co_owner' | 'helper' | 'owner'

interface UseParticipantMutationsArgs {
  meetingId?: string
  /** Suppress the per-mutation error toast — for bulk callers that emit their own summary toast. */
  silent?: boolean
}

interface MutationContext {
  previous: ParticipantsCache | undefined
  meetingId: string
}

export function useParticipantMutations({ meetingId: defaultMeetingId, silent = false }: UseParticipantMutationsArgs = {}) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { invalidateMeeting } = useInvalidation()
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  function getQueryOpts(meetingId: string) {
    return trpc.meetingsRouter.participants.getParticipants.queryOptions({ meetingId })
  }

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

  // Full meeting invalidation: participants reshape swimlanes, avatar stacks, and list rows that embed them.
  const addMutation = useMutation(
    trpc.meetingsRouter.participants.manageParticipants.mutationOptions(
      makeOptions({
        extraInvalidate: invalidateMeeting,
        mutateCache: (input, old) => {
          // No role → skip the optimistic insert; the server rejects and rollback runs.
          if (!input.role) {
            return old
          }
          return [
            ...old,
            // '' placeholders satisfy the non-nullable inner-join type until the refetch.
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

  // Full meeting invalidation: removing the owner reassigns ownerId, which list rows and the header depend on.
  const removeMutation = useMutation(
    trpc.meetingsRouter.participants.manageParticipants.mutationOptions(
      makeOptions({
        extraInvalidate: invalidateMeeting,
        mutateCache: (input, old) => {
          // Mirrors the server. With no co-owner the server backfills the system user, whose profile we lack — the refetch fills it.
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

  // Full meeting invalidation: owner changes cascade to ownerId-dependent list rows and the header.
  const changeRoleMutation = useMutation(
    trpc.meetingsRouter.participants.manageParticipants.mutationOptions(
      makeOptions({
        extraInvalidate: invalidateMeeting,
        mutateCache: (input, old) => {
          if (!input.role) {
            return old
          }
          const newRole = input.role

          if (newRole === 'owner') {
            // Must mirror manageParticipants: a distinct existing co_owner means the outgoing owner is removed, not demoted.
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

          // co_owner uniqueness is left to the server; a CONFLICT rolls the cache back.
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
    add: (userId: string, role: ParticipantRole, meetingId?: string) => {
      addMutation.mutate({ meetingId: resolveMeetingId(meetingId), userId, role, action: 'add' })
    },
    remove: (userId: string, meetingId?: string) => {
      removeMutation.mutate({ meetingId: resolveMeetingId(meetingId), userId, action: 'remove' })
    },
    changeRole: (userId: string, newRole: ParticipantRole, meetingId?: string) => {
      changeRoleMutation.mutate({ meetingId: resolveMeetingId(meetingId), userId, role: newRole, action: 'change_role' })
    },
    promoteToOwner: (userId: string, meetingId?: string) => {
      changeRoleMutation.mutate({ meetingId: resolveMeetingId(meetingId), userId, role: 'owner', action: 'change_role' })
    },
  }
}
