import type { EntityAction } from '@/shared/components/entity-actions/types'

import { PencilIcon, TrashIcon } from 'lucide-react'

export const NOTE_ACTIONS = {
  edit: {
    id: 'edit',
    label: 'Edit note',
    icon: PencilIcon,
    permission: ['update', 'CustomerNote'],
  },
  delete: {
    id: 'delete',
    label: 'Delete note',
    icon: TrashIcon,
    permission: ['delete', 'CustomerNote'],
    destructive: true,
    separatorBefore: true,
  },
} as const satisfies Record<string, EntityAction>
