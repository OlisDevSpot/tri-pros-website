'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { CockpitButton } from '@/features/proposal-flow/ui/components/cockpit/cockpit-button'
import { ProposalNavbarMenu } from '@/features/proposal-flow/ui/components/navbar/navbar-menu'
import { ThemeToggleButton } from '@/shared/components/theme-toggle-button'

import { ChapterNav } from './chapter-nav'
import { ProposalTopBarFrame } from './top-bar-frame'

export function ProposalTopBar() {
  const { proposal, canAct } = useProposalDocument()

  return (
    <ProposalTopBarFrame tabs={<ChapterNav variant="tabs" />}>
      <div className="min-w-0">
        <p className="truncate font-sans text-base leading-tight font-semibold">{proposal.label}</p>
        {/* Outside the Syne line: the customer name is body type, as in the mock's `.bar1 small`. */}
        {canAct && proposal.customer?.name && <p className="truncate text-xs font-semibold text-muted-foreground">{proposal.customer.name}</p>}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {canAct && <CockpitButton />}
        <ThemeToggleButton animateIn={false} className="relative size-8.5 pointer-coarse:size-9 pointer-coarse:after:absolute pointer-coarse:after:-inset-1 pointer-coarse:after:content-['']" />
        <ProposalNavbarMenu />
      </div>
    </ProposalTopBarFrame>
  )
}
