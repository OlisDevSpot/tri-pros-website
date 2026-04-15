import type { EntityAction } from '@/shared/components/entity-actions/types'

import { CalendarPlusIcon, EyeIcon, PencilIcon, TrashIcon } from 'lucide-react'

export const CUSTOMER_ACTIONS = {
  view: {
    id: 'view',
    label: 'View Profile',
    icon: EyeIcon,
    permission: ['read', 'Customer'],
    primary: true,
  },
  edit: {
    id: 'edit',
    label: 'Edit Profile',
    icon: PencilIcon,
    permission: ['update', 'Customer'],
  },
  scheduleMeeting: {
    id: 'scheduleMeeting',
    label: 'Schedule Meeting',
    icon: CalendarPlusIcon,
    permission: ['create', 'Meeting'],
    separatorBefore: true,
  },
  delete: {
    id: 'delete',
    label: 'Delete',
    icon: TrashIcon,
    permission: ['delete', 'Customer'],
    destructive: true,
    separatorBefore: true,
  },
} as const satisfies Record<string, EntityAction>
