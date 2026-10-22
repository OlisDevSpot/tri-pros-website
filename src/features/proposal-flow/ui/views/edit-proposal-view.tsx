'use client'

import type { OverrideProposalValues } from '../../types'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useReplaceIncentives } from '@/features/proposal-flow/dal/client/mutations/use-replace-incentives'
import { useUpdateProposal } from '@/features/proposal-flow/dal/client/mutations/use-update-proposal'
import { useGetProposal } from '@/features/proposal-flow/dal/client/queries/use-get-proposal'
import { baseDefaultValues, proposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { EditProposalShell } from '@/features/proposal-flow/ui/components/edit-page/edit-proposal-shell'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Form } from '@/shared/components/ui/form'
import { ROOTS } from '@/shared/config/roots'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { computeFinalTcp, deriveEditCashDown, resolveDeposit } from '@/shared/modules/proposals/core/lib/financials'
import { fundingDomainToColumns, toFundingInputs } from '@/shared/modules/proposals/core/lib/funding-columns'
import { getProposalLockState } from '@/shared/modules/proposals/core/lib/proposal-lock'
import { useTRPC } from '@/trpc/helpers'

interface EditProposalViewProps {
  proposalId: string
}

export function EditProposalView({ proposalId }: EditProposalViewProps) {
  const router = useRouter()
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()

  const proposal = useGetProposal(proposalId)
  const updateProposal = useUpdateProposal()
  const replaceIncentives = useReplaceIncentives()

  const lockState = proposal.data != null ? getProposalLockState(proposal.data) : 'unlocked'
  const proposalLocked = lockState !== 'unlocked'

  const discardDraft = useMutation(
    trpc.proposalsRouter.contracts.discardDraftContract.mutationOptions({
      onSuccess: () => {
        invalidateProposal({ proposalId })
        toast.success('Draft discarded — proposal unlocked for editing')
      },
      onError: err => toast.error(err.message || 'Failed to discard draft'),
    }),
  )

  const [DiscardConfirmDialog, confirmDiscard] = useConfirm({
    title: 'Discard the contract draft?',
    message: 'Editing this proposal will discard the prepared signing draft. You can create a new draft from the review page after your changes.',
  })

  const form = useForm<ProposalFormSchema>({
    resolver: zodResolver(proposalFormSchema),
    mode: 'onSubmit',
    disabled: proposal.isLoading || updateProposal.isPending || proposalLocked,
    defaultValues: baseDefaultValues,
  })

  async function onUnlockDraft() {
    if (await confirmDiscard()) {
      discardDraft.mutate({ proposalId })
    }
  }

  const initProposalValues = useMemo(() => {
    if (proposal.data) {
      const initialValues: OverrideProposalValues = {
        priceDisplayMode: proposal.data.priceDisplayMode,
        project: proposal.data.projectJSON,
        funding: toFundingInputs(proposal.data),
      }

      return initialValues
    }
  }, [proposal.data])

  const customerId = proposal.data?.customer?.id
  const customerName = proposal.data?.customer?.name
  const customer = useMemo(
    () => (customerId && customerName != null ? { id: customerId, name: customerName } : null),
    [customerId, customerName],
  )

  if (proposal.isLoading) {
    return (
      <LoadingState
        title="Loading Proposal"
        description="This might take a few seconds"
        className="bg-card"
      />
    )
  }

  if (!proposal.data) {
    return (
      <ErrorState
        title="Error: Could not load proposal"
        description="Please try again"
        className="bg-card"
      />
    )
  }

  const storedFunding = toFundingInputs(proposal.data)
  const storedFinalTcp = computeFinalTcp({ funding: storedFunding, sow: proposal.data.projectJSON.data.sow })

  function buildMutationData(rawData: ProposalFormSchema) {
    const nextFinalTcp = computeFinalTcp({ funding: rawData.funding, sow: rawData.project.data.sow })
    const nextDeposit = resolveDeposit(rawData.funding.depositAmount, nextFinalTcp)
    const nextCash = deriveEditCashDown({ storedCash: storedFunding.cashInDeal, storedFinalTcp, nextFinalTcp, nextDeposit })
    const { cashInDealCents, ...columns } = fundingDomainToColumns({ ...rawData.funding, cashInDeal: nextCash })
    const cashChanged = cashInDealCents !== Math.round(storedFunding.cashInDeal * 100)

    return {
      id: proposalId,
      data: {
        label: rawData.project.data.label,
        priceDisplayMode: rawData.priceDisplayMode,
        projectJSON: rawData.project,
        // Incentives are rows — they flow through proposalService.incentives.replace,
        // never the update payload. envelopeDocumentIds deliberately absent —
        // applyEnvelopeContext is the only writer (spec §2).
        ...columns,
        ...(cashChanged ? { cashInDealCents } : {}),
      },
    }
  }

  function onSubmit(rawData: ProposalFormSchema) {
    if (proposalLocked) {
      toast.error('This proposal is locked — see the notice above the form.')
      return
    }
    updateProposal.mutate(buildMutationData(rawData), {
      onSuccess: () => {
        replaceIncentives.mutate(
          { proposalId, incentives: rawData.funding.incentives },
          {
            onSuccess: () => {
              toast.success('Proposal updated')
              router.push(ROOTS.public.proposalReview(proposalId))
            },
            onError: error => toast.error(error.message),
          },
        )
      },
      onError: error => toast.error(error.message),
    })
  }

  function onSave(rawData: ProposalFormSchema) {
    if (proposalLocked) {
      toast.error('This proposal is locked — see the notice above the form.')
      return
    }
    updateProposal.mutate(buildMutationData(rawData), {
      onSuccess: () => {
        replaceIncentives.mutate(
          { proposalId, incentives: rawData.funding.incentives },
          {
            onSuccess: () => toast.success('Proposal saved'),
            onError: error => toast.error(error.message),
          },
        )
      },
      onError: error => toast.error(error.message),
    })
  }

  const viewHref = ROOTS.public.proposalReview(proposalId)

  const lockNotice = (
    <>
      {lockState === 'draft-locked' && (
        <Alert className="shrink-0">
          <AlertTitle>A contract draft exists for this proposal</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              The proposal is locked while its signing draft exists — editing it would make the
              draft&apos;s documents stale. Discard the draft to edit; you can prepare a new one afterward.
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={onUnlockDraft}
              disabled={discardDraft.isPending}
            >
              {discardDraft.isPending ? 'Discarding…' : 'Discard draft & edit'}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {lockState === 'inflight-locked' && (
        <Alert variant="destructive" className="shrink-0">
          <AlertTitle>Contract out for signature</AlertTitle>
          <AlertDescription>
            This proposal&apos;s contract has been sent for signing, so the proposal is locked.
            Recall the envelope from the proposal review page to make changes.
          </AlertDescription>
        </Alert>
      )}
      {lockState === 'terminal-locked' && (
        <Alert className="shrink-0">
          <AlertTitle>This proposal is final</AlertTitle>
          <AlertDescription>
            The proposal has been approved, signed, or its contract was declined — it can no
            longer be edited. Duplicate it to propose changes on a new proposal.
          </AlertDescription>
        </Alert>
      )}
    </>
  )

  return (
    <>
      <Form {...form}>
        <EditProposalShell
          proposalId={proposalId}
          status={proposal.data.status}
          customer={customer}
          meetingId={proposal.data.meetingId}
          meetingScheduledFor={proposal.data.meetingScheduledFor}
          initialValues={initProposalValues}
          isLoading={proposal.isLoading || updateProposal.isPending}
          locked={proposalLocked}
          viewHref={viewHref}
          lockNotice={lockNotice}
          onSubmit={onSubmit}
          onSave={onSave}
        />
      </Form>
      <DiscardConfirmDialog />
    </>
  )
}
