'use client'

import type { MeetingFlowContext } from '@/features/meeting-flow/types'
import type { DealStructure } from '@/shared/entities/meetings/schemas'
import { zodResolver } from '@hookform/resolvers/zod'
import { SaveIcon } from 'lucide-react'
import { useEffect, useMemo } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import z from 'zod'
import { getProgramByAccessor } from '@/features/meeting-flow/constants/programs'
import { DealStructureFields } from '@/features/meeting-flow/ui/components/steps/deal-structure-fields'
import { Button } from '@/shared/components/ui/button'
import { Form } from '@/shared/components/ui/form'
import { computeDealFinalTcp, computeDealMonthlyPayment } from '@/shared/entities/meetings/lib/compute-deal-derived'

// ── Form schema (local to this step) ────────────────────────────────────────

const dealFormSchema = z.object({
  mode: z.enum(['finance', 'cash']),
  startingTcp: z.number().min(0),
  financeTermMonths: z.number().optional(),
  apr: z.number().min(0).optional(),
  depositAmount: z.number().min(0).optional(),
})

export type DealFormValues = z.infer<typeof dealFormSchema>

// ── Component ───────────────────────────────────────────────────────────────

interface DealStructureStepProps {
  flowContext: MeetingFlowContext
}

export function DealStructureStep({ flowContext }: DealStructureStepProps) {
  const serverDeal = flowContext.flowState?.dealStructure ?? {}
  const selectedProgram = flowContext.flowState?.selectedProgram ?? null
  const program = selectedProgram ? getProgramByAccessor(selectedProgram) : null

  const form = useForm<DealFormValues>({
    resolver: zodResolver(dealFormSchema),
    mode: 'onSubmit',
    defaultValues: {
      mode: serverDeal.mode ?? 'finance',
      startingTcp: serverDeal.startingTcp ?? 0,
      financeTermMonths: serverDeal.financeTermMonths ?? 180,
      apr: serverDeal.apr ?? 9.99,
      depositAmount: serverDeal.depositAmount ?? 0,
    },
  })

  // Watch fields for computed values
  const mode = useWatch({ control: form.control, name: 'mode' })
  const startingTcp = useWatch({ control: form.control, name: 'startingTcp' })
  const financeTermMonths = useWatch({ control: form.control, name: 'financeTermMonths' }) ?? 180
  const apr = useWatch({ control: form.control, name: 'apr' }) ?? 0

  // Compute incentive deductions from program
  const incentiveDisplays = useMemo(() => {
    if (!program) {
      return []
    }
    return program.incentives.map(inc => ({
      label: inc.label,
      valueDisplay: inc.valueDisplay,
      amount: inc.calculateDeduction(startingTcp),
    }))
  }, [program, startingTcp])

  const totalDeductions = useMemo(
    () => incentiveDisplays.reduce((sum, d) => sum + d.amount, 0),
    [incentiveDisplays],
  )

  // Live form preview uses the canonical helpers — same code path as
  // persisted reads in closing-step / create-proposal-step. A DealStructure
  // snapshot is synthesized from current form values so we feed the helpers
  // the exact shape they expect.
  const dealSnapshot: DealStructure = useMemo(
    () => ({
      mode,
      startingTcp,
      incentives: incentiveDisplays.map(i => ({ label: i.label, amount: i.amount, source: program?.name ?? '' })),
      financeTermMonths,
      apr,
    }),
    [mode, startingTcp, incentiveDisplays, financeTermMonths, apr, program],
  )

  const calculatedFinalTcp = computeDealFinalTcp(dealSnapshot)
  const monthlyPayment = computeDealMonthlyPayment(dealSnapshot)

  // Reset server data into form when meeting data changes externally
  const serverDealJson = JSON.stringify(serverDeal)
  useEffect(() => {
    // Only reset if server has data and form hasn't been touched
    if (!form.formState.isDirty && serverDeal.startingTcp !== undefined) {
      form.reset({
        mode: serverDeal.mode ?? 'finance',
        startingTcp: serverDeal.startingTcp ?? 0,
        financeTermMonths: serverDeal.financeTermMonths ?? 180,
        apr: serverDeal.apr ?? 9.99,
        depositAmount: serverDeal.depositAmount ?? 0,
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverDealJson])

  function onSubmit(values: DealFormValues) {
    const incentives = program
      ? program.incentives
          .map(inc => ({
            label: inc.label,
            amount: inc.calculateDeduction(values.startingTcp),
            source: program.name,
          }))
          .filter(i => i.amount > 0)
      : []

    // Only inputs are persisted — finalTcp / monthlyPayment / depositPercent
    // are derived via the compute-deal-derived helpers on every read.
    flowContext.onFlowStateChange({
      dealStructure: {
        mode: values.mode,
        startingTcp: values.startingTcp,
        incentives,
        financeTermMonths: values.mode === 'finance' ? values.financeTermMonths : undefined,
        apr: values.mode === 'finance' ? values.apr : undefined,
        depositAmount: values.mode === 'cash' ? values.depositAmount : undefined,
      },
    })

    form.reset(values)
    toast.success('Deal structure saved')
  }

  return (
    <Form {...form}>
      <form id="deal-structure-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-4 py-4 md:px-6">
        <DealStructureFields
          programName={program?.name ?? null}
          incentiveDisplays={incentiveDisplays}
          totalDeductions={totalDeductions}
          calculatedFinalTcp={calculatedFinalTcp}
          monthlyPayment={monthlyPayment}
        />

        {/* Save button */}
        <div className="mx-auto flex max-w-2xl justify-end">
          <Button
            type="submit"
            size="sm"
            className="gap-2"
            disabled={!form.formState.isDirty}
          >
            <SaveIcon className="size-4" />
            Save Deal Structure
          </Button>
        </div>
      </form>
    </Form>
  )
}
