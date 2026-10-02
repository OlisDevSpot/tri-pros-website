'use client'

import type { HeroView } from './hero-view-toggle'
import type { CustomerProfileTab } from '@/shared/entities/customers/types/profile-modal'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Modal } from '@/shared/components/dialogs/modals/base-modal'
import { ErrorState } from '@/shared/components/states/error-state'
import { Button } from '@/shared/components/ui/button'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'
import { CustomerProfileLoadingSkeleton } from './customer-profile-loading-skeleton'
import { CustomerProfileModalContent } from './customer-profile-modal-content'

interface Props {
  customerId: string
  defaultTab?: CustomerProfileTab
  highlightMeetingId?: string
}

export function CustomerProfileModal({ customerId, defaultTab, highlightMeetingId }: Props) {
  const isOpen = useModalStore(state => state.isOpen)
  const close = useModalStore(state => state.close)
  const trpc = useTRPC()
  const { invalidateCustomer } = useInvalidation()
  const [heroView, setHeroView] = useState<HeroView>('street')

  const profileQuery = useQuery(
    trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId }),
  )

  function handleMutationSuccess() {
    invalidateCustomer()
  }

  const customerName = profileQuery.data?.customer.name
  const title = customerName ? `${customerName}'s Profile` : 'Loading Profile...'

  const customer = profileQuery.data?.customer
  const heroAddress = customer
    ? [customer.address, customer.city, customer.state, customer.zip].filter(Boolean).join(', ') || null
    : null

  return (
    <Modal
      className={cn(
        'flex flex-col overflow-hidden',
        // md and up: 32px from every viewport edge, capped so a very wide screen does not stretch the pane.
        'md:h-[calc(100dvh-4rem)] md:max-h-none md:w-[calc(100vw-4rem)] md:max-w-[100rem]',
        // The base modal turns into a centered dialog at sm, but the rail needs 768px: stay fullscreen until md.
        'sm:max-md:h-full sm:max-md:max-h-none sm:max-md:max-w-full sm:max-md:rounded-none sm:max-md:border-0',
        // Close lives in the rail and the tab bar; the header's corner X would be a second home.
        '**:data-modal-close:hidden',
      )}
      close={close}
      isOpen={isOpen}
      title={title}
    >
      <div className="flex min-h-0 w-full flex-1 flex-col" data-modal-hero>
        {profileQuery.isPending && <CustomerProfileLoadingSkeleton onClose={close} />}

        {/* A failed refetch keeps the cached data, so the error state is only for a profile that never loaded. */}
        {profileQuery.isError && !profileQuery.data && (
          <div className="flex flex-1 items-center justify-center p-6">
            <ErrorState description="Could not load customer data" title="Failed to load profile">
              <Button className="mt-4 h-11 min-w-32" onClick={close} variant="outline">Close</Button>
            </ErrorState>
          </div>
        )}

        {profileQuery.data && (
          <CustomerProfileModalContent
            data={profileQuery.data}
            defaultTab={defaultTab}
            heroAddress={heroAddress}
            heroView={heroView}
            highlightMeetingId={highlightMeetingId}
            key={profileQuery.data.customer.id}
            onClose={close}
            onHeroViewChange={setHeroView}
            onMutationSuccess={handleMutationSuccess}
          />
        )}
      </div>
    </Modal>
  )
}
