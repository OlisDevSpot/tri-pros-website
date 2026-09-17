// Project media service — the `media_files` child of a project: the photo set
// behind the portfolio and the showroom. The R2 object lifecycle and the optimize
// dispatch belong to this unit's CRUD hooks (dal/server/crud.ts, C32), so the
// spread `create`/`delete` below already carry them. What lives here is what the
// DAL cannot see: the store binding for the shared media verbs, and the
// project-only operations that used to sit in the router (MD6).
//
//   ...projectMediaCrud   the engine's five slots, unwrapped (serial int PK)
//   buildUploadTarget     presigned R2 PUT under the store's path key
//   list / reorder        scoped, table-generic, via the media module
//   retryOptimization     own-row probe -> reset status -> optimize dispatch
//   movePhase / setHero   bulk writes on this unit's DAL
//   importFromProposal    copy R2 objects from proposal media onto this project
//
// NOTE (D4): unlike the proposal twin there is NO parent-visibility probe here —
// the project media router still runs on a bare `agentProcedure` with
// `ctx.scope = null`, so adding one would be a live authorization tightening.
// That flip belongs to #285.
import type { MediaPhase } from '@/shared/constants/enums/media'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { ProjectMediaFile } from '@/shared/db/schema/project-media-files'
import type { R2BucketName } from '@/shared/services/providers/r2/types'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { mediaService } from '@/shared/modules/media/service'
import { projectMediaCrud } from '@/shared/modules/projects/media/dal/server/crud'
import { moveMediaPhase, setHeroImage } from '@/shared/modules/projects/media/dal/server/mutations'
import { projectMediaStore } from '@/shared/modules/projects/media/store'
import { listImportableProjectMedia } from '@/shared/modules/proposals/media/dal/server/queries'
import { r2Client } from '@/shared/services/providers/r2/client'
import { R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'

export const projectMediaService = {
  ...projectMediaCrud,

  // ctx-first and DalReturn-wrapped like every other verb, even though there is
  // nothing to scope here yet (D4) — the proposal twin has the same signature, and
  // #285 will put a probe in exactly this spot.
  async buildUploadTarget(
    _ctx: ScopedContext,
    input: { projectId: string, filename: string, mimeType: string, phase: MediaPhase },
  ): Promise<DalReturn<{ uploadUrl: string, pathKey: string, bucket: string }>> {
    return dalDbOperation(async () =>
      mediaService.buildUploadTarget(projectMediaStore, {
        ownerId: input.projectId,
        filename: input.filename,
        mimeType: input.mimeType,
        extra: { phase: input.phase },
      }),
    )
  },

  async list(ctx: ScopedContext, input: { projectId: string }): Promise<DalReturn<ProjectMediaFile[]>> {
    return dalDbOperation(async () =>
      dalVerifySuccess(await mediaService.list(projectMediaStore, ctx, input.projectId)) as ProjectMediaFile[],
    )
  },

  async reorder(ctx: ScopedContext, input: { updates: { id: number, sortOrder: number }[] }): Promise<DalReturn<void>> {
    return mediaService.reorder(projectMediaStore, ctx, input.updates)
  },

  async retryOptimization(ctx: ScopedContext, input: { id: number }): Promise<DalReturn<void>> {
    return dalDbOperation(async () => {
      const row = dalVerifySuccess(await projectMediaCrud.getById(ctx, { id: input.id }))
      if (!row) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      await mediaService.retryOptimization(projectMediaStore, input.id)
    })
  },

  async movePhase(ctx: ScopedContext, input: { ids: number[], phase: MediaPhase }): Promise<DalReturn<void>> {
    return moveMediaPhase(ctx, input.ids, input.phase)
  },

  async setHero(ctx: ScopedContext, input: { id: number, isHeroImage: boolean }): Promise<DalReturn<void>> {
    return setHeroImage(ctx, input.id, input.isHeroImage)
  },

  /**
   * Copy proposal media onto this project. Authorization is the source query:
   * `listImportableProjectMedia` only returns media on proposals attached to THIS
   * project's meetings, so an arbitrary proposal media id can't be imported.
   *
   * Round-2 rush rules kept unchanged on purpose (C30/MD12): no `visibility` check
   * on the source rows. Revisit with the owner, not here.
   */
  async importFromProposal(
    ctx: ScopedContext,
    input: { projectId: string, proposalMediaFileIds: number[] },
  ): Promise<DalReturn<{ imported: number }>> {
    return dalDbOperation(async () => {
      const sources = await listImportableProjectMedia(input.projectId, input.proposalMediaFileIds)
      let imported = 0
      for (const src of sources) {
        if (!src.pathKey || !src.bucket) {
          continue
        }
        const ext = src.fileExtension || (src.pathKey.includes('.') ? `.${src.pathKey.split('.').pop()}` : '')
        const destKey = projectMediaStore.buildPathKey(input.projectId, crypto.randomUUID(), ext)
        await r2Client.copyObject({
          sourceBucket: src.bucket as R2BucketName,
          sourceKey: src.pathKey,
          destBucket: projectMediaStore.bucket,
          destKey,
        })
        dalVerifySuccess(await projectMediaCrud.create(ctx, {
          projectId: input.projectId,
          name: src.name,
          mimeType: src.mimeType,
          fileExtension: ext,
          pathKey: destKey,
          bucket: projectMediaStore.bucket,
          url: `${R2_PUBLIC_DOMAINS[projectMediaStore.bucket] ?? ''}/${destKey}`,
          phase: 'uncategorized',
        }))
        imported++
      }
      return { imported }
    })
  },
} as const

export type ProjectMediaService = typeof projectMediaService
