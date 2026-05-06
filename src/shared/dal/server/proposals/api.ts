import type { ContractEvent } from '@/shared/constants/enums'
import type { InsertProposalSchema, Proposal } from '@/shared/db/schema/proposals'
import { randomBytes } from 'node:crypto'
import { and, eq, getTableColumns, sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { meetings } from '@/shared/db/schema/meetings'
import { proposals } from '@/shared/db/schema/proposals'
import { contractEventColumn, contractEventIdempotencyPolicy, shouldAutoApproveOnContractEvent } from '@/shared/entities/proposals/lib/contract-events'

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
        customerProfileJSON: customers.customerProfileJSON,
      },
      // The proposal's meeting's projectId. Null = initial scenario
      // (no project yet — created on proposal approval per the
      // project-conversion rule). Non-null = upsell on an existing
      // project. Drives envelope-scenario derivation in
      // src/shared/services/zoho-sign/documents/proposal-context.ts.
      meetingProjectId: meetings.projectId,
      // Best-available "original contract date" for this proposal's
      // project — drives AWD's `original-contract-date` on upsell
      // envelopes. Falls through `contract_sent_at → approved_at →
      // created_at` because projects can exist before the original
      // proposal's contract is sent (project conversion fires on
      // approval, contract goes out after). Null only when the meeting
      // has no project (initial scenario, where this field is unused).
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

/**
 * Applies a contract-signing event to the proposal carrying `signingRequestId`.
 * Idempotent per `contractEventIdempotencyPolicy`. Returns the updated row,
 * or undefined when no proposal matches OR the policy skipped the write
 * (caller treats both as "no notify").
 *
 * Business rules (auto-approve, idempotency mode, target column) live in
 * `entities/proposals/lib/contract-events.ts` — this function is a thin write.
 */
export interface ApplyContractEventInput {
  signingRequestId: string
  event: ContractEvent
  performedAt: string
}

export async function applyContractEvent(
  input: ApplyContractEventInput,
): Promise<Proposal | undefined> {
  const { signingRequestId, event, performedAt } = input

  const column = contractEventColumn[event]
  const policy = contractEventIdempotencyPolicy[event]
  const idempotencyClause = policy === 'write-once'
    ? sql`${proposals[column]} IS NULL`
    : sql`(${proposals[column]} IS NULL OR ${proposals[column]} > ${performedAt})`

  const setFields: Record<string, unknown> = { [column]: performedAt }
  if (shouldAutoApproveOnContractEvent(event)) {
    setFields.status = 'approved'
    setFields.approvedAt = sql`COALESCE(${proposals.approvedAt}, ${performedAt})`
  }

  const [row] = await db
    .update(proposals)
    .set(setFields)
    .where(and(
      eq(proposals.signingRequestId, signingRequestId),
      idempotencyClause,
    ))
    .returning()

  return row
}
