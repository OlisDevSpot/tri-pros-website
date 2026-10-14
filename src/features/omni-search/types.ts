import type { LucideIcon } from 'lucide-react'

import type { OmniTarget } from '@/shared/domains/omni-search/schemas'
import type { AppRouterOutputs } from '@/trpc/routers/app'

export type OmniActionId = 'toggle-theme' | 'action-center' | 'sign-out' | 'schedule-meeting'
export type OmniMode = 'root' | 'schedule-meeting'
export type OmniEntryGroup = 'go-to' | 'actions'

interface OmniEntryBase {
  id: string
  label: string
  /** Shown beside the label and matched like an alias, e.g. "Calculators". */
  parent?: string
  aliases: readonly string[]
  icon: LucideIcon
  group: OmniEntryGroup
  /** Listed before anything is typed. */
  featured?: boolean
}

export type OmniEntry = OmniEntryBase & ({ href: string } | { action: OmniActionId })

export interface RankedOmniEntry {
  entry: OmniEntry
  score: number
}

export type OmniRecordKind = 'customer' | 'meeting' | 'proposal' | 'project'

export interface RecentOmniItem {
  key: string
  kind: OmniRecordKind
  label: string
  sublabel?: string
  target: OmniTarget
}

export interface OmniPickedCustomer {
  id: string
  name: string
}

export type OmniData = AppRouterOutputs['searchRouter']['omni']
export type OmniCustomer = OmniData['customers'][number]
export type OmniMeeting = OmniData['meetings'][number]
export type OmniProposal = OmniData['proposals'][number]
export type OmniProject = OmniData['projects'][number]

export type OmniStackRecord
  = | { kind: 'meeting', row: OmniMeeting }
    | { kind: 'proposal', row: OmniProposal }
    | { kind: 'project', row: OmniProject }

/** A customer with the records listed under it on desktop. */
export interface OmniStack {
  customer: OmniCustomer
  records: OmniStackRecord[]
}

/** The phone list's records, one capped list per kind. */
export interface OmniRecordLists {
  meetings: OmniMeeting[]
  proposals: OmniProposal[]
  projects: OmniProject[]
}

/**
 * `line`: the phone list's two-line row. `nested`: inside a customer stack: the stack's head for a customer, an
 * indented tree row for a record. `compact`: a single line, for customers below the stacks.
 */
export type OmniItemLayout = 'line' | 'nested' | 'compact'
export type OmniRecordLayout = Exclude<OmniItemLayout, 'compact'>

/** What the results show: desktop stacks, the phone list, or customers only while picking one for a meeting. */
export type OmniView = 'stacks' | 'list' | 'pick'

/** One read of the search, shared by the input row, the results and the footer. */
export interface OmniQueryState {
  search: string
  /** The instant term; null below the minimum length. */
  term: string | null
  data: OmniData | undefined
  /** The rows shown describe an earlier term than the one typed. */
  pending: boolean
  busy: boolean
  failed: boolean
  /** The term the shown rows answer, for match highlighting. */
  answeredTerm: string
  retry: () => void
}

export type OmniStatusKind = 'idle' | 'busy' | 'done' | 'none' | 'error'

export interface OmniStatus {
  kind: OmniStatusKind
  text: string
}

export type OmniHintSet = 'default' | 'customer' | 'contact'
