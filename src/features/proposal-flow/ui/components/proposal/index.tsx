/* eslint-disable no-alert */
'use client'

import { motion } from 'motion/react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { customizableSections, generateProposalSteps } from '@/features/proposal-flow/constants/proposal-steps'
import { useScrollRoot } from '@/features/proposal-flow/contexts/scroll-context'
import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { useSession } from '@/shared/auth/client'
import { ErrorState } from '@/shared/components/states/error-state'
import { LoadingState } from '@/shared/components/states/loading-state'
import { useSendProposalEmail } from '@/shared/dal/client/proposals/mutations/use-send-proposal-email'
import { checkUserRole } from '@/shared/permissions/lib/check-user-role'
import { Heading } from './heading'

export function Proposal() {
  const sessionQuery = useSession()
  const params = useParams() as { proposalId: string }
  const sendProposalEmail = useSendProposalEmail()
  const proposal = useCurrentProposal()
  const { setRootEl } = useScrollRoot()

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

  const { token, homeownerJSON: { data: { email } } } = proposal.data

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
                  <step.Component onClick={() => {
                    alert('agreement link sent!')
                  }}
                  />
                )}
                {customizableSections.includes(step.accessor) && step.accessor === 'send-proposal' && (
                  <step.Component onClick={() => {
                    sendProposalEmail.mutate({
                      proposalId: params.proposalId,
                      email: email || '',
                      token: token || '',
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
