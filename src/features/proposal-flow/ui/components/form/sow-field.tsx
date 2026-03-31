import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { TiptapHandle } from '@/shared/components/tiptap/tiptap'
import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import { useQueryClient } from '@tanstack/react-query'

import { useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
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
import { useTRPC } from '@/trpc/helpers'

interface Props {
  index: number
  pricingMode: 'total' | 'breakdown'
  sowSnapshot: ProposalFormSchema['project']['data']['sow'][0]
}

export function SOWSection({
  index,
  pricingMode,
  sowSnapshot,
}: Props) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const form = useFormContext<ProposalFormSchema>()
  const [tradeId, setTradeId] = useState<string | undefined>(sowSnapshot.trade.id || undefined)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  const tiptapRef = useRef<TiptapHandle | null>(null)

  const allTrades = useGetAllTrades()
  const scopesOfTrade = useGetScopes({ query: tradeId, filterProperty: 'relatedTrade' }, { enabled: !!tradeId })

  function getScopesOfTrade(tradeId: string) {
    if (!tradeId)
      return

    setTradeId(tradeId)
  }
  const { open: openModal, close: closeModal, setModal } = useModalStore()

  return (
    <div className="flex flex-col gap-3 items-center w-full max-h-187.5 overflow-auto lg:gap-4">
      <div className="flex flex-col gap-2 rounded-lg w-full px-3 pt-2 lg:flex-row lg:items-end lg:px-0 lg:pt-0">
        <FormField
          control={form.control}
          name={`project.data.sow.${index}.trade.id`}
          render={({ field }) => (
            <FormItem className="w-full lg:max-w-62.5">
              <FormControl className="w-full">
                <Select
                  value={field.value}
                  onValueChange={(val) => {
                    field.onChange(val)
                    getScopesOfTrade(val)
                    form.setValue(`project.data.sow.${index}.scopes`, [])
                    form.setValue(`project.data.sow.${index}.trade.label`, allTrades.data?.find(trade => trade.id === val)?.name || '')
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
          name={`project.data.sow.${index}.scopes`}
          render={({ field }) => (
            <FormItem className="w-full">
              <MultiSelect
                onValuesChange={(values) => {
                  const newScopesArray = values.map((scopeId) => {
                    const scopeOfTrade = scopesOfTrade.data?.find(scope => scope.id === scopeId) as ScopeOrAddon
                    const scopeSnapshot = {
                      id: scopeOfTrade.id,
                      label: scopeOfTrade.name,
                    }
                    return scopeSnapshot
                  })
                  field.onChange(newScopesArray)
                }}
                values={field.value.map(scope => scope.id)}
              >
                <FormControl>
                  <MultiSelectTrigger className="w-full" disabled={scopesOfTrade.isLoading}>
                    <MultiSelectValue placeholder={scopesOfTrade.isLoading ? 'Loading...' : 'Select scopes'} />
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

      </div>
      <div className="w-full px-3 py-2 sticky top-0 z-10 bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)] lg:p-4">
        <div className="flex gap-3 lg:gap-4">
          <FormField
            name={`project.data.sow.${index}.title`}
            control={form.control}
            render={({ field }) => (
              <FormItem className="grow">
                <FormLabel>Section Title</FormLabel>
                <FormControl>
                  <Input placeholder="Title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {pricingMode === 'breakdown' && (
            <FormField
              name={`project.data.sow.${index}.price`}
              control={form.control}
              render={({ field }) => (
                <FormItem className="w-40">
                  <FormLabel>Section Price</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="$10,000"
                      type="text"
                      value={String(field.value || '')}
                      onChange={e => field.onChange(Number(e.target.value || ''))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
      </div>
      <div className="w-full px-3 pb-3 lg:px-4 lg:pb-4">
        <FormField
          name={`project.data.sow.${index}.contentJSON`}
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
                      Component: TemplatesModal,
                      props: {
                        trade: allTrades.data?.find(trade => trade.id === tradeId),
                        scopes: form.getValues(`project.data.sow.${index}.scopes`).map(scope => scopesOfTrade.data?.find(scopeOfTrade => scopeOfTrade.id === scope.id)).filter(Boolean) as ScopeOrAddon[],
                        onSelect: async (sowId) => {
                          closeModal()
                          setIsLoadingTemplate(true)
                          try {
                            const json = await queryClient.fetchQuery(trpc.notionRouter.scopes.getSOWContent.queryOptions({ sowId }))
                            tiptapRef.current?.insertContent(JSON.parse(json) || '')
                          }
                          finally {
                            setIsLoadingTemplate(false)
                          }
                        },
                      },
                    })
                    openModal()
                  }}
                >
                  Templates
                </Button>
              </div>
              <FormControl>
                <Tiptap
                  ref={tiptapRef}
                  isLoading={isLoadingTemplate}
                  loadingMessage="Loading template from Notion..."
                  onChange={({ html, json }) => {
                    field.onChange(JSON.stringify(json))
                    form.setValue(`project.data.sow.${index}.html`, html)
                  }}
                  initialValues={field.value ? JSON.parse(field.value) : undefined}
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
