import type { PipelineConfig, PipelineStageConfig } from '../types'

import {
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarIcon,
  CheckCircle2Icon,
  PlayCircleIcon,
  RotateCwIcon,
  SendIcon,
  UserCheckIcon,
  XCircleIcon,
} from 'lucide-react'

import { freshMeetingStages, freshProposalStages } from '@/shared/constants/enums/pipelines'

export const freshPipelineStages = [...freshMeetingStages, ...freshProposalStages] as const

export type FreshPipelineStage = (typeof freshPipelineStages)[number]

export const freshStageConfig: readonly PipelineStageConfig<FreshPipelineStage>[] = [
  { key: 'needs_confirmation', label: 'Needs Confirmation', icon: CalendarIcon, color: 'orange' },
  { key: 'meeting_confirmed', label: 'Confirmed', icon: UserCheckIcon, color: 'blue' },
  { key: 'reschedule', label: 'Reschedule', icon: CalendarClockIcon, color: 'yellow' },
  { key: 'meeting_in_progress', label: 'In Progress', icon: PlayCircleIcon, color: 'yellow' },
  { key: 'meeting_completed', label: 'Meeting Done', icon: CalendarCheckIcon, color: 'yellow' },
  { key: 'follow_up_scheduled', label: 'Follow-up', icon: RotateCwIcon, color: 'purple' },
  { key: 'proposal_sent', label: 'Proposal Sent', icon: SendIcon, color: 'purple' },
  { key: 'contract_sent', label: 'Contract Sent', icon: CheckCircle2Icon, color: 'purple' },
  { key: 'approved', label: 'Approved', icon: CheckCircle2Icon, color: 'green' },
  { key: 'declined', label: 'Declined', icon: XCircleIcon, color: 'red' },
]

export const FRESH_ALLOWED_DRAG_TRANSITIONS: Record<FreshPipelineStage, readonly FreshPipelineStage[]> = {
  needs_confirmation: ['meeting_confirmed'],
  meeting_confirmed: ['needs_confirmation'],
  reschedule: [],
  meeting_in_progress: ['meeting_completed'],
  meeting_completed: [],
  follow_up_scheduled: ['meeting_completed'],
  proposal_sent: ['declined'],
  contract_sent: [],
  approved: [],
  declined: [],
}

export const FRESH_BLOCKED_MESSAGES: Record<string, string> = {
  'needs_confirmation->meeting_in_progress': 'A meeting moves to In Progress on its own at the scheduled time',
  'meeting_confirmed->meeting_in_progress': 'A meeting moves to In Progress on its own at the scheduled time',
  'needs_confirmation->reschedule': 'Set the meeting outcome to Reschedule needed',
  'meeting_confirmed->reschedule': 'Set the meeting outcome to Reschedule needed',
  'meeting_completed->proposal_sent': 'Create a proposal from the meeting page',
  'meeting_completed->follow_up_scheduled': 'Schedule a follow-up meeting from the meeting page',
  'meeting_completed->reschedule': 'Use the Reschedule action on the meeting',
  'proposal_sent->contract_sent': 'Contracts are sent via Zoho Sign',
  'contract_sent->approved': 'Approval happens when the customer signs via Zoho Sign',
  'declined->needs_confirmation': 'Schedule a new follow-up meeting from the customer profile',
  'default': 'This transition is not supported via drag',
}

export const freshPipelineConfig: PipelineConfig<FreshPipelineStage> = {
  stages: freshPipelineStages,
  stageConfig: freshStageConfig,
  allowedTransitions: FRESH_ALLOWED_DRAG_TRANSITIONS,
  blockedMessages: FRESH_BLOCKED_MESSAGES,
}
