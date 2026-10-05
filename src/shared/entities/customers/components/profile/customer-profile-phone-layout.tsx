'use client'

import type { RefObject } from 'react'
import type { HeroView } from './hero-view-toggle'
import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import type { ProfileCommands } from '@/shared/entities/customers/types/profile-modal'
import { CustomerProfileNewSheet } from './customer-profile-new-sheet'
import { CustomerProfilePhoneHero } from './customer-profile-phone-hero'
import { CustomerProfileTabBar } from './customer-profile-tab-bar'
import { CustomerProfileTabPanels } from './customer-profile-tab-panels'

interface Props {
  commands: ProfileCommands
  data: CustomerProfileData
  editForm: ReturnType<typeof useCustomerEditForm>
  heroAddress: string | null
  heroView: HeroView
  highlightMeetingId?: string
  newSheetOpen: boolean
  onClose: () => void
  onHeroViewChange: (view: HeroView) => void
  onMutationSuccess: () => void
  onNewSheetOpenChange: (open: boolean) => void
  onOpenMeeting: (meetingId: string) => void
  scrollerRef: RefObject<HTMLDivElement | null>
}

// Below md: the hero is pinned on top, the tab bar on the bottom edge, and only the tab content
// between them scrolls. The New sheet rises from behind the tab bar, which stays live above it.
export function CustomerProfilePhoneLayout({ commands, data, editForm, heroAddress, heroView, highlightMeetingId, newSheetOpen, onClose, onHeroViewChange, onMutationSuccess, onNewSheetOpenChange, onOpenMeeting, scrollerRef }: Props) {
  return (
    <>
      <CustomerProfilePhoneHero
        customer={data.customer}
        editForm={editForm}
        heroAddress={heroAddress}
        heroView={heroView}
        onHeroViewChange={onHeroViewChange}
      />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-profile-scroller ref={scrollerRef}>
        <CustomerProfileTabPanels
          data={data}
          editForm={editForm}
          highlightMeetingId={highlightMeetingId}
          onMutationSuccess={onMutationSuccess}
          onOpenMeeting={onOpenMeeting}
        />
      </div>
      <CustomerProfileTabBar
        counts={{ meetings: data.meetings.length, projects: data.projects.length }}
        newSheetOpen={newSheetOpen}
        onClose={onClose}
        onToggleNew={() => onNewSheetOpenChange(!newSheetOpen)}
      />
      <CustomerProfileNewSheet commands={commands} meetings={data.meetings} onOpenChange={onNewSheetOpenChange} open={newSheetOpen} />
    </>
  )
}
