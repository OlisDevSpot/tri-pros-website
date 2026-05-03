import type { InsertProposalSchema } from '@/shared/db/schema/proposals'
import { randomBytes } from 'node:crypto'
import { and, eq, getTableColumns, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { proposals } from '@/shared/db/schema/proposals'
import { deriveProposalKind } from '@/shared/entities/proposals/lib/derive-proposal-kind'

export interface ProposalCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
  address: string | null
  city: string
  state: string | null
  zip: string
  customerAge: number | null
}

export async function createProposal(data: InsertProposalSchema) {
  try {
    // Server-derived: kind is frozen at insert from the meeting's current
    // project linkage. Any client-supplied `kind` on `data` is ignored —
    // see the omit() on insertProposalSchema for the Zod-level guard.
    let meetingProjectId: string | null = null
    if (data.meetingId) {
      const [row] = await db
        .select({ projectId: meetings.projectId })
        .from(meetings)
        .where(eq(meetings.id, data.meetingId))
      meetingProjectId = row?.projectId ?? null
    }
    const kind = deriveProposalKind(meetingProjectId)

    const [proposal] = await db
      .insert(proposals)
      .values({
        ...data,
        kind,
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
        customerProfileJSON: customers.customerProfileJSON,
      },
      // The proposal's meeting's projectId. Null = meeting has no
      // project yet (one is created when the meeting's initial-sale
      // proposal is approved). Non-null = meeting is on an existing
      // project. Note: this is the meeting's *current* projectId —
      // distinct from `proposal.kind`, which is the kind frozen at
      // proposal insert. Used by UI surfaces that need project linkage
      // (e.g., the project-creation gate in PastProposalsTable).
      meetingProjectId: meetings.projectId,
      // Best-available "original contract date" for this proposal's
      // project — drives AWD's `original-contract-date` on additional-
      // work envelopes. Falls through `contract_sent_at → approved_at →
      // created_at` because projects can exist before the original
      // proposal's contract is sent (project conversion fires on
      // approval, contract goes out after). Null only when the meeting
      // has no project (initial-sale, where this field is unused).
      projectFirstContractSentAt: sql<string | null>`(
        SELECT COALESCE(MIN(p2.contract_sent_at), MIN(p2.approved_at), MIN(p2.created_at))
        FROM ${proposals} p2
        JOIN ${meetings} m2 ON m2.id = p2.meeting_id
        WHERE m2.project_id = ${meetings.projectId}
      )`,
    })
    .from(proposals)
    .leftJoin(meetings, eq(meetings.id, proposals.meetingId))
    .leftJoin(customers, eq(customers.id, meetings.customerId))
    .where(eq(proposals.id, proposalId))

  if (!row) {
    return undefined
  }

  const customer: ProposalCustomer | null = row.customer?.id
    ? {
        id: row.customer.id,
        name: row.customer.name,
        phone: row.customer.phone,
        email: row.customer.email,
        address: row.customer.address,
        city: row.customer.city,
        state: row.customer.state,
        zip: row.customer.zip,
        customerAge: row.customer.customerProfileJSON?.age ?? null,
      }
    : null

  return { ...row, customer }
}

export type ProposalWithCustomer = NonNullable<Awaited<ReturnType<typeof getProposal>>>

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
