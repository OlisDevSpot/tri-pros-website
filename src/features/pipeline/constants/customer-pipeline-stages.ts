import type { KanbanStageConfig } from '@/shared/components/kanban/types'

import {
  CalendarCheckIcon,
  CalendarIcon,
  CheckCircle2Icon,
  PlayCircleIcon,
  RotateCwIcon,
  SendIcon,
  XCircleIcon,
} from 'lucide-react'

export const customerPipelineStages = [
  'meeting_scheduled',
  'meeting_in_progress',
  'meeting_completed',
  'follow_up_scheduled',
  'proposal_sent',
  'contract_sent',
  'approved',
  'declined',
] as const

export type CustomerPipelineStage = (typeof customerPipelineStages)[number]

export const customerStageConfig: readonly KanbanStageConfig<CustomerPipelineStage>[] = [
  { key: 'meeting_scheduled', label: 'Meeting Scheduled', icon: CalendarIcon, color: 'blue' },
  { key: 'meeting_in_progress', label: 'In Progress', icon: PlayCircleIcon, color: 'indigo' },
  { key: 'meeting_completed', label: 'Meeting Done', icon: CalendarCheckIcon, color: 'yellow' },
  { key: 'follow_up_scheduled', label: 'Follow-up', icon: RotateCwIcon, color: 'purple' },
  { key: 'proposal_sent', label: 'Proposal Sent', icon: SendIcon, color: 'orange' },
  { key: 'contract_sent', label: 'Contract Sent', icon: CheckCircle2Icon, color: 'cyan' },
  { key: 'approved', label: 'Approved', icon: CheckCircle2Icon, color: 'green' },
  { key: 'declined', label: 'Declined', icon: XCircleIcon, color: 'red' },
]

export const CUSTOMER_ALLOWED_DRAG_TRANSITIONS: Record<CustomerPipelineStage, readonly CustomerPipelineStage[]> = {
  meeting_scheduled: ['meeting_in_progress'],
  meeting_in_progress: ['meeting_completed'],
  meeting_completed: [],
  follow_up_scheduled: ['meeting_completed'],
  proposal_sent: ['declined'],
  contract_sent: [],
  approved: [],
  declined: [],
}

export const CUSTOMER_BLOCKED_MESSAGES: Record<string, string> = {
  'meeting_completed->proposal_sent': 'Create a proposal from the meeting page',
  'meeting_completed->follow_up_scheduled': 'Schedule a follow-up meeting from the meeting page',
  'proposal_sent->contract_sent': 'Contracts are sent via DocuSign',
  'contract_sent->approved': 'Approval happens when the customer signs via DocuSign',
  'declined->meeting_scheduled': 'Schedule a new follow-up meeting from the customer profile',
  'default': 'This transition is not supported via drag',
}
