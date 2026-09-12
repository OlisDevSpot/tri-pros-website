import type { CalendarEvent } from '@/shared/components/calendar/types'
import type { MeetingOutcome, MeetingType } from '@/shared/constants/enums'
import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
import type { MeetingFlowState, TradeSelection } from '@/shared/entities/meetings/schemas'
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
  customer: CustomerWithProfile | null
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

// ── Presentation (scroll-snap step layout) ─────────────────────────────────

/** `page` = padded scrolling document; `presentation` = the step owns a snapping scroller. */
export type MeetingStepLayout = 'page' | 'presentation'

export type PointMedia
  = | { type: 'photo', src: string, alt: string }
    | { type: 'portrait', src: string, alt: string }
    | { type: 'pair', before: string, after: string, alt: string }
    | { type: 'placeholder', label: string }

export interface PresentationDocument {
  title: string
  src: string
  alt: string
}

export interface ProofItem {
  value: string
  label: string
}

/** What the pinned column shows for one section. */
export interface PinnedSummary {
  number?: number
  title: string
  line: string
  count?: string
}

export type WhoWeAreSection
  = | {
    kind: 'hook'
    id: string
    title: string
    subtitle: string
    accent: string
    image: string
    imageAlt: string
  }
  | {
    kind: 'credentials'
    id: string
    title: string
    documents: PresentationDocument[]
    proof: ProofItem[]
  }
  | {
    kind: 'point'
    id: string
    number: number
    title: string
    line: string
    proof: string
    proofLabel: string
    media: PointMedia
  }
  | {
    kind: 'truth'
    id: string
    title: string
    quote: string
    ctaLabel: string
    image: string
    imageAlt: string
  }

// ── Flow Context (passed to step components) ────────────────────────────────

export interface MeetingFlowContext {
  meetingId: string
  customerId: string | null
  customer: CustomerWithProfile | null
  flowState: MeetingFlowState | null
  onFlowStateChange: (patch: Partial<MeetingFlowState>) => void
  onCustomerProfileChange: (patch: Record<string, unknown>) => void
}

// ── Calendar Event ──────────────────────────────────────────────────────────

export interface MeetingCalendarEvent extends CalendarEvent {
  meetingId: string
  meetingOutcome: MeetingOutcome
  meetingType: MeetingType
  customerId: string | null
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
