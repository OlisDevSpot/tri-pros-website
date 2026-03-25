'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { CustomerProfileModalContent } from '@/features/customer-pipelines/ui/components/customer-profile-modal-content'
import { Modal } from '@/shared/components/dialogs/modals/base-modal'
import { ErrorState } from '@/shared/components/states/error-state'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  customerId: string
  defaultTab?: 'overview' | 'meetings' | 'proposals'
  highlightMeetingId?: string
}

export function CustomerProfileModal({ customerId, defaultTab, highlightMeetingId }: Props) {
  const { isOpen, close } = useModalStore()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const profileQuery = useQuery(
    trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId }),
  )

  function handleMutationSuccess() {
    void queryClient.invalidateQueries(
      trpc.customerPipelinesRouter.getCustomerProfile.queryFilter(),
    )
  }

  const customerName = profileQuery.data?.customer.name
  const title = customerName ? `${customerName}'s Profile` : 'Loading Profile...'

  return (
    <Modal
      className="sm:max-w-4xl sm:h-[80vh] overflow-hidden flex flex-col"
      close={close}
      isOpen={isOpen}
      title={title}
    >
      {profileQuery.isPending && (
        <div className="w-full space-y-4 py-4">
          <div className="h-6 w-48 animate-pulse rounded bg-muted" />
          <div className="flex gap-4">
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </div>
      )}

      {profileQuery.isError && (
        <ErrorState
          description="Could not load customer data"
          title="Failed to load profile"
        />
      )}

      {profileQuery.data && (
        <CustomerProfileModalContent
          data={profileQuery.data}
          defaultTab={defaultTab}
          highlightMeetingId={highlightMeetingId}
          onMutationSuccess={handleMutationSuccess}
        />
      )}
    </Modal>
  )
}
