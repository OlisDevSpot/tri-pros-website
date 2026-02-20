import type { ProposalFormValues } from '../../schemas/form-schema'
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

export function EditProposalView() {
  const [proposalId] = useQueryState('proposalId')

  const proposal = useGetProposal(proposalId!, { enabled: !!proposalId })
  const updateProposal = useUpdateProposal()

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    mode: 'onSubmit',
    disabled: proposal.isLoading || updateProposal.isPending,
  })

  const initProposalValues = useMemo(() => {
    if (proposal.data) {
      const { data } = proposal

      const initialValues: OverrideProposalValues = {
        homeowner: {
          name: data.name || '',
          email: data.email || '',
          phoneNum: data.phoneNum || '',
          customerAge: data.customerAge || 0,
        },
        project: {
          label: data.label || '',
          projectType: data.projectType || 'general-remodeling',
          timeAllocated: data.timeAllocated || '',
          agreementNotes: data.agreementNotes || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          zipCode: data.zipCode || '',
          sow: data.sow || [],
        },
        funding: {
          cashInDeal: data.cashInDeal || 0,
          depositAmount: data.depositAmount || 0,
          tcp: data.tcp || 0,
        },
      }

      return initialValues
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
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

  function onSubmit(rawData: ProposalFormValues) {
    if (!proposalId) {
      return
    }

    const data = {
      ...rawData.project,
      ...rawData.funding,
      ...rawData.homeowner,
    }

    updateProposal.mutate({
      proposalId,
      data,
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
