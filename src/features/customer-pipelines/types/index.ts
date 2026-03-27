import type { CustomerPipelineStage } from '../constants/active-pipeline-stages'
import type { DeadPipelineStage } from '../constants/dead-pipeline-stages'
import type { RehashPipelineStage } from '../constants/rehash-pipeline-stages'
import type { Customer, Meeting, Proposal } from '@/shared/db/schema'
import type { CustomerNote } from '@/shared/db/schema/customer-notes'
import type { CustomerProfile, FinancialProfile, PropertyProfile } from '@/shared/entities/customers/schemas'

export interface PipelineItemRep {
  id: string
  name: string
  email: string
  image: string | null
}

export interface PipelineItemProposal {
  id: string
  value: number | null
  status: string
  createdAt: string
}

export interface CustomerPipelineItem {
  id: string
  type: 'customer'
  stage: CustomerPipelineStage | RehashPipelineStage | DeadPipelineStage
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
  = Pick<Meeting, 'id' | 'ownerId' | 'meetingType' | 'meetingOutcome' | 'scheduledFor' | 'createdAt' | 'updatedAt'>
    & { proposals: CustomerProfileProposal[] }

export type CustomerProfileProposal
  = Pick<Proposal, 'id' | 'label' | 'status' | 'sentAt' | 'contractSentAt' | 'meetingId' | 'createdAt'>
    & { trade: string | null, value: number | null, viewCount: number }

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
}
