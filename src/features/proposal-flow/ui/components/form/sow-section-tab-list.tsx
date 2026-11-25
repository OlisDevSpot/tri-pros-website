import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { PriceDisplayMode } from '@/shared/constants/enums'
import { useId } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'
import { SOW_SECTION_TABS } from '@/features/proposal-flow/constants/sow-section-tabs'
import { formatLedgerAmount } from '@/features/proposal-flow/lib/format-ledger-amount'
import { sectionPriceDisplay } from '@/features/proposal-flow/lib/section-price'
import { TabsList, TabsTrigger } from '@/shared/components/ui/tabs'

interface Props {
  index: number
  priceDisplayMode: PriceDisplayMode
  className?: string
  // The phone copy of the list scrolls with the body; desktop's rides in the sticky block. Only one shows at a
  // time, and the copy takes its own trigger ids so no id appears twice.
  copy?: boolean
}

export function SowSectionTabList({ index, priceDisplayMode, className, copy = false }: Props) {
  const form = useFormContext<ProposalFormSchema>()
  const financials = useWatch({ control: form.control, name: `project.data.sow.${index}.financials` })
  const { final } = sectionPriceDisplay(financials, priceDisplayMode)
  const copyId = useId()

  return (
    <TabsList className={className}>
      {SOW_SECTION_TABS.map(t => (
        // Spread, not id={undefined}: Radix spreads props after its own id, so an undefined one would erase it.
        <TabsTrigger key={t.id} value={t.id} className="px-3" {...(copy && { id: `${copyId}-${t.id}` })}>
          {t.label}
          {t.id === 'pricing' && final !== null && (
            <span className="tabular-nums">{formatLedgerAmount(final)}</span>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  )
}
