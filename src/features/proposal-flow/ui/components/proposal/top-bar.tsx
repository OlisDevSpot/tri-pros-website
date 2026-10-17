'use client'

import { PanelRightIcon } from 'lucide-react'
import { useState } from 'react'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { Cockpit } from '@/features/proposal-flow/ui/components/cockpit/cockpit'
import { ProposalNavbarMenu } from '@/features/proposal-flow/ui/components/navbar/navbar-menu'
import { ThemeToggleButton } from '@/shared/components/theme-toggle-button'
import { Button } from '@/shared/components/ui/button'

import { ChapterNav } from './chapter-nav'
import { ProposalTopBarFrame } from './top-bar-frame'

export function ProposalTopBar() {
  const { proposal, canAct } = useProposalDocument()
  // Held here, not at the page root, so opening the cockpit doesn't re-render the chapters.
  const [cockpitOpen, setCockpitOpen] = useState(false)

  return (
    <ProposalTopBarFrame tabs={<ChapterNav variant="tabs" />}>
      <div className="min-w-0">
        <p className="truncate font-sans text-base leading-tight font-semibold">{proposal.label}</p>
        {/* Outside the Syne line: the customer name is body type, as in the mock's `.bar1 small`. */}
        {canAct && proposal.customer?.name && <p className="truncate text-xs font-semibold text-muted-foreground">{proposal.customer.name}</p>}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {canAct && (
          <Button
            variant="outline"
            aria-label="Cockpit"
            aria-haspopup="dialog"
            aria-expanded={cockpitOpen}
            onClick={() => setCockpitOpen(true)}
            className="relative h-8.5 gap-1.5 px-2.5 text-sm pointer-coarse:h-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1 pointer-coarse:after:content-[''] @max-[599px]/proposal:w-9 @max-[599px]/proposal:px-0"
          >
            <PanelRightIcon className="size-4" />
            <span className="@max-[599px]/proposal:hidden">Cockpit</span>
          </Button>
        )}
        <ThemeToggleButton animateIn={false} className="relative size-8.5 pointer-coarse:size-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1 pointer-coarse:after:content-['']" />
        <ProposalNavbarMenu />
      </div>
      {canAct && <Cockpit open={cockpitOpen} onOpenChange={setCockpitOpen} />}
    </ProposalTopBarFrame>
  )
}
