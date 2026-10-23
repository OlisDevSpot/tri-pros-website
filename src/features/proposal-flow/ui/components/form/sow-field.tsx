import type { SowSectionTab } from '@/features/proposal-flow/constants/sow-section-tabs'
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { TiptapHandle } from '@/shared/components/tiptap/tiptap'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import type { Scope } from '@/shared/modules/construction/core/schemas'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { scopesTriggerLabel } from '@/features/proposal-flow/lib/scopes-trigger-label'
import { TemplatesModal } from '@/shared/components/dialogs/modals/templates-modal'
import { Tiptap } from '@/shared/components/tiptap/tiptap'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormMessage } from '@/shared/components/ui/form'
import { MultiSelect, MultiSelectContent, MultiSelectGroup, MultiSelectItem, MultiSelectTrigger, MultiSelectValue } from '@/shared/components/ui/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { openModal } from '@/shared/lib/open-modal'
import { useTRPC } from '@/trpc/helpers'
import { SOWFinancialsFields } from './sow-financials-fields'
import { SowSectionTabs } from './sow-section-tabs'

interface Props {
  index: number
  priceDisplayMode: PriceDisplayMode
  sowSnapshot: ProposalFormSchema['project']['data']['sow'][0]
  tab: SowSectionTab
  onTabChange: (tab: SowSectionTab) => void
}

export function SOWSection({
  index,
  priceDisplayMode,
  sowSnapshot,
  tab,
  onTabChange,
}: Props) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const form = useFormContext<ProposalFormSchema>()
  const [tradeId, setTradeId] = useState<string | undefined>(sowSnapshot.trade.id || undefined)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  const tiptapRef = useRef<TiptapHandle | null>(null)

  const allTrades = useQuery(trpc.constructionRouter.trades.getAll.queryOptions())
  const scopesOfTrade = useQuery(trpc.constructionRouter.scopes.byTrade.queryOptions(
    { tradeId: tradeId ?? '' },
    { enabled: !!tradeId },
  ))

  const [ScopeRemovalDialog, confirmScopeRemoval] = useConfirm({
    title: 'Remove cost lines?',
    message: 'Removing this scope will also remove cost lines tied to it. Continue?',
  })

  function getScopesOfTrade(id: string) {
    if (!id) {
      return
    }
    setTradeId(id)
  }

  async function handleScopesChange(values: string[]): Promise<boolean> {
    const oldScopes = form.getValues(`project.data.sow.${index}.scopes`)
    const oldIds = new Set(oldScopes.map(s => s.id))
    const newIds = new Set(values)

    const removedIds: string[] = []
    for (const id of oldIds) {
      if (!newIds.has(id)) {
        removedIds.push(id)
      }
    }

    if (removedIds.length > 0) {
      const costLines = form.getValues(`project.data.sow.${index}.financials.costLines`)
      const orphans = costLines.filter(line => removedIds.includes(line.relatedScopeId))
      if (orphans.length > 0) {
        const confirmed = await confirmScopeRemoval()
        if (!confirmed) {
          return false
        }
        const remaining = costLines.filter(line => !removedIds.includes(line.relatedScopeId))
        form.setValue(`project.data.sow.${index}.financials.costLines`, remaining, { shouldDirty: true })
      }
    }

    const newScopesArray = values
      .map((scopeId) => {
        const scopeOfTrade = scopesOfTrade.data?.find(scope => scope.id === scopeId)
        if (!scopeOfTrade) {
          return null
        }
        return { id: scopeOfTrade.id, label: scopeOfTrade.name }
      })
      .filter((scope): scope is { id: string, label: string } => scope !== null)
    form.setValue(`project.data.sow.${index}.scopes`, newScopesArray, { shouldDirty: true })
    return true
  }

  async function handleTradeChange(val: string) {
    if (!val) {
      return
    }
    const proceeded = await handleScopesChange([])
    if (!proceeded) {
      return
    }
    form.setValue(`project.data.sow.${index}.trade.id`, val, { shouldDirty: true })
    form.setValue(
      `project.data.sow.${index}.trade.label`,
      allTrades.data?.find(trade => trade.id === val)?.name || '',
      { shouldDirty: true },
    )
    getScopesOfTrade(val)
  }

  return (
    <>
      <ScopeRemovalDialog />
      <div className="flex w-full flex-col gap-3 p-3 lg:gap-4 lg:p-4">
        <div className="grid gap-2 md:grid-cols-[minmax(0,200px)_minmax(0,1fr)]">
          <FormField
            control={form.control}
            name={`project.data.sow.${index}.trade.id`}
            render={({ field }) => (
              <FormItem className="min-w-0">
                <FormControl className="w-full">
                  <Select
                    value={field.value}
                    onValueChange={handleTradeChange}
                    disabled={field.disabled}
                  >
                    <SelectTrigger {...field} className="w-full">
                      <SelectValue placeholder="Select trade" />
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
              <FormItem className="min-w-0">
                <MultiSelect
                  onValuesChange={handleScopesChange}
                  values={field.value.map(scope => scope.id)}
                >
                  <FormControl>
                    <MultiSelectTrigger
                      className="w-full"
                      aria-label={scopesTriggerLabel(field.value.map(scope => scope.label))}
                      disabled={field.disabled || scopesOfTrade.isLoading}
                    >
                      <MultiSelectValue overflowBehavior="cutoff" placeholder={scopesOfTrade.isLoading ? 'Loading...' : 'Select scopes'} />
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

        <SowSectionTabs
          index={index}
          tab={tab}
          onTabChange={onTabChange}
          priceDisplayMode={priceDisplayMode}
          description={(
            <FormField
              name={`project.data.sow.${index}.contentJSON`}
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-end">
                    <Button
                      variant="outline"
                      type="button"
                      className="text-xs text-muted-foreground hover:underline"
                      size="sm"
                      disabled={field.disabled}
                      onClick={() => {
                        openModal({
                          accessor: 'Templates',
                          Component: TemplatesModal,
                          props: {
                            trade: allTrades.data?.find(trade => trade.id === tradeId),
                            scopes: form.getValues(`project.data.sow.${index}.scopes`).map(scope => scopesOfTrade.data?.find(scopeOfTrade => scopeOfTrade.id === scope.id)).filter(Boolean) as Scope[],
                            onSelect: async (sowId) => {
                              setIsLoadingTemplate(true)
                              try {
                                const json = await queryClient.fetchQuery(trpc.constructionRouter.sow.content.queryOptions({ sowId }))
                                tiptapRef.current?.insertContent(JSON.parse(json) || '')
                              }
                              finally {
                                setIsLoadingTemplate(false)
                              }
                            },
                          },
                        })
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
          )}
          pricing={<SOWFinancialsFields index={index} pricingMode={priceDisplayMode} />}
        />
      </div>
    </>
  )
}
