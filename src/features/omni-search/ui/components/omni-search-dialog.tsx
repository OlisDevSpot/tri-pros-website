'use client'

import type { OmniPickedCustomer } from '@/features/omni-search/types'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

import { useDashboardOverlays } from '@/features/agent-dashboard/hooks/use-dashboard-overlays'
import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OmniSearchPanel } from '@/features/omni-search/ui/components/omni-search-panel'
import { CommandDialog } from '@/shared/components/ui/command'
import { CreateMeetingModal } from '@/shared/entities/meetings/components/create-meeting-modal'

export function OmniSearchDialog() {
  const open = useDashboardOverlays(state => state.searchOpen)
  const setSearchOpen = useDashboardOverlays(state => state.setSearchOpen)
  const toggleSearch = useDashboardOverlays(state => state.toggleSearch)
  const pathname = usePathname()
  const [scheduleFor, setScheduleFor] = useState<OmniPickedCustomer | null>(null)

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggleSearch()
      }
    }
    // Capture phase: with focus in the cmdk input, Ctrl+K never bubbles up to document, so ⌘K could open the dialog but not close it.
    document.addEventListener('keydown', onKeydown, true)
    return () => document.removeEventListener('keydown', onKeydown, true)
  }, [toggleSearch])

  // The store outlives navigation, so Back with the dialog open would otherwise carry it to the next page.
  useEffect(() => {
    useDashboardOverlays.getState().setSearchOpen(false)
  }, [pathname])

  return (
    <>
      <CommandDialog
        open={open}
        onOpenChange={setSearchOpen}
        title={OMNI_COPY.title}
        description={OMNI_COPY.description}
        showCloseButton={false}
        commandProps={{ shouldFilter: false, loop: true }}
      >
        <OmniSearchPanel
          onDone={() => setSearchOpen(false)}
          onPickCustomer={(customer) => {
            setSearchOpen(false)
            setScheduleFor(customer)
          }}
        />
      </CommandDialog>
      {scheduleFor && (
        <CreateMeetingModal
          isOpen
          onClose={() => setScheduleFor(null)}
          customerId={scheduleFor.id}
          customerName={scheduleFor.name}
        />
      )}
    </>
  )
}
