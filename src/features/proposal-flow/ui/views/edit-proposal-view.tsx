'use client'

import type { OverrideProposalValues } from '../../types'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useUpdateProposal } from '@/features/proposal-flow/dal/client/mutations/use-update-proposal'
import { useGetProposal } from '@/features/proposal-flow/dal/client/queries/use-get-proposal'
import { baseDefaultValues, proposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { ProposalForm } from '@/features/proposal-flow/ui/components/form'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Form } from '@/shared/components/ui/form'
import { ROOTS } from '@/shared/config/roots'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { CustomerInfoHeader } from '../components/customer-info-header'

interface EditProposalViewProps {
  proposalId: string
}

export function EditProposalView({ proposalId }: EditProposalViewProps) {
  const router = useRouter()

  const proposal = useGetProposal(proposalId)
  const updateProposal = useUpdateProposal()

  const form = useForm<ProposalFormSchema>({
    resolver: zodResolver(proposalFormSchema),
    mode: 'onSubmit',
    disabled: proposal.isLoading || updateProposal.isPending,
    defaultValues: baseDefaultValues,
  })

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
    const nextFinalTcp = computeFinalTcp(rawData.funding.data)

    return {
      proposalId,
      data: {
        label: rawData.project.data.label,
        formMetaJSON: rawData.meta,
        projectJSON: rawData.project,
        fundingJSON: {
          ...rawData.funding,
          data: {
            ...rawData.funding.data,
            cashInDeal: rawData.funding.data.cashInDeal > nextFinalTcp ? nextFinalTcp : rawData.funding.data.cashInDeal,
          },
        },
      },
    }
  }

  function onSubmit(rawData: ProposalFormSchema) {
    updateProposal.mutate(buildMutationData(rawData), {
      onSuccess: () => {
        toast.success('Proposal updated')
        router.push(`${ROOTS.public.proposals()}/proposal/${proposalId}`)
      },
      onError: error => toast.error(error.message),
    })
  }

  function onSave(rawData: ProposalFormSchema) {
    updateProposal.mutate(buildMutationData(rawData), {
      onSuccess: () => toast.success('Proposal saved'),
      onError: error => toast.error(error.message),
    })
  }

  const viewHref = `${ROOTS.public.proposals()}/proposal/${proposalId}`

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
    </motion.div>
  )
}
