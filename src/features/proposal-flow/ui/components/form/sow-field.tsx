import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { TrashIcon } from 'lucide-react'
import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { TemplatesModal } from '@/shared/components/dialogs/modals/templates-modal'
import { Tiptap } from '@/shared/components/tiptap/tiptap'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { MultiSelect, MultiSelectContent, MultiSelectGroup, MultiSelectItem, MultiSelectTrigger, MultiSelectValue } from '@/shared/components/ui/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { useGetScopes } from '@/shared/services/notion/dal/scopes/hooks/queries/use-get-scopes'
import { useGetAllTrades } from '@/shared/services/notion/dal/trades/hooks/queries/use-get-trades'

interface Props {
  index: number
  sowSnapshot: ProposalFormSchema['project']['sow'][0]
  onDelete: () => void
}

export function SOWSection({
  index,
  sowSnapshot,
  onDelete,
}: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const [tradeId, setTradeId] = useState<string | undefined>(sowSnapshot.trade || undefined)

  const currentSOW = useWatch({
    control: form.control,
    name: `project.sow`,
  })

  function getScopesOfTrade(tradeId: string) {
    if (!tradeId) {
      return []
    }

    setTradeId(tradeId)
  }
  const { open: openModal, setModal } = useModalStore()

  const allTrades = useGetAllTrades()
  const scopesOfTrade = useGetScopes({ query: tradeId, filterProperty: 'relatedTrade' })

  return (
    <div key={sowSnapshot.title} className="flex flex-col gap-4 items-center border w-full max-h-187.5 overflow-auto">
      <div className="flex items-end rounded-lg h-full w-full">
        <FormField
          control={form.control}
          name={`project.sow.${index}.trade`}
          render={({ field }) => (
            <FormItem className="max-w-62.5">
              <FormControl className="w-full">
                <Select
                  value={field.value}
                  onValueChange={(val) => {
                    field.onChange(val)
                    getScopesOfTrade(val)
                    form.setValue(`project.sow.${index}.scopes`, [])
                  }}
                >
                  <SelectTrigger
                    {...field}
                    className="w-full bg-transparent dark:bg-transparent border-0"
                  >
                    <SelectValue placeholder="Select a trade" />
                  </SelectTrigger>
                  <SelectContent {...field}>
                    {allTrades.data?.map(trade => (
                      <SelectItem key={trade.id} value={trade.id}>
                        {trade.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`project.sow.${index}.scopes`}
          render={({ field }) => (
            <FormItem className="w-full">
              <MultiSelect
                onValuesChange={field.onChange}
                values={field.value}
              >
                <FormControl>
                  <MultiSelectTrigger className="w-full" disabled={currentSOW[index]?.trade === undefined}>
                    <MultiSelectValue placeholder="Select scopes..." />
                  </MultiSelectTrigger>
                </FormControl>
                <MultiSelectContent
                  search={{
                    emptyMessage: 'No scopes found',
                    placeholder: 'Search scopes...',
                  }}
                >
                  <MultiSelectGroup>
                    {scopesOfTrade.data?.map(scope => (
                      <MultiSelectItem key={scope.id} value={scope.id}>
                        {scope.name}
                      </MultiSelectItem>
                    ))}
                  </MultiSelectGroup>
                </MultiSelectContent>
              </MultiSelect>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-9 w-9 rounded-none"
          onClick={onDelete}
        >
          <TrashIcon />
        </Button>
      </div>
      <div className="w-full p-4 sticky top-0 z-10 bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]">
        <FormField
          name={`project.sow.${index}.title`}
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Section Title</FormLabel>
              <FormControl>
                <Input placeholder="Title" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <div className="w-full p-4 pt-0">
        <FormField
          name={`project.sow.${index}.html`}
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <div className="flex gap-2 items-center">
                <FormLabel>Scope of Work</FormLabel>
                <Button
                  variant="outline"
                  type="button"
                  className="text-xs text-muted-foreground hover:underline"
                  size="sm"
                  onClick={() => {
                    setModal({
                      accessor: 'Templates',
                      Element: TemplatesModal,
                    })
                    openModal()
                  }}
                >
                  Templates
                </Button>
              </div>
              <FormControl>
                {/* <Textarea
                            {...field}
                            placeholder="Tri Pros Remodeling will..."
                            className="min-h-[250px]"
                          /> */}
                <Tiptap
                  onChange={html => field.onChange(html)}
                  initialValues={field.value}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}
