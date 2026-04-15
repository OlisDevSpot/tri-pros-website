'use client'

import type { CustomerProfileData } from '@/shared/entities/customers/types'

import { Separator } from '@/shared/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import { CustomerMeetingsList } from './customer-meetings-list'
import { CustomerProfileHeader } from './customer-profile-header'
import { CustomerProfileKeyInsights } from './customer-profile-key-insights'
import { CustomerProfileOverview } from './customer-profile-overview'
import { CustomerProjectsList } from './customer-projects-list'
import { ProfileEditActions } from './profile-edit-actions'

interface Props {
  data: CustomerProfileData
  defaultTab?: 'overview' | 'meetings' | 'projects'
  highlightMeetingId?: string
  onMutationSuccess: () => void
}

export function CustomerProfileModalContent({ data, defaultTab, highlightMeetingId, onMutationSuccess }: Props) {
  const editForm = useCustomerEditForm(data.customer)

  const profile = data.customer.customerProfileJSON ?? null

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <div className="flex items-center justify-between gap-2">
        <CustomerProfileHeader
          customer={data.customer}
          isEditing={editForm.isEditing}
          register={editForm.canEditContact ? editForm.form.register : undefined}
          onEditField={editForm.startEditing}
        />
        <ProfileEditActions editForm={editForm} />
      </div>
      {profile && (
        <>
          <Separator className="my-2" />
          <CustomerProfileKeyInsights profile={profile} />
        </>
      )}
      <Separator className="my-3" />

      <Tabs className="flex min-h-0 flex-1 flex-col" defaultValue={defaultTab ?? 'overview'}>
        <TabsList className="w-full shrink-0 justify-start">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="meetings">
            {`Meetings (${data.meetings.length})`}
          </TabsTrigger>
          <TabsTrigger value="projects">
            {`Projects (${data.projects.length})`}
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
              highlightMeetingId={highlightMeetingId}
              meetings={data.meetings}
              onMutationSuccess={onMutationSuccess}
            />
          </TabsContent>
          <TabsContent className="mt-0" value="projects">
            <CustomerProjectsList
              data={data}
              highlightMeetingId={highlightMeetingId}
              onMutationSuccess={onMutationSuccess}
            />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
