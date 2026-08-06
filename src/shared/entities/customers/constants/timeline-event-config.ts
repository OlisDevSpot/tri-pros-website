import type { LucideIcon } from 'lucide-react'

import type { TimelineEventType } from '@/shared/entities/customers/types/timeline'
import {
  CalendarCheckIcon,
  CalendarPlusIcon,
  EyeIcon,
  FilePlusIcon,
  FileSignatureIcon,
  MessageSquareIcon,
  SendIcon,
} from 'lucide-react'

export type TimelineEventCategory = 'note' | 'meeting' | 'proposal'

interface TimelineEventConfig {
  icon: LucideIcon
  label: string
  category: TimelineEventCategory
  // Colors stay stage-safe: only neutral tones + the Cobalt primary, never the
  // fixed red/yellow/green/purple stage semantics. Icon SHAPE carries the
  // event-type distinction; primary marks forward pipeline motion (proposals).
  color: string
}

export const TIMELINE_EVENT_CONFIG: Record<TimelineEventType, TimelineEventConfig> = {
  note_added: { icon: MessageSquareIcon, label: 'Note added', category: 'note', color: 'text-muted-foreground' },
  meeting_created: { icon: CalendarPlusIcon, label: 'Meeting created', category: 'meeting', color: 'text-muted-foreground' },
  meeting_completed: { icon: CalendarCheckIcon, label: 'Meeting completed', category: 'meeting', color: 'text-foreground' },
  proposal_created: { icon: FilePlusIcon, label: 'Proposal created', category: 'proposal', color: 'text-primary' },
  proposal_sent: { icon: SendIcon, label: 'Proposal sent', category: 'proposal', color: 'text-primary' },
  contract_sent: { icon: FileSignatureIcon, label: 'Contract sent', category: 'proposal', color: 'text-primary' },
  proposal_viewed: { icon: EyeIcon, label: 'Proposal viewed', category: 'proposal', color: 'text-muted-foreground' },
}
