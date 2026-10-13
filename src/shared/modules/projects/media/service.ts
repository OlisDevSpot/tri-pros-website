// Project media service — the `media_files` child of a project: the photo set
// behind the portfolio and the showroom. The R2 object lifecycle and the optimize
// dispatch belong to this unit's CRUD hooks (dal/server/crud.ts), so the
// spread `create`/`delete` below already carry them. What lives here is what the
// DAL cannot see: the store binding for the shared media verbs, and the
// project-only operations that used to sit in the router.
//
//   ...projectMediaCrud   the engine's five slots, unwrapped (serial int PK)
//   buildUploadTarget     presigned R2 PUT under the store's path key
//   list / reorder        scoped, table-generic, via the media module
//   retryOptimization     own-row probe -> reset status -> optimize dispatch
//   movePhase / setHero   bulk writes on this unit's DAL
//   importFromProposal    copy R2 objects from proposal media onto this project
import type { MediaPhase } from '@/shared/constants/enums/media'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { ProjectMediaFile } from '@/shared/db/schema/project-media-files'
import type { R2BucketName } from '@/shared/services/providers/r2/types'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { mediaService } from '@/shared/modules/media/service'
import { projectServerSpec } from '@/shared/modules/projects/core/server-spec'
import { projectMediaCrud } from '@/shared/modules/projects/media/dal/server/crud'
import { moveMediaPhase, setHeroImage } from '@/shared/modules/projects/media/dal/server/mutations'
import { projectMediaServerSpec } from '@/shared/modules/projects/media/server-spec'
import { projectMediaStore } from '@/shared/modules/projects/media/store'
import { listImportableProjectMedia } from '@/shared/modules/proposals/media/dal/server/queries'
import { r2Client } from '@/shared/services/providers/r2/client'
import { R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'

export const projectMediaService = {
  ...projectMediaCrud,

  async buildUploadTarget(
    ctx: ScopedContext,
    input: { projectId: string, filename: string, mimeType: string, phase: MediaPhase },
  ): Promise<DalReturn<{ uploadUrl: string, pathKey: string, bucket: string }>> {
    return dalDbOperation(async () => {
      if (!(await permit(ctx, 'update', projectServerSpec, ['media']).probe(input.projectId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      return mediaService.buildUploadTarget(projectMediaStore, {
        ownerId: input.projectId,
        filename: input.filename,
        mimeType: input.mimeType,
        extra: { phase: input.phase },
      })
    })
  },

  async list(ctx: ScopedContext, input: { projectId: string }): Promise<DalReturn<ProjectMediaFile[]>> {
    return dalDbOperation(async () => {
      if (!(await permit(ctx, 'read', projectServerSpec).probe(input.projectId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      return dalVerifySuccess(await mediaService.list(projectMediaStore, permit(ctx, 'read', projectMediaServerSpec).sql, input.projectId)) as ProjectMediaFile[]
    })
  },

  async reorder(ctx: ScopedContext, input: { updates: { id: number, sortOrder: number }[] }): Promise<DalReturn<void>> {
    return mediaService.reorder(projectMediaStore, permit(ctx, 'update', projectMediaServerSpec).sql, input.updates)
  },

  async retryOptimization(ctx: ScopedContext, input: { id: number }): Promise<DalReturn<void>> {
    return dalDbOperation(async () => {
      if (!(await permit(ctx, 'update', projectMediaServerSpec).probe(input.id))) {
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
   * Copy proposal media onto this project. The actor must be able to change the project's media, and only media they read on proposals of this project's meetings is copied.
   */
  async importFromProposal(
    ctx: ScopedContext,
    input: { projectId: string, proposalMediaFileIds: number[] },
  ): Promise<DalReturn<{ imported: number }>> {
    return dalDbOperation(async () => {
      if (!(await permit(ctx, 'update', projectServerSpec, ['media']).probe(input.projectId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      const sources = await listImportableProjectMedia(ctx, input.projectId, input.proposalMediaFileIds)
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
