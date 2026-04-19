'use client'

import type { HeroView } from './hero-view-toggle'
import type { CustomerProfileData } from '@/shared/entities/customers/types'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import { CustomerMeetingsList } from '../lists/customer-meetings-list'
import { CustomerProjectsList } from '../lists/customer-projects-list'
import { CustomerAddressHero } from './customer-address-hero'
import { CustomerHeroHeader } from './customer-hero-header'
import { CustomerProfileKeyInsights } from './customer-profile-key-insights'
import { CustomerProfileOverview } from './customer-profile-overview'

interface Props {
  data: CustomerProfileData
  defaultTab?: 'overview' | 'meetings' | 'projects'
  heroAddress: string | null
  heroView: HeroView
  highlightMeetingId?: string
  onMutationSuccess: () => void
}

export function CustomerProfileModalContent({ data, defaultTab, heroAddress, heroView, highlightMeetingId, onMutationSuccess }: Props) {
  const editForm = useCustomerEditForm(data.customer)
  const profile = data.customer.customerProfileJSON ?? null

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col">
      <Tabs className="flex min-h-0 flex-1 flex-col gap-0" defaultValue={defaultTab ?? 'overview'}>
        {/* Hero band: map backdrop + content overlay. Parent is a flex column
            so the content layer can use flex-1 to fill the band's height;
            justify-end anchors the content to the bottom with consistent
            padding on sides + bottom. Extra space (from the map min-height)
            collects above the content — no dead space below the tabs. */}
        <div className="dark relative isolate flex flex-col overflow-hidden shadow-lg sm:min-h-72">
          <CustomerAddressHero address={heroAddress} key={heroAddress} view={heroView} />

          {/* Content fills the hero band and stacks from the bottom.
              - px/pb are the "base" padding, matched on all three sides
              - pt respects the iOS safe-area (notch / Dynamic Island) so the
                floating X + view-toggle chrome never overlaps the header
                content on PWA. On non-iOS / browsers without a safe-area,
                env() resolves to 0 and this collapses to the original 2.5rem.
              - The map backdrop (absolute inset-0) intentionally extends
                edge-to-edge including behind the notch — only the content
                is pushed down by safe-area. This also makes the hero taller
                on iOS PWA, which is the desired effect. */}
          <div className="relative z-10 flex flex-1 flex-col justify-end gap-4 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+4.25rem)] text-white sm:px-6 sm:pb-6 sm:pt-10">
            <CustomerHeroHeader customer={data.customer} editForm={editForm} />

            {profile && <CustomerProfileKeyInsights profile={profile} />}

            <TabsList className="w-full justify-start border border-white/10 bg-black/40 backdrop-blur-md">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="meetings">
                {`Meetings (${data.meetings.length})`}
              </TabsTrigger>
              <TabsTrigger value="projects">
                {`Projects (${data.projects.length})`}
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Tab content: the modal is flush, so each tab owns its own padding. */}
        <TabsContent
          className="mt-0 flex min-h-0 flex-col overflow-y-auto p-4 sm:p-6 md:overflow-hidden"
          value="overview"
        >
          <CustomerProfileOverview
            data={data}
            editForm={editForm}
            onMutationSuccess={onMutationSuccess}
          />
        </TabsContent>
        <TabsContent className="mt-0 min-h-0 overflow-y-auto p-4 sm:p-6" value="meetings">
          <CustomerMeetingsList
            customerId={data.customer.id}
            customerName={data.customer.name}
            highlightMeetingId={highlightMeetingId}
            meetings={data.meetings}
            onMutationSuccess={onMutationSuccess}
          />
        </TabsContent>
        <TabsContent className="mt-0 min-h-0 overflow-y-auto p-4 sm:p-6" value="projects">
          <CustomerProjectsList
            data={data}
            highlightMeetingId={highlightMeetingId}
            onMutationSuccess={onMutationSuccess}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}
