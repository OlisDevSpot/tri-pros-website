import type { LucideIcon } from 'lucide-react'
import { ImageIcon, InfoIcon, LayersIcon, WalletIcon } from 'lucide-react'

export const FORM_PART_IDS = ['general', 'sow', 'funding', 'files'] as const

export type FormPartId = (typeof FORM_PART_IDS)[number]

export const FORM_PARTS: readonly { id: FormPartId, label: string, icon: LucideIcon }[] = [
  { id: 'general', label: 'General info', icon: InfoIcon },
  { id: 'sow', label: 'Scope of Work', icon: LayersIcon },
  { id: 'funding', label: 'Funding', icon: WalletIcon },
  { id: 'files', label: 'Files', icon: ImageIcon },
]

export const FORM_PART_FIELD_PREFIXES: Record<'general' | 'sow' | 'funding', readonly string[]> = {
  general: ['project.data.type', 'project.data.timeAllocated', 'project.data.validThroughTimeframe'],
  sow: ['project.data.sow', 'project.data.agreementNotes'],
  funding: ['funding', 'priceDisplayMode'],
}
