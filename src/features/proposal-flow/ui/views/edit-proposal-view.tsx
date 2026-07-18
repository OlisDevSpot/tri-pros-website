'use client'

import type { OverrideProposalValues } from '../../types'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useReplaceIncentives } from '@/features/proposal-flow/dal/client/mutations/use-replace-incentives'
import { useUpdateProposal } from '@/features/proposal-flow/dal/client/mutations/use-update-proposal'
import { useGetProposal } from '@/features/proposal-flow/dal/client/queries/use-get-proposal'
import { baseDefaultValues, proposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { ProposalForm } from '@/features/proposal-flow/ui/components/form'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert'
import { Button } from '@/shared/components/ui/button'
import { Form } from '@/shared/components/ui/form'
import { ROOTS } from '@/shared/config/roots'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/financials'
import { getProposalLockState } from '@/shared/entities/proposals/lib/proposal-lock'
import { useConfirm } from '@/shared/hooks/use-confirm'
import { useTRPC } from '@/trpc/helpers'
import { CustomerInfoHeader } from '../components/customer-info-header'

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

  // see src/shared/entities/proposals/DOCS.md#proposal-lock-ladder
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
        meta: proposal.data.formMetaJSON,
        project: proposal.data.projectJSON,
        funding: proposal.data.fundingJSON,
      }

      return initialValues
    }
  }, [proposal.data])

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

  const customer = proposal.data.customer

  function buildMutationData(rawData: ProposalFormSchema) {
    // finalTcp is derived via `computeFinalTcp`, not persisted. We still
    // clamp cashInDeal to the current final TCP so a downward revision of
    // startingTcp / discounts cannot leave a cash-in-deal that exceeds
    // what the homeowner actually owes.
    const nextFinalTcp = computeFinalTcp({ funding: rawData.funding.data, sow: rawData.project.data.sow })

    return {
      id: proposalId,
      data: {
        label: rawData.project.data.label,
        formMetaJSON: rawData.meta,
        projectJSON: rawData.project,
        fundingJSON: {
          ...rawData.funding,
          data: {
            ...rawData.funding.data,
            // Rows are the source of truth (Wave 2); the blob array is dead.
            // getFullView re-hydrates it from proposal_incentives on read.
            incentives: [],
            cashInDeal: rawData.funding.data.cashInDeal > nextFinalTcp ? nextFinalTcp : rawData.funding.data.cashInDeal,
          },
        },
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
          { proposalId, incentives: rawData.funding.data.incentives },
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
          { proposalId, incentives: rawData.funding.data.incentives },
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

  return (
    <motion.div
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4"
    >
      {customer && (
        <div className="shrink-0">
          <CustomerInfoHeader customer={customer} />
        </div>
      )}
      {lockState === 'draft-locked' && (
        <Alert className="shrink-0">
          <AlertTitle>A contract draft exists for this proposal</AlertTitle>
          <AlertDescription className="flex flex-col gap-2">
            <span>
              The proposal is locked while its signing draft exists — editing it would make the
              draft&apos;s documents stale. Discard the draft to edit; you can prepare a new one afterward.
            </span>
            <Button
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
      <div className="h-full w-full overflow-auto md:pr-4">
        <Form {...form}>
          <ProposalForm
            isLoading={proposal.isLoading || updateProposal.isPending}
            initialValues={initProposalValues}
            onSubmit={onSubmit}
            onSave={onSave}
            viewHref={viewHref}
          />
        </Form>
      </div>
      <DiscardConfirmDialog />
    </motion.div>
  )
}
