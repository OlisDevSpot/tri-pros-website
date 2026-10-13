import { FileTextIcon, HandshakeIcon, ImageIcon, UsersRoundIcon } from 'lucide-react'

export const OMNI_DEBOUNCE_MS = 150
export const OMNI_STALE_MS = 30_000
export const OMNI_ENTRY_CAP = 6

// Same icons as the sidebar's records group, so a result reads as the page it belongs to.
export const OMNI_RECORD_ICONS = {
  customer: UsersRoundIcon,
  meeting: HandshakeIcon,
  proposal: FileTextIcon,
  project: ImageIcon,
} as const
