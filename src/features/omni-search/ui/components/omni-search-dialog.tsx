'use client'

import type { CSSProperties } from 'react'
import type { OmniPickedCustomer } from '@/features/omni-search/types'

import { usePathname } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'

import { useDashboardOverlays } from '@/features/agent-dashboard/hooks/use-dashboard-overlays'
import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_PANEL_CLASS, OMNI_PANEL_STYLE } from '@/features/omni-search/constants/omni-search'
import { focusOmniInput, isInContactGroup } from '@/features/omni-search/lib/omni-focus'
import { OmniSearchPanel } from '@/features/omni-search/ui/components/omni-search-panel'
import { CommandDialog } from '@/shared/components/ui/command'
import { CreateMeetingModal } from '@/shared/entities/meetings/components/create-meeting-modal'
import { useVisualViewportHeight } from '@/shared/hooks/use-visual-viewport-height'

export function OmniSearchDialog() {
  const open = useDashboardOverlays(state => state.searchOpen)
  const setSearchOpen = useDashboardOverlays(state => state.setSearchOpen)
  const toggleSearch = useDashboardOverlays(state => state.toggleSearch)
  const pathname = usePathname()
  const [highlighted, setHighlighted] = useState('')
  const [wasOpen, setWasOpen] = useState(open)
  const [scheduleFor, setScheduleFor] = useState<OmniPickedCustomer | null>(null)
  // Listens only while open, so the closed palette costs the page nothing.
  const viewportHeight = useVisualViewportHeight(open)
  // Stable, so the memoized panel skips the dialog's re-render on every highlight move.
  const closeSearch = useCallback(() => setSearchOpen(false), [setSearchOpen])
  const pickCustomer = useCallback((customer: OmniPickedCustomer) => {
    setSearchOpen(false)
    setScheduleFor(customer)
  }, [setSearchOpen])

  // A stale value would stop cmdk auto-highlighting on the next open, so it is cleared the render the dialog closes.
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) {
      setHighlighted('')
    }
  }

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
        className={OMNI_PANEL_CLASS}
        contentProps={{
          style: viewportHeight === null ? OMNI_PANEL_STYLE : { ...OMNI_PANEL_STYLE, '--omni-vvh': `${viewportHeight}px` } as CSSProperties,
          overlayClassName: 'bg-palette-scrim',
          // Radix moves focus to the container when a focused row unmounts (a stale answer replaced, a layout swap);
          // cmdk's keys live on the input, so focus goes back there.
          onFocus: (event) => {
            if (event.target === event.currentTarget) {
              event.currentTarget.querySelector<HTMLInputElement>('[cmdk-input]')?.focus()
            }
          },
          onEscapeKeyDown: (event) => {
            // The first Esc inside a contact group goes back to the input; the next one closes.
            if (isInContactGroup(document.activeElement)) {
              event.preventDefault()
              focusOmniInput(document.activeElement)
            }
          },
        }}
        commandProps={{
          className: 'min-h-0 bg-transparent [&_[cmdk-item]]:py-0 [&_[cmdk-item]>svg]:size-4',
          shouldFilter: false,
          loop: true,
          value: highlighted,
          onValueChange: setHighlighted,
        }}
      >
        <OmniSearchPanel onHighlight={setHighlighted} onDone={closeSearch} onPickCustomer={pickCustomer} />
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
