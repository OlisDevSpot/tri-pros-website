'use client'

import type { MeetingFlowContext, MeetingStepHandle, PanelSection } from '@/features/meeting-flow/types'
import type { MeetingOutcome } from '@/shared/constants/enums'
import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
import type { MeetingContext, MeetingFlowState } from '@/shared/entities/meetings/schemas'
import { MutationObserver as QueryMutationObserver, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChannelProvider } from 'ably/react'
import { MotionConfig } from 'motion/react'
import { useQueryState } from 'nuqs'
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { stepParser } from '@/features/meeting-flow/constants/query-parsers'
import { DEFAULT_PANEL_SECTION } from '@/features/meeting-flow/constants/shell'
import { MEETING_STEPS, TOTAL_STEPS } from '@/features/meeting-flow/constants/step-config'
import { TradeSelectionProvider } from '@/features/meeting-flow/contexts/trade-selection-provider'
import { useMeetingFlowKeys } from '@/features/meeting-flow/hooks/use-meeting-flow-keys'
import { useMeetingSplash } from '@/features/meeting-flow/hooks/use-meeting-splash'
import { useMeetingSync } from '@/features/meeting-flow/hooks/use-meeting-sync'
import { usePresentMode } from '@/features/meeting-flow/hooks/use-present-mode'
import { computeContextFilledCount, CONTEXT_TOTAL_FIELDS } from '@/features/meeting-flow/lib/context-fill-count'
import { toPresentationAgent } from '@/features/meeting-flow/lib/to-presentation-agent'
import { ContextPanel } from '@/features/meeting-flow/ui/components/context-panel'
import { PersonaProfilePanel } from '@/features/meeting-flow/ui/components/persona-profile-panel'
import { ProjectCountBadge } from '@/features/meeting-flow/ui/components/project-section/project-count-badge'
import { ProjectSection } from '@/features/meeting-flow/ui/components/project-section/project-section'
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
import { PortfolioStep } from '@/features/meeting-flow/ui/components/steps/portfolio'
import { ProgramStep } from '@/features/meeting-flow/ui/components/steps/program-step'
import { SpecialtiesStep } from '@/features/meeting-flow/ui/components/steps/specialties'
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

interface MeetingFlowViewInnerProps extends MeetingFlowViewProps {
  /** The meeting splash covers the flow; the stage is inert until it is pressed. */
  splashOpen: boolean
}

export function MeetingFlowView({ meetingId }: MeetingFlowViewProps) {
  // The splash itself mounts from the dashboard layout (`MeetingSplashMount`, E9); the view only
  // reads the shared store to go inert under it and to take focus back when it closes (E4).
  const { open: splashOpen } = useMeetingSplash(meetingId)
  return (
    <ChannelProvider channelName={`meeting:${meetingId}`}>
      <MeetingFlowViewInner meetingId={meetingId} splashOpen={splashOpen} />
    </ChannelProvider>
  )
}

