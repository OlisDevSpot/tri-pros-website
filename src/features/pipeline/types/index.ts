import type { CustomerPipelineStage } from '../constants/customer-pipeline-stages'
import type { Customer } from '@/shared/db/schema'

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

export interface CustomerProfileMeeting {
  id: string
  program: string | null
  status: string
  scheduledFor: string | null
  createdAt: string
  proposals: CustomerProfileProposal[]
}

export interface CustomerProfileProposal {
  id: string
  label: string | null
  status: string
  trade: string | null
  value: number | null
  sentAt: string | null
  contractSentAt: string | null
  viewCount: number
  meetingId: string | null
  createdAt: string
}

export interface CustomerProfileData {
  customer: Customer
  meetings: CustomerProfileMeeting[]
  allProposals: CustomerProfileProposal[]
}
