'use client'

import type { HeroView } from './hero-view-toggle'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import type { CustomerProfileTab } from '@/shared/entities/customers/types/profile-modal'
import { useRef, useState } from 'react'
import { Tabs } from '@/shared/components/ui/tabs'
import { PROFILE_RAIL_MEDIA_QUERY } from '@/shared/entities/customers/constants/profile-modal'
import { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import { useProfileCommands } from '@/shared/entities/customers/hooks/use-profile-commands'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { CustomerProfileCommandDialogs } from './customer-profile-command-dialogs'
import { CustomerProfileDesktopLayout } from './customer-profile-desktop-layout'
import { CustomerProfilePhoneLayout } from './customer-profile-phone-layout'

interface Props {
  data: CustomerProfileData
  defaultTab?: CustomerProfileTab
  heroAddress: string | null
  heroView: HeroView
  highlightMeetingId?: string
  onClose: () => void
  onHeroViewChange: (view: HeroView) => void
  onMutationSuccess: () => void
}

// One arrangement is mounted at a time, never both hidden by CSS: the edit form registers each
// input once, Radix trigger ids stay unique, and only one hero image tree loads.
export function CustomerProfileModalContent({ data, defaultTab, heroAddress, heroView, highlightMeetingId, onClose, onHeroViewChange, onMutationSuccess }: Props) {
  const isDesktop = useMediaQuery(PROFILE_RAIL_MEDIA_QUERY)
  const editForm = useCustomerEditForm(data.customer)
  const commands = useProfileCommands()
  const [tab, setTab] = useState<CustomerProfileTab>(defaultTab ?? 'overview')
  const [activeHighlightId, setActiveHighlightId] = useState(highlightMeetingId)
  const [newSheetOpen, setNewSheetOpen] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)

  // A new tab starts at its top; on phone the pinned hero means the old offset would land mid-list.
  function showTab(next: CustomerProfileTab) {
    setTab(next)
    setNewSheetOpen(false)
    scrollerRef.current?.scrollTo({ top: 0 })
  }

  function handleOpenMeeting(meetingId: string) {
    setActiveHighlightId(meetingId)
    showTab('meetings')
  }

  const shared = {
    commands,
    data,
    editForm,
    heroAddress,
    heroView,
    highlightMeetingId: activeHighlightId,
    onClose,
    onHeroViewChange,
    onMutationSuccess,
    onOpenMeeting: handleOpenMeeting,
    scrollerRef,
  }

  return (
    <Tabs
      className="relative flex min-h-0 w-full flex-1 flex-col gap-0 md:flex-row"
      onValueChange={value => showTab(value as CustomerProfileTab)}
      value={tab}
    >
      {isDesktop
        ? <CustomerProfileDesktopLayout {...shared} />
        : <CustomerProfilePhoneLayout {...shared} newSheetOpen={newSheetOpen} onNewSheetOpenChange={setNewSheetOpen} />}
      <CustomerProfileCommandDialogs commands={commands} customer={data.customer} onMutationSuccess={onMutationSuccess} />
    </Tabs>
  )
}
