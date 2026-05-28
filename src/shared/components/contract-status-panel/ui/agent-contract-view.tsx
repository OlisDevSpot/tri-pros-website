'use client'

import type { ProposalKind, ProposalStatus } from '@/shared/constants/enums'
import type { ZohoContractStatus } from '@/shared/services/providers/zoho-sign/types'
import { motion } from 'motion/react'

import { EnvelopeCard } from './envelope-card'
import { ProposalCard } from './proposal-card'

interface AgentContractViewProps {
  proposalId: string
  token: string
  customerEmail: string | null
  contractStatus: (ZohoContractStatus & { contractSentAt: string | null }) | null
  proposalKind?: ProposalKind
  customerName?: string | null
  proposalStatus?: ProposalStatus
  proposalSentAt?: string | null
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
 *
 * The send-proposal flow client-orchestrates the (independent) signing
 * draft preparation as a first step — owned inside ProposalCard via
 * `useSendProposalWithDraft`. See
 * `src/shared/entities/proposals/DOCS.md#proposal-contract-independence`.
 *
 * Layout: cards stack on mobile, sit side-by-side on desktop (lg+).
 */
export function AgentContractView({
  proposalId,
  token,
  customerEmail,
  contractStatus,
  proposalKind,
  customerName,
  proposalStatus,
  proposalSentAt,
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

          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
            <div className="lg:flex-1">
              <ProposalCard
                proposalId={proposalId}
                token={token}
                customerEmail={customerEmail}
                customerName={customerName ?? null}
                proposalStatus={proposalStatus}
                proposalSentAt={proposalSentAt}
              />
            </div>

            <div className="lg:flex-1">
              <EnvelopeCard
                proposalId={proposalId}
                contractStatus={contractStatus}
                customerName={customerName ?? null}
                proposalKind={proposalKind}
              />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
