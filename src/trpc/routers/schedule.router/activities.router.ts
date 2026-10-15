import z from 'zod'

import { activityEntityTypes, activityTypes, gcalSyncableActivityTypes } from '@/shared/constants/enums'
import { activityCrud } from '@/shared/entities/activities/dal/server/crud'
import { activityListInputSchema, listActivities } from '@/shared/entities/activities/dal/server/queries'
import { isWholeLink } from '@/shared/entities/activities/lib/server-spec'
import { schedulingService } from '@/shared/services/scheduling.service'
import { agentProcedure, createTRPCRouter } from '@/trpc/init'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

const WHOLE_LINK = { message: 'A linked record needs its type and its id together.' }

export const activitiesRouter = createTRPCRouter({
  list: agentProcedure
    .input(activityListInputSchema)
    .query(async ({ ctx, input }) => dalToTrpc(await listActivities(ctx, input))),

  create: agentProcedure
    .input(z.object({
      type: z.enum(activityTypes),
      title: z.string().min(1),
      description: z.string().optional(),
      entityType: z.enum(activityEntityTypes).optional(),
      entityId: z.string().uuid().optional(),
      scheduledFor: z.string().optional(),
      dueAt: z.string().optional(),
      metaJSON: z.record(z.string(), z.unknown()).optional(),
    }).refine(isWholeLink, WHOLE_LINK))
    .mutation(async ({ ctx, input }) => {
      const created = dalToTrpc(await activityCrud.create(ctx, input))

      const isSyncable = (gcalSyncableActivityTypes as readonly string[]).includes(created.type)
        && !!created.scheduledFor
      if (isSyncable) {
        await schedulingService
          .syncActivity(ctx.session.user.id, created.id)
          .catch(() => {})
      }

      return created
    }),

  update: agentProcedure
    .input(z.object({
      id: z.string().uuid(),
      type: z.enum(activityTypes).optional(),
      title: z.string().min(1).optional(),
      description: z.string().optional(),
      entityType: z.enum(activityEntityTypes).optional(),
      entityId: z.string().uuid().optional(),
      scheduledFor: z.string().optional(),
      dueAt: z.string().optional(),
      metaJSON: z.record(z.string(), z.unknown()).optional(),
    }).refine(isWholeLink, WHOLE_LINK))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input
      const updated = dalToTrpc(await activityCrud.update(ctx, { id, data }))

      await schedulingService
        .syncActivity(ctx.session.user.id, updated.id)
        .catch(() => {})

      return updated
    }),

  complete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) =>
      dalToTrpc(await activityCrud.update(ctx, { id: input.id, data: { completedAt: new Date().toISOString() } }))),

  delete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      dalToTrpc(await activityCrud.delete(ctx, { id: input.id }))
      return { deleted: true }
    }),
})
