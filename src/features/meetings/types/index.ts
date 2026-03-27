import type { CalendarEvent } from '@/shared/components/calendar/types'
import type { Customer } from '@/shared/db/schema'
import type { MeetingFlowState, TradeSelection } from '@/shared/entities/meetings/schemas'
import type { MeetingOutcome, MeetingType } from '@/shared/types/enums'
import type { JsonbSection } from '@/shared/types/jsonb'

// ── Intake Collection Field (used by intake step components) ────────────────

export interface CollectionField {
  entity: 'customer' | 'meeting'
  id: string
  jsonbKey: JsonbSection
  label: string
  type: 'text' | 'select' | 'number' | 'boolean' | 'rating'
  options?: readonly string[]
  placeholder?: string
  required?: boolean
  min?: number
  max?: number
}

// ── Program Types ───────────────────────────────────────────────────────────

export interface ProgramIncentive {
  id: string
  label: string
  description: string
  valueDisplay: string
  valueType: 'fixed' | 'percentage' | 'credit'
  calculateDeduction: (tcp: number) => number
}

export interface ProgramPresentation {
  story: string
  history: string
  timeline: string
  faqs: { question: string, answer: string }[]
  keyStats: { label: string, value: string }[]
}

export interface QualificationContext {
  tradeSelections: TradeSelection[]
  customer: Customer | null
  meetingType: MeetingType
}

export interface QualificationResult {
  qualified: boolean
  reason: string
  matchedCriteria: string[]
  missedCriteria: string[]
}

export interface MeetingProgram {
  accessor: string
  name: string
  tagline: string
  accentColor: 'amber' | 'sky' | 'violet'
  qualify: (ctx: QualificationContext) => QualificationResult
  incentives: ProgramIncentive[]
  expiresLabel: string
  presentation: ProgramPresentation
}

// ── Step Types ──────────────────────────────────────────────────────────────

export type MeetingStepId
  = | 'who-we-are'
    | 'specialties'
    | 'portfolio'
    | 'program'
    | 'deal-structure'
    | 'closing'
    | 'create-proposal'

export interface MeetingStepConfig {
  id: MeetingStepId
  stepNumber: number
  title: string
  shortLabel: string
  isCustomerFacing: boolean
}

// ── Flow Context (passed to step components) ────────────────────────────────

export interface MeetingFlowContext {
  meetingId: string
  customerId: string | null
  customer: Customer | null
  flowState: MeetingFlowState | null
  onFlowStateChange: (patch: Partial<MeetingFlowState>) => void
  onCustomerProfileChange: (jsonbKey: string, patch: Record<string, unknown>) => void
}

// ── Calendar Event ──────────────────────────────────────────────────────────

export interface MeetingCalendarEvent extends CalendarEvent {
  meetingId: string
  meetingOutcome: MeetingOutcome
  meetingType: MeetingType
  ownerId: string
  ownerName: string | null
  ownerImage: string | null
  customerName: string | null
  customerPhone: string | null
  customerAddress: string | null
  customerCity: string | null
  customerState: string | null
  customerZip: string | null
  createdAt: string
}
