import type { EntityAction } from '@/shared/components/entity-actions/types'

import { CopyIcon, EyeIcon, FilePlusIcon, PencilIcon, PlayIcon, TrashIcon, UserPlusIcon } from 'lucide-react'

export const MEETING_ACTIONS = {
  view: {
    id: 'view',
    label: 'View Meeting',
    icon: EyeIcon,
    permission: ['read', 'Meeting'],
    primary: true,
  },
  start: {
    id: 'start',
    label: 'Start Meeting',
    icon: PlayIcon,
    permission: ['update', 'Meeting'],
  },
  edit: {
    id: 'edit',
    label: 'Edit Setup',
    icon: PencilIcon,
    permission: ['update', 'Meeting'],
  },
  duplicate: {
    id: 'duplicate',
    label: 'Duplicate',
    icon: CopyIcon,
    permission: ['create', 'Meeting'],
  },
  createProposal: {
    id: 'createProposal',
    label: 'Create Proposal',
    icon: FilePlusIcon,
    permission: ['create', 'Proposal'],
    separatorBefore: true,
  },
  assignOwner: {
    id: 'assignOwner',
    label: 'Assign Rep',
    icon: UserPlusIcon,
    permission: ['assign', 'Meeting'],
    separatorBefore: true,
  },
  delete: {
    id: 'delete',
    label: 'Delete',
    icon: TrashIcon,
    permission: ['delete', 'Meeting'],
    destructive: true,
    separatorBefore: true,
  },
} as const satisfies Record<string, EntityAction>
