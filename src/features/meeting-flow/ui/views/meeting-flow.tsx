'use client'

import type { MeetingFlowContext } from '@/features/meeting-flow/types'
import type { MeetingOutcome } from '@/shared/constants/enums'
import type { MeetingContext, MeetingFlowState } from '@/shared/entities/meetings/schemas'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChannelProvider } from 'ably/react'
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'
import { useQueryState } from 'nuqs'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { stepParser } from '@/features/meeting-flow/constants/query-parsers'
import { MEETING_STEPS, TOTAL_STEPS } from '@/features/meeting-flow/constants/step-config'
import { useMeetingSync } from '@/features/meeting-flow/hooks/use-meeting-sync'
import { computeContextFilledCount, CONTEXT_TOTAL_FIELDS } from '@/features/meeting-flow/lib/context-fill-count'
import { ContextPanel } from '@/features/meeting-flow/ui/components/context-panel'
import { ContextPanelTrigger } from '@/features/meeting-flow/ui/components/context-panel-trigger'
import { PersonaProfilePanel } from '@/features/meeting-flow/ui/components/persona-profile-panel'
import { PersonaProfileTrigger } from '@/features/meeting-flow/ui/components/persona-profile-trigger'
import { StepNav } from '@/features/meeting-flow/ui/components/step-nav'
import { ClosingStep } from '@/features/meeting-flow/ui/components/steps/closing-step'
import { CreateProposalStep } from '@/features/meeting-flow/ui/components/steps/create-proposal-step'
import { DealStructureStep } from '@/features/meeting-flow/ui/components/steps/deal-structure-step'
import { PortfolioStep } from '@/features/meeting-flow/ui/components/steps/portfolio-step'
import { ProgramStep } from '@/features/meeting-flow/ui/components/steps/program-step'
import { SpecialtiesStep } from '@/features/meeting-flow/ui/components/steps/specialties-step'
import { WhoWeAreStep } from '@/features/meeting-flow/ui/components/steps/who-we-are-step'
import { SyncStatusIndicator } from '@/features/meeting-flow/ui/components/sync-status-indicator'
import { Logo } from '@/shared/components/logo'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { ROOTS } from '@/shared/config/roots'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

interface MeetingFlowViewProps {
  meetingId: string
}

export function MeetingFlowView({ meetingId }: MeetingFlowViewProps) {
  return (
    <ChannelProvider channelName={`meeting:${meetingId}`}>
      <MeetingFlowViewInner meetingId={meetingId} />
    </ChannelProvider>
  )
}

