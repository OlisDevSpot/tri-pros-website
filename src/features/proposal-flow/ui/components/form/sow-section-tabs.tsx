import type { ReactNode } from 'react'
import type { SowSectionTab } from '@/features/proposal-flow/constants/sow-section-tabs'
import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import { useFormContext, useWatch } from 'react-hook-form'
import { SOW_SECTION_TABS } from '@/features/proposal-flow/constants/sow-section-tabs'
import { formatLedgerAmount } from '@/features/proposal-flow/lib/format-ledger-amount'
import { sectionPriceDisplay } from '@/features/proposal-flow/lib/section-price'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

interface Props {
  index: number
  tab: SowSectionTab
  onTabChange: (tab: SowSectionTab) => void
  priceDisplayMode: PriceDisplayMode
  description: ReactNode
  pricing: ReactNode
}

export function SowSectionTabs({ index, tab, onTabChange, priceDisplayMode, description, pricing }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const financials = useWatch({ control: form.control, name: `project.data.sow.${index}.financials` })
  const { final } = sectionPriceDisplay(financials, priceDisplayMode)

  return (
    <Tabs
      value={tab}
      onValueChange={(value) => {
        const next = SOW_SECTION_TABS.find(t => t.id === value)
        if (next) {
          onTabChange(next.id)
        }
      }}
      className="gap-3"
    >
      <TabsList className="max-md:w-full">
        {SOW_SECTION_TABS.map(t => (
          <TabsTrigger key={t.id} value={t.id} className="px-3">
            {t.label}
            {t.id === 'pricing' && final !== null && (
              <span className="tabular-nums">{formatLedgerAmount(final)}</span>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      {/* Mounted while hidden: the editor keeps its undo history and caret across tab switches. */}
      <TabsContent value="description" forceMount hidden={tab !== 'description'}>
        {description}
      </TabsContent>
      <TabsContent value="pricing">
        {pricing}
      </TabsContent>
    </Tabs>
  )
}
