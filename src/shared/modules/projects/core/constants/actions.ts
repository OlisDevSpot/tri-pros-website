import type { EntityAction } from '@/shared/components/entities/entity-actions/types'

import { CopyIcon, ExternalLinkIcon, EyeIcon, EyeOffIcon, FolderOpenIcon, TrashIcon } from 'lucide-react'

export const PROJECT_ACTIONS = {
  edit: {
    id: 'edit',
    label: 'Open Project',
    icon: FolderOpenIcon,
    permission: ['update', 'Project'],
    primary: true,
  },
  view: {
    id: 'view',
    label: 'View on Site',
    icon: ExternalLinkIcon,
    permission: ['read', 'Project'],
  },
  showOnPortfolio: {
    id: 'showOnPortfolio',
    label: 'Show on Portfolio',
    icon: EyeIcon,
    permission: ['update', 'Project'],
  },
  hideFromPortfolio: {
    id: 'hideFromPortfolio',
    label: 'Hide from Portfolio',
    icon: EyeOffIcon,
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
