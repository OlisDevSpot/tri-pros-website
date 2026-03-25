'use client'

import type { MeetingFlowContext } from '@/features/meetings/types'
import type { DealStructure } from '@/shared/entities/meetings/schemas'
import { useCallback, useEffect, useMemo } from 'react'
import { getProgramByAccessor } from '@/features/meetings/constants/programs'
import { calculateMonthlyPayment, formatCurrency } from '@/features/meetings/lib/loan-calc'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { Separator } from '@/shared/components/ui/separator'
import { cn } from '@/shared/lib/utils'

interface DealStructureStepProps {
  flowContext: MeetingFlowContext
}

const FINANCE_TERMS = [60, 120, 180] as const

export function DealStructureStep({ flowContext }: DealStructureStepProps) {
  const deal: DealStructure = useMemo(
    () => flowContext.flowState?.dealStructure ?? {},
    [flowContext.flowState?.dealStructure],
  )
  const selectedProgram = flowContext.flowState?.selectedProgram ?? null

  const mode = deal.mode ?? 'finance'
  const startingTcp = deal.startingTcp ?? 0
  const financeTermMonths = deal.financeTermMonths ?? 60
  const apr = deal.apr ?? 0
  const depositAmount = deal.depositAmount ?? 0

  const program = selectedProgram ? getProgramByAccessor(selectedProgram) : null

  const incentiveDeductions = useMemo(() => {
    if (!program) {
      return []
    }
    return program.incentives.map(inc => ({
      label: inc.label,
      amount: inc.calculateDeduction(startingTcp),
      source: program.name,
    }))
  }, [program, startingTcp])

  const totalDeductions = useMemo(
    () => incentiveDeductions.reduce((sum, d) => sum + d.amount, 0),
    [incentiveDeductions],
  )

  const calculatedFinalTcp = Math.max(0, startingTcp - totalDeductions)

  const monthlyPayment = useMemo(() => {
    if (mode !== 'finance' || calculatedFinalTcp === 0) {
      return 0
    }
    return calculateMonthlyPayment(calculatedFinalTcp, apr, financeTermMonths)
  }, [mode, calculatedFinalTcp, apr, financeTermMonths])

  const depositPercent = calculatedFinalTcp > 0
    ? Math.round((depositAmount / calculatedFinalTcp) * 100)
    : 0

  // Sync incentives + finalTcp into flowState whenever startingTcp or program changes
  useEffect(() => {
    flowContext.onFlowStateChange({
      dealStructure: {
        ...deal,
        incentives: incentiveDeductions,
        finalTcp: calculatedFinalTcp,
        monthlyPayment: mode === 'finance' ? monthlyPayment : undefined,
        depositPercent: mode === 'cash' ? depositPercent : undefined,
      },
    })
    // Only re-sync when the calculated values change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startingTcp, selectedProgram, mode, apr, financeTermMonths, depositAmount])

  const patchDeal = useCallback(
    (patch: Partial<DealStructure>) => {
      flowContext.onFlowStateChange({
        dealStructure: { ...deal, ...patch },
      })
    },
    [deal, flowContext],
  )

  function handleModeChange(next: 'finance' | 'cash') {
    patchDeal({ mode: next })
  }

  function handleStartingTcpChange(raw: string) {
    const parsed = Number.parseFloat(raw.replace(/[^0-9.]/g, ''))
    patchDeal({ startingTcp: Number.isNaN(parsed) ? 0 : parsed })
  }

  function handleTermChange(term: number) {
    patchDeal({ financeTermMonths: term })
  }

  function handleAprChange(raw: string) {
    const parsed = Number.parseFloat(raw)
    patchDeal({ apr: Number.isNaN(parsed) ? 0 : parsed })
  }

  function handleDepositChange(raw: string) {
    const parsed = Number.parseFloat(raw.replace(/[^0-9.]/g, ''))
    patchDeal({ depositAmount: Number.isNaN(parsed) ? 0 : parsed })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Mode toggle */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold">Payment Mode</Label>
        <div className="flex gap-2">
          <Button
            className={cn(
              'flex-1 text-sm',
              mode === 'finance' && 'ring-primary ring-2 ring-offset-1',
            )}
            size="sm"
            variant={mode === 'finance' ? 'default' : 'outline'}
            onClick={() => handleModeChange('finance')}
          >
            Finance
          </Button>
          <Button
            className={cn(
              'flex-1 text-sm',
              mode === 'cash' && 'ring-primary ring-2 ring-offset-1',
            )}
            size="sm"
            variant={mode === 'cash' ? 'default' : 'outline'}
            onClick={() => handleModeChange('cash')}
          >
            Cash
          </Button>
        </div>
      </div>

      {/* Starting TCP */}
      <div className="space-y-1.5">
        <Label className="text-sm font-semibold" htmlFor="starting-tcp">
          Total Contract Price
        </Label>
        <Input
          className="text-base font-medium"
          id="starting-tcp"
          inputMode="decimal"
          placeholder="$0"
          type="text"
          value={startingTcp === 0 ? '' : startingTcp.toString()}
          onChange={e => handleStartingTcpChange(e.target.value)}
        />
        <p className="text-muted-foreground text-xs">Starting price before incentive deductions</p>
      </div>

      {/* Incentives section */}
      {program && (
        <Card className="border-border/60 bg-muted/30">
          <CardHeader className="pb-3 pt-4">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">Program Incentives</CardTitle>
              <Badge className="text-xs" variant="secondary">{program.name}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {incentiveDeductions.map((deduction, idx) => (
              <div className="flex items-center justify-between text-sm" key={idx}>
                <span className="text-muted-foreground">{deduction.label}</span>
                <span className={cn(
                  'font-medium tabular-nums',
                  deduction.amount > 0 ? 'text-emerald-600' : 'text-muted-foreground',
                )}
                >
                  {deduction.amount > 0 ? `−${formatCurrency(deduction.amount)}` : 'Included'}
                </span>
              </div>
            ))}

            {totalDeductions > 0 && (
              <>
                <Separator className="my-1" />
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Total Deductions</span>
                  <span className="text-emerald-600 tabular-nums">
                    {`−${formatCurrency(totalDeductions)}`}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Final TCP */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="flex items-center justify-between px-5 py-4">
          <span className="text-sm font-semibold">Final Contract Price</span>
          <span className="text-xl font-bold tabular-nums">
            {formatCurrency(calculatedFinalTcp)}
          </span>
        </CardContent>
      </Card>

      {/* Finance details */}
      {mode === 'finance' && (
        <div className="space-y-5">
          <Separator />

          {/* Term selector */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Loan Term</Label>
            <div className="flex gap-2">
              {FINANCE_TERMS.map(term => (
                <Button
                  className="flex-1 text-sm"
                  key={term}
                  size="sm"
                  variant={financeTermMonths === term ? 'default' : 'outline'}
                  onClick={() => handleTermChange(term)}
                >
                  {`${term} mo`}
                </Button>
              ))}
            </div>
          </div>

          {/* APR */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold" htmlFor="apr">
              APR (%)
            </Label>
            <Input
              className="text-base"
              id="apr"
              inputMode="decimal"
              max={99.99}
              min={0}
              placeholder="0.00"
              step={0.01}
              type="number"
              value={apr === 0 ? '' : apr}
              onChange={e => handleAprChange(e.target.value)}
            />
          </div>

          {/* Monthly payment preview */}
          <Card className="border-border/60 bg-muted/30">
            <CardContent className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-semibold">Monthly Payment</p>
                <p className="text-muted-foreground text-xs">
                  {`${financeTermMonths} months · ${apr}% APR`}
                </p>
              </div>
              <span className="text-xl font-bold tabular-nums">
                {calculatedFinalTcp > 0 && apr > 0
                  ? `${formatCurrency(Math.round(monthlyPayment))}/mo`
                  : '—'}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cash details */}
      {mode === 'cash' && (
        <div className="space-y-5">
          <Separator />

          {/* Deposit amount */}
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold" htmlFor="deposit-amount">
              Deposit Amount
            </Label>
            <Input
              className="text-base font-medium"
              id="deposit-amount"
              inputMode="decimal"
              placeholder="$0"
              type="text"
              value={depositAmount === 0 ? '' : depositAmount.toString()}
              onChange={e => handleDepositChange(e.target.value)}
            />
          </div>

          {/* Deposit percentage */}
          <Card className="border-border/60 bg-muted/30">
            <CardContent className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-semibold">Deposit Percentage</p>
                <p className="text-muted-foreground text-xs">of final contract price</p>
              </div>
              <span className="text-xl font-bold tabular-nums">
                {calculatedFinalTcp > 0 ? `${depositPercent}%` : '—'}
              </span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
