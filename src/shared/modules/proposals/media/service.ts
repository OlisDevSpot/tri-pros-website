// Proposal media service — the `proposal_media_files` child: the agent-side
// gallery behind the proposal. The R2 object lifecycle and optimize dispatch
// belong to the shared `mediaService` (one implementation for every media child);
// this service BINDS that peer to `proposalMediaStore` and puts the proposal-side
// gates in front of it, so every origin gets the same behaviour.
//
//   ...proposalMediaCrud   the engine's five slots on the service itself (serial int PK)
//   create   (override)    parent-visibility probe → engine create → optimize dispatch
//                          for image/pdf rows. The engine's bare `create` has no
//                          WHERE to scope an insert, so the probe IS the create-side
//                          authorization for this child.
//   delete   (override)    R2 objects + variants purged, then scoped delete. Missing
//                          or invisible row ⇒ idempotent no-op. The engine's bare
//                          `delete` would orphan the objects.
//   update                 engine slot as-is (visibility, name — media is lock-exempt
//                          by design, see ../core/DOCS.md#proposal-media)
//   buildUploadTarget      parent-visibility probe → presigned R2 PUT
//   list                   parent-visibility probe → scoped rows by owner (ALL visibilities;
//                          the homeowner-only projection lives on the parent's getFullView)
//   reorder                one scoped transaction (the reorder N+1 kill)
//   retryOptimization      own-row probe → reset status → optimize dispatch
//
// Scope note (pre-#285): a media-scoped ctx carries the CHILD bridge in `ctx.scope`,
// so own-row probes use this service's `getById` while PARENT probes use
// `isVisible(proposalServerSpec, …)`, which re-resolves the parent's scope from
// its spec. #285 D-16 makes every slot self-scope off `ctx.actor.ability` and both
// probes collapse into the engine.
// see ../core/DOCS.md#proposal-media

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { ProposalMediaFile } from '@/shared/db/schema/proposal-media-files'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { isVisible } from '@/shared/dal/server/lib/scope'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { mediaService } from '@/shared/modules/media/service'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalMediaCrud } from '@/shared/modules/proposals/media/dal/server/crud'
import { proposalMediaStore } from '@/shared/modules/proposals/media/store'

type CreateProposalMediaInput = Parameters<typeof proposalMediaCrud.create>[1]

async function assertParentVisible(ctx: ScopedContext, proposalId: string): Promise<void> {
  if (!(await isVisible(proposalServerSpec, ctx, proposalId))) {
    throw new ThrowableDalError({ type: 'not-found' })
  }
}

export const proposalMediaService = {
  ...proposalMediaCrud,

  async create(ctx: ScopedContext, input: CreateProposalMediaInput): Promise<DalReturn<ProposalMediaFile>> {
    return dalDbOperation(async () => {
      await assertParentVisible(ctx, input.proposalId)
      return dalVerifySuccess(await mediaService.createRecord(proposalMediaStore, ctx, input)) as ProposalMediaFile
    })
  },

  async delete(ctx: ScopedContext, input: { id: number }): Promise<DalReturn<void>> {
    return mediaService.removeRecord(proposalMediaStore, ctx, input.id)
  },

  async buildUploadTarget(
    ctx: ScopedContext,
    input: { proposalId: string, filename: string, mimeType: string },
  ): Promise<DalReturn<{ uploadUrl: string, pathKey: string, bucket: string }>> {
    return dalDbOperation(async () => {
      await assertParentVisible(ctx, input.proposalId)
      return mediaService.buildUploadTarget(proposalMediaStore, {
        ownerId: input.proposalId,
        filename: input.filename,
        mimeType: input.mimeType,
      })
    })
  },

  async list(ctx: ScopedContext, input: { proposalId: string }): Promise<DalReturn<ProposalMediaFile[]>> {
    return dalDbOperation(async () => {
      await assertParentVisible(ctx, input.proposalId)
      return dalVerifySuccess(await mediaService.list(proposalMediaStore, ctx, input.proposalId)) as ProposalMediaFile[]
    })
  },

  async reorder(ctx: ScopedContext, input: { updates: { id: number, sortOrder: number }[] }): Promise<DalReturn<void>> {
    return mediaService.reorder(proposalMediaStore, ctx, input.updates)
  },

  async retryOptimization(ctx: ScopedContext, input: { id: number }): Promise<DalReturn<void>> {
    return dalDbOperation(async () => {
      const row = dalVerifySuccess(await proposalMediaService.getById(ctx, { id: input.id }))
      if (!row) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      await mediaService.retryOptimization(proposalMediaStore, input.id)
    })
  },
} as const

export type ProposalMediaService = typeof proposalMediaService
