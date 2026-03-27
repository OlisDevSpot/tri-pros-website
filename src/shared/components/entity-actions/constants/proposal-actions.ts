import { CopyIcon, EyeIcon, PencilIcon, TrashIcon, UserPlusIcon } from 'lucide-react'

import type { EntityAction } from '@/shared/components/entity-actions/types'

export const PROPOSAL_ACTIONS = {
  view: {
    id: 'view',
    label: 'View Proposal',
    icon: EyeIcon,
    permission: ['read', 'Proposal'],
    primary: true,
  },
  edit: {
    id: 'edit',
    label: 'Edit Proposal',
    icon: PencilIcon,
    permission: ['update', 'Proposal'],
  },
  duplicate: {
    id: 'duplicate',
    label: 'Duplicate',
    icon: CopyIcon,
    permission: ['create', 'Proposal'],
  },
  assignOwner: {
    id: 'assignOwner',
    label: 'Assign Rep',
    icon: UserPlusIcon,
    permission: ['assign', 'Proposal'],
    separatorBefore: true,
  },
  delete: {
    id: 'delete',
    label: 'Delete',
    icon: TrashIcon,
    permission: ['delete', 'Proposal'],
    destructive: true,
    separatorBefore: true,
  },
} as const satisfies Record<string, EntityAction>
