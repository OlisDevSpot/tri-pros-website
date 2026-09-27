'use client'

import type { SavingsProjectionFormValues } from '@/features/calculators/savings-projection-calculator/schemas/form'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'

import { createSavingsProjectionDefaults } from '@/features/calculators/savings-projection-calculator/constants/form-defaults'
import { useSavingsProjection } from '@/features/calculators/savings-projection-calculator/hooks/use-savings-projection'
import { formatYears } from '@/features/calculators/savings-projection-calculator/lib/format-years'
import { resolveSavingsProjectionConfig } from '@/features/calculators/savings-projection-calculator/lib/resolve-config'
import { savingsProjectionFormSchema } from '@/features/calculators/savings-projection-calculator/schemas/form'
import { AssumptionsStep } from '@/features/calculators/savings-projection-calculator/ui/components/assumptions-step'
import { BillsStep } from '@/features/calculators/savings-projection-calculator/ui/components/bills-step'
import { ComparisonCard } from '@/features/calculators/savings-projection-calculator/ui/components/comparison-card'
import { HomeAndLoansStep } from '@/features/calculators/savings-projection-calculator/ui/components/home-and-loans-step'
import { ProjectStep } from '@/features/calculators/savings-projection-calculator/ui/components/project-step'
import { SavingsHeadline } from '@/features/calculators/savings-projection-calculator/ui/components/savings-headline'
import { TotalPaidChart } from '@/features/calculators/savings-projection-calculator/ui/components/total-paid-chart'
import { Form } from '@/shared/components/ui/form'

export function SavingsProjectionCalculator() {
  const [config] = useState(resolveSavingsProjectionConfig)
  const form = useForm<SavingsProjectionFormValues>({
    resolver: zodResolver(savingsProjectionFormSchema),
    mode: 'onChange',
    defaultValues: createSavingsProjectionDefaults(config),
  })
  const { years, summary } = useSavingsProjection(form.control, config)
  const today = years[0]
  const later = years[years.length - 1]
  const inYears = `In ${formatYears(summary.horizonYears)}`

  return (
    <Form {...form}>
      <form className="grid gap-6 pb-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]" noValidate onSubmit={event => event.preventDefault()}>
        <div className="flex flex-col gap-6 lg:order-2">
          <SavingsHeadline summary={summary} />
          <div className="grid gap-3 sm:grid-cols-2">
            <ComparisonCard homeValue={today.homeValueBefore} money={summary.monthlyBefore} moneyLabel="Monthly bills and payments" netWorth={today.netWorthBefore} title="Today, without the project" />
            <ComparisonCard homeValue={today.homeValueAfter} money={summary.monthlyAfter} moneyLabel="Monthly bills and payments" netWorth={today.netWorthAfter} title="Today, with the project" />
            <ComparisonCard homeValue={later.homeValueBefore} money={later.cumulativeCostBefore} moneyLabel="Total paid by then" netWorth={later.netWorthBefore} title={`${inYears}, without the project`} />
            <ComparisonCard homeValue={later.homeValueAfter} money={later.cumulativeCostAfter} moneyLabel="Total paid by then" netWorth={later.netWorthAfter} title={`${inYears}, with the project`} />
          </div>
          <TotalPaidChart years={years} />
        </div>
        <div className="flex flex-col gap-6 lg:order-1">
          <HomeAndLoansStep heldFlatLiabilities={summary.heldFlatLiabilities} />
          <BillsStep group="billsNow" step={2} title="Monthly bills today" />
          <BillsStep group="billsAfter" step={3} title="Monthly bills after the project" />
          <ProjectStep />
          <AssumptionsStep />
        </div>
      </form>
    </Form>
  )
}
