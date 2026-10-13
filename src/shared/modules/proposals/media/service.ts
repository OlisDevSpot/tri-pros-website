// Proposal media service — the `proposal_media_files` child: the agent-side
// gallery behind the proposal. The ROW LIFECYCLE (optimize dispatch, R2 purge)
// belongs to this unit's CRUD hooks (dal/server/crud.ts), so the spread
// `create`/`delete` below already carry it on every origin. The spread `create`
// probes the proposal's `update` of `media` before it inserts.

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { ProposalMediaFile } from '@/shared/db/schema/proposal-media-files'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { mediaService } from '@/shared/modules/media/service'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalMediaCrud } from '@/shared/modules/proposals/media/dal/server/crud'
import { proposalMediaServerSpec } from '@/shared/modules/proposals/media/server-spec'
import { proposalMediaStore } from '@/shared/modules/proposals/media/store'

export const proposalMediaService = {
  ...proposalMediaCrud,

  async buildUploadTarget(
    ctx: ScopedContext,
    input: { proposalId: string, filename: string, mimeType: string },
  ): Promise<DalReturn<{ uploadUrl: string, pathKey: string, bucket: string }>> {
    return dalDbOperation(async () => {
      if (!(await permit(ctx, 'update', proposalServerSpec, ['media']).probe(input.proposalId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      return mediaService.buildUploadTarget(proposalMediaStore, { ownerId: input.proposalId, filename: input.filename, mimeType: input.mimeType })
    })
  },

  async list(ctx: ScopedContext, input: { proposalId: string }): Promise<DalReturn<ProposalMediaFile[]>> {
    return dalDbOperation(async () => {
      if (!(await permit(ctx, 'read', proposalServerSpec).probe(input.proposalId))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      return dalVerifySuccess(await mediaService.list(proposalMediaStore, permit(ctx, 'read', proposalMediaServerSpec).sql, input.proposalId)) as ProposalMediaFile[]
    })
  },

  async reorder(ctx: ScopedContext, input: { updates: { id: number, sortOrder: number }[] }): Promise<DalReturn<void>> {
    return mediaService.reorder(proposalMediaStore, permit(ctx, 'update', proposalMediaServerSpec).sql, input.updates)
  },

  async retryOptimization(ctx: ScopedContext, input: { id: number }): Promise<DalReturn<void>> {
    return dalDbOperation(async () => {
      if (!(await permit(ctx, 'update', proposalMediaServerSpec).probe(input.id))) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      await mediaService.retryOptimization(proposalMediaStore, input.id)
    })
  },
} as const

export type ProposalMediaService = typeof proposalMediaService
