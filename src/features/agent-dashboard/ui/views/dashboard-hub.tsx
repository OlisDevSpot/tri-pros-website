'use client'

import { AnimatePresence } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useEffect } from 'react'

import { dashboardStepParser, editMeetingIdParser } from '@/features/agent-dashboard/lib/url-parsers'
import { DashboardSidebar } from '@/features/agent-dashboard/ui/components/dashboard-sidebar'
import { ActionCenterView } from '@/features/agent-dashboard/ui/views/action-center-view'
import { PipelineView } from '@/features/agent-dashboard/ui/views/pipeline-view'
import { CreateMeetingView } from '@/features/meetings/ui/views/create-meeting-view'
import { EditMeetingSetupView } from '@/features/meetings/ui/views/edit-meeting-setup-view'
import { PastMeetingsView } from '@/features/meetings/ui/views/past-meetings-view'
import { CreateNewProposalView } from '@/features/proposal-flow/ui/views/create-new-proposal-view'
import { EditProposalView } from '@/features/proposal-flow/ui/views/edit-proposal-view'
import { PastProposalsView } from '@/features/proposal-flow/ui/views/past-proposals-view'
import { useSession } from '@/shared/auth/client'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'

export function DashboardHub() {
  const router = useRouter()
  const session = useSession()
  const [step] = useQueryState('step', dashboardStepParser)
  const [editMeetingId] = useQueryState('editMeetingId', editMeetingIdParser)

  useEffect(() => {
    if (!session.isPending && !session.data?.user) {
      router.replace('/')
    }
  }, [router, session.isPending, session.data?.user])

  if (session.isPending) {
    return (
      <div className="h-full w-full flex flex-col lg:flex-row gap-4 justify-between py-4 lg:py-8">
        <nav className="h-(--sidebar-height) lg:h-50 border border-primary/20 p-4 rounded-xl w-full lg:w-(--sidebar-width) shrink-0" />
        <LoadingState title="Loading Session Data" description="This might take a few seconds" />
      </div>
    )
  }

  if (!session.data) {
    return (
      <ErrorState
        title="Error: You are not logged in"
        description="Please log in to continue. Navigating away..."
      />
    )
  }

  return (
    <div className="h-full w-full flex flex-col lg:flex-row gap-4 justify-between py-4 lg:py-8">
      <nav className="h-(--sidebar-height) lg:h-fit border border-primary/20 p-4 rounded-xl w-full lg:w-(--sidebar-width) shrink-0">
        <DashboardSidebar />
      </nav>
      <div className="relative w-full h-full overflow-hidden min-h-0">
        <AnimatePresence>
          {step === 'action-center' && (
            <ActionCenterView key="action-center" />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {step === 'pipeline' && (
            <PipelineView key="pipeline" />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {step === 'meetings' && (
            <PastMeetingsView key="meetings" />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {step === 'create-meeting' && (
            <CreateMeetingView key="create-meeting" />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {step === 'edit-meeting' && editMeetingId && (
            <EditMeetingSetupView key={`edit-meeting-${editMeetingId}`} meetingId={editMeetingId} />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {step === 'proposals' && (
            <PastProposalsView key="proposals" />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {step === 'create-proposal' && (
            <CreateNewProposalView key="create-proposal" />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {step === 'edit-proposal' && (
            <EditProposalView key="edit-proposal" />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
