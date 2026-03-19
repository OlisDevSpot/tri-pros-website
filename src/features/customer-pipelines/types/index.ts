import type { CustomerPipelineStage } from '../constants/active-pipeline-stages'

import type { Customer, Meeting, Proposal } from '@/shared/db/schema'

export interface CustomerPipelineItem {
  id: string
  type: 'customer'
  stage: CustomerPipelineStage
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string
  totalPipelineValue: number
  meetingCount: number
  proposalCount: number
  latestActivityAt: string
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
  hasCompletedMeeting: boolean
  hasInProgressMeeting: boolean
  hasScheduledFutureMeeting: boolean
  proposalStatuses: string[]
  hasSentContract: boolean
  totalPipelineValue: number
  latestActivityAt: string
}

export type CustomerProfileMeeting
  = Pick<Meeting, 'id' | 'program' | 'status' | 'scheduledFor' | 'createdAt'>
    & { proposals: CustomerProfileProposal[] }

export type CustomerProfileProposal
  = Pick<Proposal, 'id' | 'label' | 'status' | 'sentAt' | 'contractSentAt' | 'meetingId' | 'createdAt'>
    & { trade: string | null, value: number | null, viewCount: number }

export interface CustomerProfileData {
  customer: Customer
  meetings: CustomerProfileMeeting[]
  allProposals: CustomerProfileProposal[]
}
