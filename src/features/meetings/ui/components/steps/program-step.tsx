'use client'

import type { MeetingFlowContext, QualificationContext } from '@/features/meetings/types'
import type { MeetingType } from '@/shared/types/enums'
import { useMemo, useState } from 'react'
import { getProgramByAccessor, MEETING_PROGRAMS } from '@/features/meetings/constants/programs'
import { qualifyAllPrograms } from '@/features/meetings/lib/qualify-programs'
import { ProgramCard, StandardPricingCard } from '@/features/meetings/ui/components/steps/program-card'
import { ProgramPresentation } from '@/features/meetings/ui/components/steps/program-presentation'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'

const STANDARD_PRICING_ACCESSOR = 'standard-pricing'

interface ProgramStepProps {
  flowContext: MeetingFlowContext
  meetingType: MeetingType
}

export function ProgramStep({ flowContext, meetingType }: ProgramStepProps) {
  const [showPresentation, setShowPresentation] = useState(
    !!flowContext.flowState?.selectedProgram,
  )

  const qualCtx: QualificationContext = useMemo(() => ({
    tradeSelections: flowContext.flowState?.tradeSelections ?? [],
    customer: flowContext.customer,
    meetingType,
  }), [flowContext.flowState?.tradeSelections, flowContext.customer, meetingType])

  const qualifications = useMemo(() => qualifyAllPrograms(qualCtx), [qualCtx])

  const selectedAccessor = flowContext.flowState?.selectedProgram ?? null

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

  // Phase 2: presentation view
  if (showPresentation) {
    const selectedProgram = selectedAccessor ? getProgramByAccessor(selectedAccessor) : null

    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <h2 className="text-base font-semibold">
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

        {/* Presentation or standard pricing summary */}
        {selectedProgram
          ? (
              <ProgramPresentation program={selectedProgram} />
            )
          : (
              <div className="rounded-lg bg-muted/40 px-4 py-5">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Standard pricing applies. No program incentives, promotional add-ons, or expiration
                  windows. The project is scoped and priced based on materials and labor only.
                </p>
              </div>
            )}
      </div>
    )
  }

  // Phase 1: program selection
  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="space-y-1">
        <h2 className="text-base font-semibold">Pick the Right Path</h2>
        <p className="text-sm text-muted-foreground">
          Based on what you&apos;ve shared, here are the programs available to you today.
          Select one to see the full story — or go with standard pricing.
        </p>
      </div>

      {/* Program cards */}
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

        {/* Standard Pricing */}
        <StandardPricingCard
          isSelected={selectedAccessor === null && showPresentation}
          onSelect={() => handleSelect(STANDARD_PRICING_ACCESSOR)}
        />
      </div>
    </div>
  )
}
