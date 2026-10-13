// Bulk writes on project media that are not single-row CRUD slots: a phase move and the one-hero rule.

import type { MediaPhase } from '@/shared/constants/enums/media'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'

import { and, eq } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { projectMediaFiles } from '@/shared/db/schema'
import { projectMediaServerSpec } from '@/shared/modules/projects/media/server-spec'

/** Bulk-set `phase` for the given ids in one scoped transaction. Empty input → no-op. */
export function moveMediaPhase(
  ctx: ScopedContext,
  ids: number[],
  phase: MediaPhase,
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    if (ids.length === 0) {
      return
    }
    await db.transaction(async (tx) => {
      for (const id of ids) {
        await tx.update(projectMediaFiles).set({ phase }).where(and(eq(projectMediaFiles.id, id), permit(ctx, 'update', projectMediaServerSpec).sql))
      }
    })
  })
}

/**
 * Set/unset the hero image for a project. When setting, enforces single-hero
 * exclusivity (clears every other hero on the same project first) in one tx.
 * Scoped: an out-of-scope id matches nothing → not-found.
 */
export function setHeroImage(
  ctx: ScopedContext,
  id: number,
  isHeroImage: boolean,
): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    await db.transaction(async (tx) => {
      if (isHeroImage) {
        const [file] = await tx
          .select({ projectId: projectMediaFiles.projectId })
          .from(projectMediaFiles)
          .where(and(eq(projectMediaFiles.id, id), permit(ctx, 'update', projectMediaServerSpec).sql))
        if (!file) {
          throw new ThrowableDalError({ type: 'not-found' })
        }
        await tx.update(projectMediaFiles).set({ isHeroImage: false }).where(eq(projectMediaFiles.projectId, file.projectId))
      }
      await tx.update(projectMediaFiles).set({ isHeroImage }).where(and(eq(projectMediaFiles.id, id), permit(ctx, 'update', projectMediaServerSpec).sql))
    })
  })
}
