// Every dashboard module (snapshot strip, meetings hub, proposals and projects sections) reads through these, so
// a module and the page's prefetch share one query key per concern. Meetings and projects are data-view configs:
// a wrong filter or sort id fails `pnpm tsc` against the entity's field list. Proposals have no field list yet,
// so their inputs are checked with `satisfies` against the procedure's input type.

import type { MeetingWindowKind } from '../lib/meeting-windows'
import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'
import type { ProposalListInput } from '@/shared/modules/proposals/core/dal/server/queries'

import { LIVE_MEETING_OUTCOMES, proposalStatuses } from '@/shared/constants/enums'
import { staticDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'
import { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'
import { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'
import { meetingWindow } from '../lib/meeting-windows'

/** Caps shared by every dashboard module that lists this entity — a Top-N slice for most, the month grid's row cap for the meetings calendar. */
export const DASHBOARD_LIMITS = { meetings: 8, meetingsCalendar: 500, proposals: 20, proposalsPerSection: 5, projects: 15, projectsPerSection: 5 } as const

/** The Today, Upcoming and Past lists: live outcomes only, the first rows by `scheduledFor` (latest first for Past). */
export const DASHBOARD_MEETINGS_WINDOW_QUERIES = {
  today: {
    fields: MEETING_FIELDS,
    paramPrefix: 'dmt',
    toolbar: [],
    defaultSort: { sortBy: 'scheduledFor', sortDir: 'asc' },
    fixed: { outcome: LIVE_MEETING_OUTCOMES },
    window: { kind: 'first', count: DASHBOARD_LIMITS.meetings },
  },
  upcoming: {
    fields: MEETING_FIELDS,
    paramPrefix: 'dmu',
    toolbar: [],
    defaultSort: { sortBy: 'scheduledFor', sortDir: 'asc' },
    fixed: { outcome: LIVE_MEETING_OUTCOMES },
    window: { kind: 'first', count: DASHBOARD_LIMITS.meetings },
  },
  past: {
    fields: MEETING_FIELDS,
    paramPrefix: 'dmp',
    toolbar: [],
    defaultSort: { sortBy: 'scheduledFor', sortDir: 'desc' },
    fixed: { outcome: LIVE_MEETING_OUTCOMES },
    window: { kind: 'first', count: DASHBOARD_LIMITS.meetings },
  },
} as const satisfies Record<MeetingWindowKind, DataViewQueryConfig<typeof MEETING_FIELDS>>

/** The day range moves with the clock, so it is pinned when the input is built; the page's prefetch and the snapshot strip both call this. */
export function meetingsWindowInput(kind: MeetingWindowKind) {
  return staticDataViewInput(DASHBOARD_MEETINGS_WINDOW_QUERIES[kind], { scheduledFor: meetingWindow(kind) })
}

/** The month calendar: live outcomes only. */
export const DASHBOARD_MEETINGS_QUERY = {
  fields: MEETING_FIELDS,
  paramPrefix: 'dm',
  toolbar: [],
  defaultSort: { sortBy: 'scheduledFor', sortDir: 'asc' },
  fixed: { outcome: LIVE_MEETING_OUTCOMES },
  window: { kind: 'date', field: 'scheduledFor', cap: DASHBOARD_LIMITS.meetingsCalendar, views: ['month'] },
} as const satisfies DataViewQueryConfig<typeof MEETING_FIELDS>

const OPEN_PROPOSAL_STATUSES = proposalStatuses.filter(status => status !== 'declined')

/** Proposals awaiting the homeowner's signature (contract sent, unsigned/undeclined). */
export function awaitingProposalsInput() {
  return {
    pagination: { limit: DASHBOARD_LIMITS.proposalsPerSection, offset: 0 },
    sort: { sortBy: 'contractSentAt', sortDir: 'desc' },
    // A proposal can be declined while its contract envelope still reads unsigned and undeclined; the envelope
    // alone would keep it listed as waiting for a signature.
    filters: { awaitingSignature: true, status: OPEN_PROPOSAL_STATUSES },
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
 * Live work (signed through full payment), newest first. `statusBucket` is derived from the pipeline stage;
 * `excludePortfolio` drops showcase-only projects, which never ran the lifecycle.
 */
export const DASHBOARD_ACTIVE_PROJECTS_QUERY = {
  fields: PROJECT_FIELDS,
  paramPrefix: 'dpa',
  toolbar: [],
  defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
  fixed: { statusBucket: ['active'], excludePortfolio: true },
  window: { kind: 'first', count: DASHBOARD_LIMITS.projectsPerSection },
} as const satisfies DataViewQueryConfig<typeof PROJECT_FIELDS>

/** Projects paused mid-flight, newest first. Real projects only. */
export const DASHBOARD_ON_HOLD_PROJECTS_QUERY = {
  fields: PROJECT_FIELDS,
  paramPrefix: 'dph',
  toolbar: [],
  defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
  fixed: { statusBucket: ['on_hold'], excludePortfolio: true },
  window: { kind: 'first', count: DASHBOARD_LIMITS.projectsPerSection },
} as const satisfies DataViewQueryConfig<typeof PROJECT_FIELDS>
