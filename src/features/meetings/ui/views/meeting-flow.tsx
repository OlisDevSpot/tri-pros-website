'use client'

import type { MeetingFlowContext } from '@/features/meetings/types'
import type { MeetingContext, MeetingFlowState } from '@/shared/entities/meetings/schemas'
import type { MeetingOutcome } from '@/shared/types/enums'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'
import { useQueryState } from 'nuqs'
import { useCallback, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { CONTEXT_TOTAL_FIELDS } from '@/features/meetings/constants/context-panel'
import { stepParser } from '@/features/meetings/constants/query-parsers'
import { MEETING_STEPS, TOTAL_STEPS } from '@/features/meetings/constants/step-config'
import { computeContextFilledCount } from '@/features/meetings/lib/context-fill-count'
import { ContextPanel } from '@/features/meetings/ui/components/context-panel'
import { ContextPanelTrigger } from '@/features/meetings/ui/components/context-panel-trigger'
import { StepNav } from '@/features/meetings/ui/components/step-nav'
import { ClosingStep } from '@/features/meetings/ui/components/steps/closing-step'
import { CreateProposalStep } from '@/features/meetings/ui/components/steps/create-proposal-step'
import { DealStructureStep } from '@/features/meetings/ui/components/steps/deal-structure-step'
import { PortfolioStep } from '@/features/meetings/ui/components/steps/portfolio-step'
import { ProgramStep } from '@/features/meetings/ui/components/steps/program-step'
import { SpecialtiesStep } from '@/features/meetings/ui/components/steps/specialties-step'
import { WhoWeAreStep } from '@/features/meetings/ui/components/steps/who-we-are-step'
import { Logo } from '@/shared/components/logo'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { ROOTS } from '@/shared/config/roots'
import { useTRPC } from '@/trpc/helpers'

interface MeetingFlowViewProps {
  meetingId: string
}

export function MeetingFlowView({ meetingId }: MeetingFlowViewProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [currentStep, setCurrentStep] = useQueryState('step', stepParser)
  const [contextOpen, setContextOpen] = useState(false)

  const meetingQuery = useQuery(
    trpc.meetingsRouter.getById.queryOptions({ id: meetingId }),
  )

  const updateMeeting = useMutation(
    trpc.meetingsRouter.update.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.meetingsRouter.getById.queryKey({ id: meetingId }),
        })
      },
      onError: () => toast.error('Failed to save'),
    }),
  )

  const updateCustomerProfile = useMutation(
    trpc.customersRouter.updateProfile.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.meetingsRouter.getById.queryKey({ id: meetingId }),
        })
      },
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
      customerId: customer.id,
      [jsonbKey]: { ...(currentSection as Record<string, unknown>), ...patch },
    })
  }, [customer, updateCustomerProfile])

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
    <div className="flex h-full flex-col">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-border/40 px-4 py-2.5 md:px-6">
        <Link
          className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          href={`${ROOTS.dashboard.root}?step=meetings`}
        >
          <ArrowLeftIcon className="size-4" />
          <span className="hidden sm:inline">Meetings</span>
        </Link>

        <StepNav currentStep={currentStep} onStepClick={s => void setCurrentStep(s)} />

        <div className="ml-auto hidden h-6 w-20 sm:block">
          <Logo variant="right" />
        </div>
      </header>

      {/* Step title bar */}
      <div className="shrink-0 border-b border-border/20 px-4 py-2 md:px-6">
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
          />
        )}
        {stepConfig.id === 'create-proposal' && (
          <CreateProposalStep flowContext={flowContext} meetingId={meetingId} />
        )}
      </div>

      {/* Footer navigation */}
      <footer className="shrink-0">
        <Separator />
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
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

      {/* Context panel trigger + sheet */}
      <ContextPanelTrigger
        filledCount={contextFilledCount}
        totalCount={CONTEXT_TOTAL_FIELDS}
        onClick={() => setContextOpen(true)}
      />

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
    </div>
  )
}
