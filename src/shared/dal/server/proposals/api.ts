import type { InsertProposalSchema } from '@/shared/db/schema/proposals'
import { randomBytes } from 'node:crypto'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema/proposals'

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
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(eq(proposals.id, proposalId))

  return proposal
}

export async function getProposals(userId: string) {
  const foundProposals = await db
    .select()
    .from(proposals)
    .where(eq(proposals.ownerId, userId))
    .orderBy(desc(proposals.createdAt))

  return foundProposals
}

export async function updateProposal(userIdOrToken: string, proposalId: string, data: Partial<InsertProposalSchema>) {
  const isToken = userIdOrToken.startsWith('tpr-')
  const authFilter = isToken ? eq(proposals.token, userIdOrToken) : eq(proposals.ownerId, userIdOrToken)

  const [proposal] = await db
    .update(proposals)
    .set(data)
    .where(and(
      eq(proposals.id, proposalId),
      authFilter,
    ))
    .returning()

  return proposal
}

export async function deleteProposal(proposalId: string) {
  await db.delete(proposals).where(eq(proposals.id, proposalId))
}
