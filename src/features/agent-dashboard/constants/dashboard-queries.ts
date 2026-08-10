// Shared query-input builders for the agent dashboard. Every dashboard
// module (snapshot strip, meetings hub, proposals/projects sections) reads
// through these so they share one query key per concern instead of each
// module inlining its own pagination/sort/filter shape.
//
// Each builder's return type is checked with `satisfies` against the real
// procedure input type (imported, not hand-mirrored) — see
// docs/codebase-conventions for why builders are isolated in one file: a
// wrong filter/sort key here fails `pnpm tsc`, not a runtime 500.

import type { inferRouterInputs } from '@trpc/server'
import type { MeetingWindowKind } from '../lib/meeting-windows'
import type { MeetingListInput } from '@/shared/entities/meetings/dal/server/queries'
import type { ProposalListInput } from '@/shared/entities/proposals/dal/server/queries'
import type { AppRouter } from '@/trpc/routers/app'

import { LIVE_MEETING_OUTCOMES } from '@/shared/constants/enums'
import { meetingMonthWindow, meetingWindow } from '../lib/meeting-windows'

// `projects.crud.list`'s input isn't exported as a named schema/type (it's
// inlined in the router's `.input(...)`), so it's pulled off the router type
// itself — same pattern as `use-participant-mutations.tsx`. Exported so the
// dashboard's `DashboardProjectSection` can type its `input` prop against it.
export type ProjectsListInput = inferRouterInputs<AppRouter>['projectsRouter']['crud']['list']

/** Top-N caps shared by every dashboard module that lists this entity. */
export const DASHBOARD_LIMITS = { meetings: 8, proposals: 20, proposalsPerSection: 5, projects: 15, projectsPerSection: 5, actionQueue: 8 } as const

/** Meetings list input for a Today/Upcoming/Past window, sorted by `scheduledFor`. */
export function meetingsWindowInput(kind: MeetingWindowKind) {
  return {
    pagination: { limit: DASHBOARD_LIMITS.meetings, offset: 0 },
    sort: { sortBy: 'scheduledFor', sortDir: kind === 'past' ? 'desc' : 'asc' },
    filters: { scheduledFor: meetingWindow(kind), outcome: LIVE_MEETING_OUTCOMES },
  } satisfies MeetingListInput
}

/** All meetings in the LA calendar month of `anchorCalendarDay`, live outcomes only, chronological. */
export function meetingsMonthInput(anchorCalendarDay: string) {
  return {
    pagination: { limit: 200, offset: 0 },
    sort: { sortBy: 'scheduledFor', sortDir: 'asc' },
    filters: { scheduledFor: meetingMonthWindow(anchorCalendarDay), outcome: LIVE_MEETING_OUTCOMES },
  } satisfies MeetingListInput
}

/** Proposals awaiting the homeowner's signature (contract sent, unsigned/undeclined). */
export function awaitingProposalsInput() {
  return {
    pagination: { limit: DASHBOARD_LIMITS.proposalsPerSection, offset: 0 },
    sort: { sortBy: 'contractSentAt', sortDir: 'desc' },
    filters: { awaitingSignature: true },
  } satisfies ProposalListInput
}

/** Proposals sent, awaiting the customer's response — `status='sent'` with no contract envelope yet (the `proposal_sent` stage). Newest-first by send recency (coalesced to createdAt), matching the card's displayed "time since". */
export function sentProposalsInput() {
  return {
    pagination: { limit: DASHBOARD_LIMITS.proposalsPerSection, offset: 0 },
    sort: { sortBy: 'sentRecency', sortDir: 'desc' },
    filters: { sentNoContract: true },
  } satisfies ProposalListInput
}

/**
 * Active projects — live work (signed through full payment), newest first.
 * Grouped by the derived status bucket (`statusBucket: ['active']`, expanded to
 * stages server-side via `PROJECT_STAGE_BUCKET`), NOT the removed `status`
 * column. `excludePortfolio` drops showcase-only projects (no meetings), which
 * carry no lifecycle stage. See src/shared/constants/enums/pipelines.ts.
 */
export function activeProjectsInput() {
  return {
    pagination: { limit: DASHBOARD_LIMITS.projectsPerSection, offset: 0 },
    sort: { sortBy: 'createdAt', sortDir: 'desc' },
    filters: { statusBucket: ['active'], excludePortfolio: true },
  } satisfies ProjectsListInput
}

/** Projects paused mid-flight (`on_hold`), newest first. Real projects only. */
export function onHoldProjectsInput() {
  return {
    pagination: { limit: DASHBOARD_LIMITS.projectsPerSection, offset: 0 },
    sort: { sortBy: 'createdAt', sortDir: 'desc' },
    filters: { statusBucket: ['on_hold'], excludePortfolio: true },
  } satisfies ProjectsListInput
}
