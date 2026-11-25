import type { EntityAction } from '@/shared/components/entities/entity-actions/types'

import { CalculatorIcon, ClipboardCopyIcon, CopyIcon, EyeIcon, LinkIcon, MailIcon, MessageSquareIcon, PencilIcon, TrashIcon, UserPlusIcon } from 'lucide-react'

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
  internalFinancials: {
    id: 'internalFinancials',
    label: 'View Internal Financials',
    icon: CalculatorIcon,
    permission: ['update', 'Proposal'],
  },
  copySow: {
    id: 'copySow',
    label: 'Copy Scope of Work',
    icon: ClipboardCopyIcon,
    permission: ['update', 'Proposal'],
  },
  copyLink: {
    id: 'copyLink',
    label: 'Copy link',
    icon: LinkIcon,
    permission: ['read', 'Proposal'],
    separatorBefore: true,
  },
  shareByEmail: {
    id: 'shareByEmail',
    label: 'Copy email link',
    icon: MailIcon,
    permission: ['read', 'Proposal'],
  },
  shareBySms: {
    id: 'shareBySms',
    label: 'Copy text link (SMS)',
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
