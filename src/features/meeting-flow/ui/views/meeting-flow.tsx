'use client'

import type { MeetingFlowContext, PanelSection, PresentationHandle } from '@/features/meeting-flow/types'
import type { MeetingOutcome } from '@/shared/constants/enums'
import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
import type { MeetingContext, MeetingFlowState } from '@/shared/entities/meetings/schemas'
import { useMutation, useQuery } from '@tanstack/react-query'
import { ChannelProvider } from 'ably/react'
import { useQueryState } from 'nuqs'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { stepParser } from '@/features/meeting-flow/constants/query-parsers'
import { DEFAULT_PANEL_SECTION } from '@/features/meeting-flow/constants/shell'
import { MEETING_STEPS, TOTAL_STEPS } from '@/features/meeting-flow/constants/step-config'
import { useMeetingFlowKeys } from '@/features/meeting-flow/hooks/use-meeting-flow-keys'
import { useMeetingSync } from '@/features/meeting-flow/hooks/use-meeting-sync'
import { usePresentMode } from '@/features/meeting-flow/hooks/use-present-mode'
import { computeContextFilledCount, CONTEXT_TOTAL_FIELDS } from '@/features/meeting-flow/lib/context-fill-count'
import { ContextPanel } from '@/features/meeting-flow/ui/components/context-panel'
import { PersonaProfilePanel } from '@/features/meeting-flow/ui/components/persona-profile-panel'
import { InspectorRail } from '@/features/meeting-flow/ui/components/shell/inspector-rail'
import { MeetingPanel } from '@/features/meeting-flow/ui/components/shell/meeting-panel'
import { MeetingSection } from '@/features/meeting-flow/ui/components/shell/meeting-section'
import { StageFrame } from '@/features/meeting-flow/ui/components/shell/stage-frame'
import { StepCapsule } from '@/features/meeting-flow/ui/components/shell/step-capsule'
import { StepRegion } from '@/features/meeting-flow/ui/components/shell/step-region'
import { TopBar } from '@/features/meeting-flow/ui/components/shell/top-bar'
import { ClosingStep } from '@/features/meeting-flow/ui/components/steps/closing-step'
import { CreateProposalStep } from '@/features/meeting-flow/ui/components/steps/create-proposal-step'
import { DealStructureStep } from '@/features/meeting-flow/ui/components/steps/deal-structure-step'
import { PortfolioStep } from '@/features/meeting-flow/ui/components/steps/portfolio-step'
import { ProgramStep } from '@/features/meeting-flow/ui/components/steps/program-step'
import { SpecialtiesStep } from '@/features/meeting-flow/ui/components/steps/specialties-step'
import { WhoWeAreStep } from '@/features/meeting-flow/ui/components/steps/who-we-are'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { hasCustomerProfileData } from '@/shared/entities/customers/lib/customer-predicates'
import { useOutcomeChange } from '@/shared/entities/meetings/hooks/use-outcome-change'
import { useRescheduleChange } from '@/shared/entities/meetings/hooks/use-reschedule-change'
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
  const { status: syncStatus } = useMeetingSync(meetingId)
  const { changeOutcome, OutcomeReasonDialog } = useOutcomeChange()
  const { reschedule, RescheduleDialog } = useRescheduleChange()
  const { presenting, toggle: togglePresentMode } = usePresentMode()
  const stepTitleId = useId()

  const rootRef = useRef<HTMLDivElement>(null)
  const panelHeaderRef = useRef<HTMLDivElement>(null)
  const presentationRef = useRef<PresentationHandle>(null)
  const lastSectionRef = useRef<PanelSection>(DEFAULT_PANEL_SECTION)
  const previousPanelRef = useRef<PanelSection | null>(null)
  const [panel, setPanel] = useState<PanelSection | null>(null)

  const meetingQuery = useQuery(
    trpc.meetingsRouter.reads.getByIdWithJoins.queryOptions({ id: meetingId }),
  )

  const invalidateMeetingQueries = useCallback(() => {
    invalidateMeeting()
  }, [invalidateMeeting])

  const updateMeeting = useMutation(
    trpc.meetingsRouter.crud.update.mutationOptions({
      onSuccess: invalidateMeetingQueries,
      onError: () => toast.error('Failed to save'),
    }),
  )

  const updateCustomerProfile = useMutation(
    trpc.meetingFlowRouter.updateCustomerProfile.mutationOptions({
      onSuccess: invalidateMeetingQueries,
      onError: () => toast.error('Failed to save customer data'),
    }),
  )

  const meeting = meetingQuery.data
  const customer = meeting?.customer?.id ? meeting.customer : null
  const isReady = Boolean(meeting)

  const handleFlowStateChange = useCallback((patch: Partial<MeetingFlowState>) => {
    const current = meeting?.flowStateJSON ?? {}
    updateMeeting.mutate({
      id: meetingId,
      data: { flowStateJSON: { ...current, ...patch } },
    })
  }, [meeting?.flowStateJSON, meetingId, updateMeeting])

  const handleCustomerProfileChange = useCallback((patch: Record<string, unknown>) => {
    if (!customer?.id) {
      return
    }
    // Flat column patch (epic #256/#259) — send only the changed field(s),
    // no read-modify-merge needed since each column IS the field.
    updateCustomerProfile.mutate({
      meetingId,
      customerId: customer.id,
      patch,
    })
  }, [customer, meetingId, updateCustomerProfile])

  const handleContextChange = useCallback((patch: Record<string, unknown>) => {
    const current = (meeting?.contextJSON ?? {}) as MeetingContext
    updateMeeting.mutate({
      id: meetingId,
      data: { contextJSON: { ...current, ...patch } as MeetingContext },
    })
  }, [meeting?.contextJSON, meetingId, updateMeeting])

  const handleOutcomeChange = useCallback((outcome: string) => {
    void changeOutcome(meetingId, outcome as MeetingOutcome)
  }, [changeOutcome, meetingId])

  const handleAgentNotesChange = useCallback((notes: string) => {
    updateMeeting.mutate({
      id: meetingId,
      data: { agentNotes: notes },
    })
  }, [meetingId, updateMeeting])

  const flowContext = useMemo<MeetingFlowContext | null>(() => {
    if (!meeting) {
      return null
    }
    return {
      meetingId,
      customerId: meeting.customerId ?? null,
      customer: customer as CustomerWithProfile | null,
      flowState: meeting.flowStateJSON ?? null,
      onFlowStateChange: handleFlowStateChange,
      onCustomerProfileChange: handleCustomerProfileChange,
    }
  }, [meeting, meetingId, customer, handleFlowStateChange, handleCustomerProfileChange])

  const contextFilledCount = useMemo(
    () => (meeting ? computeContextFilledCount(meeting, customer as CustomerWithProfile | null) : 0),
    [meeting, customer],
  )

  // ── Steps ──────────────────────────────────────────────────────────────────

  const setStep = useCallback((step: number) => {
    void setCurrentStep(step)
  }, [setCurrentStep])

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS) {
      setStep(currentStep + 1)
    }
  }, [currentStep, setStep])

  const handlePrev = useCallback(() => {
    if (currentStep > 1) {
      setStep(currentStep - 1)
    }
  }, [currentStep, setStep])

  // ── Panel ──────────────────────────────────────────────────────────────────

  const openSection = useCallback((section: PanelSection) => {
    lastSectionRef.current = section
    setPanel(section)
  }, [])

  const closePanel = useCallback(() => {
    setPanel(null)
  }, [])

  const togglePanel = useCallback(() => {
    if (panel === null) {
      openSection(lastSectionRef.current)
    }
    else {
      closePanel()
    }
  }, [panel, openSection, closePanel])

  const selectFromRail = useCallback((section: PanelSection) => {
    if (panel === section) {
      closePanel()
    }
    else {
      openSection(section)
    }
  }, [panel, openSection, closePanel])

  // ── Present mode: entering closes the panel (the screen faces the homeowner) ─

  const togglePresent = useCallback(() => {
    if (!presenting) {
      setPanel(null)
    }
    togglePresentMode()
  }, [presenting, togglePresentMode])

  // ── Focus: the step root after every step change, the panel header on open ──

  const focusStepRoot = useCallback(() => {
    rootRef.current?.querySelector<HTMLElement>('[data-step-root]')?.focus({ preventScroll: true })
  }, [])

  useEffect(() => {
    focusStepRoot()
  }, [currentStep, isReady, focusStepRoot])

  useEffect(() => {
    const wasOpen = previousPanelRef.current !== null
    const isOpen = panel !== null
    previousPanelRef.current = panel
    if (isOpen && !wasOpen) {
      panelHeaderRef.current?.focus({ preventScroll: true })
    }
    else if (!isOpen && wasOpen) {
      focusStepRoot()
    }
  }, [panel, focusStepRoot])

  useMeetingFlowKeys({
    rootRef,
    step: currentStep,
    setStep,
    presenting,
    togglePresent,
    panelOpen: panel !== null,
    closePanel,
    presentationRef,
  })

  // ── Render ─────────────────────────────────────────────────────────────────

  if (meetingQuery.isLoading) {
    return (
      <StageFrame ref={rootRef}>
        <LoadingState title="Loading meeting" description="Fetching meeting details..." />
      </StageFrame>
    )
  }

  if (!meeting || !flowContext) {
    return (
      <StageFrame ref={rootRef}>
        <ErrorState title="Meeting not found" description="This meeting could not be loaded." />
      </StageFrame>
    )
  }

  const stepConfig = MEETING_STEPS[currentStep - 1]
  if (!stepConfig) {
    return (
      <StageFrame ref={rootRef}>
        <ErrorState title="Invalid step" description="This step does not exist." />
      </StageFrame>
    )
  }

  return (
    <StageFrame ref={rootRef}>
      <TopBar
        currentStep={currentStep}
        customer={customer}
        meetingId={meetingId}
        panelOpen={panel !== null}
        syncStatus={syncStatus}
        onStepClick={setStep}
        onTogglePanel={togglePanel}
      />

      <div className="relative isolate flex min-h-0 flex-1 overflow-hidden">
        {/* Stage: the step owns its scroller; the capsule floats over it */}
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {stepConfig.layout === 'presentation'
            ? (
                <>
                  <h1 className="sr-only" id={stepTitleId}>{stepConfig.title}</h1>
                  {stepConfig.id === 'who-we-are' && <WhoWeAreStep ref={presentationRef} onContinue={handleNext} />}
                </>
              )
            : (
                <StepRegion labelledBy={stepTitleId}>
                  <h1 className="sr-only" id={stepTitleId}>{stepConfig.title}</h1>
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
                </StepRegion>
              )}

          <StepCapsule
            currentStep={currentStep}
            presenting={presenting}
            stepTitle={stepConfig.title}
            tone={stepConfig.layout}
            onNext={handleNext}
            onPrev={handlePrev}
            onTogglePresent={togglePresent}
          />
        </div>

        <MeetingPanel headerRef={panelHeaderRef} openSection={panel} onClose={closePanel} onSelect={openSection}>
          {panel === 'meeting' && (
            <MeetingSection meeting={meeting} onReschedule={() => void reschedule(meetingId)} />
          )}
          {panel === 'context' && (
            <ContextPanel
              customer={customer as CustomerWithProfile | null}
              meeting={meeting}
              onAgentNotesChange={handleAgentNotesChange}
              onContextChange={handleContextChange}
              onCustomerProfileChange={handleCustomerProfileChange}
              onOutcomeChange={handleOutcomeChange}
            />
          )}
          {panel === 'persona' && <PersonaProfilePanel meetingId={meetingId} />}
        </MeetingPanel>

        <InspectorRail
          contextFilledCount={contextFilledCount}
          contextTotalCount={CONTEXT_TOTAL_FIELDS}
          openSection={panel}
          personaHasData={hasCustomerProfileData(customer)}
          onSelect={selectFromRail}
        />
      </div>

      <OutcomeReasonDialog />
      <RescheduleDialog />
    </StageFrame>
  )
}
