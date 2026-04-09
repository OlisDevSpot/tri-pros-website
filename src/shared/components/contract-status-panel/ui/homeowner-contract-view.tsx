'use client'

import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import type { ZohoContractStatus } from '@/shared/services/zoho-sign/types'
import { Button } from '@/shared/components/ui/button'
import { useTRPC } from '@/trpc/helpers'
import { useCreditCooldown } from '../hooks/use-credit-cooldown'

interface HomeownerContractViewProps {
  proposalId: string
  token: string
  contractStatus: (ZohoContractStatus & { contractSentAt: string | null }) | null
}

export function HomeownerContractView({ proposalId, token, contractStatus }: HomeownerContractViewProps) {
  const trpc = useTRPC()
  const { isCoolingDown, remainingSeconds, startCooldown } = useCreditCooldown()

  const sendContract = useMutation(
    trpc.proposalsRouter.contracts.sendContractForSigning.mutationOptions({
      onSuccess: () => {
        startCooldown()
      },
    }),
  )

  const requestStatus = contractStatus?.requestStatus
  const contractorStatus = contractStatus?.signerStatuses.find(s => s.role === 'Contractor')

  if (requestStatus === 'declined' || requestStatus === 'recalled' || requestStatus === 'expired') {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          This agreement is no longer active. Please contact your representative for assistance.
        </p>
        <Button
          onClick={() => sendContract.mutate({ proposalId, token })}
          disabled={sendContract.isPending || isCoolingDown}
        >
          {sendContract.isPending
            ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Requesting...
                </>
              )
            : isCoolingDown
              ? `Wait ${remainingSeconds}s...`
              : 'Request New Agreement'}
        </Button>
      </div>
    )
  }

  if (requestStatus === 'completed') {
    return (
      <p className="text-sm text-green-600">
        Agreement signed! Thank you. Our team will be in touch to schedule your project.
      </p>
    )
  }

  if (requestStatus === 'inprogress' && contractorStatus?.status === 'SIGNED') {
    return (
      <p className="text-sm text-muted-foreground">
        Your agreement is ready for signature! Please check your email for the signing link from Zoho Sign.
      </p>
    )
  }

  if (requestStatus === 'inprogress') {
    return (
      <p className="text-sm text-muted-foreground">
        Your agreement has been generated and is being reviewed by our team. You will receive a signing email shortly.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        No agreement has been generated for this proposal yet. Once you are ready to move forward, click below to alert our office you'd like to proceed with scheduling.
      </p>
      <Button
        onClick={() => sendContract.mutate({ proposalId, token })}
        disabled={sendContract.isPending || isCoolingDown}
      >
        {sendContract.isPending
          ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Requesting...
              </>
            )
          : isCoolingDown
            ? `Wait ${remainingSeconds}s...`
            : 'Request Agreement'}
      </Button>
    </div>
  )
}
