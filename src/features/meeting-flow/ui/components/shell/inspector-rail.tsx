'use client'

import type { ReactNode } from 'react'
import type { PanelSection } from '@/features/meeting-flow/types'
import { BrainIcon, CalendarClockIcon, ClipboardListIcon } from 'lucide-react'
import { PANEL_ID } from '@/features/meeting-flow/constants/shell'
import { PANEL_SECTION_LABELS, SHELL_COPY } from '@/features/meeting-flow/constants/shell-copy'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

interface InspectorRailProps {
  openSection: PanelSection | null
  contextFilledCount: number
  contextTotalCount: number
  personaHasData: boolean
  onSelect: (section: PanelSection) => void
}

/**
 * The lg+ strip on the stage's right edge: one button per panel section. Sits
 * above the panel (`z-30` over `z-20`) so the panel slides out from behind it.
 * Stays visible in present mode; the internal material is one click away.
 */
export function InspectorRail({ openSection, contextFilledCount, contextTotalCount, personaHasData, onSelect }: InspectorRailProps) {
  const items: { section: PanelSection, icon: ReactNode, badge?: ReactNode, accent?: boolean }[] = [
    { section: 'meeting', icon: <CalendarClockIcon className="size-5" /> },
    {
      section: 'context',
      icon: <ClipboardListIcon className="size-5" />,
      badge: (
        <Badge
          className="absolute -right-1 -top-1 h-4 min-w-4 px-1 text-[9px] tabular-nums"
          variant={contextFilledCount > 0 ? 'secondary' : 'outline'}
        >
          {`${contextFilledCount}/${contextTotalCount}`}
        </Badge>
      ),
    },
    { section: 'persona', icon: <BrainIcon className="size-5" />, accent: personaHasData },
  ]

  return (
    <aside
      aria-label={SHELL_COPY.railLabel}
      className="z-30 hidden w-12 shrink-0 flex-col items-center gap-1 border-l border-border/40 bg-card py-2 lg:flex"
    >
      {items.map(({ section, icon, badge, accent }) => {
        const isOpen = openSection === section

        return (
          <Button
            key={section}
            aria-controls={PANEL_ID}
            aria-expanded={isOpen}
            className={cn(
              'relative size-11 hover:bg-muted hover:text-foreground motion-safe:transition-colors',
              isOpen && 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary',
              !isOpen && accent && 'text-primary',
            )}
            size="icon"
            title={PANEL_SECTION_LABELS[section]}
            variant="ghost"
            onClick={() => onSelect(section)}
          >
            {icon}
            {badge}
            <span className="sr-only">{PANEL_SECTION_LABELS[section]}</span>
          </Button>
        )
      })}
    </aside>
  )
}
