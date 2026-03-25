'use client'

import type { MeetingFlowContext } from '@/features/meetings/types'
import type { MeetingFlowState } from '@/shared/entities/meetings/schemas'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'
import { useQueryState } from 'nuqs'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'
import { stepParser } from '@/features/meetings/constants/query-parsers'
import { MEETING_STEPS, TOTAL_STEPS } from '@/features/meetings/constants/step-config'
import { StepNav } from '@/features/meetings/ui/components/step-nav'
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

      {/* Step content — placeholder until step components are built */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-6">
        <div className="flex items-center justify-center p-12 text-muted-foreground">
          {`Step ${currentStep}: ${stepConfig.title} — component pending`}
        </div>
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
    </div>
  )
}
