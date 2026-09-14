import type { CalendarEvent } from '@/shared/components/calendar/types'
import type { MeetingOutcome, MeetingType } from '@/shared/constants/enums'
import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
import type { MeetingFlowState, TradeSelection } from '@/shared/entities/meetings/schemas'
import type { ScopeOrAddon } from '@/shared/services/providers/notion/lib/scopes/schema'
import type { Trade } from '@/shared/services/providers/notion/lib/trades/schema'
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

// ── Shell (top bar, inspector panel, keys) ─────────────────────────────────

/** Which inspector-panel section is open; the panel is closed when the view holds `null`. */
export type PanelSection = 'meeting' | 'context' | 'persona'

/** Imperative surface a presentation-layout step exposes to the shell's key map. */
export interface PresentationHandle {
  next: () => void
  prev: () => void
}

/** One row of the keyboard help list. */
export interface KeyHint {
  keys: string[]
  label: string
}

export type PointMedia
  = | { type: 'photo', src: string, alt: string }
    | { type: 'portrait', src: string, alt: string }
    | { type: 'pair', before: string, after: string, alt: string }
    | { type: 'placeholder', label: string }
    | { type: 'documents', documents: PresentationDocument[] }

export interface PresentationDocument {
  title: string
  src: string
  alt: string
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

// ── Specialties (trade selection) ───────────────────────────────────────────

/** A trade's catalog entries, split by Notion `entryType`. */
export interface TradeScopeGroup {
  scopes: ScopeOrAddon[]
  addons: ScopeOrAddon[]
}

export interface TradeCatalog {
  trades: Trade[]
  tradesById: ReadonlyMap<string, Trade>
  tradesBySlug: ReadonlyMap<string, Trade>
  scopesByTrade: ReadonlyMap<string, TradeScopeGroup>
  isLoading: boolean
  error: Error | null
  refetch: () => void
}

/** One chosen scope or add-on, as persisted in `TradeSelection.selectedScopes`. */
export type SelectionItem = TradeSelection['selectedScopes'][number]

export interface TradeSelectionActions {
  /** Adds the item when absent, removes it when present. Creates the trade entry on first add. */
  toggleItem: (tradeId: string, item: SelectionItem) => void
  toggleReason: (tradeId: string, reason: string) => void
  setNote: (tradeId: string, note: string) => void
  /** Drops the trade entry entirely: items, reasons, and note. */
  clearTrade: (tradeId: string) => void
}

export interface TradeSelectionContextValue extends TradeSelectionActions {
  selections: TradeSelection[]
  catalog: TradeCatalog
}

export interface OpenTradeOptions {
  /** Scope to scroll into view and focus once the sheet opens. */
  focusScopeId?: string
}

export interface TradeSheetState {
  openTradeId: string | null
  focusScopeId: string | null
  openTrade: (tradeId: string, options?: OpenTradeOptions) => void
  closeTrade: () => void
}

export interface TradePhoto {
  src: string
  alt: string
}

export interface TradePairing {
  pairedSlug: string
  reason: string
}
