'use client'

import type { CustomerProfileData } from '@/features/customer-pipelines/types'

import { useCustomerEditForm } from '@/features/customer-pipelines/hooks/use-customer-edit-form'
import { CustomerMeetingsList } from '@/features/customer-pipelines/ui/components/customer-meetings-list'
import { CustomerProfileHeader } from '@/features/customer-pipelines/ui/components/customer-profile-header'
import { CustomerProfileKeyInsights } from '@/features/customer-pipelines/ui/components/customer-profile-key-insights'
import { CustomerProfileOverview } from '@/features/customer-pipelines/ui/components/customer-profile-overview'
import { CustomerProposalsList } from '@/features/customer-pipelines/ui/components/customer-proposals-list'
import { Separator } from '@/shared/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

interface Props {
  data: CustomerProfileData
  onMutationSuccess: () => void
}

export function CustomerProfileModalContent({ data, onMutationSuccess }: Props) {
  const editForm = useCustomerEditForm(data.customer)

  const profile = data.customer.customerProfileJSON ?? null

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <CustomerProfileHeader
        customer={data.customer}
        onEditField={editForm.startEditing}
      />
      {profile && (
        <>
          <Separator className="my-2" />
          <CustomerProfileKeyInsights profile={profile} />
        </>
      )}
      <Separator className="my-3" />

      <Tabs className="flex min-h-0 flex-1 flex-col" defaultValue="overview">
        <TabsList className="w-full shrink-0 justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="meetings">
            {`Meetings (${data.meetings.length})`}
          </TabsTrigger>
          <TabsTrigger value="proposals">
            {`Proposals (${data.allProposals.length})`}
          </TabsTrigger>
        </TabsList>

        <div className="mt-3 flex-1 overflow-y-auto pr-1">
          <TabsContent className="mt-0" value="overview">
            <CustomerProfileOverview
              data={data}
              editForm={editForm}
              onMutationSuccess={onMutationSuccess}
            />
          </TabsContent>
          <TabsContent className="mt-0" value="meetings">
            <CustomerMeetingsList
              customerId={data.customer.id}
              customerName={data.customer.name}
              meetings={data.meetings}
              onMutationSuccess={onMutationSuccess}
            />
          </TabsContent>
          <TabsContent className="mt-0" value="proposals">
            <CustomerProposalsList data={data} onMutationSuccess={onMutationSuccess} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
