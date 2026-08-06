import type { Customer, Meeting, Proposal } from '@/shared/db/schema'
import type { CustomerNote } from '@/shared/db/schema/customer-notes'
import type { CustomerFullView, CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
import type { ProfileKey } from '@/shared/entities/customers/schemas'
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

export type CustomerNoteWithAuthor = CustomerNote & {
  authorName: string | null
  authorImage: string | null
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

// Flat form shape — profile-trio columns (child table, Addendum B) sit
// directly on the form values alongside contact fields and `age` (plain
// Customer column); no more nested JSONB sections.
export type CustomerFormValues = {
  name: string
  phone: string
  email: string
  address: string
  city: string
  state: string
  zip: string
} & Partial<Pick<Customer, 'age'>> & Partial<Pick<CustomerWithProfile, ProfileKey>>

export interface CustomerProfileData {
  customer: CustomerFullView
  meetings: CustomerProfileMeeting[]
  allProposals: CustomerProfileProposal[]
  notes: CustomerNoteWithAuthor[]
  proposalViews: CustomerProfileProposalView[]
  projects: CustomerProfileProject[]
}
