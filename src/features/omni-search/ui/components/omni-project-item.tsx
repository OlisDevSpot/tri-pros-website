'use client'

import type { RecentOmniItem } from '@/features/omni-search/types'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { OMNI_RECORD_ICONS } from '@/features/omni-search/constants/omni-search'
import { CommandItem } from '@/shared/components/ui/command'

type OmniProject = AppRouterOutputs['searchRouter']['omni']['projects'][number]

interface Props {
  project: OmniProject
  onSelect: (item: RecentOmniItem) => void
  disabled?: boolean
}

export function OmniProjectItem({ project, onSelect, disabled }: Props) {
  const Icon = OMNI_RECORD_ICONS.project
  return (
    <CommandItem
      disabled={disabled}
      value={`project:${project.id}`}
      onSelect={() => onSelect({ key: `project:${project.id}`, kind: 'project', label: project.title, sublabel: project.customerName, target: project.target })}
    >
      <Icon aria-hidden className="text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        <span className="text-foreground">{project.title}</span>
        <span className="text-muted-foreground">{` · ${project.customerName}`}</span>
      </span>
      <span className="shrink-0 truncate text-xs text-muted-foreground">{project.address ?? project.city}</span>
    </CommandItem>
  )
}
