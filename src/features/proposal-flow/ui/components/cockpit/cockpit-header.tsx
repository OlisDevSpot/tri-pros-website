'use client'

import type { ProposalFieldConfig } from '@/shared/modules/proposals/core/components/overview-card'

import { XIcon } from 'lucide-react'

import { COCKPIT_HEADER_HIDDEN, COCKPIT_HEADER_TOOLBAR } from '@/features/proposal-flow/constants/cockpit-actions'
import { Button } from '@/shared/components/ui/button'
import { ProposalOverviewCard, useProposalOverviewCard } from '@/shared/modules/proposals/core/components/overview-card'

import { useCockpitOpen } from './cockpit-open-context'

export function CockpitHeader() {
  const { setOpen } = useCockpitOpen()
  const { proposal } = useProposalOverviewCard()
  const fields: ProposalFieldConfig[] = [
    { field: 'status', variant: 'badge' },
    { field: 'value' },
    proposal.sentAt ? { field: 'sentAt' } : { field: 'createdAt', format: 'date-only' },
    { field: 'viewCount' },
  ]

  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-2.5 pt-2.5 pr-3 pb-2 pl-4.5">
        <div className="grid min-w-0 flex-1 gap-1">
          <h2 className="font-sans text-lg leading-tight font-medium">Cockpit</h2>
          <ProposalOverviewCard.Fields fields={fields} className="gap-x-3" />
        </div>
        {/* The sheet returns focus to the Cockpit button once it closes. */}
        <Button variant="ghost" size="icon" aria-label="Close" className="pointer-coarse:size-11" onClick={() => setOpen(false)}>
          <XIcon className="size-4" />
        </Button>
      </div>
      <ProposalOverviewCard.Actions mode="toolbar" roles={COCKPIT_HEADER_TOOLBAR} hide={COCKPIT_HEADER_HIDDEN} className="flex-nowrap gap-1 pr-3.5 pb-3 pl-4.5" />
    </div>
  )
}
