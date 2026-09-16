'use client'

import type { ReactNode, RefObject } from 'react'
import type { PanelSection } from '@/features/meeting-flow/types'
import { PANEL_ID } from '@/features/meeting-flow/constants/shell'
import { PANEL_SECTION_LABELS, SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { MeetingPanelHeader } from '@/features/meeting-flow/ui/components/shell/meeting-panel-header'
import { ResponsiveSheet } from '@/shared/components/dialogs/sheets/responsive-sheet'
import { useIsBelowLg } from '@/shared/hooks/use-is-below-lg'
import { cn } from '@/shared/lib/utils'

interface MeetingPanelProps {
  openSection: PanelSection | null
  /** The view focuses this header when the panel opens. */
  headerRef: RefObject<HTMLDivElement | null>
  onSelect: (section: PanelSection) => void
  onClose: () => void
  children: ReactNode
}

/**
 * lg+: the shell-owned overlay (unchanged). Below lg: the same header and
 * sections inside `ResponsiveSheet` (bottom drawer, 60% height) so the stage
 * band stays visible (spec D5, §4.1).
 */
export function MeetingPanel({ openSection, headerRef, onSelect, onClose, children }: MeetingPanelProps) {
  const isOpen = openSection !== null
  const isBelowLg = useIsBelowLg()

  if (isBelowLg) {
    return (
      <ResponsiveSheet
        drawerClassName="h-[60dvh] max-h-[60dvh]"
        hideTitle
        open={isOpen}
        title={SHELL_COPY.panelLabel}
        onOpenChange={(open) => {
          if (!open) {
            onClose()
          }
        }}
      >
        <MeetingPanelHeader className="sticky top-0 z-10 -mx-4 bg-background px-3" headerRef={headerRef} openSection={openSection} onSelect={onSelect} />
        <div className="py-3">
          {openSection && <h2 className="sr-only">{PANEL_SECTION_LABELS[openSection]}</h2>}
          {children}
        </div>
      </ResponsiveSheet>
    )
  }

  return (
    <aside
      aria-label={SHELL_COPY.panelLabel}
      role="complementary"
      className={cn(
        'absolute inset-y-0 right-0 z-20 grid w-full max-w-full grid-rows-[auto_minmax(0,1fr)] border-l border-border/40 bg-card shadow-lg sm:w-[380px] lg:right-12',
        'motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(.32,.72,0,1)]',
        isOpen ? 'translate-x-0' : 'translate-x-full',
      )}
      id={PANEL_ID}
      inert={!isOpen}
    >
      <MeetingPanelHeader headerRef={headerRef} openSection={openSection} onClose={onClose} onSelect={onSelect} />
      <div className="overflow-y-auto overscroll-contain px-4 py-3">
        {openSection && <h2 className="sr-only">{PANEL_SECTION_LABELS[openSection]}</h2>}
        {children}
      </div>
    </aside>
  )
}
