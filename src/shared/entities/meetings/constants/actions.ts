import type { EntityAction } from '@/shared/components/entity-actions/types'

import { CalendarSearchIcon, CircleDotIcon, CopyIcon, EyeIcon, FilePlusIcon, FolderOpenIcon, PlayIcon, TrashIcon, UserPlusIcon } from 'lucide-react'

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
  assignProject: {
    id: 'assignProject',
    label: 'Assign to Project',
    icon: FolderOpenIcon,
    permission: ['update', 'Meeting'],
  },
  viewSchedule: {
    id: 'viewSchedule',
    label: 'View in Schedule',
    icon: CalendarSearchIcon,
    permission: ['read', 'Meeting'],
  },
  duplicate: {
    id: 'duplicate',
    label: 'Duplicate',
    icon: CopyIcon,
    permission: ['create', 'Meeting'],
  },
  setOutcome: {
    id: 'setOutcome',
    label: 'Set Outcome',
    icon: CircleDotIcon,
    permission: ['update', 'Meeting'],
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
