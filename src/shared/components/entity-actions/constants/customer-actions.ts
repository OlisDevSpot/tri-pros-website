import { ArrowRightLeftIcon, CalendarPlusIcon, EyeIcon, PencilIcon, TrashIcon } from 'lucide-react'

import type { EntityAction } from '@/shared/components/entity-actions/types'

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
  moveToPipeline: {
    id: 'moveToPipeline',
    label: 'Move to Pipeline',
    icon: ArrowRightLeftIcon,
    permission: ['manage', 'CustomerPipeline'],
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
