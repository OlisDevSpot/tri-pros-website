import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { x_projectScopes } from '@/shared/db/schema'

/**
 * Delete-then-insert the x_projectScopes rows for a project. Called from the
 * `create/updateProjectWithScopes` abstractions in ./crud.ts (scopeIds as a
 * call-site closure); kept standalone so callers that only need the scope link
 * (no project-row write) can reach it directly.
 */
export async function setProjectScopes(projectId: string, scopeIds: string[]): Promise<void> {
  await db
    .delete(x_projectScopes)
    .where(eq(x_projectScopes.projectId, projectId))

  if (scopeIds.length > 0) {
    await db.insert(x_projectScopes).values(
      scopeIds.map(scopeId => ({
        projectId,
        scopeId,
      })),
    )
  }
}
