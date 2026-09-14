// users DAL — queries. Reads over the better-auth `user` table that services
// need for recipient resolution. Unscoped by design: user identity is not a
// visibility-gated resource (there is no `user` entity spec yet — see
// memory/project-users-entity-migration).
// DAL conventions: docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'

import { inArray } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'

/** User ids for the given emails (exact match). Unknown emails are simply absent from the result. */
export async function getUserIdsByEmails(emails: string[]): Promise<DalReturn<string[]>> {
  return dalDbOperation(async () => {
    if (emails.length === 0) {
      return []
    }
    const rows = await db.select({ id: user.id }).from(user).where(inArray(user.email, emails))
    return rows.map(r => r.id)
  })
}
