'use client'

import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'

import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { ProjectMeetingList } from '@/shared/entities/meetings/components/project-meeting-list'
import { MeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'

interface ProjectSalesHistoryPaneProps {
  meetings: CustomerProfileMeeting[]
  isLoading: boolean
  onMutationSuccess: () => void
}

export function ProjectSalesHistoryPane({ meetings, isLoading, onMutationSuccess }: ProjectSalesHistoryPaneProps) {
  return (
    <ExpandedRowPanel.Pane title="Sales history" isLoading={isLoading}>
      {meetings.length === 0
        ? <p className="text-sm text-muted-foreground">No meetings linked to this project</p>
        : (
            <MeetingActionsHost>
              <ProjectMeetingList meetings={meetings} onMutationSuccess={onMutationSuccess} />
            </MeetingActionsHost>
          )}
    </ExpandedRowPanel.Pane>
  )
}
