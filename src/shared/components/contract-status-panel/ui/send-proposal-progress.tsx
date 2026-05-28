'use client'

import type { SendProposalStage, SendProposalStep } from '@/shared/entities/proposals/hooks/use-send-proposal-with-draft'

import { cn } from '@/shared/lib/utils'
import { SEND_PROPOSAL_STEPS } from '../constants/send-proposal-steps'
import { deriveSendProposalStepStatus } from '../lib/derive-send-proposal-step-status'
import { SendProposalStepIcon } from './send-proposal-step-icon'

interface SendProposalProgressProps {
  stage: SendProposalStage
  failedStep: SendProposalStep | null
  errorMessage: string | null
}

/**
 * Honest two-step progress display for the "Send Proposal" orchestration.
 * Each step maps 1:1 to a real tRPC mutation — see
 * `use-send-proposal-with-draft.ts`. The status icons reflect actual hook
 * state, never timer-driven advancement.
 */
export function SendProposalProgress({ stage, failedStep, errorMessage }: SendProposalProgressProps) {
  if (stage === 'idle' || stage === 'done') {
    return null
  }

  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <ul className="space-y-2.5">
        {SEND_PROPOSAL_STEPS.map((step) => {
          const status = deriveSendProposalStepStatus(step.key, stage, failedStep)
          return (
            <li key={step.key} className="flex items-start gap-2.5 text-sm">
              <SendProposalStepIcon status={status} />
              <span className={cn(
                'pt-0.5',
                status === 'active' && 'text-foreground',
                status === 'done' && 'text-muted-foreground',
                status === 'pending' && 'text-muted-foreground/70',
                status === 'error' && 'text-destructive',
              )}
              >
                {status === 'active' ? step.activeLabel : step.label}
              </span>
            </li>
          )
        })}
      </ul>
      {stage === 'error' && errorMessage && (
        <p className="mt-2.5 border-t border-border pt-2.5 text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
