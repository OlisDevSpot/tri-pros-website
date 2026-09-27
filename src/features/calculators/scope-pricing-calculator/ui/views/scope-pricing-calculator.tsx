'use client'

import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'

import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useFieldArray, useForm } from 'react-hook-form'

import { SCOPE_PRICING_FORM_DEFAULTS } from '@/features/calculators/scope-pricing-calculator/constants/form-defaults'
import { useScopePricingQuote } from '@/features/calculators/scope-pricing-calculator/hooks/use-scope-pricing-quote'
import { createFormulaLine, createManualLine, duplicateLine } from '@/features/calculators/scope-pricing-calculator/lib/create-quote-line'
import { resolveScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/lib/resolve-config'
import { createScopePricingFormSchema } from '@/features/calculators/scope-pricing-calculator/schemas/form'
import { AddScopePicker } from '@/features/calculators/scope-pricing-calculator/ui/components/add-scope-picker'
import { AgentPanel } from '@/features/calculators/scope-pricing-calculator/ui/components/agent-panel'
import { FormulaLineCard } from '@/features/calculators/scope-pricing-calculator/ui/components/formula-line-card'
import { ManualLineCard } from '@/features/calculators/scope-pricing-calculator/ui/components/manual-line-card'
import { PermitLines } from '@/features/calculators/scope-pricing-calculator/ui/components/permit-lines'
import { ProjectContextFields } from '@/features/calculators/scope-pricing-calculator/ui/components/project-context-fields'
import { QuoteTotal } from '@/features/calculators/scope-pricing-calculator/ui/components/quote-total'
import { Form } from '@/shared/components/ui/form'

export function ScopePricingCalculator() {
  const [config] = useState(resolveScopePricingConfig)
  const [schema] = useState(() => createScopePricingFormSchema(config.multiplier.floor))
  const form = useForm<ScopePricingFormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: SCOPE_PRICING_FORM_DEFAULTS,
  })
  const lines = useFieldArray({ control: form.control, name: 'lines', keyName: 'fieldKey' })
  const { quote, solved } = useScopePricingQuote(form.control, config)

  return (
    <Form {...form}>
      <form className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-8" noValidate onSubmit={event => event.preventDefault()}>
        <div className="flex items-end gap-3">
          <ProjectContextFields />
          <AgentPanel config={config} quote={quote} solved={solved} />
        </div>

        <section aria-label="Quote" className="flex flex-col gap-3">
          {lines.fields.map((field, index) => {
            const result = quote.lines.find(line => line.id === field.id)
            const onDuplicate = () => lines.insert(index + 1, duplicateLine(form.getValues(`lines.${index}`)))
            const onRemove = () => lines.remove(index)
            return field.kind === 'formula'
              ? <FormulaLineCard index={index} key={field.fieldKey} onDuplicate={onDuplicate} onRemove={onRemove} pricingKey={field.pricingKey} result={result} />
              : <ManualLineCard index={index} key={field.fieldKey} onDuplicate={onDuplicate} onRemove={onRemove} />
          })}
          {lines.fields.length === 0 && (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Add the scopes you measured to see the price.
            </p>
          )}
          <PermitLines quote={quote} />
          <AddScopePicker onAddFormula={key => lines.append(createFormulaLine(key))} onAddManual={() => lines.append(createManualLine())} />
        </section>

        <QuoteTotal quote={quote} />
      </form>
    </Form>
  )
}
