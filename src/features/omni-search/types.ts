import type { LucideIcon } from 'lucide-react'

import type { OmniTarget } from '@/shared/domains/omni-search/schemas'

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
