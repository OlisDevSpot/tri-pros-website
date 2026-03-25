import type { LucideIcon } from 'lucide-react'

import type { TimelineEventType } from '@/features/customer-pipelines/types/timeline'
import {
  CalendarCheckIcon,
  CalendarPlusIcon,
  EyeIcon,
  FilePlusIcon,
  FileSignatureIcon,
  MessageSquareIcon,
  SendIcon,
} from 'lucide-react'

interface TimelineEventConfig {
  icon: LucideIcon
  label: string
  color: string
}

export const TIMELINE_EVENT_CONFIG: Record<TimelineEventType, TimelineEventConfig> = {
  note_added: { icon: MessageSquareIcon, label: 'Note', color: 'text-blue-500' },
  meeting_created: { icon: CalendarPlusIcon, label: 'Meeting Created', color: 'text-purple-500' },
  meeting_completed: { icon: CalendarCheckIcon, label: 'Meeting Completed', color: 'text-green-500' },
  proposal_created: { icon: FilePlusIcon, label: 'Proposal Created', color: 'text-indigo-500' },
  proposal_sent: { icon: SendIcon, label: 'Proposal Sent', color: 'text-orange-500' },
  contract_sent: { icon: FileSignatureIcon, label: 'Contract Sent', color: 'text-amber-500' },
  proposal_viewed: { icon: EyeIcon, label: 'Viewed', color: 'text-slate-500' },
}
