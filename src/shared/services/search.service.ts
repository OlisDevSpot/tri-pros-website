import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { OmniSearchInput, OmniTarget } from '@/shared/domains/omni-search/schemas'
import type { RankedCustomer } from '@/shared/entities/customers/dal/server/search-customers-ranked'
import type { MeetingSearchRow } from '@/shared/entities/meetings/dal/server/queries'
import type { ProjectSearchRow } from '@/shared/modules/projects/core/dal/server/queries'
import type { ProposalSearchRow } from '@/shared/modules/proposals/core/dal/server/queries'

import { ROOTS } from '@/shared/config/roots'
import { makeQueryParsers } from '@/shared/dal/lib/query/url-state'
import { dalSuccess } from '@/shared/dal/server/types'
import { OMNI_LIMITS } from '@/shared/domains/omni-search/schemas'
import { CUSTOMERS_TABLE_QUERY_CONFIG } from '@/shared/entities/customers/constants/customers-table-query-config'
import { searchCustomersRanked } from '@/shared/entities/customers/dal/server/search-customers-ranked'
import { listMeetingsForCustomers } from '@/shared/entities/meetings/dal/server/queries'
import { listProjectsForCustomers } from '@/shared/modules/projects/core/dal/server/queries'
import { listProposalsForCustomers } from '@/shared/modules/proposals/core/dal/server/queries'
import 'server-only'

interface Targeted { target: OmniTarget }
interface WithCustomer { customerName: string }

/** How many of each kind the caller can read for a customer, past what the response lists. */
export interface OmniRecordCounts {
  meetings: number
  proposals: number
  projects: number
}

export interface OmniSearchResult {
  /** `counts` is optional in the contract, so a client that outlives a rollback of this server still renders. */
  customers: (RankedCustomer & Targeted & { counts?: OmniRecordCounts })[]
  meetings: (MeetingSearchRow & WithCustomer & Targeted)[]
  proposals: (ProposalSearchRow & WithCustomer & Targeted)[]
  projects: (ProjectSearchRow & WithCustomer & Targeted)[]
  /** The customers records page, filtered to the same term. */
  seeAllHref: string
}

function customersPageHref(term: string): string {
  const { searchKey } = makeQueryParsers(CUSTOMERS_TABLE_QUERY_CONFIG.paramPrefix)
  return `${ROOTS.dashboard.customers.root()}?${searchKey}=${encodeURIComponent(term)}`
}

export const searchService = {
  /** Customer-anchored: related records come from the top matches, each read under its own entity's rules. */
  async omni(ctx: ScopedContext, input: OmniSearchInput): Promise<DalReturn<OmniSearchResult>> {
    const ranked = await searchCustomersRanked(ctx, input.term, OMNI_LIMITS.customers)
    if (!ranked.success) {
      return ranked
    }
    // Every matched customer is read, so each gets its totals from the same three queries; only the top ones list records.
    const customerIds = ranked.data.map(customer => customer.id)
    const [meetingRows, proposalRows, projectRows] = await Promise.all([
      listMeetingsForCustomers(ctx, customerIds, OMNI_LIMITS.related),
      listProposalsForCustomers(ctx, customerIds, OMNI_LIMITS.related),
      listProjectsForCustomers(ctx, customerIds, OMNI_LIMITS.related),
    ])
    if (!meetingRows.success) {
      return meetingRows
    }
    if (!proposalRows.success) {
      return proposalRows
    }
    if (!projectRows.success) {
      return projectRows
    }

    const nameById = new Map(ranked.data.map(customer => [customer.id, customer.name]))
    const customerName = (id: string) => nameById.get(id) ?? ''
    const relatedIds = new Set(customerIds.slice(0, OMNI_LIMITS.relatedCustomers))
    const isRelated = (row: { customerId: string }) => relatedIds.has(row.customerId)
    const totalsOf = (rows: { customerId: string, customerTotal: number }[]) => new Map(rows.map(row => [row.customerId, row.customerTotal]))
    const [meetingTotals, proposalTotals, projectTotals] = [totalsOf(meetingRows.data), totalsOf(proposalRows.data), totalsOf(projectRows.data)]

    return dalSuccess({
      customers: ranked.data.map(customer => ({
        ...customer,
        counts: { meetings: meetingTotals.get(customer.id) ?? 0, proposals: proposalTotals.get(customer.id) ?? 0, projects: projectTotals.get(customer.id) ?? 0 },
        target: { kind: 'profile', customerId: customer.id },
      })),
      meetings: meetingRows.data.filter(isRelated).map(meeting => ({
        ...meeting,
        customerName: customerName(meeting.customerId),
        target: { kind: 'profile', customerId: meeting.customerId, defaultTab: 'meetings', highlightMeetingId: meeting.id },
      })),
      proposals: proposalRows.data.filter(isRelated).map(proposal => ({
        ...proposal,
        customerName: customerName(proposal.customerId),
        target: { kind: 'route', href: ROOTS.dashboard.proposals.byId(proposal.id) },
      })),
      projects: projectRows.data.filter(isRelated).map(project => ({
        ...project,
        customerName: customerName(project.customerId),
        target: { kind: 'route', href: ROOTS.dashboard.projects.byId(project.id) },
      })),
      seeAllHref: customersPageHref(input.term),
    })
  },
}
