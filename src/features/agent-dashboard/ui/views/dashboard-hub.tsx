'use client'

import { AnimatePresence } from 'motion/react'
import { useQueryState } from 'nuqs'
import { useState } from 'react'

import { dashboardStepParser } from '@/features/agent-dashboard/lib/url-parsers'
import { ActionCenterSheet } from '@/features/agent-dashboard/ui/components/action-center-sheet'
import { MobileBottomNav } from '@/features/agent-dashboard/ui/components/mobile-bottom-nav'
import { StepTransition } from '@/features/agent-dashboard/ui/components/step-transition'
import { SettingsView } from '@/features/agent-settings/ui/views/settings-view'
import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { MeetingsView } from '@/features/meetings/ui/views'
import { CreateNewProposalView, EditProposalView, PastProposalsView } from '@/features/proposal-flow/ui/views'
import { CreateProjectView, EditProjectView, PortfolioProjectsView } from '@/features/showroom/ui/views'
import { SignInGoogleButton } from '@/shared/components/buttons/auth/sign-in-google-button'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { editProjectIdParser } from '@/shared/lib/url-parsers'

interface DashboardHubProps {
  authState:
    | { status: 'unauthenticated' }
    | { status: 'authenticated' }
}

function StepContent({ step, editProjectId }: { step: string, editProjectId: string | null }) {
  switch (step) {
    case 'customer-pipelines':
      return <CustomerPipelineView />
    case 'meetings':
      return <MeetingsView />
    case 'proposals':
      return <PastProposalsView />
    case 'create-proposal':
      return <CreateNewProposalView />
    case 'edit-proposal':
      return <EditProposalView />
    case 'showroom':
      return <PortfolioProjectsView />
    case 'create-project':
      return <CreateProjectView />
    case 'edit-project':
      if (editProjectId) {
        return <EditProjectView projectId={editProjectId} />
      }
      return <EmptyState title="No project selected" description="Select a project to edit." />
    case 'settings':
      return <SettingsView />
    case 'dashboard':
    case 'intake':
    case 'team':
    case 'analytics':
      return <EmptyState title="Coming Soon" description="This section is under construction." />
    default:
      return null
  }
}

export function DashboardHub({ authState }: DashboardHubProps) {
  const [step] = useQueryState('step', dashboardStepParser)
  const [editProjectId] = useQueryState('editProjectId', editProjectIdParser)
  const [isActionCenterOpen, setIsActionCenterOpen] = useState(false)

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

  const stepKey = step === 'edit-project' ? `edit-project-${editProjectId}` : step

  return (
    <div className="flex h-full min-w-0 flex-col">
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden px-4 pb-20 pt-4 md:px-6 md:py-6 md:pb-6">
        <AnimatePresence mode="wait">
          <StepTransition key={stepKey}>
            <StepContent step={step} editProjectId={editProjectId} />
          </StepTransition>
        </AnimatePresence>
      </main>
      <MobileBottomNav onActionCenterClick={() => setIsActionCenterOpen(true)} />
      <ActionCenterSheet isOpen={isActionCenterOpen} onClose={() => setIsActionCenterOpen(false)} />
    </div>
  )
}
