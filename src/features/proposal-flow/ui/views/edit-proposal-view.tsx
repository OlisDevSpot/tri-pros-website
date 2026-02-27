import type { ProposalFormSchema } from '../../schemas/form-schema'
import type { OverrideProposalValues } from '../../types'

import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'motion/react'
import { useQueryState } from 'nuqs'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Form } from '@/shared/components/ui/form'
import { useUpdateProposal } from '@/shared/dal/client/proposals/mutations/use-update-proposal'
import { useGetProposal } from '@/shared/dal/client/proposals/queries/use-get-proposal'
import { proposalFormSchema } from '../../schemas/form-schema'
import { ProposalForm } from '../components/form'

export function calculateProposalDiscounts(proposal: ProposalFormSchema) {
  const { funding } = proposal

  const totalDiscounts = funding.data.incentives.reduce((acc, cur) => {
    if (cur.type === 'discount') {
      return acc + cur.amount
    }

    return acc
  }, 0)

  return totalDiscounts
}

export function EditProposalView() {
  const [proposalId] = useQueryState('proposalId')

  const proposal = useGetProposal(proposalId!, { enabled: !!proposalId })
  const updateProposal = useUpdateProposal()

  const form = useForm<ProposalFormSchema>({
    resolver: zodResolver(proposalFormSchema),
    mode: 'onSubmit',
    disabled: proposal.isLoading || updateProposal.isPending,
  })

  const initProposalValues = useMemo(() => {
    if (proposal.data) {
      const initialValues: OverrideProposalValues = {
        homeowner: proposal.data.homeownerJSON,
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

  function onSubmit(rawData: ProposalFormSchema) {
    if (!proposalId) {
      return
    }

    const totalDiscounts = calculateProposalDiscounts(rawData)

    const updatedFinalTcp = rawData.funding.data.startingTcp - totalDiscounts

    updateProposal.mutate({
      proposalId,
      data: {
        homeownerJSON: rawData.homeowner,
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
