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
    <div className="rounded-lg border border-status-info-dot/40 bg-status-info-bg p-3.5 text-status-info-fg">
      <div className="flex items-start gap-2.5">
        <KindIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-medium">{kindLabel}</p>
            <span className="rounded-full border border-status-info-dot/40 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide">
              {proposalKind}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed">
            {reason}
          </p>
        </div>
      </div>
    </div>
  )
}
