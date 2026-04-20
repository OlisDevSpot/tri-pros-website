'use client'

import type { MeetingFlowContext } from '@/features/meeting-flow/types'
import Link from 'next/link'
import { getProgramByAccessor } from '@/features/meeting-flow/constants/programs'
import { formatCurrency } from '@/features/meeting-flow/lib/loan-calc'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { ROOTS } from '@/shared/config/roots'
import { computeDealDepositPercent, computeDealFinalTcp, computeDealMonthlyPayment } from '@/shared/entities/meetings/lib/compute-deal-derived'

interface CreateProposalStepProps {
  flowContext: MeetingFlowContext
  meetingId: string
}

export function CreateProposalStep({ flowContext, meetingId }: CreateProposalStepProps) {
  const { customer, flowState } = flowContext

  const customerName = customer?.name ?? '—'

  const tradeSelections = flowState?.tradeSelections ?? []
  const tradesSummary = tradeSelections.length > 0
    ? tradeSelections.map(t => `${t.tradeName} (${t.selectedScopes.length} scope${t.selectedScopes.length !== 1 ? 's' : ''})`).join(', ')
    : '—'

  const selectedProgram = flowState?.selectedProgram ?? null
  const program = selectedProgram ? getProgramByAccessor(selectedProgram) : null
  const programName = program?.name ?? '—'

  const deal = flowState?.dealStructure ?? {}
  const startingTcp = deal.startingTcp ?? 0
  const mode = deal.mode ?? 'finance'
  const financeTermMonths = deal.financeTermMonths
  const apr = deal.apr
  // Derived values — always computed from inputs, never read from storage.
  const finalTcp = computeDealFinalTcp(deal)
  const monthlyPayment = computeDealMonthlyPayment(deal)
  const depositPercent = computeDealDepositPercent(deal)

  const proposalHref = `${ROOTS.dashboard.proposals.new()}?meetingId=${meetingId}`

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Transfer Preview */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold">Data Transfer Preview</h2>
        <p className="text-muted-foreground text-sm">
          The following information will be pre-filled in the proposal editor.
        </p>

        <div className="rounded-lg border p-5 space-y-3">
          <TransferRow label="Customer" value={customerName} />
          <Separator />
          <TransferRow label="Trades & Scopes" value={tradesSummary} />
          <Separator />
          <TransferRow label="Program" value={programName} />
          <Separator />
          <TransferRow
            label="Starting TCP"
            value={startingTcp > 0 ? formatCurrency(startingTcp) : '—'}
          />
          <Separator />
          <TransferRow
            label="Final TCP"
            value={finalTcp > 0 ? formatCurrency(finalTcp) : '—'}
          />
          {mode === 'finance' && financeTermMonths != null && apr != null && (
            <>
              <Separator />
              <TransferRow
                label="Financing"
                value={
                  monthlyPayment != null && monthlyPayment > 0
                    ? `${financeTermMonths} months at ${apr}% APR · ${formatCurrency(Math.round(monthlyPayment))}/mo`
                    : `${financeTermMonths} months at ${apr}% APR`
                }
              />
            </>
          )}
          {mode === 'cash' && deal.depositAmount != null && deal.depositAmount > 0 && (
            <>
              <Separator />
              <TransferRow
                label="Deposit"
                value={`${formatCurrency(deal.depositAmount)}${depositPercent > 0 ? ` (${depositPercent}%)` : ''}`}
              />
            </>
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="space-y-3">
        <Button asChild className="w-full" size="lg">
          <Link href={proposalHref}>
            Create Proposal →
          </Link>
        </Button>
        <p className="text-muted-foreground text-center text-xs">
          SOW content, pricing breakdown, and agreement notes will be completed in the proposal editor.
        </p>
      </div>
    </div>
  )
}

interface TransferRowProps {
  label: string
  value: string
}

function TransferRow({ label, value }: TransferRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )
}
