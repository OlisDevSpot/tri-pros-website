'use client'

import Link from 'next/link'

import { awaitingProposalsInput, sentProposalsInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardModule } from '@/features/agent-dashboard/ui/components/dashboard-module'
import { DashboardProposalSection } from '@/features/agent-dashboard/ui/components/dashboard-proposal-section'
import { ROOTS } from '@/shared/config/roots'

/**
 * Proposals module — two truthful, non-overlapping sections: "Out for signature"
 * (contract envelope out for signature) and "Sent — awaiting response" (proposal
 * sent, no contract yet). Each section header names the state, so the rows carry
 * no status badge. Each section reuses the exact query keys the dashboard route
 * prefetches (`awaitingProposalsInput` / `sentProposalsInput`), so both hydrate
 * instantly. See docs/superpowers/specs/2026-08-08-dashboard-proposals-sections-design.md.
 */
export function DashboardProposals() {
  return (
    <DashboardModule
      title="Proposals"
      action={(
        <Link
          href={ROOTS.dashboard.proposals.root()}
          className="-mr-2 -my-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent/50 hover:text-primary"
        >
          See all →
        </Link>
      )}
    >
      <div className="flex flex-col gap-4">
        <DashboardProposalSection
          title="Out for signature"
          input={awaitingProposalsInput()}
          timeSince="contractSentAt"
          emptyMessage="None out for signature"
        />
        <DashboardProposalSection
          title="Sent — awaiting response"
          input={sentProposalsInput()}
          timeSince="sentAt"
          emptyMessage="Nothing sent awaiting a response"
        />
      </div>
    </DashboardModule>
  )
}
