'use client'

import type { PriceDisplayMode } from '@/shared/constants/enums'
import type { FundingData } from '@/shared/entities/proposals/schemas'
import type { SOW } from '@/shared/entities/proposals/types'
import { Modal } from '@/shared/components/dialogs/modals/base-modal'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { PricingBreakdown } from './pricing-breakdown'
import { InternalCalculationBlock } from './pricing-breakdown/internal-calculation-block'

interface Props {
  funding: FundingData
  sow: SOW[]
  priceDisplayMode: PriceDisplayMode
}

/**
 * Agent-only financial X-ray: the customer pricing breakdown plus the
 * Internal Calculation (margin/multiplier). Opened via the global modal
 * store — never rendered inline, never reachable by the homeowner.
 */
export function InternalFinancialsModal({ funding, sow, priceDisplayMode }: Props) {
  const { isOpen, close } = useModalStore()

  return (
    <Modal
      isOpen={isOpen}
      close={close}
      title="Internal Financials"
      description="Visible only to agents"
      className="sm:max-w-2xl"
    >
      <div className="w-full min-h-0 flex-1 overflow-y-auto space-y-1">
        <PricingBreakdown funding={funding} sow={sow} priceDisplayMode={priceDisplayMode} />
        <InternalCalculationBlock funding={funding} sow={sow} priceDisplayMode={priceDisplayMode} />
      </div>
    </Modal>
  )
}
