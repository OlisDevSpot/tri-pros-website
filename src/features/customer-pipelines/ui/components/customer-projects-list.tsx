'use client'

import type { CustomerProfileData, CustomerProfileProposal } from '@/features/customer-pipelines/types'

import { MeetingProposalRow } from '@/features/customer-pipelines/ui/components/meeting-proposal-row'
import { ProjectEntityCard } from '@/features/customer-pipelines/ui/components/project-entity-card'
import { EmptyState } from '@/shared/components/states/empty-state'
import { Card, CardContent } from '@/shared/components/ui/card'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'
import { cn } from '@/shared/lib/utils'

interface Props {
  data: CustomerProfileData
  onMutationSuccess: () => void
  highlightMeetingId?: string
}

export function CustomerProjectsList({ data, onMutationSuccess, highlightMeetingId }: Props) {
  // Meetings NOT assigned to any project
  const unassignedMeetings = data.meetings.filter(m => !m.projectId)

  if (data.projects.length === 0 && unassignedMeetings.length === 0) {
    return <EmptyState description="Projects are created when a meeting is converted" title="No Projects" />
  }

  return (
    <div className="space-y-4">
      {/* Project cards (each wraps its meetings) */}
      {data.projects.map(project => (
        <ProjectEntityCard
          key={project.id}
          customerId={data.customer.id}
          highlightMeetingId={highlightMeetingId}
          onMutationSuccess={onMutationSuccess}
          project={project}
        />
      ))}

      {/* Unassigned meetings (Fresh pipeline meetings with no project) */}
      {unassignedMeetings.length > 0 && (
        <div className="space-y-2">
          {data.projects.length > 0 && (
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Fresh Meetings
            </span>
          )}
          {unassignedMeetings.map(meeting => (
            <Card key={meeting.id} className={cn('group pt-0 pb-0 gap-0', meeting.id === highlightMeetingId && 'outline-2 outline-primary -outline-offset-2 shadow-sm')}>
              <CardContent className="p-0">
                <MeetingOverviewCard meeting={meeting} customerId={data.customer.id}>
                  <MeetingOverviewCard.Header className="px-3 py-2">
                    <MeetingOverviewCard.Fields fields={[
                      { field: 'scheduledDate', format: 'full' },
                      { field: 'type' },
                      { field: 'outcome' },
                      { field: 'proposalCount' },
                    ]}
                    />
                    <MeetingOverviewCard.CreatedAt />
                    <MeetingOverviewCard.Actions mode="compact" className="ml-auto opacity-60 hover:opacity-100 transition-opacity" />
                  </MeetingOverviewCard.Header>
                  <MeetingOverviewCard.Proposals
                    showHeader={false}
                    className="border-t px-3 pt-2 pb-2 space-y-0.5"
                    renderProposal={p => (
                      <MeetingProposalRow
                        key={p.id}
                        proposal={p as CustomerProfileProposal}
                        onMutationSuccess={onMutationSuccess}
                      />
                    )}
                  />
                </MeetingOverviewCard>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
