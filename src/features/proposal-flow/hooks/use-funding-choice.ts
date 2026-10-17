'use client'

import type { FinanceOption } from '@/shared/db/schema'
import type { PaymentScheduleRow } from '@/shared/modules/proposals/core/lib/financials'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useSetCashInDeal } from '@/features/proposal-flow/dal/client/mutations/use-set-cash-in-deal'
import { useUpdateProposal } from '@/features/proposal-flow/dal/client/mutations/use-update-proposal'
import { useGetFinanceOptions } from '@/features/proposal-flow/dal/client/queries/use-get-finance-options'
import { useDebouncedSave } from '@/features/proposal-flow/hooks/use-debounced-save'
import { deriveStoredFundingChoice } from '@/features/proposal-flow/lib/derive-stored-funding-choice'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { getLoanValues } from '@/shared/lib/loan-calculations'
import { PROPOSAL_REFUSALS } from '@/shared/modules/proposals/core/constants/proposal-refusals'
import { clampFinancedCashDown, getCashDownStops, roundToCents } from '@/shared/modules/proposals/core/lib/financials'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'

export interface FundingChoice {
  finalTcp: number
  deposit: number
  stops: number[]
  canFinance: boolean
  allCash: boolean
  cash: number
  financed: number
  setCash: (value: number) => void
  setAllCash: (on: boolean) => void
  options: FinanceOption[]
  optionsLoading: boolean
  selectedOptionId: number | null
  selectOption: (id: number) => void
  monthlyFor: (option: FinanceOption) => number
  lowest: FinanceOption | null
  locked: boolean
  schedule: PaymentScheduleRow[]
}

export function useFundingChoice(): FundingChoice {
  const { proposal, token } = useProposalDocument()
  const stored = useMemo(() => deriveStoredFundingChoice(proposal), [proposal])
  const { finalTcp, deposit, canFinance: financeable, storedCash } = stored
  const stops = useMemo(() => getCashDownStops(finalTcp, deposit), [finalTcp, deposit])

  // A share-link read carries no envelope id, so for a homeowner a draft envelope shows up only as the server refusing the write.
  const [refused, setRefused] = useState(false)
  const locked = refused || isProposalFrozen(proposal)

  const [picked, setPicked] = useState<{ cash: number, allCash: boolean } | null>(null)
  const choosing = !locked && picked !== null
  const allCash = choosing ? !financeable || picked.allCash : stored.allCash
  // Clamped on render, never in an effect: a price change shows the clamped value at once, and the save below stores
  // it. The value sent is always inside the bounds the server checks, and cent-rounded as the server compares it.
  const cash = choosing ? roundToCents(allCash ? finalTcp : clampFinancedCashDown(picked.cash, finalTcp, deposit)) : stored.cash

  const [pickedOptionId, setPickedOptionId] = useState<number | null>(null)
  const selectedOptionId = locked ? stored.selectedOptionId : pickedOptionId ?? stored.selectedOptionId
  const financeOptions = useGetFinanceOptions()
  const saveCash = useSetCashInDeal()
  const updateProposal = useUpdateProposal()
  const { invalidateProposal } = useInvalidation()

  function onWriteError(error: { message: string }, fallback: string, isNewFailure: boolean) {
    if (error.message === PROPOSAL_REFUSALS.frozen) {
      setRefused(true)
      return
    }
    if (isNewFailure) {
      toast.error(fallback)
    }
  }

  useDebouncedSave(locked ? storedCash : cash, storedCash, (value, failed) => {
    saveCash.mutate({ token, id: proposal.id, cashInDeal: value }, {
      onError: (error) => {
        onWriteError(error, 'Couldn’t save your cash down. Your choice is kept on this screen.', failed())
        // The bounds refused are the server's price, so this client's is stale: refetch and clamp against it, never resend.
        if (error.message === PROPOSAL_REFUSALS.invalidCashDown) {
          invalidateProposal({ proposalId: proposal.id })
        }
      },
    })
  })

  useDebouncedSave(selectedOptionId, stored.selectedOptionId, (optionId, failed) => {
    if (optionId === null) {
      return
    }
    updateProposal.mutate({ token, id: proposal.id, data: { financeOptionId: optionId } }, {
      onError: (error) => {
        const isNewFailure = failed()
        setPickedOptionId(null)
        onWriteError(error, 'Couldn’t save your loan term.', isNewFailure)
      },
    })
  })

  const financed = roundToCents(Math.max(0, finalTcp - cash))
  const options = financeOptions.data ?? []
  const monthlyFor = (option: FinanceOption) => getLoanValues(financed, option.interestRate, option.termInMonths).monthly
  const lowest = options.reduce<FinanceOption | null>((best, option) => (best === null || monthlyFor(option) < monthlyFor(best) ? option : best), null)

  return {
    finalTcp,
    deposit,
    stops,
    canFinance: financeable,
    allCash,
    cash,
    financed,
    locked,
    setCash: (value: number) => setPicked({ cash: value, allCash: false }),
    setAllCash: (on: boolean) => setPicked({ cash: on ? finalTcp : deposit, allCash: on }),
    options,
    optionsLoading: financeOptions.isPending,
    selectedOptionId,
    selectOption: setPickedOptionId,
    monthlyFor,
    lowest,
    schedule: stored.schedule,
  }
}
