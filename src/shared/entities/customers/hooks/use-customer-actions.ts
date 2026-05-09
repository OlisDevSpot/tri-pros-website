'use client'

import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

export function useCustomerActions() {
  const trpc = useTRPC()
  const { invalidateCustomer, invalidateMeeting, invalidateProposal, invalidateProject, invalidateActivities, invalidateLeadSource } = useInvalidation()

  // Customer delete cascades through meetings, proposals, projects, notes —
  // refresh every surface those entities feed (lists, pipelines, dashboard,
  // schedule, lead-source signed counts).
  const deleteCustomer = useMutation(
    trpc.customersRouter.delete.mutationOptions({
      onSuccess: () => {
        invalidateCustomer()
        invalidateMeeting()
        invalidateProposal()
        invalidateProject()
        invalidateActivities()
        invalidateLeadSource()
        toast.success('Customer deleted')
      },
      onError: err => toast.error(err.message ?? 'Failed to delete customer'),
    }),
  )

  return { deleteCustomer }
}
