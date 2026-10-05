// users DAL — queries. Reads over the better-auth `user` table that services
// need for recipient resolution. Unscoped by design: user identity is not a
// visibility-gated resource (there is no `user` entity spec yet — see
// memory/project-users-entity-migration).

import type { UserRole } from '@/shared/constants/enums/user'
import type { DalReturn } from '@/shared/dal/server/types'
import type { User } from '@/shared/db/schema/auth'

import { and, eq, inArray, notInArray } from 'drizzle-orm'

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

export type InternalUserRow = Pick<User, 'id' | 'name' | 'email' | 'image' | 'role'>

/** Users with one of these roles, by name. `excludeIds` drops system accounts. */
export async function listUsersByRoles(
  roles: readonly UserRole[],
  options: { excludeIds?: readonly string[] } = {},
): Promise<DalReturn<InternalUserRow[]>> {
  return dalDbOperation(async () =>
    db
      .select({ id: user.id, name: user.name, email: user.email, image: user.image, role: user.role })
      .from(user)
      .where(and(
        inArray(user.role, [...roles]),
        options.excludeIds?.length ? notInArray(user.id, [...options.excludeIds]) : undefined,
      ))
      .orderBy(user.name),
  )
}

export async function getUserRoleById(id: string): Promise<DalReturn<UserRole | null>> {
  return dalDbOperation(async () => {
    const [row] = await db.select({ role: user.role }).from(user).where(eq(user.id, id)).limit(1)
    return row?.role ?? null
  })
}
