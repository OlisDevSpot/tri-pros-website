import type { SowSectionTab } from '@/features/proposal-flow/constants/sow-section-tabs'
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { TiptapHandle } from '@/shared/components/tiptap/tiptap'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import type { Scope } from '@/shared/modules/construction/core/schemas'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'
import { useSowCatalog } from '@/features/proposal-flow/hooks/use-sow-catalog'
import { TemplatesModal } from '@/shared/components/dialogs/modals/templates-modal'
import { Tiptap } from '@/shared/components/tiptap/tiptap'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormMessage } from '@/shared/components/ui/form'
import { openModal } from '@/shared/lib/open-modal'
import { useTRPC } from '@/trpc/helpers'
import { SOWFinancialsFields } from './sow-financials-fields'
import { SowSectionTabs } from './sow-section-tabs'

interface Props {
  index: number
  priceDisplayMode: PriceDisplayMode
  tab: SowSectionTab
  onTabChange: (tab: SowSectionTab) => void
}

export function SOWSection({
  index,
  priceDisplayMode,
  tab,
  onTabChange,
}: Props) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const form = useFormContext<ProposalFormSchema>()
  const { tradeId, allTrades, scopesOfTrade } = useSowCatalog(index)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)
  const tiptapRef = useRef<TiptapHandle | null>(null)

  return (
    <div className="flex w-full flex-col gap-3 p-3 lg:gap-4 lg:p-4">
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
  )
}
