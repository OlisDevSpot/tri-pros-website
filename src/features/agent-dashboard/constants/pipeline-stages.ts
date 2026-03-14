import {
  CalendarCheckIcon,
  CalendarIcon,
  CheckCircle2Icon,
  FileEditIcon,
  GitMergeIcon,
  SendIcon,
  XCircleIcon,
} from 'lucide-react'

// ---------- Meetings ----------

export const meetingPipelineStages = [
  'meeting_set',
  'meeting_done',
  'meeting_converted',
] as const

export type MeetingPipelineStage = (typeof meetingPipelineStages)[number]

export interface PipelineStageConfig<S extends string = string> {
  key: S
  label: string
  icon: typeof CalendarIcon
  color: string
}

export const meetingStageConfig: readonly PipelineStageConfig<MeetingPipelineStage>[] = [
  { key: 'meeting_set', label: 'Meeting Set', icon: CalendarIcon, color: 'blue' },
  { key: 'meeting_done', label: 'Meeting Done', icon: CalendarCheckIcon, color: 'yellow' },
  { key: 'meeting_converted', label: 'Converted', icon: GitMergeIcon, color: 'green' },
]

export const MEETING_ALLOWED_DRAG_TRANSITIONS: Record<MeetingPipelineStage, readonly MeetingPipelineStage[]> = {
  meeting_set: ['meeting_done'],
  meeting_done: [],
  meeting_converted: [],
}

export const MEETING_BLOCKED_MESSAGES: Record<string, string> = {
  'meeting_done->meeting_converted': 'Create a proposal from the meeting page to convert',
  'default': 'This transition is not supported via drag',
}

// ---------- Proposals ----------

export const proposalPipelineStages = [
  'proposal_draft',
  'proposal_sent',
  'contract_signed',
  'declined',
] as const

export type ProposalPipelineStage = (typeof proposalPipelineStages)[number]

export const proposalStageConfig: readonly PipelineStageConfig<ProposalPipelineStage>[] = [
  { key: 'proposal_draft', label: 'Draft', icon: FileEditIcon, color: 'slate' },
  { key: 'proposal_sent', label: 'Sent', icon: SendIcon, color: 'orange' },
  { key: 'contract_signed', label: 'Signed', icon: CheckCircle2Icon, color: 'green' },
  { key: 'declined', label: 'Declined', icon: XCircleIcon, color: 'red' },
]

export const PROPOSAL_ALLOWED_DRAG_TRANSITIONS: Record<ProposalPipelineStage, readonly ProposalPipelineStage[]> = {
  proposal_draft: [],
  proposal_sent: ['contract_signed', 'declined'],
  contract_signed: ['proposal_sent'],
  declined: ['proposal_draft'],
}

export const PROPOSAL_BLOCKED_MESSAGES: Record<string, string> = {
  'proposal_draft->proposal_sent': 'Use the send flow to email the proposal',
  'proposal_sent->contract_signed': 'Contracts are completed via DocuSign',
  'default': 'This transition is not supported via drag',
}

// ---------- Union type for shared code ----------

export type PipelineStage = MeetingPipelineStage | ProposalPipelineStage
export type PipelineMode = 'meetings' | 'proposals'
