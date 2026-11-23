'use client'

import type { ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'
import type { QuoteResult } from '@/features/calculators/scope-pricing-calculator/types'

import { useFormContext } from 'react-hook-form'

import { MULTIPLIER_STEP } from '@/features/calculators/scope-pricing-calculator/constants/agent-panel'
import { FORMULAS } from '@/features/calculators/scope-pricing-calculator/lib/formula-registry'
import { scopeMultiplierRows } from '@/features/calculators/scope-pricing-calculator/lib/scope-multiplier-rows'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormMessage } from '@/shared/components/ui/form'
import { NumberField } from '@/shared/components/ui/number-field'
import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  config: ScopePricingConfig
  quote: QuoteResult
  lines: ScopePricingFormValues['lines']
}

export function ScopeMultiplierOverrides({ config, quote, lines }: Props) {
  const { control } = useFormContext<ScopePricingFormValues>()
  const { floor } = config.multiplier
  const rows = scopeMultiplierRows(quote, lines)

  return (
    <section aria-label="Scope multipliers" className="flex flex-col gap-3">
      <h3 className="text-sm font-medium">Scope multipliers</h3>
      {rows.length === 0
        ? (
            <p className="text-sm text-muted-foreground">Costed scopes show here, each with its own multiplier.</p>
          )
        : (
            <ul className="flex flex-col gap-3">
              {rows.map((row) => {
                const label = FORMULAS[row.pricingKey].label
                const applied = row.priced == null ? '—' : `${formatAsDollars(row.priced.cost ?? 0)} → ${formatAsDollars(row.priced.price)}`
                return (
                  <li className="flex flex-col gap-1" key={row.id}>
                    <div className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate">{label}</span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">{applied}</span>
                    </div>
                    <FormField
                      control={control}
                      name={`lines.${row.index}.multiplierOverride`}
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex items-center gap-2">
                            <FormControl>
                              <NumberField
                                {...field}
                                aria-label={`Multiplier for ${label}`}
                                className="h-11 w-28 text-center"
                                inputMode="decimal"
                                min={floor}
                                placeholder={row.priced?.multiplier == null ? '' : row.priced.multiplier.toFixed(2)}
                                step={MULTIPLIER_STEP}
                              />
                            </FormControl>
                            {field.value != null && (
                              <Button className="min-h-11 px-0" onClick={() => field.onChange(null)} type="button" variant="link">
                                Back to the default
                              </Button>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </li>
                )
              })}
            </ul>
          )}
    </section>
  )
}
