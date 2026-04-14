'use client'

import type { ZohoContractStatus } from '@/shared/services/zoho-sign/types'
import { useMutation } from '@tanstack/react-query'
import { ArrowRight, Loader2, Mail, PartyPopper, TriangleAlert } from 'lucide-react'
import { motion } from 'motion/react'
import { Button } from '@/shared/components/ui/button'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'
import { useCreditCooldown } from '../hooks/use-credit-cooldown'
import { deriveTimelineState } from '../lib/derive-timeline-state'
import { AgreementTimeline } from './agreement-timeline'
import { CustomerAgeForm } from './customer-age-form'

interface HomeownerContractViewProps {
  proposalId: string
  token: string
  contractStatus: (ZohoContractStatus & { contractSentAt: string | null }) | null
  customerAge: number | null
  customerId: string | null
}

export function HomeownerContractView({ proposalId, token, contractStatus, customerAge }: HomeownerContractViewProps) {
  const trpc = useTRPC()
  const { invalidateProposal } = useInvalidation()
  const { isCoolingDown, remainingSeconds, startCooldown } = useCreditCooldown()

  const sendContract = useMutation(
    trpc.proposalsRouter.contracts.sendContractForSigning.mutationOptions({
      onSuccess: () => {
        startCooldown()
        invalidateProposal()
      },
    }),
  )

  const timelineSteps = deriveTimelineState(contractStatus)
  const requestStatus = contractStatus?.requestStatus
  const contractorSigner = contractStatus?.signerStatuses.find(s => s.role === 'Contractor')
  const isTerminal = requestStatus === 'declined' || requestStatus === 'recalled' || requestStatus === 'expired'

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Gradient background wash */}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/4 via-primary/2 to-transparent dark:from-primary/8 dark:via-primary/3" />

        <div className="relative space-y-6 p-5 sm:p-7">
          {/* Header */}
          <div>
            <h3 className="text-base font-semibold tracking-tight sm:text-lg">
              Agreement Status
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
              Track the progress of your project agreement
            </p>
          </div>

          {/* Timeline */}
          <AgreementTimeline steps={timelineSteps} />

          {/* Contextual action area */}
          <ActionArea
            requestStatus={requestStatus ?? null}
            contractorSignerStatus={contractorSigner?.status ?? null}
            isTerminal={isTerminal}
            isPending={sendContract.isPending}
            isCoolingDown={isCoolingDown}
            remainingSeconds={remainingSeconds}
            customerAge={customerAge}
            proposalId={proposalId}
            token={token}
            onRequestAgreement={() => sendContract.mutate({ proposalId, token })}
          />
        </div>
      </div>
    </motion.div>
  )
}

function ActionArea(props: {
  requestStatus: string | null
  contractorSignerStatus: string | null
  isTerminal: boolean
  isPending: boolean
  isCoolingDown: boolean
  remainingSeconds: number
  customerAge: number | null
  proposalId: string
  token: string
  onRequestAgreement: () => void
}) {
  // Terminal: declined / recalled / expired
  if (props.isTerminal) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4"
      >
        <div className="flex items-start gap-2.5">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
          <div>
            <p className="text-sm font-medium text-foreground">Agreement no longer active</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Please contact your representative, or request a new agreement below.
            </p>
          </div>
        </div>
        <RequestButton
          isPending={props.isPending}
          isCoolingDown={props.isCoolingDown}
          remainingSeconds={props.remainingSeconds}
          onClick={props.onRequestAgreement}
          label="Request New Agreement"
        />
      </motion.div>
    )
  }

  // Completed: all signed
  if (props.requestStatus === 'completed') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex items-start gap-3 rounded-lg border border-green-500/20 bg-green-500/5 p-4"
      >
        <PartyPopper className="mt-0.5 size-5 shrink-0 text-green-600 dark:text-green-400" />
        <div>
          <p className="text-sm font-semibold text-foreground">Agreement signed!</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Thank you for choosing Tri Pros Remodeling. Our team will be in touch to schedule your project.
          </p>
        </div>
      </motion.div>
    )
  }

  // Homeowner's turn to sign
  if (props.requestStatus === 'inprogress' && props.contractorSignerStatus === 'SIGNED') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4"
      >
        <Mail className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <p className="text-sm font-semibold text-foreground">Your signature is needed</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Check your email for the signing link from Zoho Sign. Once signed, your project will be confirmed and our team will begin scheduling.
          </p>
        </div>
      </motion.div>
    )
  }

  // In progress — contractor hasn't signed yet
  if (props.requestStatus === 'inprogress') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-lg border border-border bg-muted/30 p-4"
      >
        <p className="text-sm text-muted-foreground">
          Your agreement is being reviewed by our team. You will receive a signing email once it has been approved.
        </p>
      </motion.div>
    )
  }

  // Draft exists but not submitted
  if (props.requestStatus === 'draft') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-lg border border-border bg-muted/30 p-4"
      >
        <p className="text-sm text-muted-foreground">
          Your agreement has been prepared and is awaiting final review. You will be notified by email when it is ready for your signature.
        </p>
      </motion.div>
    )
  }

  // No contract — age gate then CTA
  if (props.customerAge == null) {
    return <CustomerAgeForm proposalId={props.proposalId} token={props.token} />
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="flex flex-col gap-3"
    >
      <p className="text-sm text-muted-foreground">
        Ready to move forward? Request your agreement below and our office will prepare the paperwork.
      </p>
      <RequestButton
        isPending={props.isPending}
        isCoolingDown={props.isCoolingDown}
        remainingSeconds={props.remainingSeconds}
        onClick={props.onRequestAgreement}
        label="Request Agreement"
      />
    </motion.div>
  )
}

function RequestButton(props: {
  isPending: boolean
  isCoolingDown: boolean
  remainingSeconds: number
  onClick: () => void
  label: string
}) {
  return (
    <Button
      onClick={props.onClick}
      disabled={props.isPending || props.isCoolingDown}
      className="group w-full sm:w-auto"
    >
      {props.isPending
        ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Requesting...
            </>
          )
        : props.isCoolingDown
          ? `Wait ${props.remainingSeconds}s...`
          : (
              <>
                {props.label}
                <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-0.5" />
              </>
            )}
    </Button>
  )
}
