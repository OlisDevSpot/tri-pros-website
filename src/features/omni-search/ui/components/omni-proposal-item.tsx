'use client'

import type { OmniProposal, OmniRecordLayout, RecentOmniItem } from '@/features/omni-search/types'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_ICON_TILE_CLASS, OMNI_KIND_LABEL_CLASS, OMNI_RECORD_ICONS, OMNI_ROW_CLASSES } from '@/features/omni-search/constants/omni-search'
import { omniRowLabel } from '@/features/omni-search/lib/omni-row-label'
import { CommandItem } from '@/shared/components/ui/command'
import { formatAsDollars } from '@/shared/lib/formatters'
import { ProposalStatusBadge } from '@/shared/modules/proposals/core/components/proposal-status-badge'

interface Props {
  proposal: OmniProposal
  layout: OmniRecordLayout
  onSelect: (item: RecentOmniItem) => void
  disabled?: boolean
}

export function OmniProposalItem({ proposal, layout, onSelect, disabled }: Props) {
  const Icon = OMNI_RECORD_ICONS.proposal
  const value = `proposal:${proposal.id}`
  const select = () => onSelect({ key: value, kind: 'proposal', label: proposal.label, sublabel: proposal.customerName, target: proposal.target })
  const amount = proposal.finalTcpCents === null ? null : formatAsDollars(proposal.finalTcpCents / 100)
  const label = omniRowLabel(OMNI_COPY.kinds.proposal, proposal.label, proposal.customerName, amount, proposal.status)
  const money = amount && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{amount}</span>
  const badge = <ProposalStatusBadge status={proposal.status} />

  if (layout === 'nested') {
    return (
      <CommandItem aria-label={label} disabled={disabled} value={value} onSelect={select} className={OMNI_ROW_CLASSES.nested}>
        <span className={OMNI_KIND_LABEL_CLASS}>{OMNI_COPY.kinds.proposal}</span>
        <span className="min-w-0 flex-1 truncate text-foreground">{proposal.label}</span>
        {money}
        {badge}
      </CommandItem>
    )
  }

  return (
    <CommandItem aria-label={label} disabled={disabled} value={value} onSelect={select} className={OMNI_ROW_CLASSES.line}>
      <span aria-hidden className={OMNI_ICON_TILE_CLASS}><Icon /></span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-foreground">{proposal.label}</span>
        <span className="truncate text-xs text-muted-foreground">{proposal.customerName}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        {money}
        {badge}
      </span>
    </CommandItem>
  )
}
