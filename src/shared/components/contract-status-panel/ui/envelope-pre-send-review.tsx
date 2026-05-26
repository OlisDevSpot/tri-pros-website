'use client'

import type { ProposalKind } from '@/shared/constants/enums'
import { PlusCircle, Sparkles } from 'lucide-react'

interface EnvelopePreSendReviewProps {
  proposalKind: ProposalKind
  customerName: string | null
}

/**
 * Compact pre-send context block shown while the envelope is still a
 * draft. Tells the agent what kind of agreement they're about to send
 * and the project-level effect of approval.
 */
export function EnvelopePreSendReview({ proposalKind, customerName }: EnvelopePreSendReviewProps) {
  const isInitialSale = proposalKind === 'initial-sale'
  const KindIcon = isInitialSale ? Sparkles : PlusCircle
  const kindLabel = isInitialSale ? 'Initial sale' : 'Additional work'
  const reason = isInitialSale
    ? customerName
      ? `First proposal for ${customerName} — a project will be created when this is approved.`
      : 'First proposal on this customer — a project will be created when this is approved.'
    : customerName
      ? `Adding scope to ${customerName}'s existing project.`
      : 'Adding scope to an existing project.'

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3.5">
      <div className="flex items-start gap-2.5">
        <KindIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-medium text-foreground">{kindLabel}</p>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
              {proposalKind}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {reason}
          </p>
        </div>
      </div>
    </div>
  )
}
