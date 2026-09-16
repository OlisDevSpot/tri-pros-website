'use client'

import type { ReactNode, RefObject } from 'react'
import type { PanelSection } from '@/features/meeting-flow/types'
import { XIcon } from 'lucide-react'
import { PANEL_ID, PANEL_SECTIONS } from '@/features/meeting-flow/constants/shell'
import { PANEL_SECTION_LABELS, SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { Button } from '@/shared/components/ui/button'
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
 * The shell-owned inspector panel: fixed to the stage's right edge, slides in
 * over the stage, never a Sheet. Non-modal on purpose (no focus trap, no scroll
 * lock): the stage stays usable while it is open. Closed, it is translated out,
 * clipped by the stage row, and `inert`, so nothing inside is focusable or announced.
 * On lg+ it sits under the rail (`right-12`, `z-20` under `z-30`) and slides out
 * from behind it.
 */
export function MeetingPanel({ openSection, headerRef, onSelect, onClose, children }: MeetingPanelProps) {
  const isOpen = openSection !== null

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
      <div ref={headerRef} className="flex items-center gap-1 border-b border-border/40 px-2 py-2 outline-none" tabIndex={-1}>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {PANEL_SECTIONS.map((section) => {
            const isCurrent = openSection === section

            return (
              <Button
                key={section}
                aria-pressed={isCurrent}
                className={cn(
                  'h-11 flex-1 text-xs font-semibold motion-safe:transition-colors',
                  isCurrent
                    ? 'bg-muted text-foreground hover:bg-muted hover:text-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                )}
                size="sm"
                variant="ghost"
                onClick={() => onSelect(section)}
              >
                {PANEL_SECTION_LABELS[section]}
              </Button>
            )
          })}
        </div>
        <Button className="size-11 shrink-0" size="icon" title={SHELL_COPY.closePanel} variant="ghost" onClick={onClose}>
          <XIcon className="size-5" />
          <span className="sr-only">{SHELL_COPY.closePanel}</span>
        </Button>
      </div>
      <div className="overflow-y-auto overscroll-contain px-4 py-3">
        {openSection && <h2 className="sr-only">{PANEL_SECTION_LABELS[openSection]}</h2>}
        {children}
      </div>
    </aside>
  )
}
