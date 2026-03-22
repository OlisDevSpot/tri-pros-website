'use client'

import type { IntakeFormData } from '@/features/intake/schemas/intake-form-schema'
import { useQuery } from '@tanstack/react-query'
import { PlusIcon } from 'lucide-react'
import { useFieldArray, useFormContext } from 'react-hook-form'
import { TradeScopeRow } from '@/shared/components/trade-scope-row'
import { Button } from '@/shared/components/ui/button'
import { FormField, FormItem, FormMessage } from '@/shared/components/ui/form'
import { Label } from '@/shared/components/ui/label'
import { useTRPC } from '@/trpc/helpers'

export function IntakeTradeScopePicker() {
  const trpc = useTRPC()
  const form = useFormContext<IntakeFormData>()

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'tradeRows',
  })

  const { data: trades = [] } = useQuery(trpc.notionRouter.trades.getAll.queryOptions())

  const usedTradeIds = new Set(
    form.getValues('tradeRows').map(r => r.tradeId).filter(Boolean),
  )

  return (
    <FormField
      control={form.control}
      name="tradeRows"
      render={() => (
        <FormItem>
          <Label>
            {'Trades & Scopes '}
            <span className="text-destructive">*</span>
          </Label>
          <div className="space-y-3">
            {fields.map((field, index) => (
              <TradeScopeRow
                key={field.id}
                tradeId={form.watch(`tradeRows.${index}.tradeId`)}
                selectedScopeIds={form.watch(`tradeRows.${index}.scopeIds`)}
                allTrades={trades}
                usedTradeIds={usedTradeIds}
                onTradeChange={(tradeId) => {
                  form.setValue(`tradeRows.${index}.tradeId`, tradeId, { shouldValidate: true })
                  form.setValue(`tradeRows.${index}.scopeIds`, [])
                }}
                onScopesChange={(scopeIds) => {
                  form.setValue(`tradeRows.${index}.scopeIds`, scopeIds)
                }}
                onDelete={() => {
                  if (fields.length > 1) {
                    remove(index)
                  }
                }}
              />
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ tradeId: '', scopeIds: [] })}
            disabled={usedTradeIds.size >= trades.length}
          >
            <PlusIcon className="mr-1.5 h-3.5 w-3.5" />
            Add Trade
          </Button>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
