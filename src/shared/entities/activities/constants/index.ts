import type { EntityAction } from '@/shared/components/entity-actions/types'

import {
  BellIcon,
  CalendarIcon,
  CheckSquareIcon,
  EditIcon,
  EyeIcon,
  StickyNoteIcon,
  TrashIcon,
} from 'lucide-react'

export const ACTIVITY_TYPE_CONFIG = {
  note: { icon: StickyNoteIcon, label: 'Note', color: 'text-blue-500', bgColor: 'bg-blue-500/10' },
  reminder: { icon: BellIcon, label: 'Reminder', color: 'text-amber-500', bgColor: 'bg-amber-500/10' },
  task: { icon: CheckSquareIcon, label: 'Task', color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  event: { icon: CalendarIcon, label: 'Event', color: 'text-purple-500', bgColor: 'bg-purple-500/10' },
} as const

export const ACTIVITY_ACTIONS = {
  view: { id: 'view', label: 'View', icon: EyeIcon, permission: ['read', 'Activity'] as const, primary: true },
  edit: { id: 'edit', label: 'Edit', icon: EditIcon, permission: ['update', 'Activity'] as const },
  complete: { id: 'complete', label: 'Mark Complete', icon: CheckSquareIcon, permission: ['update', 'Activity'] as const },
  delete: { id: 'delete', label: 'Delete', icon: TrashIcon, permission: ['delete', 'Activity'] as const, destructive: true, separatorBefore: true },
} as const satisfies Record<string, EntityAction>
