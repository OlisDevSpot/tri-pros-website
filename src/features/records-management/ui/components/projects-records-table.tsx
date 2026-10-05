'use client'

import type { UseProjectsTableOptions } from '@/shared/modules/projects/core/components/projects-table/use-projects-table'

import { PlusIcon } from 'lucide-react'
import Link from 'next/link'

import { PROJECTS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/projects-records-table-view'
import { EntityRecordsTable } from '@/shared/components/entity-records-table'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { useProjectsTable } from '@/shared/modules/projects/core/components/projects-table/use-projects-table'

export function ProjectsRecordsTable({ renderExpandedRow }: UseProjectsTableOptions) {
  const table = useProjectsTable(PROJECTS_RECORDS_TABLE_VIEW, { renderExpandedRow })

  return (
    <EntityRecordsTable
      title="Projects"
      entityName="projects"
      searchPlaceholder="Search by project, city or customer…"
      headerActions={(
        <Button size="sm" asChild>
          <Link href={ROOTS.dashboard.projects.new()}>
            <PlusIcon className="mr-2 h-4 w-4" />
            New Project
          </Link>
        </Button>
      )}
      table={table}
    />
  )
}
