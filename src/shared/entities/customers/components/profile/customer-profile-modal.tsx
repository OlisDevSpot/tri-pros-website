'use client'

import type { HeroView } from './hero-view-toggle'
import { useQuery } from '@tanstack/react-query'

import { useState } from 'react'
import { Modal } from '@/shared/components/dialogs/modals/base-modal'
import { ErrorState } from '@/shared/components/states/error-state'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'
import { CustomerProfileModalContent } from './customer-profile-modal-content'
import { HeroViewToggle } from './hero-view-toggle'

interface Props {
  customerId: string
  defaultTab?: 'overview' | 'meetings' | 'projects'
  highlightMeetingId?: string
}

export function CustomerProfileModal({ customerId, defaultTab, highlightMeetingId }: Props) {
  const { isOpen, close } = useModalStore()
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
      className="sm:max-w-[min(72rem,calc(100vw-2rem))] sm:h-[85vh] overflow-hidden flex flex-col"
      close={close}
      // The toggle lives in the Modal's own header row, so it shares the flex
      // container (and items-center alignment) with the close button.
      headerActions={heroAddress ? <HeroViewToggle onChange={setHeroView} value={heroView} /> : undefined}
      isOpen={isOpen}
      title={title}
    >
      <div data-modal-hero className="flex min-h-0 w-full flex-1 flex-col">
        {profileQuery.isPending && <CustomerProfileLoadingSkeleton />}

        {profileQuery.isError && (
          <div className="flex flex-1 items-center justify-center p-6">
            <ErrorState
              description="Could not load customer data"
              title="Failed to load profile"
            />
          </div>
        )}

        {profileQuery.data && (
          <CustomerProfileModalContent
            data={profileQuery.data}
            defaultTab={defaultTab}
            heroAddress={heroAddress}
            heroView={heroView}
            highlightMeetingId={highlightMeetingId}
            onMutationSuccess={handleMutationSuccess}
          />
        )}
      </div>
    </Modal>
  )
}

// Matches the structure of the loaded CustomerProfileModalContent — same hero
// band height, same body below — so swapping to real content is a content
// swap, not a layout jump.
function CustomerProfileLoadingSkeleton() {
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="relative isolate overflow-hidden">
        <div className="h-65 animate-pulse bg-linear-to-br from-slate-900 via-slate-800 to-slate-950 sm:h-75" />
        <div className="absolute inset-x-5 bottom-5 flex flex-col gap-3">
          <div className="h-8 w-56 rounded-md bg-white/10" />
          <div className="h-4 w-72 rounded-md bg-white/10" />
          <div className="flex gap-2">
            <div className="h-6 w-20 rounded-full bg-white/10" />
            <div className="h-6 w-24 rounded-full bg-white/10" />
          </div>
          <div className="h-9 w-full rounded-md bg-black/40" />
        </div>
      </div>

      <div className="flex-1 p-4 sm:p-6">
        <div className="grid gap-4 md:grid-cols-[3fr_2fr]">
          <div className="space-y-3">
            <div className="h-4 w-24 animate-pulse rounded bg-muted" />
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
            <div className="h-20 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="space-y-3">
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
            <div className="h-28 animate-pulse rounded-lg bg-muted" />
          </div>
        </div>
      </div>
    </div>
  )
}
