import type { ProjectStatusBucket } from '@/shared/constants/enums/pipelines'
import type { DeadPipelineStage } from '@/shared/domains/pipelines/constants/dead-pipeline'
import type { FreshPipelineStage } from '@/shared/domains/pipelines/constants/fresh-pipeline'
import type { LeadsPipelineStage } from '@/shared/domains/pipelines/constants/leads-pipeline'
import type { ProjectsPipelineStage } from '@/shared/domains/pipelines/constants/projects-pipeline'
import type { RehashPipelineStage } from '@/shared/domains/pipelines/constants/rehash-pipeline'

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
  status: ProjectStatusBucket
  pipelineStage: string | null
  startedAt: string | null
  totalValue: number
  meetings: PipelineItemProjectMeeting[]
}

export interface CustomerPipelineItem {
  id: string
  type: 'customer'
  stage: FreshPipelineStage | RehashPipelineStage | DeadPipelineStage | ProjectsPipelineStage | LeadsPipelineStage
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
  meetingConfirmedAt: string | null
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
  hasConfirmedFutureMeeting: boolean
  hasFollowUpNeeded: boolean
  hasRescheduleNeeded: boolean
  proposalStatuses: string[]
  hasSentContract: boolean
  latestActivityAt: string | null
}
