'use client'

import { useMutation } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { customizableSections, generateProposalSteps } from '@/features/proposal-flow/constants/proposal-steps'
import { useScrollRoot } from '@/features/proposal-flow/contexts/scroll-context'
import { useSendProposalEmail } from '@/features/proposal-flow/dal/client/mutations/use-send-proposal-email'
import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useAbility } from '@/shared/permissions/hooks'
import { useTRPC } from '@/trpc/helpers'
import { Heading } from './heading'

export function Proposal() {
  const params = useParams() as { proposalId: string }
  const searchParams = useSearchParams()
  const sendProposalEmail = useSendProposalEmail()
  const proposal = useCurrentProposal()
  const { setRootEl } = useScrollRoot()
  const trpc = useTRPC()
  const recordView = useMutation(trpc.proposalsRouter.delivery.recordView.mutationOptions())
  const ability = useAbility()
  const hasRecorded = useRef(false)

  useEffect(() => {
    if (hasRecorded.current || !proposal.data) {
      return
    }
    hasRecorded.current = true

    const token = searchParams.get('token') ?? ''
    const utmSource = searchParams.get('utm_source')
    const source = utmSource === 'email' ? 'email' : utmSource === 'sms' ? 'sms' : 'direct'

    recordView.mutate({
      proposalId: params.proposalId,
      token,
      source,
      referer: typeof window !== 'undefined' ? document.referrer : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal.data])

  if (proposal.isLoading) {
    return (
      <LoadingState
        title="Loading Proposal"
        description="This may take a few seconds"
      />
    )
  }

  if (proposal.isError || !proposal.data) {
    return (
      <ErrorState
        title="Error: Could not load proposal"
        description={proposal.error?.message ?? 'Please try again'}
      />
    )
  }

  const { token, customer } = proposal.data
  const customerEmail = customer?.email ?? ''
  const customerName = customer?.name ?? 'Customer'

  const viewerRole = ability.can('update', 'Proposal') ? 'agent' : 'homeowner'
  const proposalSteps = generateProposalSteps(viewerRole)

  return (
    <div className="h-full overflow-auto">
      <div ref={setRootEl} id="proposal-container" className="h-full overflow-auto scroll-smooth">
        <div className="space-y-20 lg:pr-8">
          <Heading />
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-20"
          >
            {proposalSteps.map(step => (
              <div
                id={step.accessor}
                key={step.accessor}
              >
                {customizableSections.includes(step.accessor) && step.accessor === 'funding' && (
                  <step.Component onPickFinancingOption={(option) => {
                  // eslint-disable-next-line no-console
                    console.log(option)
                  }}
                  />
                )}
                {customizableSections.includes(step.accessor) && step.accessor === 'contract' && (
                  <step.Component
                    proposalId={params.proposalId}
                    token={token ?? undefined}
                    variant="full"
                    isAgent={ability.can('update', 'Proposal')}
                  />
                )}
                {customizableSections.includes(step.accessor) && step.accessor === 'send-proposal' && (
                  <step.Component onClick={(message) => {
                    if (!customerEmail) {
                      toast.error('Email is not configured')
                      return
                    }
                    sendProposalEmail.mutate({
                      proposalId: params.proposalId,
                      email: customerEmail,
                      token: token || '',
                      customerName,
                      message,
                    }, {
                      onSuccess: () => {
                        toast.success('proposal sent!')
                      },
                    })
                  }}
                  />
                )}
                {!customizableSections.includes(step.accessor) && (
                  <step.Component />
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </div>
  )
}
