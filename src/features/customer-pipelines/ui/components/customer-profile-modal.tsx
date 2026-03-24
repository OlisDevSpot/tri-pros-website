'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { CustomerMeetingsList } from '@/features/customer-pipelines/ui/components/customer-meetings-list'
import { CustomerProfileHeader } from '@/features/customer-pipelines/ui/components/customer-profile-header'
import { CustomerProfileKeyInsights } from '@/features/customer-pipelines/ui/components/customer-profile-key-insights'
import { CustomerProfileOverview } from '@/features/customer-pipelines/ui/components/customer-profile-overview'
import { CustomerProposalsList } from '@/features/customer-pipelines/ui/components/customer-proposals-list'
import { Modal } from '@/shared/components/dialogs/modals/base-modal'
import { ErrorState } from '@/shared/components/states/error-state'
import { Separator } from '@/shared/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useTRPC } from '@/trpc/helpers'

interface Props {
  customerId: string
}

export function CustomerProfileModal({ customerId }: Props) {
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
  const profile = profileQuery.data?.customer.customerProfileJSON ?? null

  return (
    <Modal
      isOpen={isOpen}
      close={close}
      title={title}
      description={profile ? <CustomerProfileKeyInsights profile={profile} /> : undefined}
      className="sm:max-w-4xl sm:h-[80vh] overflow-hidden flex flex-col"
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
          title="Failed to load profile"
          description="Could not load customer data"
        />
      )}

      {profileQuery.data && (
        <div className="flex flex-col min-h-0 flex-1 w-full">
          <CustomerProfileHeader customer={profileQuery.data.customer} />
          <Separator className="my-3" />

          <Tabs defaultValue="overview" className="flex-1 min-h-0 flex flex-col">
            <TabsList className="w-full justify-start shrink-0">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="meetings">
                {`Meetings (${profileQuery.data.meetings.length})`}
              </TabsTrigger>
              <TabsTrigger value="proposals">
                {`Proposals (${profileQuery.data.allProposals.length})`}
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto mt-3 pr-1">
              <TabsContent value="overview" className="mt-0">
                <CustomerProfileOverview data={profileQuery.data} />
              </TabsContent>
              <TabsContent value="meetings" className="mt-0">
                <CustomerMeetingsList
                  meetings={profileQuery.data.meetings}
                  customerId={customerId}
                  customerName={profileQuery.data.customer.name}
                  onMutationSuccess={handleMutationSuccess}
                />
              </TabsContent>
              <TabsContent value="proposals" className="mt-0">
                <CustomerProposalsList data={profileQuery.data} onMutationSuccess={handleMutationSuccess} />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      )}
    </Modal>
  )
}
