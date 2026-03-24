import type { OverrideProposalValues } from '../../types'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useUpdateProposal } from '@/features/proposal-flow/dal/client/mutations/use-update-proposal'
import { useGetProposal } from '@/features/proposal-flow/dal/client/queries/use-get-proposal'
import { calculateProposalDiscounts } from '@/features/proposal-flow/lib/calculate-proposal-discounts'
import { baseDefaultValues, proposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { ProposalForm } from '@/features/proposal-flow/ui/components/form'
import { EntityViewButton } from '@/shared/components/entity-actions/entity-view-button'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Form } from '@/shared/components/ui/form'
import { ROOTS } from '@/shared/config/roots'
import { CustomerInfoHeader } from '../components/customer-info-header'

export function EditProposalView() {
  const router = useRouter()
  const [proposalId] = useQueryState('proposalId')

  const proposal = useGetProposal(proposalId!, undefined, { enabled: !!proposalId })
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

  function onSubmit(rawData: ProposalFormSchema) {
    if (!proposalId) {
      return
    }

    const totalDiscounts = calculateProposalDiscounts(rawData)

    const updatedFinalTcp = rawData.funding.data.startingTcp - totalDiscounts

    updateProposal.mutate({
      proposalId,
      data: {
        label: rawData.project.data.label,
        formMetaJSON: rawData.meta,
        projectJSON: rawData.project,
        fundingJSON: {
          ...rawData.funding,
          data: {
            ...rawData.funding.data,
            finalTcp: updatedFinalTcp,
            cashInDeal: rawData.funding.data.cashInDeal > updatedFinalTcp ? updatedFinalTcp : rawData.funding.data.cashInDeal,
          },
        },
      },
    }, {
      onSuccess: () => {
        toast.success('Proposal updated')
        router.push(`${ROOTS.public.proposals()}/proposal/${proposalId}`)
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4"
    >
      {customer && (
        <div className="shrink-0 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <CustomerInfoHeader customer={customer} />
          {proposalId && (
            <EntityViewButton
              href={`${ROOTS.public.proposals()}/proposal/${proposalId}`}
              external
              showLabel
              size="sm"
              className="h-8 w-auto gap-1.5 px-3 shrink-0 self-end sm:self-start"
            />
          )}
        </div>
      )}
      <div
        className="h-full w-full overflow-auto pr-4"
      >
        <Form {...form}>
          <ProposalForm
            isLoading={proposal.isLoading || updateProposal.isPending}
            initialValues={initProposalValues}
            onSubmit={onSubmit}
          />
        </Form>
      </div>
    </motion.div>
  )
}
