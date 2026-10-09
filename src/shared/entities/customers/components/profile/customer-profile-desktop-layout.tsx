'use client'

import type { RefObject } from 'react'
import type { HeroView } from './hero-view-toggle'
import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import type { ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { TabsList, TabsTrigger } from '@/shared/components/ui/tabs'
import { Can } from '@/shared/domains/permissions/ui/can'
import { PROFILE_TAB_LABELS } from '@/shared/entities/customers/constants/profile-modal'
import { CustomerProfileRail } from './customer-profile-rail'
import { CustomerProfileTabPanels } from './customer-profile-tab-panels'

interface Props {
  commands: ProfileCommands
  data: CustomerProfileData
  editForm: ReturnType<typeof useCustomerEditForm>
  heroAddress: string | null
  heroView: HeroView
  highlightMeetingId?: string
  onClose: () => void
  onHeroViewChange: (view: HeroView) => void
  onMutationSuccess: () => void
  onOpenMeeting: (meetingId: string) => void
  scrollerRef: RefObject<HTMLDivElement | null>
}

// md and up: the identity rail on the left, underline tabs and one scrolling pane on the right.
export function CustomerProfileDesktopLayout({ commands, data, editForm, heroAddress, heroView, highlightMeetingId, onClose, onHeroViewChange, onMutationSuccess, onOpenMeeting, scrollerRef }: Props) {
  return (
    <>
      <CustomerProfileRail
        commands={commands}
        customer={data.customer}
        editForm={editForm}
        heroAddress={heroAddress}
        heroView={heroView}
        meetings={data.meetings}
        onClose={onClose}
        onHeroViewChange={onHeroViewChange}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <TabsList className="shrink-0 px-6" variant="underline">
          <TabsTrigger className="min-h-13" value="overview">{PROFILE_TAB_LABELS.overview}</TabsTrigger>
          <TabsTrigger className="min-h-13" value="meetings">{`${PROFILE_TAB_LABELS.meetings} (${data.meetings.length})`}</TabsTrigger>
          <Can permission={['read', 'Project']}>
            <TabsTrigger className="min-h-13" value="projects">{`${PROFILE_TAB_LABELS.projects} (${data.projects.length})`}</TabsTrigger>
          </Can>
        </TabsList>
        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-gutter-stable" data-profile-scroller ref={scrollerRef}>
          <CustomerProfileTabPanels
            data={data}
            editForm={editForm}
            highlightMeetingId={highlightMeetingId}
            onMutationSuccess={onMutationSuccess}
            onOpenMeeting={onOpenMeeting}
          />
        </div>
      </div>
    </>
  )
}
