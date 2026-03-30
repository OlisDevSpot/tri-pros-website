'use client'

import type { BetterAuthUser } from '@/shared/auth/server'

import { AnimatePresence } from 'motion/react'
import { useQueryState } from 'nuqs'

import { dashboardStepParser } from '@/features/agent-dashboard/lib/url-parsers'
import { AppSidebar } from '@/features/agent-dashboard/ui/components/app-sidebar'
import { SettingsView } from '@/features/agent-settings/ui/views/settings-view'
import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { MeetingsView } from '@/features/meetings/ui/views'
import { CreateNewProposalView, EditProposalView, PastProposalsView } from '@/features/proposal-flow/ui/views'
import { CreateProjectView, EditProjectView, PortfolioProjectsView } from '@/features/showroom/ui/views'
import { SignInGoogleButton } from '@/shared/components/buttons/auth/sign-in-google-button'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { SidebarTrigger } from '@/shared/components/ui/sidebar'
import { editProjectIdParser } from '@/shared/lib/url-parsers'

interface DashboardHubProps {
  authState:
    | { status: 'unauthenticated' }
    | { status: 'authenticated', user: BetterAuthUser }
}

export function DashboardHub({ authState }: DashboardHubProps) {
  const [step] = useQueryState('step', dashboardStepParser)
  const [editProjectId] = useQueryState('editProjectId', editProjectIdParser)

  if (authState.status === 'unauthenticated') {
    return (
      <div className="flex h-dvh w-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
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
    <>
      <AppSidebar user={authState.user} />
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 px-4 md:hidden">
          <SidebarTrigger />
        </header>
        <main className="relative flex-1 overflow-hidden px-4 pb-4 md:px-6 md:py-6">
          <AnimatePresence>
            {step === 'customer-pipelines' && <CustomerPipelineView key="customer-pipelines" />}
          </AnimatePresence>
          <AnimatePresence>
            {step === 'meetings' && <MeetingsView key="meetings" />}
          </AnimatePresence>
          <AnimatePresence>
            {step === 'proposals' && <PastProposalsView key="proposals" />}
          </AnimatePresence>
          <AnimatePresence>
            {step === 'create-proposal' && <CreateNewProposalView key="create-proposal" />}
          </AnimatePresence>
          <AnimatePresence>
            {step === 'edit-proposal' && <EditProposalView key="edit-proposal" />}
          </AnimatePresence>
          <AnimatePresence>
            {step === 'showroom' && <PortfolioProjectsView key="showroom" />}
          </AnimatePresence>
          <AnimatePresence>
            {step === 'create-project' && <CreateProjectView key="create-project" />}
          </AnimatePresence>
          <AnimatePresence>
            {step === 'edit-project' && editProjectId && (
              <EditProjectView key={`edit-project-${editProjectId}`} projectId={editProjectId} />
            )}
          </AnimatePresence>
          {step === 'settings' && authState.status === 'authenticated' && (
            <SettingsView key="settings" />
          )}
          {(step === 'dashboard' || step === 'intake' || step === 'team' || step === 'analytics') && (
            <EmptyState
              title="Coming Soon"
              description="This section is under construction."
            />
          )}
        </main>
      </div>
    </>
  )
}
