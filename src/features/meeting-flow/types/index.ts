import type { CalendarEvent } from '@/shared/components/calendar/types'
import type { MeetingOutcome, MeetingType } from '@/shared/constants/enums'
import type { ProjectMediaFile } from '@/shared/db/schema'
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

/** `page` = padded scrolling document; `presentation` = the step owns a snapping scroller; `split` = the step owns two independent scrollers (showcase + work column). */
export type MeetingStepLayout = 'page' | 'presentation' | 'split'

// ── Shell (top bar, inspector panel, keys) ─────────────────────────────────

/** Which inspector-panel section is open; the panel is closed when the view holds `null`. */
export type PanelSection = 'meeting' | 'project' | 'context' | 'persona'

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

/** Full-bleed media behind a point's copy. */
export type PointMedia
  = | { type: 'photo', src: string, alt: string }
    | { type: 'pair', before: string, after: string, alt: string }

/** A paper document shown on the stage; every page shares one pixel size. */
export interface PresentationDocument {
  title: string
  alt: string
  pages: string[]
  width: number
  height: number
}

/** A figure with what it means, e.g. `$2M` / `Insurance per project`. */
export interface ProofFigure {
  value: string
  label: string
}

/** One mark in the licensing beat's reputation line. */
export type ReputationMark
  = | { kind: 'fact', value: string, label: string }
    | { kind: 'rating', platform: 'Google' | 'Yelp', rating: string, count: number }

/** The meeting owner, introduced in the Communication beat. */
export interface PresentationAgent {
  name: string
  image: string | null
  email: string
  phone: string | null
  yearsOfExperience: number | null
}

export interface ComparisonRow {
  label: string
  triPros: string
  others: string
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
    number: number
    title: string
    line: string
    documents: PresentationDocument[]
    protection: ProofFigure[]
    reputation: ReputationMark[]
  }
  | {
    kind: 'sample'
    id: string
    number: number
    title: string
    line: string
    proof: ProofFigure
    document: PresentationDocument
    openLabel: string
  }
  | {
    kind: 'point'
    id: string
    number: number
    title: string
    line: string
    proof: ProofFigure
    media: PointMedia
  }
  | {
    kind: 'agent'
    id: string
    number: number
    title: string
    line: string
    cardRole: string
    commitments: string[]
  }
  | {
    kind: 'team'
    id: string
    number: number
    title: string
    line: string
    proof: ProofFigure
    partner: { name: string, title: string, image: string, points: string[] }
    teamPhotoLabel: string
  }
  | {
    kind: 'comparison'
    id: string
    title: string
    rows: ComparisonRow[]
  }
  | {
    kind: 'truth'
    id: string
    tableTitle: string
    rows: ComparisonRow[]
    title: string
    quote: string
    ctaLabel: string
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

export interface TradePhoto {
  src: string
  alt: string
}

export interface TradePairing {
  pairedSlug: string
  reason: string
}

/** A portfolio project reduced to what the showcase shows. */
export interface ShowcaseProject {
  id: string
  city: string | null
  state: string | null
  duration: string | null
  heroImage: ProjectMediaFile
  scopeIds: string[]
}

export interface ShowcaseProjectIndex {
  /** Projects tagged with any of the trade's scopes, most matching scopes first. */
  byTrade: ReadonlyMap<string, ShowcaseProject[]>
  /** Projects tagged with the scope, in portfolio order. */
  byScope: ReadonlyMap<string, ShowcaseProject[]>
}

/** One photo the showcase can put on stage. `key` is stable: a curated photo's `src`, or `project:<id>`. */
export type ShowcaseMedia
  = | { key: string, kind: 'project', file: ProjectMediaFile, caption: string }
    | { key: string, kind: 'curated', photo: TradePhoto, caption: string }

export interface TradeBenefit {
  headline: string
  body: string
}

/** Stable once both reads have loaded. */
export interface TradeCatalogContextValue {
  catalog: TradeCatalog
  projects: ShowcaseProjectIndex
}

/** Stable callbacks; they never change on a toggle. */
export interface TradeActions {
  /** Adds the item when absent, removes it when present. Creates the trade entry on first add. */
  toggleItem: (tradeId: string, item: SelectionItem) => void
  toggleReason: (tradeId: string, reason: string) => void
  setNote: (tradeId: string, note: string) => void
  /** Drops the trade entry entirely: items, reasons, and note. */
  removeTrade: (tradeId: string) => void
  /** Puts a removed entry back (Undo), replacing any entry for the same trade. */
  restoreTrade: (entry: TradeSelection) => void
}

export interface TradeStageState {
  /** The trade on stage, resolved: `?trade=` when it names a catalog trade, else the first on-project trade, else the first catalog trade. */
  stageTradeId: string | null
  /** The photo on stage; null means the stage trade's first photo. Reset whenever the stage trade changes. */
  stageMediaKey: string | null
  /** `null` clears the explicit choice so the stage falls back to the default. */
  showTrade: (tradeId: string | null) => void
  showMedia: (key: string | null) => void
}

export interface SwitcherGroup {
  key: string
  label: string
  trades: Trade[]
}
