import type { CustomerProfileData } from '@/features/customer-pipelines/types'
import type { TimelineEvent } from '@/features/customer-pipelines/types/timeline'

export function buildTimelineEvents(data: CustomerProfileData): TimelineEvent[] {
  const events: TimelineEvent[] = []

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
      title: `Meeting created — ${meeting.type ?? 'Meeting'}`,
      description: meeting.program ?? undefined,
      timestamp: meeting.createdAt,
      entityId: meeting.id,
      entityType: 'meeting',
    })

    if (meeting.status === 'completed' || meeting.status === 'converted') {
      events.push({
        id: `meeting-completed-${meeting.id}`,
        type: 'meeting_completed',
        title: `Meeting completed — ${meeting.program ?? 'Meeting'}`,
        timestamp: meeting.updatedAt,
        entityId: meeting.id,
        entityType: 'meeting',
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
        metadata: { trade: proposal.trade, value: proposal.value },
      })

      if (proposal.sentAt) {
        events.push({
          id: `proposal-sent-${proposal.id}`,
          type: 'proposal_sent',
          title: `Proposal sent — ${proposal.label || 'Untitled'}`,
          timestamp: proposal.sentAt,
          entityId: proposal.id,
          entityType: 'proposal',
          metadata: { value: proposal.value },
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
        })
      }
    }
  }

  // Proposal view events
  for (const view of data.proposalViews) {
    const proposal = data.allProposals.find(p => p.id === view.proposalId)
    events.push({
      id: `view-${view.id}`,
      type: 'proposal_viewed',
      title: `Customer viewed — ${proposal?.label || 'Proposal'}`,
      timestamp: view.viewedAt,
      entityId: view.proposalId,
      entityType: 'proposal',
    })
  }

  // Sort reverse chronological
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return events
}