function MeetingFlowViewInner({ meetingId }: MeetingFlowViewProps) {
  const trpc = useTRPC()
  const { invalidateMeeting } = useInvalidation()
  const [currentStep, setCurrentStep] = useQueryState('step', stepParser)
  const [contextOpen, setContextOpen] = useState(false)
  const [personaOpen, setPersonaOpen] = useState(false)
  const { status: syncStatus } = useMeetingSync(meetingId)

  const meetingQuery = useQuery(
    trpc.meetingsRouter.getById.queryOptions({ id: meetingId }),
  )

  const invalidateMeetingQueries = useCallback(() => {
    invalidateMeeting()
  }, [invalidateMeeting])

  const updateMeeting = useMutation(
    trpc.meetingsRouter.update.mutationOptions({
      onSuccess: invalidateMeetingQueries,
      onError: () => toast.error('Failed to save'),
    }),
  )

  const updateCustomerProfile = useMutation(
    trpc.meetingsRouter.updateCustomerProfileForMeeting.mutationOptions({
      onSuccess: invalidateMeetingQueries,
      onError: () => toast.error('Failed to save customer data'),
    }),
  )

  const meeting = meetingQuery.data
  const customer = meeting?.customer?.id ? meeting.customer : null

  const handleFlowStateChange = useCallback((patch: Partial<MeetingFlowState>) => {
    const current = meeting?.flowStateJSON ?? {}
    updateMeeting.mutate({
      id: meetingId,
      flowStateJSON: { ...current, ...patch },
    })
  }, [meeting?.flowStateJSON, meetingId, updateMeeting])

  const handleCustomerProfileChange = useCallback((jsonbKey: string, patch: Record<string, unknown>) => {
    if (!customer?.id) {
      return
    }
    const currentSection = (customer as Record<string, unknown>)[jsonbKey] ?? {}
    updateCustomerProfile.mutate({
      meetingId,
      customerId: customer.id,
      [jsonbKey]: { ...(currentSection as Record<string, unknown>), ...patch },
    })
  }, [customer, meetingId, updateCustomerProfile])

  const handleContextChange = useCallback((patch: Record<string, unknown>) => {
    const current = (meeting?.contextJSON ?? {}) as MeetingContext
    updateMeeting.mutate({
      id: meetingId,
      contextJSON: { ...current, ...patch } as MeetingContext,
    })
  }, [meeting?.contextJSON, meetingId, updateMeeting])

  const handleOutcomeChange = useCallback((outcome: string) => {
    updateMeeting.mutate({
      id: meetingId,
      meetingOutcome: outcome as MeetingOutcome,
    })
  }, [meetingId, updateMeeting])

  const handleAgentNotesChange = useCallback((notes: string) => {
    updateMeeting.mutate({
      id: meetingId,
      agentNotes: notes,
    })
  }, [meetingId, updateMeeting])

  const flowContext = useMemo<MeetingFlowContext | null>(() => {
    if (!meeting) {
      return null
    }
    return {
      meetingId,
      customerId: meeting.customerId ?? null,
      customer,
      flowState: meeting.flowStateJSON ?? null,
      onFlowStateChange: handleFlowStateChange,
      onCustomerProfileChange: handleCustomerProfileChange,
    }
  }, [meeting, meetingId, customer, handleFlowStateChange, handleCustomerProfileChange])

  const contextFilledCount = useMemo(
    () => (meeting ? computeContextFilledCount(meeting, customer) : 0),
    [meeting, customer],
  )

  if (meetingQuery.isLoading) {
    return <LoadingState title="Loading meeting" description="Fetching meeting details..." />
  }

  if (!meeting || !flowContext) {
    return <ErrorState title="Meeting not found" description="This meeting could not be loaded." />
  }

  const stepConfig = MEETING_STEPS[currentStep - 1]
  if (!stepConfig) {
    return <ErrorState title="Invalid step" description="This step does not exist." />
  }

  function handleNext() {
    if (currentStep < TOTAL_STEPS) {
      void setCurrentStep(currentStep + 1)
    }
  }

  function handlePrev() {
    if (currentStep > 1) {
      void setCurrentStep(currentStep - 1)
    }
  }

  return (
    <div className="flex h-full flex-col [--prevNextHeight:3.5rem]">
      {/* Header */}
      <header className="relative flex shrink-0 items-center border-b border-border/40 px-4 py-2.5 md:px-6">
        <Link
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          href={ROOTS.dashboard.meetings.root()}
        >
          <ArrowLeftIcon className="size-4" />
          <span className="hidden sm:inline">Meetings</span>
        </Link>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto">
            <StepNav currentStep={currentStep} onStepClick={s => void setCurrentStep(s)} />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <SyncStatusIndicator status={syncStatus} />
          <div className="hidden h-10 w-32 sm:block">
            <Logo variant="right" />
          </div>
        </div>
      </header>

      {/* Step title bar */}
      <div className="shrink-0 space-y-0.5 border-b border-border/20 px-4 pb-3 pt-5 text-center md:px-6">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          {`Step ${currentStep} of ${TOTAL_STEPS}`}
        </p>
        <h1 className="text-lg font-bold tracking-tight md:text-xl">{stepConfig.title}</h1>
      </div>

      {/* Step content */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
        {stepConfig.id === 'who-we-are' && <WhoWeAreStep />}
        {stepConfig.id === 'specialties' && <SpecialtiesStep flowContext={flowContext} />}
        {stepConfig.id === 'portfolio' && <PortfolioStep flowContext={flowContext} />}
        {stepConfig.id === 'program' && (
          <ProgramStep flowContext={flowContext} meetingType={meeting.meetingType} />
        )}
        {stepConfig.id === 'deal-structure' && <DealStructureStep flowContext={flowContext} />}
        {stepConfig.id === 'closing' && (
          <ClosingStep
            flowContext={flowContext}
            meetingOutcome={meeting.meetingOutcome}
            onOutcomeChange={handleOutcomeChange}
            proposalState={{
              proposalCount: meeting.proposalCount ?? 0,
              hasSentProposal: meeting.hasSentProposal ?? false,
              hasApprovedProposal: meeting.hasApprovedProposal ?? false,
            }}
          />
        )}
        {stepConfig.id === 'create-proposal' && (
          <CreateProposalStep flowContext={flowContext} meetingId={meetingId} />
        )}
      </div>

      {/* Footer navigation + overlay triggers */}
      <footer className="relative shrink-0">
        {/* Context & Persona triggers — positioned above the nav bar */}
        <div className="absolute bottom-full left-0 right-0 flex items-end justify-between px-4 pb-3 pointer-events-none md:px-6">
          <div className="pointer-events-auto">
            <ContextPanelTrigger
              filledCount={contextFilledCount}
              totalCount={CONTEXT_TOTAL_FIELDS}
              onClick={() => setContextOpen(true)}
            />
          </div>
          <div className="pointer-events-auto">
            <PersonaProfileTrigger
              hasData={!!customer?.customerProfileJSON}
              onClick={() => setPersonaOpen(true)}
            />
          </div>
        </div>

        <Separator />
        <div className="flex h-(--prevNextHeight) items-center justify-between px-4 md:px-6">
          <Button
            className="gap-2"
            disabled={currentStep === 1}
            size="sm"
            variant="outline"
            onClick={handlePrev}
          >
            <ArrowLeftIcon className="size-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>

          <span className="text-xs text-muted-foreground">
            {`${currentStep} / ${TOTAL_STEPS}`}
          </span>

          <Button
            className="gap-2"
            disabled={currentStep === TOTAL_STEPS}
            size="sm"
            onClick={handleNext}
          >
            <span className="hidden sm:inline">Next</span>
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      </footer>

      {/* Overlay sheets */}
      <ContextPanel
        customer={customer}
        isOpen={contextOpen}
        meeting={meeting}
        onAgentNotesChange={handleAgentNotesChange}
        onContextChange={handleContextChange}
        onCustomerProfileChange={handleCustomerProfileChange}
        onOpenChange={setContextOpen}
        onOutcomeChange={handleOutcomeChange}
      />

      <PersonaProfilePanel
        isOpen={personaOpen}
        meetingId={meetingId}
        onOpenChange={setPersonaOpen}
      />
    </div>
  )
}
