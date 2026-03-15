'use client'

import type { CustomerProfileData, CustomerProfileProposal } from '@/features/pipeline/types'

import { formatDistanceToNow } from 'date-fns'
import { ExternalLinkIcon, EyeIcon, FlameIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { EmptyState } from '@/shared/components/states/empty-state'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface Props {
  data: CustomerProfileData
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-slate-500/10 text-slate-600',
  sent: 'bg-orange-500/10 text-orange-600',
  approved: 'bg-green-500/10 text-green-600',
  declined: 'bg-red-500/10 text-red-600',
}

export function CustomerProposalsList({ data }: Props) {
  const [view, setView] = useState<'grouped' | 'flat'>('grouped')

  if (data.allProposals.length === 0) {
    return <EmptyState title="No proposals" description="No proposals created for this customer" />
  }

  return (
    <div className="space-y-3">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={view}
        onValueChange={(v) => {
          if (v) {
            setView(v as 'grouped' | 'flat')
          }
        }}
      >
        <ToggleGroupItem value="grouped">By Meeting</ToggleGroupItem>
        <ToggleGroupItem value="flat">All</ToggleGroupItem>
      </ToggleGroup>

      {view === 'grouped'
        ? (
            <div className="space-y-4">
              {data.meetings.filter(m => m.proposals.length > 0).map(meeting => (
                <div key={meeting.id} className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    {meeting.program ?? 'Meeting'}
                    {' '}
                    &middot;
                    {' '}
                    {formatDistanceToNow(new Date(meeting.createdAt), { addSuffix: true })}
                  </p>
                  <div className="space-y-1">
                    {meeting.proposals.map(p => (
                      <ProposalRow key={p.id} proposal={p} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        : (
            <div className="space-y-1">
              {data.allProposals.map(p => (
                <ProposalRow key={p.id} proposal={p} />
              ))}
            </div>
          )}
    </div>
  )
}

function ProposalRow({ proposal }: { proposal: CustomerProfileProposal }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-muted/50">
      <div className="flex items-center gap-2 min-w-0">
        <Badge variant="secondary" className={`text-[10px] ${STATUS_COLORS[proposal.status] ?? ''}`}>
          {proposal.status}
        </Badge>
        <span className="text-sm truncate max-w-48">{proposal.label || 'Untitled'}</span>
        {proposal.trade && (
          <span className="text-xs text-muted-foreground truncate">{proposal.trade}</span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {proposal.value != null && proposal.value > 0 && (
          <span className="text-green-600 font-medium text-sm tabular-nums">
            $
            {proposal.value.toLocaleString()}
          </span>
        )}
        {proposal.viewCount > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            {proposal.viewCount >= 3 && <FlameIcon size={11} className="text-orange-500" />}
            <EyeIcon size={11} />
            {proposal.viewCount}
          </span>
        )}
        <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
          <Link href={`/dashboard?step=edit-proposal&proposalId=${proposal.id}`}>
            <ExternalLinkIcon size={12} />
          </Link>
        </Button>
      </div>
    </div>
  )
}
