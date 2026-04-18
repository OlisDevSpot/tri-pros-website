'use client'

import type { inferRouterOutputs } from '@trpc/server'

import type { AppRouter } from '@/trpc/routers/app'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

type ParticipantsCache = inferRouterOutputs<AppRouter>['meetingsRouter']['getParticipants']

interface UseParticipantPickerMutationsArgs {
  meetingId: string
}

/**
 * Bundles the 3 manageParticipants flows the inline picker uses:
 *  - add(userId, role)
 *  - remove(userId)
 *  - promoteToOwner(userId)  — atomic role swap; current owner becomes co_owner
 *
 * Tracks per-user pending state so the affected row can show a spinner.
 * Uses the optimistic pattern from memory/pattern-optimistic-updates.md.
 */
export function useParticipantPickerMutations({ meetingId }: UseParticipantPickerMutationsArgs) {
  const trpc = useTRPC()
  const qc = useQueryClient()
  const { invalidateMeeting } = useInvalidation()
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  const queryOpts = trpc.meetingsRouter.getParticipants.queryOptions({ meetingId })

  function makeBaseOptions(extraInvalidate?: () => void) {
    return {
      onMutate: async (input: { userId: string }) => {
        setPendingUserId(input.userId)
        await qc.cancelQueries(queryOpts)
        const previous = qc.getQueryData(queryOpts.queryKey)
        return { previous }
      },
      onError: (
        err: { message?: string },
        _vars: { userId: string },
        context: { previous: ParticipantsCache | undefined } | undefined,
      ) => {
        if (context?.previous) {
          qc.setQueryData(queryOpts.queryKey, context.previous)
        }
        toast.error(err.message || 'Couldn\'t update participant')
      },
      onSettled: () => {
        setPendingUserId(null)
        qc.invalidateQueries(queryOpts)
        extraInvalidate?.()
      },
    }
  }

  const addMutation = useMutation(
    trpc.meetingsRouter.manageParticipants.mutationOptions({
      ...makeBaseOptions(),
      onMutate: async (input) => {
        const ctx = await makeBaseOptions().onMutate(input)
        // Guard: if role is somehow absent, skip the optimistic insert —
        // the server will reject with BAD_REQUEST and the rollback will handle it.
        if (!input.role) {
          return ctx
        }
        const role = input.role
        // Optimistically insert a placeholder row so the popover updates instantly
        qc.setQueryData(queryOpts.queryKey, (old: ParticipantsCache | undefined) => {
          if (!old) {
            return old
          }
          return [
            ...old,
            // Placeholder: userName/userEmail are '' until the server responds.
            // This satisfies the non-nullable inferred type from the inner-join query.
            {
              id: `optimistic-${input.userId}`,
              userId: input.userId,
              role,
              userName: '',
              userEmail: '',
              userImage: null,
            } satisfies ParticipantsCache[number],
          ]
        })
        return ctx
      },
    }),
  )

  const removeMutation = useMutation(
    trpc.meetingsRouter.manageParticipants.mutationOptions({
      ...makeBaseOptions(),
      onMutate: async (input) => {
        const ctx = await makeBaseOptions().onMutate(input)
        qc.setQueryData(queryOpts.queryKey, (old: ParticipantsCache | undefined) => {
          if (!old) {
            return old
          }
          return old.filter(p => p.userId !== input.userId)
        })
        return ctx
      },
    }),
  )

  // promoteMutation triggers full meeting invalidation: owner changes cascade to
  // ownerId-dependent displays (meeting list rows, meeting header, etc.)
  const promoteMutation = useMutation(
    trpc.meetingsRouter.manageParticipants.mutationOptions({
      ...makeBaseOptions(invalidateMeeting),
      onMutate: async (input) => {
        const ctx = await makeBaseOptions(invalidateMeeting).onMutate(input)
        qc.setQueryData(queryOpts.queryKey, (old: ParticipantsCache | undefined) => {
          if (!old) {
            return old
          }
          return old.map((p) => {
            if (p.userId === input.userId) {
              return { ...p, role: 'owner' as const }
            }
            if (p.role === 'owner') {
              return { ...p, role: 'co_owner' as const }
            }
            return p
          })
        })
        return ctx
      },
    }),
  )

  return {
    pendingUserId,
    add: (userId: string, role: 'owner' | 'co_owner') => {
      addMutation.mutate({ meetingId, action: 'add', userId, role })
    },
    remove: (userId: string) => {
      removeMutation.mutate({ meetingId, action: 'remove', userId })
    },
    promoteToOwner: (userId: string) => {
      promoteMutation.mutate({ meetingId, action: 'change_role', userId, role: 'owner' })
    },
  }
}
