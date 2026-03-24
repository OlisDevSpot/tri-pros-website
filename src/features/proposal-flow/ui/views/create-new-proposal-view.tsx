'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import type { SOW } from '@/shared/entities/proposals/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useQueryState } from 'nuqs'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { useCreateProposal } from '@/features/proposal-flow/dal/client/mutations/use-create-proposal'
import { baseDefaultValues, proposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { ProposalForm } from '@/features/proposal-flow/ui/components/form'
import { useSession } from '@/shared/auth/client'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { Button } from '@/shared/components/ui/button'
import { Form } from '@/shared/components/ui/form'
import { useTRPC } from '@/trpc/helpers'
import { getProposalAggregates } from '../../lib/get-proposal-aggregates'
import { CustomerInfoHeader } from '../components/customer-info-header'

export function CreateNewProposalView() {
  const [meetingId] = useQueryState('meetingId', { defaultValue: '' })
  const trpc = useTRPC()
  const { data: session } = useSession()
  const router = useRouter()
  const createProposal = useCreateProposal()

  const meetingQuery = useQuery(
    trpc.meetingsRouter.getById.queryOptions(
      { id: meetingId },
      { enabled: !!meetingId },
    ),
  )

  const customer = meetingQuery.data?.customer ?? null

  const form = useForm<ProposalFormSchema>({
    resolver: zodResolver(proposalFormSchema),
    mode: 'onSubmit',
    defaultValues: {
      ...baseDefaultValues,
      project: {
        ...baseDefaultValues.project,
        data: {
          ...baseDefaultValues.project.data,
          label: customer?.name ?? '',
        },
      },
    },
    disabled: meetingQuery.isLoading,
  })

  function onSubmit(data: ProposalFormSchema) {
    const sow = data.project.data.sow.map((singleSOW) => {
      if (!singleSOW.trade.id) {
        return undefined
      }

      return singleSOW
    }).filter(
      (item): item is SOW =>
        item !== undefined,
    )

    const { totalProjectDiscounts } = getProposalAggregates(data)

    createProposal.mutate({
      label: data.project.data.label,
      ownerId: session?.user.id || '',
      meetingId: meetingId || undefined,
      formMetaJSON: data.meta,
      projectJSON: {
        data: {
          ...data.project.data,
          sow,
        },
        meta: data.project.meta,
      },
      fundingJSON: {
        data: {
          ...data.funding.data,
          cashInDeal: data.funding.data.startingTcp - totalProjectDiscounts,
          finalTcp: data.funding.data.startingTcp - totalProjectDiscounts,
        },
        meta: data.funding.meta,
      },
    }, {
      onSuccess: (data) => {
        const urlWithoutQueryStrings = data.proposalUrl.split('?')[0]
        toast.success('Proposal created!')
        router.push(urlWithoutQueryStrings)
      },
      onError: (error) => {
        toast.error(error.message)
      },
    })
  }

  if (!meetingId) {
    return (
      <ErrorState
        title="No meeting selected"
        description="A proposal must be created from a meeting. Please go back and select a meeting first."
      />
    )
  }

  if (meetingQuery.isLoading) {
    return (
      <LoadingState
        title="Loading Meeting"
        description="Fetching customer information..."
      />
    )
  }

  if (!meetingQuery.data) {
    return (
      <ErrorState
        title="Meeting not found"
        description="Could not load the meeting. Please try again."
      />
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.25 }}
      className="w-full h-full flex flex-col gap-4 min-h-0"
    >
      <div className="shrink-0 flex flex-col sm:flex-row sm:items-start gap-3">
        {customer && (
          <div className="flex-1 min-w-0">
            <CustomerInfoHeader customer={customer} />
          </div>
        )}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-start">
          <Button
            type="submit"
            form="proposal-form"
            disabled={meetingQuery.isLoading || createProposal.isPending}
            className="whitespace-nowrap"
          >
            Save & Preview
          </Button>
        </div>
      </div>
      <div className="flex-1 min-h-0 w-full overflow-auto pr-4">
        <Form {...form}>
          <ProposalForm
            isLoading={meetingQuery.isLoading || createProposal.isPending}
            onSubmit={onSubmit}
            hideSubmitButton
          />
        </Form>
      </div>
    </motion.div>
  )
}
