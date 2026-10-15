'use client'

import type { OmniProject, OmniRecordLayout, RecentOmniItem } from '@/features/omni-search/types'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_ICON_TILE_CLASS, OMNI_KIND_LABEL_CLASS, OMNI_RECORD_ICONS, OMNI_ROW_CLASSES } from '@/features/omni-search/constants/omni-search'
import { omniRowLabel } from '@/features/omni-search/lib/omni-row-label'
import { CommandItem } from '@/shared/components/ui/command'
import { deriveProjectStatusBucket } from '@/shared/constants/enums'
import { ProjectStatusBadge } from '@/shared/modules/projects/core/components/project-status-badge'
import { PROJECT_STATUS_BUCKET_LABELS } from '@/shared/modules/projects/core/constants/status-labels'

interface Props {
  project: OmniProject
  layout: OmniRecordLayout
  onSelect: (item: RecentOmniItem) => void
  disabled?: boolean
}

export function OmniProjectItem({ project, layout, onSelect, disabled }: Props) {
  const Icon = OMNI_RECORD_ICONS.project
  const value = `project:${project.id}`
  const select = () => onSelect({ key: value, kind: 'project', label: project.title, sublabel: project.customerName, target: project.target })
  const place = project.address ?? project.city
  const bucket = deriveProjectStatusBucket(project.pipelineStage)
  const label = omniRowLabel(OMNI_COPY.kinds.project, project.title, project.customerName, place, PROJECT_STATUS_BUCKET_LABELS[bucket])
  const badge = <ProjectStatusBadge bucket={bucket} />

  if (layout === 'nested') {
    return (
      <CommandItem aria-label={label} disabled={disabled} value={value} onSelect={select} className={OMNI_ROW_CLASSES.nested}>
        <span className={OMNI_KIND_LABEL_CLASS}>{OMNI_COPY.kinds.project}</span>
        <span className="min-w-0 flex-1 truncate text-foreground">{project.title}</span>
        {badge}
      </CommandItem>
    )
  }

  return (
    <CommandItem aria-label={label} disabled={disabled} value={value} onSelect={select} className={OMNI_ROW_CLASSES.line}>
      <span aria-hidden className={OMNI_ICON_TILE_CLASS}><Icon /></span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-medium text-foreground">{project.title}</span>
        <span className="truncate text-xs text-muted-foreground">{`${project.customerName} · ${place}`}</span>
      </span>
      {badge}
    </CommandItem>
  )
}
