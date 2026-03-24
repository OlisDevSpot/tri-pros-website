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
import { Button } from '@/shared/components/ui/button'
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
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-stretch gap-3">
        {customer && (
          <div className="flex-1 min-w-0">
            <CustomerInfoHeader customer={customer} />
          </div>
        )}
        <div className="flex flex-col gap-2 shrink-0">
          <Button
            type="submit"
            form="proposal-form"
            disabled={proposal.isLoading || updateProposal.isPending}
            className="flex-1 w-full whitespace-nowrap"
          >
            Update & Preview
          </Button>
          {proposalId && (
            <EntityViewButton
              href={`${ROOTS.public.proposals()}/proposal/${proposalId}`}
              external
              showLabel
              variant="outline"
              size="default"
              className="flex-1 w-full gap-1.5 whitespace-nowrap"
            />
          )}
        </div>
      </div>
      <div className="h-full w-full overflow-auto pr-4">
        <Form {...form}>
          <ProposalForm
            isLoading={proposal.isLoading || updateProposal.isPending}
            initialValues={initProposalValues}
            onSubmit={onSubmit}
            hideSubmitButton
          />
        </Form>
      </div>
    </motion.div>
  )
}
