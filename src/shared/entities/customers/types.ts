import type { Customer, Meeting, Proposal } from '@/shared/db/schema'
import type { CustomerNote } from '@/shared/db/schema/customer-notes'
import type { CustomerProfile, FinancialProfile, PropertyProfile } from '@/shared/entities/customers/schemas'
import type { SowTradeScope } from '@/shared/entities/proposals/types'

export type CustomerProfileMeeting
  = Pick<Meeting, 'id' | 'ownerId' | 'meetingType' | 'meetingOutcome' | 'scheduledFor' | 'createdAt' | 'updatedAt' | 'projectId'>
    & { proposals: CustomerProfileProposal[] }

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

export interface ProfileFieldConfig {
  id: string
  label: string
  type: 'select' | 'multi-select' | 'number' | 'boolean' | 'textarea' | 'text'
  options?: readonly string[]
  placeholder?: string
  min?: number
  max?: number
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
