import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { TiptapHandle } from '@/shared/components/tiptap/tiptap'
import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDownIcon } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { TemplatesModal } from '@/shared/components/dialogs/modals/templates-modal'
import { Tiptap } from '@/shared/components/tiptap/tiptap'
import { Button } from '@/shared/components/ui/button'
import { Collapsible, CollapsibleTrigger } from '@/shared/components/ui/collapsible'
import { FormControl, FormField, FormItem, FormMessage } from '@/shared/components/ui/form'
import { MultiSelect, MultiSelectContent, MultiSelectGroup, MultiSelectItem, MultiSelectTrigger, MultiSelectValue } from '@/shared/components/ui/multi-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { cn } from '@/shared/lib/utils'
import { useGetScopes } from '@/shared/services/notion/dal/scopes/hooks/queries/use-get-scopes'
import { useGetAllTrades } from '@/shared/services/notion/dal/trades/hooks/queries/use-get-trades'
import { useTRPC } from '@/trpc/helpers'
import { SOWFinancialsFields } from './sow-financials-fields'

const TRANSITION = { duration: 0.2, ease: [0.25, 0.1, 0.25, 1] } as const

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
  const [scopeOpen, setScopeOpen] = useState(true)
  const [financialsOpen, setFinancialsOpen] = useState(true)
  const tiptapRef = useRef<TiptapHandle | null>(null)

  const allTrades = useGetAllTrades()
  const scopesOfTrade = useGetScopes({ query: tradeId, filterProperty: 'relatedTrade' }, { enabled: !!tradeId })

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

  const { open: openModal, close: closeModal, setModal } = useModalStore()

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
        form.setValue(`project.data.sow.${index}.financials.costLines`, remaining)
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
    form.setValue(`project.data.sow.${index}.scopes`, newScopesArray)
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
    form.setValue(`project.data.sow.${index}.trade.id`, val)
    form.setValue(
      `project.data.sow.${index}.trade.label`,
      allTrades.data?.find(trade => trade.id === val)?.name || '',
    )
    getScopesOfTrade(val)
  }

  return (
    <>
      <ScopeRemovalDialog />
      <div className="flex flex-col gap-3 items-center w-full overflow-auto lg:gap-4">
        {/* Trade + Scope pickers */}
        <div className="flex flex-col gap-2 rounded-lg w-full px-3 pt-2 lg:flex-row lg:items-end lg:px-0 lg:pt-0">
          <FormField
            control={form.control}
            name={`project.data.sow.${index}.trade.id`}
            render={({ field }) => (
              <FormItem className="w-full lg:max-w-62.5">
                <FormControl className="w-full">
                  <Select
                    value={field.value}
                    onValueChange={handleTradeChange}
                  >
                    <SelectTrigger {...field} className="w-full bg-transparent dark:bg-transparent border-0">
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
                  onValuesChange={handleScopesChange}
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

        {/* Scope of Work collapsible */}
        <div className="w-full">
          <Collapsible open={scopeOpen} onOpenChange={setScopeOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 lg:px-4"
              >
                <span>Scope of Work</span>
                <ChevronDownIcon className={cn('size-4 transition-transform', !scopeOpen && '-rotate-90')} />
              </button>
            </CollapsibleTrigger>
            <AnimatePresence initial={false}>
              {scopeOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={TRANSITION}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 lg:px-4 lg:pb-4">
                    <FormField
                      name={`project.data.sow.${index}.contentJSON`}
                      control={form.control}
                      render={({ field }) => (
                        <FormItem>
                          <div className="flex gap-2 items-center">
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
                </motion.div>
              )}
            </AnimatePresence>
          </Collapsible>
        </div>

        {/* Financials collapsible */}
        <div className="w-full border-t border-border/30">
          <Collapsible open={financialsOpen} onOpenChange={setFinancialsOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium hover:bg-muted/50 lg:px-4"
              >
                <span>Financials</span>
                <ChevronDownIcon className={cn('size-4 transition-transform', !financialsOpen && '-rotate-90')} />
              </button>
            </CollapsibleTrigger>
            <AnimatePresence initial={false}>
              {financialsOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={TRANSITION}
                  className="overflow-hidden"
                >
                  <SOWFinancialsFields index={index} pricingMode={pricingMode} />
                </motion.div>
              )}
            </AnimatePresence>
          </Collapsible>
        </div>
      </div>
    </>
  )
}
