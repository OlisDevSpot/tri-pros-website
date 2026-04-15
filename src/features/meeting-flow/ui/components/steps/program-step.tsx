'use client'

import type { MeetingFlowContext, QualificationContext } from '@/features/meeting-flow/types'
import type { MeetingType } from '@/shared/constants/enums'
import { ArrowRightIcon, SparklesIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { BENEFIT_CATEGORY_CONFIG } from '@/features/meeting-flow/constants/benefit-categories'
import { getProgramByAccessor, MEETING_PROGRAMS } from '@/features/meeting-flow/constants/programs'
import { getProfileBenefits } from '@/features/meeting-flow/lib/profile-benefits'
import { qualifyAllPrograms } from '@/features/meeting-flow/lib/qualify-programs'
import { ProgramCard, StandardPricingCard } from '@/features/meeting-flow/ui/components/steps/program-card'
import { ProgramPresentation } from '@/features/meeting-flow/ui/components/steps/program-presentation'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { cn } from '@/shared/lib/utils'

const STANDARD_PRICING_ACCESSOR = 'standard-pricing'

interface ProgramStepProps {
  flowContext: MeetingFlowContext
  meetingType: MeetingType
}

export function ProgramStep({ flowContext, meetingType }: ProgramStepProps) {
  const [showPresentation, setShowPresentation] = useState(
    !!flowContext.flowState?.selectedProgram,
  )

  const tradeSelections = useMemo(
    () => flowContext.flowState?.tradeSelections ?? [],
    [flowContext.flowState?.tradeSelections],
  )
  const customer = flowContext.customer

  const qualCtx: QualificationContext = useMemo(() => ({
    tradeSelections,
    customer,
    meetingType,
  }), [tradeSelections, customer, meetingType])

  const qualifications = useMemo(() => qualifyAllPrograms(qualCtx), [qualCtx])

  const profileBenefits = useMemo(
    () => getProfileBenefits(customer, tradeSelections),
    [customer, tradeSelections],
  )

  const selectedAccessor = flowContext.flowState?.selectedProgram ?? null

  // Build the personalized intro based on customer name and pain points
  const customerName = customer?.name?.split(' ')[0] ?? null
  const painSummary = tradeSelections.flatMap(t => t.painPoints).slice(0, 2)

  function handleSelect(accessor: string) {
    if (accessor === STANDARD_PRICING_ACCESSOR) {
      flowContext.onFlowStateChange({ selectedProgram: null, programQualified: false })
    }
    else {
      flowContext.onFlowStateChange({ selectedProgram: accessor, programQualified: true })
    }
    setShowPresentation(true)
  }

  function handleChangeProgram() {
    setShowPresentation(false)
  }

  // ── Phase 2: Program Presentation ───────────────────────────────────────
  if (showPresentation) {
    const selectedProgram = selectedAccessor ? getProgramByAccessor(selectedAccessor) : null

    return (
      <div className="space-y-8">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg font-bold tracking-tight">
              {selectedProgram ? selectedProgram.name : 'Standard Pricing'}
            </h2>
            <p className="text-sm text-muted-foreground">
              {selectedProgram
                ? selectedProgram.tagline
                : 'No program selected — standard project pricing applies.'}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={handleChangeProgram}>
            Change Program
          </Button>
        </div>

        <Separator />

        {selectedProgram
          ? <ProgramPresentation program={selectedProgram} />
          : (
              <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 px-6 py-8 text-center">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Standard pricing applies. No program incentives or promotional add-ons.
                  The project is scoped and priced based on materials and labor only.
                </p>
              </div>
            )}
      </div>
    )
  }

  // ── Phase 1: Story + Benefits + Selection ───────────────────────────────
  return (
    <div className="space-y-10">
      {/* ── Personalized Story Hero ────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-12 shadow-xl md:px-12 md:py-16">
        <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-80 -translate-x-1/2 rounded-full bg-primary/20 blur-[100px]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative z-10 mx-auto max-w-2xl space-y-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Your Path Forward
          </p>

          <h2 className="text-2xl font-bold leading-tight tracking-tight text-foreground md:text-3xl">
            {customerName
              ? `${customerName}, here's what we've built for your situation.`
              : 'Here\'s what we\'ve built for your situation.'}
          </h2>

          <p className="text-base leading-relaxed text-foreground/60 md:text-lg">
            {painSummary.length > 0
              ? `You told us about ${painSummary.map(p => p.toLowerCase()).join(' and ')}. Every recommendation below is designed to address exactly that — with the right scope, the right timeline, and the right financial structure.`
              : 'Based on what we\'ve discussed today, we\'ve identified the programs and benefits that match your home, your priorities, and your timeline.'}
          </p>
        </div>
      </div>

      {/* ── Personalized Benefits ──────────────────────────────────────── */}
      {profileBenefits.length > 0 && (
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-primary" />
            <h3 className="text-base font-bold tracking-tight">
              Why this matters for you
            </h3>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {profileBenefits.map((benefit) => {
              const config = BENEFIT_CATEGORY_CONFIG[benefit.category]
              const Icon = config.icon

              return (
                <div
                  key={benefit.category}
                  className={cn(
                    'rounded-2xl border p-5 transition-all hover:shadow-md',
                    config.border,
                    `bg-linear-to-br ${config.gradient}`,
                  )}
                >
                  <div className="flex items-start gap-3.5">
                    <div className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl', config.iconBg)}>
                      <Icon className="size-4.5" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-[15px] font-semibold leading-snug tracking-tight">
                          {benefit.headline}
                        </h4>
                        <Badge variant="outline" className={cn('text-[10px]', config.border)}>
                          {config.label}
                        </Badge>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {benefit.body}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Transition Line ────────────────────────────────────────────── */}
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          Now, let&apos;s pick the program that delivers these benefits at the best value.
        </p>
      </div>

      {/* ── Program Cards ──────────────────────────────────────────────── */}
      <div className="space-y-5">
        <h3 className="text-base font-bold tracking-tight">Available Programs</h3>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MEETING_PROGRAMS.map((program) => {
            const qualification = qualifications.find(q => q.accessor === program.accessor)
            if (!qualification) {
              return null
            }
            return (
              <ProgramCard
                key={program.accessor}
                isSelected={selectedAccessor === program.accessor}
                program={program}
                qualification={qualification}
                onSelect={handleSelect}
              />
            )
          })}

          <StandardPricingCard
            isSelected={selectedAccessor === null && showPresentation}
            onSelect={() => handleSelect(STANDARD_PRICING_ACCESSOR)}
          />
        </div>
      </div>

      {/* ── Bottom CTA hint ────────────────────────────────────────────── */}
      {profileBenefits.length > 0 && (
        <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
          <ArrowRightIcon className="size-3" />
          <span>Select a program above to see its full story and incentive details</span>
        </div>
      )}
    </div>
  )
}
