export type TimelineEventType
  = 'note_added'
    | 'meeting_created'
    | 'meeting_completed'
    | 'proposal_created'
    | 'proposal_sent'
    | 'contract_sent'
    | 'proposal_viewed'

export interface TimelineEvent {
  id: string
  type: TimelineEventType
  title: string
  description?: string
  timestamp: string
  entityId?: string
  entityType?: 'meeting' | 'proposal' | 'note'
  metadata?: Record<string, unknown>
}
