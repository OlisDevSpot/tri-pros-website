'use client'

import type { PaymentMode } from '@/features/proposal-flow/lib/get-cash-down-bounds'

import { LockIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { FUNDING_LOCKED_NOTE, PROPOSAL_FROZEN_REASON } from '@/features/proposal-flow/constants/funding-lock'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useSetCashInDeal } from '@/features/proposal-flow/dal/client/mutations/use-set-cash-in-deal'
import { useUpdateProposal } from '@/features/proposal-flow/dal/client/mutations/use-update-proposal'
import { useGetFinanceOptions } from '@/features/proposal-flow/dal/client/queries/use-get-finance-options'
import { useDebouncedSave } from '@/features/proposal-flow/hooks/use-debounced-save'
import { clampCashDown, clampStoredCashDown, getCashDownBounds, getStoredPaymentMode, isPaymentModeAvailable } from '@/features/proposal-flow/lib/get-cash-down-bounds'
import { PricingBreakdown } from '@/features/proposal-flow/ui/components/pricing-breakdown'
import { CashDownSlider } from '@/features/proposal-flow/ui/components/proposal/cash-down-slider'
import { FinanceOptionGroup } from '@/features/proposal-flow/ui/components/proposal/finance-option-group'
import { PaymentPlanGroup } from '@/features/proposal-flow/ui/components/proposal/payment-plan-group'
import { formatAsDollars } from '@/shared/lib/formatters'
import { computeFinalTcp } from '@/shared/modules/proposals/core/lib/financials'
import { toFundingInputs } from '@/shared/modules/proposals/core/lib/funding-columns'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'

export function Funding() {
  const { proposal, token } = useProposalDocument()
  const funding = useMemo(() => toFundingInputs(proposal), [proposal])
  const sow = proposal.projectJSON.data.sow
  const finalTcp = computeFinalTcp({ funding, sow })
  const { max } = getCashDownBounds(finalTcp)
  const storedCash = funding.cashInDeal ?? 0
  const storedMode = getStoredPaymentMode(storedCash, finalTcp)

  // A share-link read carries no envelope id, so for a homeowner a draft envelope shows up only as the server refusing the write.
  const [refused, setRefused] = useState(false)
  const locked = refused || isProposalFrozen(proposal)

  const [pickedMode, setPickedMode] = useState<PaymentMode | null>(null)
  const [pickedCash, setPickedCash] = useState<number | null>(null)
  const [pickedOptionId, setPickedOptionId] = useState<number | null>(null)

  const mode = !locked && pickedMode && isPaymentModeAvailable(pickedMode, finalTcp) ? pickedMode : storedMode
  // Clamped on every render, not synced in an effect: a price change that would leave under $3,500 financed
  // shows the clamped value at once, and the debounced save below stores it.
  const cash = locked
    ? storedCash
    : pickedCash !== null ? clampCashDown(pickedCash, finalTcp) : clampStoredCashDown(storedCash, finalTcp)
  // Only a slider move or a stored "Some cash" amount that breaks the floor is written. An all-cash deal
  // stores the whole price and an all-finance one $0, and opening the page must leave both as they are.
  const cashToSave = !locked && (pickedCash !== null || storedMode === 'some-cash') ? cash : storedCash
  const selectedOptionId = locked ? proposal.financeOptionId : pickedOptionId ?? proposal.financeOptionId

  const financeOptions = useGetFinanceOptions()
  const saveCash = useSetCashInDeal()
  const updateProposal = useUpdateProposal()

  function onWriteError(error: { message: string }, fallback: string, isNewFailure: boolean) {
    if (error.message === PROPOSAL_FROZEN_REASON) {
      setRefused(true)
      return
    }
    if (isNewFailure) {
      toast.error(fallback)
    }
  }

  // The slider is the only cash write: switching to All cash or All finance never sends $0.
  useDebouncedSave(cashToSave, storedCash, (value, failed) => {
    saveCash.mutate({ token, id: proposal.id, cashInDeal: value }, {
      onError: (error) => {
        onWriteError(error, 'Couldn’t save your cash down. Your choice is kept on this screen.', failed())
      },
    })
  })

  useDebouncedSave(selectedOptionId, proposal.financeOptionId, (optionId, failed) => {
    if (optionId === null) {
      return
    }
    updateProposal.mutate({ token, id: proposal.id, data: { financeOptionId: optionId } }, {
      onError: (error) => {
        const isNewFailure = failed()
        setPickedOptionId(null)
        onWriteError(error, 'Couldn’t save your finance option.', isNewFailure)
      },
    })
  })

  const cashDown = mode === 'some-cash' ? cash : 0
  const amountFinanced = finalTcp - cashDown

  return (
    <div className="px-4 py-12 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Funding</p>
          <h2 id="funding-title" className="text-3xl font-semibold text-balance">Your investment</h2>
          <p className="text-muted-foreground">
            {proposal.priceDisplayMode === 'breakdown' ? 'Every part priced, every saving shown.' : 'Your price, with every saving shown.'}
            {' Choose how you’d like to pay.'}
          </p>
        </header>
        <div className="grid gap-6 @min-[1100px]/proposal:grid-cols-2">
          <div className="grid content-start gap-3">
            <PricingBreakdown funding={funding} sow={sow} priceDisplayMode={proposal.priceDisplayMode} />
          </div>
          <div className="grid content-start gap-4 rounded-lg border border-border bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">How you’d like to pay</p>
            {locked && (
              <p className="flex items-center gap-2 text-sm font-semibold">
                <LockIcon className="size-4 shrink-0" />
                {FUNDING_LOCKED_NOTE}
              </p>
            )}
            <PaymentPlanGroup value={mode} finalTcp={finalTcp} disabled={locked} onChange={setPickedMode} />
            {mode === 'all-cash' && (
              <p className="text-sm">{`${formatAsDollars(finalTcp)} in total: ${formatAsDollars(funding.depositAmount)} at signing, the balance on completion.`}</p>
            )}
            {mode === 'scheduled' && (
              <p className="text-sm text-muted-foreground">Your consultant will set up a payment schedule with you.</p>
            )}
            {mode === 'some-cash' && <CashDownSlider value={cash} max={max} disabled={locked} onChange={setPickedCash} />}
            {(mode === 'some-cash' || mode === 'all-finance') && (
              <>
                <p className="text-sm">{`${formatAsDollars(amountFinanced)} to finance${cashDown > 0 ? ` after ${formatAsDollars(cashDown)} down` : ''}.`}</p>
                {financeOptions.data && financeOptions.data.length > 0 && (
                  <FinanceOptionGroup
                    options={financeOptions.data}
                    selectedId={selectedOptionId}
                    amountFinanced={amountFinanced}
                    disabled={locked}
                    onSelect={setPickedOptionId}
                  />
                )}
                <p className="text-xs text-muted-foreground">Estimates, subject to lender approval. Financing starts at $3,500.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
