'use client'

import type { MeetingFlowContext } from '@/features/meeting-flow/types'
import { useMemo } from 'react'
import { getProgramByAccessor } from '@/features/meeting-flow/constants/programs'
import { formatCurrency } from '@/features/meeting-flow/lib/loan-calc'
import { ClosingScopeCard } from '@/features/meeting-flow/ui/components/steps/closing-scope-card'
import { Badge } from '@/shared/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Separator } from '@/shared/components/ui/separator'
import { meetingOutcomes } from '@/shared/constants/enums'
import { getOutcomeDisabledChecker } from '@/shared/domains/pipelines/lib/get-disabled-outcomes'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { cn } from '@/shared/lib/utils'

interface ClosingStepProps {
  flowContext: MeetingFlowContext
  meetingOutcome: string
  onOutcomeChange: (outcome: string) => void
  proposalState: {
    proposalCount: number
    hasSentProposal: boolean
    hasApprovedProposal: boolean
  }
}

export function ClosingStep({ flowContext, meetingOutcome, onOutcomeChange, proposalState }: ClosingStepProps) {
  const isOutcomeDisabled = getOutcomeDisabledChecker(proposalState)
  const flowState = flowContext.flowState
  const tradeSelections = flowState?.tradeSelections ?? []
  const selectedProgram = flowState?.selectedProgram ?? null
  const deal = flowState?.dealStructure ?? {}

  const program = useMemo(
    () => (selectedProgram ? getProgramByAccessor(selectedProgram) : null),
    [selectedProgram],
  )

  const mode = deal.mode ?? 'finance'
  const startingTcp = deal.startingTcp ?? 0
  const finalTcp = deal.finalTcp ?? startingTcp
  const incentives = useMemo(() => deal.incentives ?? [], [deal.incentives])
  const totalDeductions = useMemo(
    () => incentives.reduce((sum, inc) => sum + inc.amount, 0),
    [incentives],
  )
  const monthlyPayment = deal.monthlyPayment ?? 0
  const financeTermMonths = deal.financeTermMonths ?? 60
  const apr = deal.apr ?? 0
  const depositAmount = deal.depositAmount ?? 0
  const depositPercent = deal.depositPercent ?? 0

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Scopes section */}
      {tradeSelections.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Project Scope</h3>
          <div className="space-y-3">
            {tradeSelections.map(selection => (
              <ClosingScopeCard key={selection.tradeId} selection={selection} />
            ))}
          </div>
        </section>
      )}

      {tradeSelections.length === 0 && (
        <Card className="border-border/60 bg-muted/30">
          <CardContent className="py-5 text-center">
            <p className="text-muted-foreground text-sm">No trades selected yet.</p>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Program section */}
      {program && (
        <section className="space-y-3">
          <h3 className="text-sm font-semibold">Selected Program</h3>
          <Card className={cn(
            'border',
            program.accentColor === 'amber' && 'border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20',
            program.accentColor === 'sky' && 'border-sky-300/60 bg-sky-50/40 dark:bg-sky-950/20',
            program.accentColor === 'violet' && 'border-violet-300/60 bg-violet-50/40 dark:bg-violet-950/20',
          )}
          >
            <CardHeader className="pb-2 pt-4">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-semibold">{program.name}</CardTitle>
                <Badge className="text-xs" variant="secondary">{program.expiresLabel}</Badge>
              </div>
              <p className="text-muted-foreground text-xs">{program.tagline}</p>
            </CardHeader>

            {incentives.length > 0 && (
              <CardContent className="space-y-2 pb-4">
                {incentives.map(inc => (
                  <div className="flex items-center justify-between text-sm" key={inc.label}>
                    <span className="text-muted-foreground">{inc.label}</span>
                    <span className={cn(
                      'font-medium tabular-nums',
                      inc.amount > 0 ? 'text-emerald-600' : 'text-muted-foreground',
                    )}
                    >
                      {inc.amount > 0 ? `−${formatCurrency(inc.amount)}` : 'Included'}
                    </span>
                  </div>
                ))}
              </CardContent>
            )}
          </Card>
        </section>
      )}

      {program && <Separator />}

      {/* Pricing section */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Pricing Summary</h3>
        <Card className="border-border/60">
          <CardContent className="space-y-3 px-5 py-4">
            {/* Starting TCP */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Starting Price</span>
              <span className="tabular-nums">{formatCurrency(startingTcp)}</span>
            </div>

            {/* Deductions */}
            {totalDeductions > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Program Deductions</span>
                <span className="tabular-nums text-emerald-600">{`−${formatCurrency(totalDeductions)}`}</span>
              </div>
            )}

            <Separator className="my-1" />

            {/* Final TCP */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">Final Contract Price</span>
              <span className="text-lg font-bold tabular-nums">{formatCurrency(finalTcp)}</span>
            </div>

            <Separator className="my-1" />

            {/* Payment detail */}
            {mode === 'finance'
              ? (
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">Monthly Payment</span>
                      <p className="text-muted-foreground text-xs">{`${financeTermMonths} months · ${apr}% APR`}</p>
                    </div>
                    <span className="tabular-nums font-semibold">
                      {finalTcp > 0 && apr > 0 ? `${formatCurrency(Math.round(monthlyPayment))}/mo` : '—'}
                    </span>
                  </div>
                )
              : (
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">Deposit</span>
                      <p className="text-muted-foreground text-xs">{`${depositPercent}% of final price`}</p>
                    </div>
                    <span className="tabular-nums font-semibold">
                      {depositAmount > 0 ? formatCurrency(depositAmount) : '—'}
                    </span>
                  </div>
                )}
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Timeline section */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold">Project Timeline</h3>
        <Card className="border-border/60 bg-muted/30">
          <CardContent className="space-y-2 px-5 py-4">
            <div className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
              <span>Install coordinator calls within 24 hours of signing</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
              <span>Crew on-site within 3–4 weeks of signing</span>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <span className="text-muted-foreground mt-0.5 shrink-0">•</span>
              <span>Most projects complete in 10–14 business days</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Outcome selector */}
      <section className="space-y-2">
        <Label className="text-sm font-semibold" htmlFor="meeting-outcome">
          Meeting Outcome
        </Label>
        <Select value={meetingOutcome} onValueChange={onOutcomeChange}>
          <SelectTrigger className="w-full" id="meeting-outcome">
            <SelectValue placeholder="Select outcome…" />
          </SelectTrigger>
          <SelectContent>
            {meetingOutcomes.map((outcome) => {
              const disabled = outcome !== meetingOutcome && isOutcomeDisabled(outcome)
              return (
                <SelectItem
                  key={outcome}
                  value={outcome}
                  disabled={disabled}
                  className={disabled ? 'opacity-40' : ''}
                >
                  {MEETING_OUTCOME_LABELS[outcome] ?? outcome}
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      </section>
    </div>
  )
}
