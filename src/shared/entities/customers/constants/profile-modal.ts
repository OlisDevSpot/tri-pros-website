import type { LucideIcon } from 'lucide-react'
import type { CustomerProfileTab, NewSheetChoice } from '@/shared/entities/customers/types/profile-modal'
import { ActivityIcon, CalendarIcon, FileTextIcon, FolderIcon, StickyNoteIcon } from 'lucide-react'
import { BREAKPOINTS } from '@/shared/constants/css-breakpoints'

// The rail needs 380px beside a usable pane; below md the profile is the phone arrangement.
export const PROFILE_RAIL_MEDIA_QUERY = `(min-width: ${BREAKPOINTS.md}px)`

export const PROFILE_NEW_SHEET_ID = 'customer-profile-new-sheet'

export const PROFILE_NEW_SHEET_TITLE_ID = 'customer-profile-new-sheet-title'

export const PROFILE_TAB_LABELS: Record<CustomerProfileTab, string> = {
  overview: 'Overview',
  meetings: 'Meetings',
  projects: 'Projects',
}

export const PROFILE_TAB_ICONS: Record<CustomerProfileTab, LucideIcon> = {
  overview: ActivityIcon,
  meetings: CalendarIcon,
  projects: FolderIcon,
}

export const NEW_SHEET_ITEMS: { id: NewSheetChoice, label: string, description?: string, icon: LucideIcon }[] = [
  { id: 'proposal', label: 'New proposal', description: 'Attach it to a meeting', icon: FileTextIcon },
  { id: 'meeting', label: 'Add meeting', icon: CalendarIcon },
  { id: 'note', label: 'Add note', icon: StickyNoteIcon },
]
