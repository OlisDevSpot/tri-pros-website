// users business mutations for the agent-settings profile.
// see docs/codebase-conventions/dal-conventions.md

import type { DalReturn } from '@/shared/dal/server/types'
import type { User } from '@/shared/db/schema'

import { eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema'

export type UpdateUserProfilePatch = Partial<Pick<
  typeof user.$inferInsert,
  | 'quote'
  | 'bio'
  | 'yearsOfExperience'
  | 'tradeSpecialties'
  | 'languagesSpoken'
  | 'certifications'
  | 'headshotUrl'
  | 'headshotCropData'
  | 'birthdate'
  | 'funFact'
  | 'phone'
  | 'startDate'
>>

/**
 * Patch the caller's flat profile columns. Drizzle skips `undefined` keys, so
 * a headshot save (`{ headshotUrl }`) can no longer clobber brand fields, and
 * vice versa — this is the whole race fix, no lock needed. The ONLY write
 * path to `user` profile fields (agent-settings.router.ts must not
 * `db.update` directly).
 */
export async function updateUserProfile(
  userId: string,
  patch: UpdateUserProfilePatch,
): Promise<DalReturn<User>> {
  return dalDbOperation(async () => {
    const [updated] = await db
      .update(user)
      .set(patch)
      .where(eq(user.id, userId))
      .returning()
    return updated
  })
}
