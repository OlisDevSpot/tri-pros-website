import type { EntityAction } from '@/shared/components/entities/entity-actions/types'

import { CalendarClockIcon, CalendarSearchIcon, CircleDotIcon, CopyIcon, EyeIcon, FilePlusIcon, FolderOpenIcon, PlayIcon, TrashIcon, UserCheckIcon, UserPenIcon, Users2Icon } from 'lucide-react'

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
  confirmation: {
    id: 'confirmation',
    label: 'Confirmation',
    icon: UserCheckIcon,
    permission: ['update', 'Meeting'],
  },
  reschedule: {
    id: 'reschedule',
    label: 'Reschedule',
    icon: CalendarClockIcon,
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
    label: 'Manage Participants',
    icon: Users2Icon,
    permission: ['assign', 'Meeting'],
    separatorBefore: true,
  },
  setSetter: {
    id: 'setSetter',
    label: 'Set Setter',
    icon: UserPenIcon,
    permission: ['assign', 'Meeting'],
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
