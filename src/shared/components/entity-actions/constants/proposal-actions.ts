import type { EntityAction } from '@/shared/components/entity-actions/types'

import { CopyIcon, EyeIcon, MailIcon, MessageSquareIcon, PencilIcon, TrashIcon, UserPlusIcon } from 'lucide-react'

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
  shareByEmail: {
    id: 'shareByEmail',
    label: 'Copy Link (Email)',
    icon: MailIcon,
    permission: ['read', 'Proposal'],
    separatorBefore: true,
  },
  shareBySms: {
    id: 'shareBySms',
    label: 'Copy Link (SMS)',
    icon: MessageSquareIcon,
    permission: ['read', 'Proposal'],
  },
  duplicate: {
    id: 'duplicate',
    label: 'Duplicate',
    icon: CopyIcon,
    permission: ['create', 'Proposal'],
    separatorBefore: true,
  },
  assignOwner: {
    id: 'assignOwner',
    label: 'Assign Rep',
    icon: UserPlusIcon,
    permission: ['assign', 'Proposal'],
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
