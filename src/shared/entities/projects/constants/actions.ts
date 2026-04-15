import type { EntityAction } from '@/shared/components/entity-actions/types'

import { CopyIcon, ExternalLinkIcon, PencilIcon, TrashIcon } from 'lucide-react'

export const PROJECT_ACTIONS = {
  view: {
    id: 'view',
    label: 'View Project',
    icon: ExternalLinkIcon,
    permission: ['read', 'Project'],
    primary: true,
  },
  edit: {
    id: 'edit',
    label: 'Edit Project',
    icon: PencilIcon,
    permission: ['update', 'Project'],
  },
  duplicate: {
    id: 'duplicate',
    label: 'Duplicate',
    icon: CopyIcon,
    permission: ['create', 'Project'],
    separatorBefore: true,
  },
  delete: {
    id: 'delete',
    label: 'Delete',
    icon: TrashIcon,
    permission: ['delete', 'Project'],
    destructive: true,
    separatorBefore: true,
  },
} as const satisfies Record<string, EntityAction>
