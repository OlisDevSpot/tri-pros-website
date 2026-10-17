'use client'

import type { MeetingRep } from '@/shared/modules/meetings/core/types'

import { useMutation } from '@tanstack/react-query'
import { Loader2Icon, MailIcon, PartyPopperIcon } from 'lucide-react'
import { toast } from 'sonner'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { deriveNextSteps } from '@/features/proposal-flow/lib/derive-next-steps'
import { repsPhrase, repsVerb } from '@/features/proposal-flow/lib/rep-names'
import { useContractStatus } from '@/shared/components/contract-status-panel/hooks/use-contract-status'
import { useCreditCooldown } from '@/shared/components/contract-status-panel/hooks/use-credit-cooldown'
import { CustomerAgeForm } from '@/shared/components/contract-status-panel/ui/customer-age-form'
import { Button } from '@/shared/components/ui/button'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

import { NextStepsTimeline } from './next-steps-timeline'

export function NextStepsAction({ reps }: { reps: MeetingRep[] }) {
  const { proposal, token } = useProposalDocument()
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()
  const { isCoolingDown, remainingSeconds, startCooldown } = useCreditCooldown()
  const accessToken = proposal.token ?? token
  const { data: contractStatus } = useContractStatus(proposal.id, accessToken)

  // A pure signal to the agents; it never touches the contract lifecycle.
  const requestMoveForward = useMutation(
    trpc.proposalsRouter.delivery.requestToMoveForward.mutationOptions({
      onSuccess: () => {
        startCooldown()
        invalidateProposal()
      },
      onError: () => {
        toast.error('We couldn’t send your request. Please try again in a moment.')
      },
    }),
  )

  const requestStatus = contractStatus?.requestStatus ?? null
  // A draft means an agent already prepared the agreement from an earlier request.
  const { states, action } = deriveNextSteps({
    requested: requestMoveForward.isSuccess || requestStatus === 'draft',
    requestStatus,
    signed: requestStatus === 'completed',
  })

  const team = repsPhrase(reps)
  const lead = repsPhrase(reps, { sentenceStart: true })
  const prepares = repsVerb(reps, 'prepares', 'prepare')
  const has = repsVerb(reps, 'has', 'have')

  return (
    <>
      <NextStepsTimeline states={states} repsLine={`${lead} ${prepares} your agreement.`} />
      {action === 'request' && proposal.customer?.customerAge == null && (
        <CustomerAgeForm proposalId={proposal.id} token={accessToken ?? undefined} />
      )}
      {action === 'request' && proposal.customer?.customerAge != null && (
        <div className="grid gap-3.5 rounded-xl border border-on-media/16 bg-on-media/8 p-5 @min-[700px]/proposal:grid-cols-[minmax(0,1fr)_auto] @min-[700px]/proposal:items-center">
          <div className="grid gap-1">
            <h3 className="font-sans text-xl font-medium">Ready to move forward?</h3>
            <p className="text-sm text-on-media-muted">{`Let ${team} know, and we’ll prepare the paperwork.`}</p>
          </div>
          <Button
            size="lg"
            disabled={requestMoveForward.isPending || isCoolingDown || !accessToken}
            onClick={() => accessToken && requestMoveForward.mutate({ id: proposal.id, token: accessToken })}
            className="h-12 bg-(--presentation-accent) px-5.5 text-base text-[oklch(0.17_0.04_262)] hover:bg-(--presentation-accent)/90"
          >
            {requestMoveForward.isPending
              ? (
                  <>
                    <Loader2Icon className="animate-spin" aria-hidden />
                    Sending…
                  </>
                )
              : isCoolingDown ? `Wait ${remainingSeconds}s…` : 'I’m ready to move forward'}
          </Button>
        </div>
      )}
      {action === 'requested' && (
        <Message icon={<PartyPopperIcon aria-hidden className="mt-0.5 size-5 shrink-0" />}>
          <b>Request sent.</b>
          {` ${lead} ${has} been notified and will prepare your agreement. You’ll get an email when it’s ready to sign.`}
        </Message>
      )}
      {action === 'sign' && (
        <Message icon={<MailIcon aria-hidden className="mt-0.5 size-5 shrink-0" />}>
          <b>Your signature is needed.</b>
          {' Check your email for the signing link from Zoho Sign. Once signed, our team begins scheduling.'}
        </Message>
      )}
      {action === 'kickoff' && (
        <Message icon={<PartyPopperIcon aria-hidden className="mt-0.5 size-5 shrink-0" />}>
          <b>Signed.</b>
          {' We’ll call you to schedule your start date.'}
        </Message>
      )}
    </>
  )
}

function Message({ icon, children }: { icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <p className="flex gap-3 rounded-lg bg-(--presentation-accent)/18 p-4">
      {icon}
      <span>{children}</span>
    </p>
  )
}
