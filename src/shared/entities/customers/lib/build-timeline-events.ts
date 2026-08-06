import type { CustomerProfileData } from '@/shared/entities/customers/types'
import type { TimelineEvent } from '@/shared/entities/customers/types/timeline'

export function buildTimelineEvents(data: CustomerProfileData): TimelineEvent[] {
  const events: TimelineEvent[] = []

  // proposalId → parent meetingId, so proposal/view events can navigate to
  // the meeting that owns them (proposals render nested under meetings).
  const meetingIdByProposal = new Map<string, string>()
  for (const meeting of data.meetings) {
    for (const proposal of meeting.proposals) {
      meetingIdByProposal.set(proposal.id, meeting.id)
    }
  }

  // Notes
  for (const note of data.notes) {
    events.push({
      id: `note-${note.id}`,
      type: 'note_added',
      title: note.content,
      timestamp: note.createdAt,
      entityId: note.id,
      entityType: 'note',
      metadata: { authorId: note.authorId },
    })
  }

  // Meeting events
  for (const meeting of data.meetings) {
    events.push({
      id: `meeting-created-${meeting.id}`,
      type: 'meeting_created',
      title: `Meeting created — ${meeting.meetingType ?? 'Meeting'}`,
      timestamp: meeting.createdAt,
      entityId: meeting.id,
      entityType: 'meeting',
      metadata: { meetingId: meeting.id },
    })

    if (meeting.meetingOutcome !== 'not_set') {
      events.push({
        id: `meeting-completed-${meeting.id}`,
        type: 'meeting_completed',
        title: `Meeting completed — ${humanizeToken(meeting.meetingOutcome)}`,
        timestamp: meeting.updatedAt,
        entityId: meeting.id,
        entityType: 'meeting',
        metadata: { meetingId: meeting.id },
      })
    }

    // Proposal events from each meeting
    for (const proposal of meeting.proposals) {
      events.push({
        id: `proposal-created-${proposal.id}`,
        type: 'proposal_created',
        title: `Proposal created — ${proposal.label || 'Untitled'}`,
        timestamp: proposal.createdAt,
        entityId: proposal.id,
        entityType: 'proposal',
        metadata: { meetingId: meeting.id, trade: proposal.trade, value: proposal.value },
      })

      if (proposal.sentAt) {
        events.push({
          id: `proposal-sent-${proposal.id}`,
          type: 'proposal_sent',
          title: `Proposal sent — ${proposal.label || 'Untitled'}`,
          timestamp: proposal.sentAt,
          entityId: proposal.id,
          entityType: 'proposal',
          metadata: { meetingId: meeting.id, value: proposal.value },
        })
      }

      if (proposal.contractSentAt) {
        events.push({
          id: `contract-sent-${proposal.id}`,
          type: 'contract_sent',
          title: `Contract sent — ${proposal.label || 'Untitled'}`,
          timestamp: proposal.contractSentAt,
          entityId: proposal.id,
          entityType: 'proposal',
          metadata: { meetingId: meeting.id },
        })
      }
    }
  }

  // Proposal views are machine telemetry that can fire many times — aggregate
  // per proposal into a single "viewed N×" event (most-recent view drives its
  // position) so a customer refreshing the page can't bury real milestones.
  const viewsByProposal = new Map<string, { count: number, latest: string }>()
  for (const view of data.proposalViews) {
    const existing = viewsByProposal.get(view.proposalId)
    if (!existing) {
      viewsByProposal.set(view.proposalId, { count: 1, latest: view.viewedAt })
    }
    else {
      existing.count += 1
      if (new Date(view.viewedAt).getTime() > new Date(existing.latest).getTime()) {
        existing.latest = view.viewedAt
      }
    }
  }

  for (const [proposalId, { count, latest }] of viewsByProposal) {
    const proposal = data.allProposals.find(p => p.id === proposalId)
    events.push({
      id: `views-${proposalId}`,
      type: 'proposal_viewed',
      title: `Customer viewed — ${proposal?.label || 'Proposal'}`,
      timestamp: latest,
      entityId: proposalId,
      entityType: 'proposal',
      metadata: { meetingId: meetingIdByProposal.get(proposalId), count },
    })
  }

  // Sort reverse chronological
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return events
}

// Turn a raw enum token ("no_show") into a human label ("No show").
function humanizeToken(token: string): string {
  const spaced = token.replace(/_/g, ' ')
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}
