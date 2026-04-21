import type { EntityAction } from '@/shared/components/entity-actions/types'

import { ArchiveIcon, CopyIcon, ExternalLinkIcon, EyeIcon, LinkIcon, PowerIcon, TrashIcon } from 'lucide-react'

export const LEAD_SOURCE_ACTIONS = {
  view: {
    id: 'view',
    label: 'Open',
    icon: EyeIcon,
    permission: ['manage', 'all'],
    primary: true,
  },
  copyIntakeUrl: {
    id: 'copyIntakeUrl',
    label: 'Copy intake URL',
    icon: LinkIcon,
    permission: ['manage', 'all'],
  },
  previewIntake: {
    id: 'previewIntake',
    label: 'Preview intake',
    icon: ExternalLinkIcon,
    permission: ['manage', 'all'],
  },
  toggleActive: {
    id: 'toggleActive',
    label: 'Toggle active',
    icon: PowerIcon,
    permission: ['manage', 'all'],
  },
  duplicate: {
    id: 'duplicate',
    label: 'Duplicate',
    icon: CopyIcon,
    permission: ['manage', 'all'],
    separatorBefore: true,
  },
  archive: {
    id: 'archive',
    label: 'Archive',
    icon: ArchiveIcon,
    permission: ['manage', 'all'],
  },
  delete: {
    id: 'delete',
    label: 'Delete',
    icon: TrashIcon,
    permission: ['manage', 'all'],
    destructive: true,
    separatorBefore: true,
  },
} as const satisfies Record<string, EntityAction>
