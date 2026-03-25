'use client'

import { AnimatePresence } from 'motion/react'
import { useQueryState } from 'nuqs'

import { dashboardStepParser } from '@/features/agent-dashboard/lib/url-parsers'
import { DashboardSidebar } from '@/features/agent-dashboard/ui/components/dashboard-sidebar'
import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { MeetingsView } from '@/features/meetings/ui/views'
import { CreateNewProposalView, EditProposalView, PastProposalsView } from '@/features/proposal-flow/ui/views'
import { CreateProjectView, EditProjectView, PortfolioProjectsView } from '@/features/showroom/ui/views'
import { SignInGoogleButton } from '@/shared/components/buttons/auth/sign-in-google-button'
import { ErrorState } from '@/shared/components/states/error-state'
import { editProjectIdParser } from '@/shared/lib/url-parsers'

interface DashboardHubProps {
  authState: { status: 'unauthenticated' } | { status: 'authenticated' }
}

export function DashboardHub({ authState }: DashboardHubProps) {
  const [step] = useQueryState('step', dashboardStepParser)
  const [editProjectId] = useQueryState('editProjectId', editProjectIdParser)

  if (authState.status === 'unauthenticated') {
    return (
      <div className="h-full w-full flex flex-col-reverse lg:flex-row gap-4 justify-between py-4 lg:py-8">
        <nav className="h-(--sidebar-height) lg:h-50 border border-primary/20 p-4 rounded-xl w-full lg:w-(--sidebar-width) shrink-0" />
        <div className="w-full h-full flex flex-col items-center justify-center gap-4 border rounded-lg">
          <ErrorState
            title="Sign in to access the dashboard"
            description="You need to be signed in to view this page."
          />
          <SignInGoogleButton />
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full flex flex-col-reverse lg:flex-row gap-4 justify-between py-4 lg:py-8">
      <nav className="h-(--sidebar-height) lg:h-fit border border-primary/20 p-4 rounded-xl w-full lg:w-(--sidebar-width) shrink-0">
        <DashboardSidebar />
      </nav>
      <div className="relative w-full h-full overflow-hidden min-h-0">
        <AnimatePresence>
          {step === 'customer-pipelines' && (
            <CustomerPipelineView key="customer-pipelines" />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {step === 'meetings' && (
            <MeetingsView key="meetings" />
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
        <AnimatePresence>
          {step === 'showroom' && (
            <PortfolioProjectsView key="showroom" />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {step === 'create-project' && (
            <CreateProjectView key="create-project" />
          )}
        </AnimatePresence>
        <AnimatePresence>
          {step === 'edit-project' && editProjectId && (
            <EditProjectView key={`edit-project-${editProjectId}`} projectId={editProjectId} />
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
