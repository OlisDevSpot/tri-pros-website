'use client'

import type { CustomerProfileData } from '@/features/pipeline/types'

import { formatDistanceToNow } from 'date-fns'
import { useState } from 'react'

import { ProposalRow } from '@/features/pipeline/ui/components/proposal-row'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

interface Props {
  data: CustomerProfileData
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
        <ToggleGroupItem value="grouped" className="min-w-fit">By Meeting</ToggleGroupItem>
        <ToggleGroupItem value="flat" className="min-w-fit">All</ToggleGroupItem>
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
