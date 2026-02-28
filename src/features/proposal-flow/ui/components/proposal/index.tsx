'use client'

import { useMutation } from '@tanstack/react-query'
import { motion } from 'motion/react'
import { useParams, useSearchParams } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { customizableSections, generateProposalSteps } from '@/features/proposal-flow/constants/proposal-steps'
import { useScrollRoot } from '@/features/proposal-flow/contexts/scroll-context'
import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { useSession } from '@/shared/auth/client'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useSendProposalEmail } from '@/shared/dal/client/proposals/mutations/use-send-proposal-email'
import { checkUserRole } from '@/shared/permissions/lib/check-user-role'
import { useTRPC } from '@/trpc/helpers'
import { Heading } from './heading'

export function Proposal() {
  const sessionQuery = useSession()
  const params = useParams() as { proposalId: string }
  const searchParams = useSearchParams()
  const sendProposalEmail = useSendProposalEmail()
  const proposal = useCurrentProposal()
  const { setRootEl } = useScrollRoot()
  const trpc = useTRPC()
  const recordView = useMutation(trpc.proposalRouter.recordView.mutationOptions())
  const sendContract = useMutation(trpc.docusignRouter.sendContractForSigning.mutationOptions())
  const hasRecorded = useRef(false)

  useEffect(() => {
    if (hasRecorded.current || !proposal.data) {
      return
    }
    hasRecorded.current = true

    const token = searchParams.get('token') ?? ''
    const utmSource = searchParams.get('utm_source')
    const source = utmSource === 'email' ? 'email' : 'direct'

    recordView.mutate({
      proposalId: params.proposalId,
      token,
      source,
      referer: typeof window !== 'undefined' ? document.referrer : undefined,
      userAgent: typeof window !== 'undefined' ? navigator.userAgent : undefined,
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal.data])

  if (sessionQuery.isPending || proposal.isLoading) {
    return (
      <LoadingState
        title="Loading Proposal"
        description="This may take a few seconds"
      />
    )
  }

  if (!proposal.data) {
    return (
      <ErrorState
        title="Error: Could not load proposal"
        description="Please try again"
      />
    )
  }

  const { token, homeownerJSON: { data: { email, name } } } = proposal.data

  const userRole = checkUserRole(sessionQuery.data?.user.email || '')
  const proposalSteps = generateProposalSteps(userRole)

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
                {customizableSections.includes(step.accessor) && step.accessor === 'agreement-link' && (
                  <step.Component
                    onClick={() => {
                      sendContract.mutate({ proposalId: params.proposalId, token: token ?? '' })
                    }}
                    isPending={sendContract.isPending}
                    isSuccess={sendContract.isSuccess}
                  />
                )}
                {customizableSections.includes(step.accessor) && step.accessor === 'send-proposal' && (
                  <step.Component onClick={() => {
                    sendProposalEmail.mutate({
                      proposalId: params.proposalId,
                      email: email || '',
                      token: token || '',
                      customerName: name,
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
