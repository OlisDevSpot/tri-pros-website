// Proposal media service — the `proposal_media_files` child: the agent-side
// gallery behind the proposal. The ROW LIFECYCLE (optimize dispatch, R2 purge)
// belongs to this unit's CRUD hooks (dal/server/crud.ts, C32), so the spread
// `create`/`delete` below already carry it on every origin. What lives here is
// the proposal-side AUTHORIZATION the DAL cannot express, plus the store binding
// for the shared media verbs.
//
//   ...proposalMediaCrud   the engine's five slots on the service itself (serial int PK)
//   create   (override)    parent-visibility probe → engine create (the create hook
//                          dispatches optimize). The engine's bare `create` has no
//                          WHERE to scope an insert, so the probe IS the create-side
//                          authorization for this child.
//   delete                 engine slot — the delete hook purges R2 first. An already
//                          deleted or out-of-scope row is `not-found`, not a no-op.
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
      return dalVerifySuccess(await proposalMediaCrud.create(ctx, input)) as ProposalMediaFile
    })
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
