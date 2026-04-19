import type { CustomerPipelineStage } from '../constants/active-pipeline-stages'
import type { DeadPipelineStage } from '../constants/dead-pipeline-stages'
import type { RehashPipelineStage } from '../constants/rehash-pipeline-stages'
import type { ProjectStatus } from '@/shared/constants/enums/pipelines'
import type { LeadsPipelineStage } from '@/shared/domains/pipelines/constants/leads-pipeline'
import type { ProjectsPipelineStage } from '@/shared/domains/pipelines/constants/projects-pipeline'

// Re-export entity-level types for backward compatibility
export type {
  CustomerFormValues,
  CustomerProfileData,
  CustomerProfileMeeting,
  CustomerProfileProject,
  CustomerProfileProposal,
  CustomerProfileProposalView,
} from '@/shared/entities/customers/types'

export type { SowTradeScope } from '@/shared/entities/proposals/types'

export interface PipelineItemRep {
  id: string
  name: string
  email: string
  image: string | null
}

export interface PipelineItemProposal {
  id: string
  token: string | null
  value: number | null
  status: string
  createdAt: string
}

export interface PipelineItemProjectMeeting {
  id: string
  ownerId: string
  ownerName: string
  ownerImage: string | null
  proposals: PipelineItemProposal[]
}

export interface PipelineItemProject {
  id: string
  title: string
  address: string | null
  status: ProjectStatus
  pipelineStage: string | null
  startedAt: string | null
  totalValue: number
  meetings: PipelineItemProjectMeeting[]
}

export interface CustomerPipelineItem {
  id: string
  type: 'customer'
  stage: CustomerPipelineStage | RehashPipelineStage | DeadPipelineStage | ProjectsPipelineStage | LeadsPipelineStage
  name: string
  phone: string | null
  /** True when the customer has at least one proposal with status `sent` — used to distinguish a gated (locked) phone from a genuinely missing one. */
  hasSentProposal: boolean
  email: string | null
  address: string | null
  city: string
  state: string | null
  zip: string
  totalPipelineValue: number
  meetingCount: number
  proposalCount: number
  latestActivityAt: string | null
  nextMeetingId: string | null
  nextMeetingAt: string | null
  meetingScheduledFor: string | null
  assignedRep: PipelineItemRep | null
  proposals: PipelineItemProposal[]
  /** Present only in the projects pipeline */
  project: PipelineItemProject | null
}

export interface CustomerPipelineRawData {
  customerId: string
  customerName: string
  customerPhone: string | null
  customerHasSentProposal: boolean
  customerEmail: string | null
  customerAddress: string | null
  customerCity: string
  meetingCount: number
  proposalCount: number
  hasPastMeeting: boolean
  hasActiveMeeting: boolean
  hasScheduledFutureMeeting: boolean
  proposalStatuses: string[]
  hasSentContract: boolean
  latestActivityAt: string | null
}
