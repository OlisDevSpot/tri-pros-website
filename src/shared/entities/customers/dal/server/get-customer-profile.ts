// LAZY: customers is still a plain entity; this read moves to modules/customers/core/dal/server when customers is promoted to a module.

import type { ScopedContext } from '@/shared/dal/server/types'

import type { CustomerLeadAttributionRow } from '@/shared/db/schema/customer-lead-attribution'
import type { CustomerProfileData, CustomerProfileMeeting, CustomerProfileProject, CustomerProfileProposalView } from '@/shared/entities/customers/types'

import { TRPCError } from '@trpc/server'
import { and, asc, desc, eq, getTableColumns, sql } from 'drizzle-orm'

import { deriveProjectStatusBucket } from '@/shared/constants/enums'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { customerEnrichment } from '@/shared/db/schema/customer-enrichment'
import { customerLeadAttribution } from '@/shared/db/schema/customer-lead-attribution'
import { customerNotes } from '@/shared/db/schema/customer-notes'
import { customerProfiles } from '@/shared/db/schema/customer-profiles'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { projects } from '@/shared/db/schema/projects'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { canSeeUngatedPhone, gatedPhoneSql, hasSentProposalSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { profileCols } from '@/shared/entities/customers/lib/profile-select'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { getMeetingsWithProposals } from '@/shared/entities/meetings/dal/server/meetings-with-proposals'

export async function getCustomerProfile(ctx: ScopedContext, customerId: string): Promise<CustomerProfileData> {
  const { phone: _phone, ...customerCols } = getTableColumns(customers)

  const [customerRow] = await db
    .select({
      ...customerCols,
      ...profileCols(),
      phone: gatedPhoneSql(canSeeUngatedPhone(ctx.actor.ability)),
      hasSentProposal: hasSentProposalSql(),
      attribution: getTableColumns(customerLeadAttribution),
    })
    .from(customers)
    .leftJoin(customerProfiles, eq(customerProfiles.customerId, customers.id))
    .leftJoin(customerLeadAttribution, eq(customerLeadAttribution.customerId, customers.id))
    .where(and(
      eq(customers.id, customerId),
      permit(ctx, 'read', customerServerSpec).sql,
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
  // Whether a lead recording exists is a synchronous fact from data we already
  // load — surface it so the UI can decide to render the player BEFORE the
  // separate presigned-URL fetch, instead of flashing a skeleton then removing it.
  const hasRecording = Boolean(attribution?.captureJSON?.mp3RecordingKey)

  const { meetings: meetingsWithProposals, proposals: allProposals } = await getMeetingsWithProposals(eq(meetings.customerId, customerId))

  const noteRows = await db
    .select({
      id: customerNotes.id,
      customerId: customerNotes.customerId,
      content: customerNotes.content,
      authorId: customerNotes.authorId,
      createdAt: customerNotes.createdAt,
      updatedAt: customerNotes.updatedAt,
      authorName: user.name,
      authorImage: user.image,
    })
    .from(customerNotes)
    .leftJoin(user, eq(user.id, customerNotes.authorId))
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
    status: deriveProjectStatusBucket(p.pipelineStage),
    pipelineStage: p.pipelineStage,
    createdAt: p.createdAt,
    meetings: meetingsByProjectId.get(p.id) ?? [],
  }))

  return {
    customer,
    hasRecording,
    meetings: meetingsWithProposals,
    allProposals,
    notes: noteRows,
    proposalViews: proposalViewRows,
    projects: customerProjects,
  }
}
