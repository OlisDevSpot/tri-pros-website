'use client'

import type { DealFormValues } from '@/features/meetings/ui/components/steps/deal-structure-step'
import { useFormContext, useWatch } from 'react-hook-form'
import { formatCurrency } from '@/features/meetings/lib/loan-calc'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { Separator } from '@/shared/components/ui/separator'
import { cn } from '@/shared/lib/utils'

interface ProgramIncentiveDisplay {
  label: string
  valueDisplay: string
  amount: number
}

interface DealStructureFieldsProps {
  programName: string | null
  incentiveDisplays: ProgramIncentiveDisplay[]
  totalDeductions: number
  calculatedFinalTcp: number
  monthlyPayment: number
}

const FINANCE_TERMS = [60, 120, 180] as const

export function DealStructureFields({
  programName,
  incentiveDisplays,
  totalDeductions,
  calculatedFinalTcp,
  monthlyPayment,
}: DealStructureFieldsProps) {
  const form = useFormContext<DealFormValues>()
  const mode = useWatch({ control: form.control, name: 'mode' })
  const financeTermMonths = useWatch({ control: form.control, name: 'financeTermMonths' })
  const apr = useWatch({ control: form.control, name: 'apr' })

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Mode toggle */}
      <div className="space-y-1.5">
        <FormLabel className="text-sm font-semibold">Payment Mode</FormLabel>
        <div className="flex gap-2">
          <Button
            type="button"
            className={cn(
              'flex-1 text-sm',
              mode === 'finance' && 'ring-2 ring-primary ring-offset-1',
            )}
            size="sm"
            variant={mode === 'finance' ? 'default' : 'outline'}
            onClick={() => form.setValue('mode', 'finance')}
          >
            Finance
          </Button>
          <Button
            type="button"
            className={cn(
              'flex-1 text-sm',
              mode === 'cash' && 'ring-2 ring-primary ring-offset-1',
            )}
            size="sm"
            variant={mode === 'cash' ? 'default' : 'outline'}
            onClick={() => form.setValue('mode', 'cash')}
          >
            Cash
          </Button>
        </div>
      </div>

      {/* Starting TCP */}
      <FormField
        name="startingTcp"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel className="text-sm font-semibold">Total Contract Price</FormLabel>
            <FormControl>
              <Input
                className="text-base font-medium"
                inputMode="decimal"
                placeholder="$0"
                type="text"
                value={field.value === 0 ? '' : String(field.value)}
                onChange={(e) => {
                  const numericValue = Number(e.target.value.replace(/\D/g, ''))
                  field.onChange(Number.isNaN(numericValue) ? 0 : numericValue)
                }}
              />
            </FormControl>
            <p className="text-xs text-muted-foreground">Starting price before incentive deductions</p>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Incentives section */}
      {programName && incentiveDisplays.length > 0 && (
        <Card className="border-border/60 bg-muted/30">
          <CardHeader className="pb-3 pt-4">
            <div className="flex items-center gap-2">
              <CardTitle className="text-sm font-semibold">Program Incentives</CardTitle>
              <Badge className="text-xs" variant="secondary">{programName}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pb-4">
            {incentiveDisplays.map(inc => (
              <div className="flex items-center justify-between text-sm" key={inc.label}>
                <span className="text-muted-foreground">{inc.label}</span>
                <span className={cn(
                  'font-medium tabular-nums',
                  inc.amount > 0 ? 'text-emerald-600' : 'text-muted-foreground',
                )}
                >
                  {inc.amount > 0 ? `−${formatCurrency(inc.amount)}` : inc.valueDisplay}
                </span>
              </div>
            ))}

            {totalDeductions > 0 && (
              <>
                <Separator className="my-1" />
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>Total Deductions</span>
                  <span className="tabular-nums text-emerald-600">
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
            <FormLabel className="text-sm font-semibold">Loan Term</FormLabel>
            <div className="flex gap-2">
              {FINANCE_TERMS.map(term => (
                <Button
                  type="button"
                  className="flex-1 text-sm"
                  key={term}
                  size="sm"
                  variant={financeTermMonths === term ? 'default' : 'outline'}
                  onClick={() => form.setValue('financeTermMonths', term)}
                >
                  {`${term} mo`}
                </Button>
              ))}
            </div>
          </div>

          {/* APR */}
          <FormField
            name="apr"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold">APR (%)</FormLabel>
                <FormControl>
                  <Input
                    className="text-base"
                    inputMode="decimal"
                    placeholder="0.00"
                    type="text"
                    value={field.value === 0 ? '' : String(field.value)}
                    onChange={(e) => {
                      const parsed = Number.parseFloat(e.target.value)
                      field.onChange(Number.isNaN(parsed) ? 0 : parsed)
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Monthly payment preview */}
          <Card className="border-border/60 bg-muted/30">
            <CardContent className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-semibold">Monthly Payment</p>
                <p className="text-xs text-muted-foreground">
                  {`${financeTermMonths} months · ${apr}% APR`}
                </p>
              </div>
              <span className="text-xl font-bold tabular-nums">
                {calculatedFinalTcp > 0 && (apr ?? 0) > 0
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

          <FormField
            name="depositAmount"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-sm font-semibold">Deposit Amount</FormLabel>
                <FormControl>
                  <Input
                    className="text-base font-medium"
                    inputMode="decimal"
                    placeholder="$0"
                    type="text"
                    value={field.value === 0 ? '' : String(field.value)}
                    onChange={(e) => {
                      const numericValue = Number(e.target.value.replace(/\D/g, ''))
                      field.onChange(Number.isNaN(numericValue) ? 0 : numericValue)
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Deposit percentage */}
          <Card className="border-border/60 bg-muted/30">
            <CardContent className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="text-sm font-semibold">Deposit Percentage</p>
                <p className="text-xs text-muted-foreground">of final contract price</p>
              </div>
              <span className="text-xl font-bold tabular-nums">
                {calculatedFinalTcp > 0
                  ? `${Math.round(((form.getValues('depositAmount') ?? 0) / calculatedFinalTcp) * 100)}%`
                  : '—'}
              </span>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
