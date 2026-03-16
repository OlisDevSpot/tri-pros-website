'use client'

import type { CollectionField, MeetingContext } from '@/features/meetings/types'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, ArrowRightIcon, ClipboardListIcon, FileTextIcon, WrenchIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { useQueryState } from 'nuqs'
import { useEffect, useMemo } from 'react'
import { toast } from 'sonner'
import { getProgramByAccessor } from '@/features/meetings/constants/programs'
import { modeParser, stepParser } from '@/features/meetings/constants/query-parsers'
import { getJsonbSection } from '@/features/meetings/lib/get-jsonb-section'
import { BuyTriggerBar } from '@/features/meetings/ui/components/buy-trigger-bar'
import { ProgramQuickPick } from '@/features/meetings/ui/components/program-quick-pick'
import { StepDataPanel } from '@/features/meetings/ui/components/step-data-panel'
import { StepProgress } from '@/features/meetings/ui/components/step-progress'
import { CloseStep } from '@/features/meetings/ui/components/steps/close-step'
import { FinancingStep } from '@/features/meetings/ui/components/steps/financing-step'
import { PackageStep } from '@/features/meetings/ui/components/steps/package-step'
import { StoriesStep } from '@/features/meetings/ui/components/steps/stories-step'
import { MeetingIntakeView } from '@/features/meetings/ui/views/meeting-intake-view'
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
      onError: () => toast.error('Failed to save field'),
    }),
  )

  const updateCustomerProfile = useMutation(
    trpc.customersRouter.updateProfile.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.meetingsRouter.getById.queryKey({ id: meetingId }),
        })
      },
      onError: () => toast.error('Failed to save customer field'),
    }),
  )

  const [currentStep, setCurrentStep] = useQueryState('step', stepParser)
  const [mode, setMode] = useQueryState('mode', modeParser)

  // Contact data for personalised program content
  const contactId = meetingQuery.data?.customer?.notionContactId ?? ''
  const contactQuery = useQuery(
    trpc.notionRouter.contacts.getSingleById.queryOptions(
      { id: contactId },
      { enabled: !!contactId },
    ),
  )

  const meeting = meetingQuery.data
  const dbCustomer = meeting?.customer ?? null

  const ctx = useMemo<MeetingContext>(() => {
    const raw = contactQuery.data as {
      address?: string | null
      city?: string
      email?: string | null
      name?: string
      phone?: string | null
      state?: string | null
    } | undefined

    const ctxCustomer = raw?.name
      ? {
          address: raw.address ?? null,
          city: raw.city ?? '',
          email: raw.email,
          id: contactId,
          name: raw.name,
          phone: raw.phone,
          state: raw.state ?? null,
        }
      : null

    return {
      collectedData: {
        bill: meeting?.programDataJSON?.bill ?? '',
        dmsPresent: meeting?.situationProfileJSON?.decisionMakersPresent ?? '',
        scope: meeting?.programDataJSON?.scope ?? '',
        timeline: meeting?.programDataJSON?.timeline ?? '',
        triggerEvent: dbCustomer?.customerProfileJSON?.triggerEvent ?? '',
        yrs: meeting?.programDataJSON?.yrs ?? '',
      },
      customer: ctxCustomer,
    }
  }, [contactQuery.data, contactId, meeting, dbCustomer])

  function handleFieldSave(field: CollectionField, value: string | number | boolean) {
    if (field.entity === 'customer' && dbCustomer?.id) {
      const currentSection = getJsonbSection(dbCustomer, field.jsonbKey)
      updateCustomerProfile.mutate({
        customerId: dbCustomer.id,
        [field.jsonbKey]: { ...currentSection, [field.id]: value },
      })
    }
    else {
      const currentSection = getJsonbSection(meeting ?? null, field.jsonbKey)
      updateMeeting.mutate({ id: meetingId, [field.jsonbKey]: { ...currentSection, [field.id]: value } })
    }
  }

  // Arrow-key navigation for program mode
  useEffect(() => {
    if (mode !== 'program') {
      return
    }
    const program = meeting?.program ? getProgramByAccessor(meeting.program) : null
    const count = program?.steps.length ?? 0

    function handleKeyDown(e: KeyboardEvent) {
      if (!count) {
        return
      }
      if (
        e.target instanceof HTMLInputElement
        || e.target instanceof HTMLTextAreaElement
        || e.target instanceof HTMLSelectElement
      ) {
        return
      }
      if (e.key === 'ArrowLeft' && currentStep > 1) {
        void setCurrentStep(currentStep - 1)
      }
      if (e.key === 'ArrowRight' && currentStep < count) {
        void setCurrentStep(currentStep + 1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mode, meeting?.program, currentStep, setCurrentStep])

  function handleCompleteIntake() {
    void setCurrentStep(1)
    void setMode('program')
  }

  function handleSelectProgram(programId: string) {
    updateMeeting.mutate({ id: meetingId, program: programId })
    void setCurrentStep(1)
  }

  if (meetingQuery.isLoading) {
    return <LoadingState title="Loading meeting" description="Fetching meeting details…" />
  }

  if (!meeting) {
    return <ErrorState title="Meeting not found" description="This meeting could not be loaded." />
  }

  // ── Header — shared across modes ──────────────────────────────────────────
  const header = (
    <header className="flex shrink-0 items-center gap-3 border-b border-border/40 px-4 py-2.5 md:px-6">
      <Link
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        href={`${ROOTS.dashboard.root}?step=meetings`}
      >
        <ArrowLeftIcon className="size-4" />
        <span className="hidden sm:inline">Meetings</span>
      </Link>

      {/* Mode toggle */}
      <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 p-0.5">
        <Button
          className={`h-auto gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
            mode === 'intake'
              ? 'bg-background text-foreground shadow-sm hover:bg-background'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          variant="ghost"
          onClick={() => {
            void setMode('intake')
            void setCurrentStep(1)
          }}
        >
          <ClipboardListIcon className="size-3.5" />
          Intake
        </Button>
        <Button
          className={`h-auto gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
            mode === 'program'
              ? 'bg-background text-foreground shadow-sm hover:bg-background'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          variant="ghost"
          onClick={() => {
            void setMode('program')
            void setCurrentStep(1)
          }}
        >
          <WrenchIcon className="size-3.5" />
          Run Meeting
        </Button>
      </div>

      <div className="ml-auto hidden h-6 w-20 sm:block">
        <Logo variant="right" />
      </div>
    </header>
  )

  // ── Intake mode ────────────────────────────────────────────────────────────
  if (mode === 'intake') {
    return (
      <div className="flex h-full flex-col">
        {header}
        <div className="min-h-0 flex-1">
          <MeetingIntakeView
            currentStep={currentStep}
            customer={dbCustomer}
            meeting={meeting}
            onCompleteIntake={handleCompleteIntake}
            onFieldSave={handleFieldSave}
            onStepChange={s => void setCurrentStep(s)}
          />
        </div>
      </div>
    )
  }

  // ── Program mode ────────────────────────────────────────────────────────────
  const program = meeting.program ? getProgramByAccessor(meeting.program) : null
  if (!program) {
    return (
      <div className="flex h-full flex-col">
        {header}
        <ProgramQuickPick onSelect={handleSelectProgram} />
      </div>
    )
  }

  const stepCount = program.steps.length
  const stepIndex = Math.min(Math.max(currentStep - 1, 0), stepCount - 1)
  const step = program.steps[stepIndex]!

  const headline = step.headlineFn ? step.headlineFn(ctx) : step.headline
  const body = step.bodyFn ? step.bodyFn(ctx) : step.body

  function handleNext() {
    if (currentStep < stepCount) {
      void setCurrentStep(currentStep + 1)
    }
  }

  function handlePrev() {
    if (currentStep > 1) {
      void setCurrentStep(currentStep - 1)
    }
  }

  const proposalHref = `${ROOTS.dashboard.root}?step=create-proposal&meetingId=${meetingId}`

  return (
    <div className="flex h-full flex-col">
      {header}

      {/* Program step progress */}
      <div className="flex shrink-0 items-center gap-4 px-4 py-2 md:px-6">
        <StepProgress
          currentStep={currentStep}
          onStepClick={s => void setCurrentStep(s)}
          stepCount={stepCount}
          stepLabels={
            program.steps.some(s => s.shortLabel)
              ? program.steps.map(s => s.shortLabel ?? '')
              : undefined
          }
          stepTitles={program.steps.map(s => s.title)}
        />
        <span className="ml-auto text-xs font-medium text-amber-400">
          {`${currentStep} / ${stepCount}`}
        </span>
      </div>

      <BuyTriggerBar className="shrink-0" trigger={step.buyTrigger} />

      <div className="flex min-h-0 flex-1 gap-4 px-4 py-4 md:px-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={step.accessor}
            animate={{ opacity: 1, x: 0 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
            exit={{ opacity: 0, x: -16 }}
            initial={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.25 }}
          >
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              {step.title}
            </p>
            <h1 className="text-xl font-semibold leading-snug tracking-tight md:text-2xl">
              {headline}
            </h1>
            {meeting.program === 'tpr-monthly-special' && step.accessor === 'package'
              ? <PackageStep />
              : meeting.program === 'tpr-monthly-special' && step.accessor === 'numbers'
                ? <FinancingStep />
                : meeting.program === 'tpr-monthly-special' && step.accessor === 'stories'
                  ? <StoriesStep />
                  : meeting.program === 'tpr-monthly-special' && step.accessor === 'close'
                    ? <CloseStep ctx={ctx} />
                    : (
                        <div className="flex flex-col gap-3">
                          {body.split('\n\n').map(paragraph => (
                            <p
                              className="text-base leading-relaxed text-foreground/85 md:text-lg"
                              key={paragraph.slice(0, 50)}
                            >
                              {paragraph.replace(/\*\*/g, '')}
                            </p>
                          ))}
                        </div>
                      )}
          </motion.div>
        </AnimatePresence>

        <StepDataPanel
          customer={dbCustomer}
          fields={step.collectsData ?? []}
          meeting={meeting}
          onSave={handleFieldSave}
        />
      </div>

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
          <Button asChild className="gap-2 bg-primary/90 font-semibold text-primary-foreground hover:bg-primary" size="sm">
            <Link href={proposalHref}>
              <FileTextIcon className="size-4" />
              Create Proposal
            </Link>
          </Button>
          <Button
            className="gap-2"
            disabled={currentStep === stepCount}
            size="sm"
            variant={currentStep === stepCount ? 'outline' : 'default'}
            onClick={handleNext}
          >
            <span className="hidden sm:inline">Next Step</span>
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      </footer>
    </div>
  )
}
