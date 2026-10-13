'use client'

import type { RecentOmniItem } from '@/features/omni-search/types'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { OMNI_RECORD_ICONS } from '@/features/omni-search/constants/omni-search'
import { CommandItem } from '@/shared/components/ui/command'
import { formatAsDollars } from '@/shared/lib/formatters'

type OmniProposal = AppRouterOutputs['searchRouter']['omni']['proposals'][number]

interface Props {
  proposal: OmniProposal
  onSelect: (item: RecentOmniItem) => void
}

export function OmniProposalItem({ proposal, onSelect }: Props) {
  const Icon = OMNI_RECORD_ICONS.proposal
  return (
    <CommandItem
      value={`proposal:${proposal.id}`}
      onSelect={() => onSelect({ key: `proposal:${proposal.id}`, kind: 'proposal', label: proposal.label, sublabel: proposal.customerName, target: proposal.target })}
    >
      <Icon aria-hidden className="text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        <span className="text-foreground">{proposal.label}</span>
        <span className="text-muted-foreground">{` · ${proposal.customerName}`}</span>
      </span>
      {proposal.finalTcpCents !== null && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatAsDollars(proposal.finalTcpCents / 100)}</span>}
      <span className="shrink-0 text-xs text-muted-foreground capitalize">{proposal.status}</span>
    </CommandItem>
  )
}
