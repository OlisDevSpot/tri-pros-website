// Shared query-input builders for the agent dashboard. Every dashboard
// module (snapshot strip, meetings hub, proposals/projects sections) reads
// through these so they share one query key per concern instead of each
// module inlining its own pagination/sort/filter shape.
//
// Each list-input builder's return type is checked with `satisfies` against
// the real procedure input type (imported, not hand-mirrored): a wrong
// filter/sort key here fails `pnpm tsc`, not a runtime 500.
// `DASHBOARD_MEETINGS_QUERY` is checked instead against `DataViewQueryConfig`;
// its procedure compatibility is checked where `useDataViewQuery` is called.

import type { MeetingWindowKind } from '../lib/meeting-windows'
import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'
import type { MeetingListInput } from '@/shared/entities/meetings/dal/server/queries'
import type { ProjectListInput } from '@/shared/modules/projects/core/dal/server/queries'
import type { ProposalListInput } from '@/shared/modules/proposals/core/dal/server/queries'

import { LIVE_MEETING_OUTCOMES } from '@/shared/constants/enums'
import { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'
import { meetingWindow } from '../lib/meeting-windows'

// Exported so the dashboard's `DashboardProjectSection` can type its `input` prop against it.
export type ProjectsListInput = ProjectListInput

/** Caps shared by every dashboard module that lists this entity — a Top-N slice for most, the month grid's row cap for the meetings calendar. */
export const DASHBOARD_LIMITS = { meetings: 8, meetingsCalendar: 500, proposals: 20, proposalsPerSection: 5, projects: 15, projectsPerSection: 5, actionQueue: 8 } as const

/** Meetings list input for a Today/Upcoming/Past window, sorted by `scheduledFor`. */
export function meetingsWindowInput(kind: MeetingWindowKind) {
  return {
    pagination: { limit: DASHBOARD_LIMITS.meetings, offset: 0 },
    sort: { sortBy: 'scheduledFor', sortDir: kind === 'past' ? 'desc' : 'asc' },
    filters: { scheduledFor: meetingWindow(kind), outcome: LIVE_MEETING_OUTCOMES },
  } satisfies MeetingListInput
}

/** Live outcomes only: pinned by the procedure through `DASHBOARD_MEETINGS_EXTRA`, since a data-view config never pins a filter. */
export const DASHBOARD_MEETINGS_QUERY = {
  fields: MEETING_FIELDS,
  paramPrefix: 'dm',
  toolbar: [],
  defaultSort: { sortBy: 'scheduledFor', sortDir: 'asc' },
  window: { kind: 'date', field: 'scheduledFor', cap: DASHBOARD_LIMITS.meetingsCalendar, views: ['month'] },
} as const satisfies DataViewQueryConfig<typeof MEETING_FIELDS>

/** The calendar read's `extra`; the page's prefetch and the hub's hook pass this one object so their keys match. */
export const DASHBOARD_MEETINGS_EXTRA = { liveOnly: true } as const

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
