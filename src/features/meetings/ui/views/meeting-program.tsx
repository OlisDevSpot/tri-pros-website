'use client'

import type { MeetingContext } from '@/features/meetings/types'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeftIcon, ArrowRightIcon, FileTextIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import Link from 'next/link'
import { parseAsInteger, parseAsString, useQueryState } from 'nuqs'
import { useMemo } from 'react'
import { getProgramById } from '@/features/meetings/constants/programs'
import { BuyTriggerBar } from '@/features/meetings/ui/components/buy-trigger-bar'
import { CaseStudyPanel } from '@/features/meetings/ui/components/case-study-panel'
import { DataCollectionPanel } from '@/features/meetings/ui/components/data-collection-panel'
import { StepProgress } from '@/features/meetings/ui/components/step-progress'
import { Logo } from '@/shared/components/logo'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { useTRPC } from '@/trpc/helpers'

interface MeetingProgramViewProps {
  programId: string
}

const stepParser = parseAsInteger.withDefault(1)
const strParser = parseAsString.withDefault('')

export function MeetingProgramView({ programId }: MeetingProgramViewProps) {
  const program = getProgramById(programId)

  // ── URL state ──────────────────────────────────────────────────────
  const [currentStep, setCurrentStep] = useQueryState('step', stepParser)
  const [contactId] = useQueryState('contactId', strParser)
  const [scope, setScope] = useQueryState('scope', strParser)
  const [timeline, setTimeline] = useQueryState('timeline', strParser)
  const [yrs, setYrs] = useQueryState('yrs', strParser)
  const [reason, setReason] = useQueryState('reason', strParser)
  const [bill, setBill] = useQueryState('bill', strParser)
  const [dms, setDms] = useQueryState('dms', strParser)

  // ── Contact fetch ──────────────────────────────────────────────────
  const trpc = useTRPC()
  const contactQuery = useQuery(
    trpc.notionRouter.contacts.getSingleById.queryOptions(
      { id: contactId },
      { enabled: !!contactId },
    ),
  )

  // ── Meeting context ────────────────────────────────────────────────
  const ctx = useMemo<MeetingContext>(() => {
    // The tRPC procedure returns `{} | Contact` — cast to a safe partial shape
    const raw = contactQuery.data as {
      address?: string | null
      city?: string
      email?: string | null
      name?: string
      phone?: string | null
      state?: string | null
    } | undefined

    const customer = raw?.name
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
      collectedData: { bill, dms, reason, scope, timeline, yrs },
      customer,
    }
  }, [contactQuery.data, contactId, scope, timeline, yrs, reason, bill, dms])

  // ── Collected values record + setter (for DataCollectionPanel) ────
  const collectedValues: Record<string, string> = { bill, dms, reason, scope, timeline, yrs }

  function handleCollectedChange(id: string, value: string) {
    if (id === 'bill') {
      void setBill(value)
    }
    else if (id === 'dms') {
      void setDms(value)
    }
    else if (id === 'reason') {
      void setReason(value)
    }
    else if (id === 'scope') {
      void setScope(value)
    }
    else if (id === 'timeline') {
      void setTimeline(value)
    }
    else if (id === 'yrs') {
      void setYrs(value)
    }
  }

  if (!program) {
    return null
  }

  const stepCount = program.steps.length
  const stepIndex = Math.min(Math.max(currentStep - 1, 0), stepCount - 1)
  const step = program.steps[stepIndex]

  if (!step) {
    return null
  }

  // ── Resolve personalized content ───────────────────────────────────
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

  // ── Proposal CTA href — carry contactId if present ─────────────────
  const proposalHref = contactId ? `/proposal-flow?contactId=${contactId}` : '/proposal-flow'

  return (
    <div className="flex h-dvh flex-col">
      {/* Top bar */}
      <header className="flex shrink-0 items-center gap-4 px-4 py-3 md:px-6">
        <Link
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          href="/meetings"
        >
          <ArrowLeftIcon className="size-4" />
          <span className="hidden sm:inline">Programs</span>
        </Link>

        <div className="flex flex-1 items-center justify-center">
          <StepProgress
            currentStep={currentStep}
            stepCount={stepCount}
            stepTitles={program.steps.map(s => s.title)}
          />
        </div>

        <div className="flex items-center gap-3">
          <div className="relative hidden h-6 w-20 sm:block">
            <Logo variant="right" />
          </div>
          <span className="text-xs text-amber-400 font-medium">
            {`Step ${currentStep} of ${stepCount}`}
          </span>
        </div>
      </header>

      {/* Buy-trigger bar */}
      <BuyTriggerBar className="shrink-0" trigger={step.buyTrigger} />

      {/* Main content */}
      <div className="flex min-h-0 flex-1 gap-4 px-4 py-4 md:px-6">
        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            animate={{ opacity: 1, x: 0 }}
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto"
            exit={{ opacity: 0, x: -16 }}
            initial={{ opacity: 0, x: 16 }}
            key={step.id}
            transition={{ duration: 0.25 }}
          >
            {/* Step label */}
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              {step.title}
            </p>

            {/* Headline */}
            <h1 className="text-3xl font-black leading-tight tracking-tight md:text-4xl lg:text-5xl">
              {headline}
            </h1>

            {/* Body */}
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

            {/* Data collection panel — renders inside step for steps that collect data */}
            {step.collectsData && step.collectsData.length > 0 && (
              <DataCollectionPanel
                className="mt-2"
                fields={step.collectsData}
                values={collectedValues}
                onChange={handleCollectedChange}
              />
            )}
          </motion.div>
        </AnimatePresence>

        {/* Case study panel — desktop only (mobile handled inside CaseStudyPanel) */}
        <CaseStudyPanel caseStudy={step.caseStudy} />
      </div>

      {/* Bottom navigation */}
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

          {/* Create Proposal CTA — always visible */}
          <Button
            asChild
            className="gap-2 bg-primary/90 hover:bg-primary text-primary-foreground font-semibold"
            size="sm"
          >
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
