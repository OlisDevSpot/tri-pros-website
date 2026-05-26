'use client'

import type { EnvelopeDocumentId, ProposalKind } from '@/shared/constants/enums'
import type { ZohoContractStatus } from '@/shared/services/providers/zoho-sign/types'
import { motion } from 'motion/react'
import { EnvelopeCard } from './envelope-card'
import { ProposalCard } from './proposal-card'

interface AgentContractViewProps {
  proposalId: string
  contractStatus: (ZohoContractStatus & { contractSentAt: string | null }) | null
  customerAge: number | null
  customerId: string | null
  envelopeDocumentIds: readonly EnvelopeDocumentId[] | null
  proposalKind?: ProposalKind
  customerName?: string | null
  onSendProposalEmail?: (message: string) => void
  isSendingEmail?: boolean
  proposalStatus?: string
  proposalSentAt?: string | null
  isDraftSyncing?: boolean
}

/**
 * Agent-facing agreement section. Composes two independent cards that
 * correspond to the two distinct things the customer experiences:
 *
 *   1. **Proposal** — the interactive doc the customer reviews in-app
 *      via a tokenized link.
 *   2. **Signing Envelope** — the Zoho Sign package the customer signs.
 *
 * Each card has its own lifecycle and its own customer-notification
 * channel. Acting on one card never touches the other — that's the
 * whole point of the split: keep the agent in tight control over what
 * the customer receives, and when.
 */
export function AgentContractView({
  proposalId,
  contractStatus,
  customerAge,
  envelopeDocumentIds,
  proposalKind,
  customerName,
  onSendProposalEmail,
  isSendingEmail,
  proposalStatus,
  proposalSentAt,
  isDraftSyncing,
}: AgentContractViewProps) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        {/* Gradient background wash — preserves prior agreement-section look */}
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/4 via-primary/2 to-transparent dark:from-primary/8 dark:via-primary/3" />

        <div className="relative space-y-4 p-5 sm:p-7">
          <h3 className="text-base font-semibold tracking-tight sm:text-lg">
            Agreement
          </h3>

          <ProposalCard
            proposalStatus={proposalStatus}
            proposalSentAt={proposalSentAt}
            customerName={customerName ?? null}
            onSendProposalEmail={onSendProposalEmail}
            isSendingEmail={isSendingEmail ?? false}
          />

          <EnvelopeCard
            proposalId={proposalId}
            contractStatus={contractStatus}
            customerAge={customerAge}
            envelopeDocumentIds={envelopeDocumentIds}
            customerName={customerName ?? null}
            proposalKind={proposalKind}
            isDraftSyncing={isDraftSyncing ?? false}
          />
        </div>
      </div>
    </motion.div>
  )
}
