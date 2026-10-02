'use client'

import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'

import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { ProjectMeetingList } from '@/shared/entities/meetings/components/project-meeting-list'

interface ProjectSalesHistoryPaneProps {
  customerId: string | null
  meetings: CustomerProfileMeeting[]
  isLoading: boolean
  onMutationSuccess: () => void
}

export function ProjectSalesHistoryPane({ customerId, meetings, isLoading, onMutationSuccess }: ProjectSalesHistoryPaneProps) {
  return (
    <ExpandedRowPanel.Pane title="Sales history" isLoading={isLoading}>
      {!customerId || meetings.length === 0
        ? <p className="text-sm text-muted-foreground">No meetings linked to this project</p>
        : <ProjectMeetingList customerId={customerId} meetings={meetings} onMutationSuccess={onMutationSuccess} />}
    </ExpandedRowPanel.Pane>
  )
}
