import type { CustomerPipelineStage } from '../constants/active-pipeline-stages'
import type { DeadPipelineStage } from '../constants/dead-pipeline-stages'
import type { RehashPipelineStage } from '../constants/rehash-pipeline-stages'
import type { Customer, Meeting, Proposal } from '@/shared/db/schema'
import type { CustomerNote } from '@/shared/db/schema/customer-notes'
import type { CustomerProfile, FinancialProfile, PropertyProfile } from '@/shared/entities/customers/schemas'
import type { LeadsPipelineStage } from '@/shared/pipelines/constants/leads-pipeline'
import type { ProjectsPipelineStage } from '@/shared/pipelines/constants/projects-pipeline'
import type { ProjectStatus } from '@/shared/types/enums/pipelines'

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
  totalPipelineValue: number
  latestActivityAt: string | null
}

export type CustomerProfileMeeting
  = Pick<Meeting, 'id' | 'ownerId' | 'meetingType' | 'meetingOutcome' | 'scheduledFor' | 'createdAt' | 'updatedAt' | 'projectId'>
    & { proposals: CustomerProfileProposal[] }

export interface SowTradeScope {
  trade: string
  scopes: string[]
}

export type CustomerProfileProposal
  = Pick<Proposal, 'id' | 'label' | 'status' | 'token' | 'sentAt' | 'contractSentAt' | 'meetingId' | 'createdAt'>
    & { trade: string | null, value: number | null, viewCount: number, sowSummary: SowTradeScope[] }

export interface CustomerProfileProject {
  id: string
  title: string
  address: string | null
  status: string
  pipelineStage: string | null
  createdAt: string
  meetings: CustomerProfileMeeting[]
}

export interface CustomerProfileProposalView {
  id: string
  proposalId: string
  viewedAt: string
  source: string
}

export interface CustomerFormValues {
  name: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  zip: string
  customerProfileJSON: Partial<CustomerProfile>
  financialProfileJSON: Partial<FinancialProfile>
  propertyProfileJSON: Partial<PropertyProfile>
}

export interface CustomerProfileData {
  customer: Customer
  meetings: CustomerProfileMeeting[]
  allProposals: CustomerProfileProposal[]
  notes: CustomerNote[]
  proposalViews: CustomerProfileProposalView[]
  projects: CustomerProfileProject[]
}
