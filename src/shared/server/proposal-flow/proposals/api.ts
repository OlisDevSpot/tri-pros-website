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
