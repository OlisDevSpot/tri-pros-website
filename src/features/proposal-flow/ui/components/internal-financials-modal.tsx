'use client'

import type { InsertProposalSchema } from '@/shared/db/schema'
import { Modal } from '@/shared/components/dialogs/modals/base-modal'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { PricingBreakdown } from './pricing-breakdown'
import { InternalCalculationBlock } from './pricing-breakdown/internal-calculation-block'

interface Props {
  proposalData: InsertProposalSchema
}

/**
 * Agent-only financial X-ray: the customer pricing breakdown plus the
 * Internal Calculation (margin/multiplier). Opened via the global modal
 * store — never rendered inline, never reachable by the homeowner.
 */
export function InternalFinancialsModal({ proposalData }: Props) {
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
        <PricingBreakdown proposalData={proposalData} />
        <InternalCalculationBlock proposalData={proposalData} />
      </div>
    </Modal>
  )
}
