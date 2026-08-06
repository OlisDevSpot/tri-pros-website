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

import { meetingWindow } from '../lib/meeting-windows'

// `projects.crud.list`'s input isn't exported as a named schema/type (it's
// inlined in the router's `.input(...)`), so it's pulled off the router type
// itself — same pattern as `use-participant-mutations.tsx`.
type ProjectsListInput = inferRouterInputs<AppRouter>['projectsRouter']['crud']['list']

/** Top-N caps shared by every dashboard module that lists this entity. */
export const DASHBOARD_LIMITS = { meetings: 8, proposals: 20, projects: 15, actionQueue: 8 } as const

/** Meetings list input for a Today/Upcoming/Past window, sorted by `scheduledFor`. */
export function meetingsWindowInput(kind: MeetingWindowKind) {
  return {
    pagination: { limit: DASHBOARD_LIMITS.meetings, offset: 0 },
    sort: { sortBy: 'scheduledFor', sortDir: kind === 'past' ? 'desc' : 'asc' },
    filters: { scheduledFor: meetingWindow(kind) },
  } satisfies MeetingListInput
}

/** Proposals awaiting the homeowner's signature (contract sent, unsigned/undeclined). */
export function awaitingProposalsInput() {
  return {
    pagination: { limit: DASHBOARD_LIMITS.proposals, offset: 0 },
    sort: { sortBy: 'sentAt', sortDir: 'desc' },
    filters: { awaitingSignature: true },
  } satisfies ProposalListInput
}

/** Open (active) projects, newest first. */
export function activeProjectsInput() {
  return {
    pagination: { limit: DASHBOARD_LIMITS.projects, offset: 0 },
    sort: { sortBy: 'createdAt', sortDir: 'desc' },
    filters: { status: ['active'] },
  } satisfies ProjectsListInput
}
