import type { InsertProposalSchema } from '@/shared/db/schema/proposals'
import { randomBytes } from 'node:crypto'
import { and, count, desc, eq, getTableColumns, max } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalViews } from '@/shared/db/schema/proposal-views'
import { proposals } from '@/shared/db/schema/proposals'

export interface ProposalCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string
  state: string | null
  zip: string
}

export async function createProposal(data: InsertProposalSchema) {
  try {
    const [proposal] = await db
      .insert(proposals)
      .values({
        ...data,
        fundingJSON: {
          ...data.fundingJSON,
          data: {
            ...data.fundingJSON.data,
            cashInDeal: data.fundingJSON.data.cashInDeal,
          },
        },
        token: `tpr-${randomBytes(8).toString('hex')}`,
      })
      .returning()

    return proposal
  }
  catch (error) {
    console.error(error)
    throw new Error('Failed to create proposal')
  }
}

export async function getProposal(proposalId: string) {
  const [row] = await db
    .select({
      ...getTableColumns(proposals),
      customer: {
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        address: customers.address,
        city: customers.city,
        state: customers.state,
        zip: customers.zip,
      },
    })
    .from(proposals)
    .leftJoin(meetings, eq(meetings.id, proposals.meetingId))
    .leftJoin(customers, eq(customers.id, meetings.customerId))
    .where(eq(proposals.id, proposalId))

  if (!row) {
    return undefined
  }

  const customer = row.customer?.id ? (row.customer as ProposalCustomer) : null

  return { ...row, customer }
}

export type ProposalWithCustomer = NonNullable<Awaited<ReturnType<typeof getProposal>>>

export async function getProposals(userId: string, isOmni = false) {
  return db
    .select({
      ...getTableColumns(proposals),
      viewCount: count(proposalViews.id),
      lastViewedAt: max(proposalViews.viewedAt),
      customerId: customers.id,
      customerName: customers.name,
      meetingPipeline: meetings.pipeline,
      meetingProjectId: meetings.projectId,
    })
    .from(proposals)
    .leftJoin(proposalViews, eq(proposalViews.proposalId, proposals.id))
    .leftJoin(meetings, eq(meetings.id, proposals.meetingId))
    .leftJoin(customers, eq(customers.id, meetings.customerId))
    .where(isOmni ? undefined : eq(proposals.ownerId, userId))
    .groupBy(proposals.id, customers.id, customers.name, meetings.pipeline, meetings.projectId)
    .orderBy(desc(proposals.createdAt))
}

export async function updateProposal(userIdOrToken: string | null, proposalId: string, data: Partial<InsertProposalSchema>) {
  const conditions = [eq(proposals.id, proposalId)]

  // null = privileged caller (e.g. super-admin) — skip ownership check
  if (userIdOrToken !== null) {
    const isToken = userIdOrToken.startsWith('tpr-')
    conditions.push(isToken ? eq(proposals.token, userIdOrToken) : eq(proposals.ownerId, userIdOrToken))
  }

  const [proposal] = await db
    .update(proposals)
    .set(data)
    .where(and(...conditions))
    .returning()

  return proposal
}

export async function deleteProposal(proposalId: string) {
  await db.delete(proposals).where(eq(proposals.id, proposalId))
}
