import type { CustomerProfileData, CustomerProfileMeeting, CustomerProfileProject, CustomerProfileProposal, CustomerProfileProposalView } from '@/features/customer-pipelines/types'

import type { CustomerLeadAttributionRow } from '@/shared/db/schema/customer-lead-attribution'

import { TRPCError } from '@trpc/server'
import { and, asc, count, desc, eq, getTableColumns, sql } from 'drizzle-orm'

import { db } from '@/shared/db'
import { customerEnrichment } from '@/shared/db/schema/customer-enrichment'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customerNotes } from '@/shared/db/schema/customer-notes'
import { customerProfiles } from '@/shared/db/schema/customer-profiles'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { projects } from '@/shared/db/schema/projects'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'
import { userCanSeeCustomer } from '@/shared/entities/customers/dal/server/visibility'
import { gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { profileCols } from '@/shared/entities/customers/lib/profile-select'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'

// Local viewer shape for this DAL. The customers entity used to export a
// shared `CustomersViewer` interface; that was removed when queries.ts
// adopted the canonical (ctx: ScopedContext, input) signature. This file is
// next on the migration list — until then, keep the shape inline so the
// customer-pipelines router caller stays unchanged.
interface CustomerProfileViewer {
  userId: string
  isSuperAdmin: boolean
  canSeeUngated: boolean
}

export async function getCustomerProfile(customerId: string, viewer: CustomerProfileViewer): Promise<CustomerProfileData> {
  const { phone: _phone, ...customerCols } = getTableColumns(customers)

  const [customerRow] = await db
    .select({
      ...customerCols,
      ...profileCols(),
      phone: gatedPhoneSql(viewer.canSeeUngated),
      hasSentProposal: hasSentProposalSql(),
      attribution: getTableColumns(customerLeadAttribution),
    })
    .from(customers)
    .leftJoin(customerProfiles, eq(customerProfiles.customerId, customers.id))
    .leftJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
    .where(and(
      eq(customers.id, customerId),
      viewer.isSuperAdmin ? undefined : userCanSeeCustomer(viewer.userId, customers.id),
    ))

  if (!customerRow) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Customer not found' })
  }

  // Nested 1:1 attribution (leftJoin miss → null) + ordered enrichment rows —
  // mirrors the canonical getCustomer read so `data.customer` is a CustomerFullView.
  const attribution: CustomerLeadAttributionRow | null = customerRow.attribution?.customerId
    ? customerRow.attribution
    : null
  const enrichment = await db
    .select()
    .from(customerEnrichment)
    .where(eq(customerEnrichment.customerId, customerId))
    .orderBy(asc(customerEnrichment.order))
  const customer = { ...customerRow, attribution, enrichment }

  const meetingRows = await db
    .select({
      id: meetings.id,
      ownerId: meetings.ownerId,
      projectId: meetings.projectId,
      meetingType: meetings.meetingType,
      meetingOutcome: meetings.meetingOutcome,
      scheduledFor: meetings.scheduledFor,
      createdAt: meetings.createdAt,
      updatedAt: meetings.updatedAt,
    })
    .from(meetings)
    .where(eq(meetings.customerId, customerId))
    .orderBy(desc(meetings.createdAt))

  const proposalRows = await db
    .select({
      id: proposals.id,
      label: proposals.label,
      status: proposals.status,
      token: proposals.token,
      meetingId: proposals.meetingId,
      sentAt: proposals.sentAt,
      contractSentAt: proposals.contractSentAt,
      createdAt: proposals.createdAt,
      trade: sql<string | null>`${proposals.projectJSON}->'data'->'sow'->0->'trade'->>'label'`.as('trade'),
      fundingJSON: proposals.fundingJSON,
      projectJSON: proposals.projectJSON,
      sowRaw: sql<string | null>`${proposals.projectJSON}->'data'->'sow'`.as('sow_raw'),
      viewCount: count(proposalViews.id).as('view_count'),
    })
    .from(proposals)
    .leftJoin(proposalViews, eq(proposalViews.proposalId, proposals.id))
    .where(
      sql`${proposals.meetingId} IN (${sql.join(
        meetingRows.length > 0
          ? meetingRows.map(m => sql`${m.id}`)
          : [sql`NULL`],
        sql`, `,
      )})`,
    )
    .groupBy(proposals.id)
    .orderBy(desc(proposals.createdAt))

  const allProposals: CustomerProfileProposal[] = proposalRows.map((p) => {
    // Parse SOW JSON into trade+scopes summary
    let sowSummary: CustomerProfileProposal['sowSummary'] = []
    try {
      const rawSow = typeof p.sowRaw === 'string' ? JSON.parse(p.sowRaw) : p.sowRaw
      if (Array.isArray(rawSow)) {
        sowSummary = rawSow
          .filter((entry: any) => entry?.trade?.label)
          .map((entry: any) => ({
            trade: entry.trade.label as string,
            scopes: Array.isArray(entry.scopes)
              ? entry.scopes.map((s: any) => s.label as string).filter(Boolean)
              : [],
          }))
      }
    }
    catch {
      // Invalid JSON — leave empty
    }

    return {
      id: p.id,
      label: p.label,
      status: p.status,
      token: p.token,
      trade: p.trade,
      value: computeFinalTcp({ funding: p.fundingJSON.data, sow: p.projectJSON.data.sow }),
      sentAt: p.sentAt,
      contractSentAt: p.contractSentAt,
      viewCount: p.viewCount,
      meetingId: p.meetingId,
      createdAt: p.createdAt,
      sowSummary,
    }
  })

  const proposalsByMeeting = new Map<string, CustomerProfileProposal[]>()
  for (const p of allProposals) {
    if (p.meetingId) {
      const existing = proposalsByMeeting.get(p.meetingId) ?? []
      existing.push(p)
      proposalsByMeeting.set(p.meetingId, existing)
    }
  }

  const meetingsWithProposals: CustomerProfileMeeting[] = meetingRows.map(m => ({
    id: m.id,
    ownerId: m.ownerId,
    projectId: m.projectId,
    meetingType: m.meetingType,
    meetingOutcome: m.meetingOutcome,
    scheduledFor: m.scheduledFor,
    createdAt: m.createdAt,
    updatedAt: m.updatedAt,
    proposals: proposalsByMeeting.get(m.id) ?? [],
  }))

  const noteRows = await db
    .select()
    .from(customerNotes)
    .where(eq(customerNotes.customerId, customerId))
    .orderBy(desc(customerNotes.createdAt))

  const proposalViewRows: CustomerProfileProposalView[] = allProposals.length > 0
    ? await db
        .select({
          id: proposalViews.id,
          proposalId: proposalViews.proposalId,
          viewedAt: proposalViews.viewedAt,
          source: proposalViews.source,
        })
        .from(proposalViews)
        .where(
          sql`${proposalViews.proposalId} IN (${sql.join(
            allProposals.map(p => sql`${p.id}`),
            sql`, `,
          )})`,
        )
        .orderBy(desc(proposalViews.viewedAt))
    : []

  // Fetch projects for this customer
  const projectRows = await db
    .select({
      id: projects.id,
      title: projects.title,
      address: projects.address,
      status: projects.status,
      pipelineStage: projects.pipelineStage,
      createdAt: projects.createdAt,
    })
    .from(projects)
    .where(eq(projects.customerId, customerId))
    .orderBy(desc(projects.createdAt))

  // Group meetings by projectId for project cards
  const meetingsByProjectId = new Map<string, CustomerProfileMeeting[]>()
  for (const m of meetingsWithProposals) {
    if (m.projectId) {
      const existing = meetingsByProjectId.get(m.projectId) ?? []
      existing.push(m)
      meetingsByProjectId.set(m.projectId, existing)
    }
  }

  const customerProjects: CustomerProfileProject[] = projectRows.map(p => ({
    id: p.id,
    title: p.title,
    address: p.address,
    status: p.status,
    pipelineStage: p.pipelineStage,
    createdAt: p.createdAt,
    meetings: meetingsByProjectId.get(p.id) ?? [],
  }))

  return {
    customer,
    meetings: meetingsWithProposals,
    allProposals,
    notes: noteRows,
    proposalViews: proposalViewRows,
    projects: customerProjects,
  }
}