function MeetingFlowViewInner({ meetingId, splashOpen }: MeetingFlowViewInnerProps) {
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
  const presentationRef = useRef<MeetingStepHandle>(null)
  const lastSectionRef = useRef<PanelSection>(DEFAULT_PANEL_SECTION)
  const previousPanelRef = useRef<PanelSection | null>(null)
  const [panel, setPanel] = useState<PanelSection | null>(null)

  const meetingQuery = useQuery(
    trpc.meetingsRouter.reads.getByIdWithJoins.queryOptions({ id: meetingId }),
  )

  const queryClient = useQueryClient()

  // Writes go through observers the view never subscribes to, so a save's pending and success
  // states do not re-render the view or change `flowContext` (spec §4.4 step 2). The latest
  // invalidation function is read through a ref so the observers are created once.
  const invalidateRef = useRef(invalidateMeeting)
  useLayoutEffect(() => {
    invalidateRef.current = invalidateMeeting
  })

  const [meetingWriter] = useState(() => new QueryMutationObserver(queryClient, trpc.meetingsRouter.crud.update.mutationOptions({
    onSuccess: () => invalidateRef.current(),
    onError: () => toast.error('Failed to save'),
  })))

  const [customerProfileWriter] = useState(() => new QueryMutationObserver(queryClient, trpc.meetingFlowRouter.updateCustomerProfile.mutationOptions({
    onSuccess: () => invalidateRef.current(),
    onError: () => toast.error('Failed to save customer data'),
  })))

  const meeting = meetingQuery.data
  const customer = meeting?.customer?.id ? meeting.customer : null
  const isReady = Boolean(meeting)

  // The cached meeting at call time, not the value from the last render: two writes close together
  // merge onto the newest cached blob instead of a stale closure (follow-up 9, partly).
  const readCachedMeeting = useCallback(
    () => queryClient.getQueryData(trpc.meetingsRouter.reads.getByIdWithJoins.queryKey({ id: meetingId })),
    [queryClient, trpc, meetingId],
  )

  const handleFlowStateChange = useCallback((patch: Partial<MeetingFlowState>) => {
    const current = readCachedMeeting()?.flowStateJSON ?? {}
    meetingWriter.mutate({ id: meetingId, data: { flowStateJSON: { ...current, ...patch } } }).catch(() => undefined)
  }, [readCachedMeeting, meetingId, meetingWriter])

  const customerId = customer?.id
  const handleCustomerProfileChange = useCallback((patch: Record<string, unknown>) => {
    if (!customerId) {
      return
    }
    // Flat column patch (epic #256/#259) — send only the changed field(s),
    // no read-modify-merge needed since each column IS the field.
    customerProfileWriter.mutate({ meetingId, customerId, patch }).catch(() => undefined)
  }, [customerId, meetingId, customerProfileWriter])

  const handleContextChange = useCallback((patch: Record<string, unknown>) => {
    const current = (readCachedMeeting()?.contextJSON ?? {}) as MeetingContext
    meetingWriter.mutate({ id: meetingId, data: { contextJSON: { ...current, ...patch } as MeetingContext } }).catch(() => undefined)
  }, [readCachedMeeting, meetingId, meetingWriter])

  const handleOutcomeChange = useCallback((outcome: string) => {
    void changeOutcome(meetingId, outcome as MeetingOutcome)
  }, [changeOutcome, meetingId])

  const handleAgentNotesChange = useCallback((notes: string) => {
    meetingWriter.mutate({ id: meetingId, data: { agentNotes: notes } }).catch(() => undefined)
  }, [meetingId, meetingWriter])

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

  // The splash held the stage inert; when it closes, focus returns to the step (E4), driven by
  // state, not by a timer or `onExitComplete`: the splash sits outside this tree. An inert
  // element cannot take focus, so the step-change focus above cannot steal it from the splash.
  useEffect(() => {
    if (!splashOpen) {
      focusStepRoot()
    }
  }, [splashOpen, focusStepRoot])

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
      <StageFrame ref={rootRef} inert={splashOpen}>
        <div className="h-full p-4 md:p-6">
          <LoadingState title="Loading meeting" description="Fetching meeting details…" />
        </div>
      </StageFrame>
    )
  }

  if (!meeting || !flowContext) {
    return (
      <StageFrame ref={rootRef} inert={splashOpen}>
        <div className="h-full p-4 md:p-6">
          <ErrorState title="Meeting not found" description="This meeting could not be loaded." />
        </div>
      </StageFrame>
    )
  }

  const stepConfig = MEETING_STEPS[currentStep - 1]
  if (!stepConfig) {
    return (
      <StageFrame ref={rootRef} inert={splashOpen}>
        <div className="h-full p-4 md:p-6">
          <ErrorState title="Invalid step" description="This step does not exist." />
        </div>
      </StageFrame>
    )
  }

  return (
    <TradeSelectionProvider flowContext={flowContext}>
      <MotionConfig reducedMotion="user">
        <StageFrame ref={rootRef} inert={splashOpen}>
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
            {/* Stage: a flex column because the presentation root is `min-h-0 flex-1` (it collapses to
                0px in a block parent). The step owns its scroller; the capsule floats over it. */}
            <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              {stepConfig.layout === 'presentation'
                ? (
                    <>
                      <h1 className="sr-only" id={stepTitleId}>{stepConfig.title}</h1>
                      {stepConfig.id === 'who-we-are' && (
                        <WhoWeAreStep ref={presentationRef} agent={toPresentationAgent(meeting)} onContinue={handleNext} />
                      )}
                      {stepConfig.id === 'portfolio' && <PortfolioStep ref={presentationRef} labelledBy={stepTitleId} />}
                    </>
                  )
                : (
                    <StepRegion className={stepConfig.layout === 'split' ? 'overflow-hidden p-0 md:p-0' : undefined} labelledBy={stepTitleId}>
                      <h1 className="sr-only" id={stepTitleId}>{stepConfig.title}</h1>
                      {stepConfig.id === 'specialties' && <SpecialtiesStep />}
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
              {panel === 'project' && <ProjectSection />}
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
              projectBadge={<ProjectCountBadge />}
              syncStatus={syncStatus}
              onSelect={selectFromRail}
            />
          </div>

          <OutcomeReasonDialog />
          <RescheduleDialog />
        </StageFrame>
      </MotionConfig>
    </TradeSelectionProvider>
  )
}
