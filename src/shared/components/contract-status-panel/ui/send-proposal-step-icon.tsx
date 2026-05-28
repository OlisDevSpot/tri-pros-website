'use client'

import type { SendProposalStepStatus } from '../lib/derive-send-proposal-step-status'
import { AlertCircle, Check, Loader2 } from 'lucide-react'

interface SendProposalStepIconProps {
  status: SendProposalStepStatus
}

export function SendProposalStepIcon({ status }: SendProposalStepIconProps) {
  if (status === 'done') {
    return (
      <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-green-500/15 text-green-700 dark:text-green-400">
        <Check className="size-3" aria-hidden />
      </span>
    )
  }
  if (status === 'active') {
    return <Loader2 className="mt-0.5 size-4 shrink-0 animate-spin text-foreground" aria-hidden />
  }
  if (status === 'error') {
    return <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
  }
  return (
    <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border border-muted-foreground/30" aria-hidden />
  )
}
