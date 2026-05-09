'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

/**
 * Default mutation for reassigning a customer's lead source. Owns toast +
 * invalidation so a column cell (or any other surface) can reuse it without
 * each call site re-wiring the same boilerplate. Reassignment changes the
 * `customers.leadSourceId` join key — both the customers tree and the
 * lead-sources tree (totals, signed counts, per-source customer lists) must
 * refresh.
 */
export function useUpdateLeadSourceMutation() {
  const trpc = useTRPC()
  const { invalidateCustomer, invalidateLeadSource } = useInvalidation()

  return useMutation(
    trpc.customersRouter.updateLeadSource.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.leadSourceName
          ? `Source set to ${data.leadSourceName}`
          : 'Lead source updated')
        invalidateCustomer()
        invalidateLeadSource()
      },
      onError: err => toast.error(err.message),
    }),
  )
}
