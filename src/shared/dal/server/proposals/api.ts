import type { InsertProposalSchema } from '@/shared/db/schema/proposals'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema/proposals'

export async function getProposal(proposalId: string) {
  const [proposal] = await db
    .select()
    .from(proposals)
    .where(eq(proposals.id, proposalId))

  return proposal
}

export async function updateProposal(proposalId: string, data: Partial<InsertProposalSchema>) {
  const [proposal] = await db
    .update(proposals)
    .set(data)
    .where(eq(proposals.id, proposalId))
    .returning()

  return proposal
}
