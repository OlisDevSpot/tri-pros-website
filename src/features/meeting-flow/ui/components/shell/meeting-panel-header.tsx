'use client'

import type { RefObject } from 'react'
import type { PanelSection } from '@/features/meeting-flow/types'
import { XIcon } from 'lucide-react'
import { PANEL_SECTIONS } from '@/features/meeting-flow/constants/shell'
import { PANEL_SECTION_LABELS, SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface MeetingPanelHeaderProps {
  openSection: PanelSection | null
  /** The view focuses this header when the panel opens. */
  headerRef: RefObject<HTMLDivElement | null>
  onSelect: (section: PanelSection) => void
  /** Omitted in the drawer: it closes by drag, Escape or the scrim. */
  onClose?: () => void
  className?: string
}

/** Section tabs and the close button, shared by the lg+ overlay panel and the drawer below lg. */
export function MeetingPanelHeader({ openSection, headerRef, onSelect, onClose, className }: MeetingPanelHeaderProps) {
  return (
    <div ref={headerRef} className={cn('flex items-center gap-1 border-b border-border/40 px-2 py-2 outline-none', className)} tabIndex={-1}>
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
      {onClose && (
        <Button className="size-11 shrink-0" size="icon" title={SHELL_COPY.closePanel} variant="ghost" onClick={onClose}>
          <XIcon className="size-5" />
          <span className="sr-only">{SHELL_COPY.closePanel}</span>
        </Button>
      )}
    </div>
  )
}
