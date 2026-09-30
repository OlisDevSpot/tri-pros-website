import type { EntityAction } from '@/shared/components/entities/entity-actions/types'

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
  note: { icon: StickyNoteIcon, label: 'Note', color: 'text-status-info-fg', bgColor: 'bg-status-info-bg' },
  reminder: { icon: BellIcon, label: 'Reminder', color: 'text-status-pending-fg', bgColor: 'bg-status-pending-bg' },
  task: { icon: CheckSquareIcon, label: 'Task', color: 'text-status-success-fg', bgColor: 'bg-status-success-bg' },
  event: { icon: CalendarIcon, label: 'Event', color: 'text-status-action-fg', bgColor: 'bg-status-action-bg' },
} as const

export const ACTIVITY_ACTIONS = {
  view: { id: 'view', label: 'View', icon: EyeIcon, permission: ['read', 'Activity'] as const, primary: true },
  edit: { id: 'edit', label: 'Edit', icon: EditIcon, permission: ['update', 'Activity'] as const },
  complete: { id: 'complete', label: 'Mark Complete', icon: CheckSquareIcon, permission: ['update', 'Activity'] as const },
  delete: { id: 'delete', label: 'Delete', icon: TrashIcon, permission: ['delete', 'Activity'] as const, destructive: true, separatorBefore: true },
} as const satisfies Record<string, EntityAction>
