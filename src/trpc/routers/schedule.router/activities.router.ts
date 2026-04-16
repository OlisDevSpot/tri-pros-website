import { TRPCError } from '@trpc/server'
import { desc, eq, getTableColumns } from 'drizzle-orm'
import z from 'zod'

import { activityEntityTypes, activityTypes, gcalSyncableActivityTypes } from '@/shared/constants/enums'
import { db } from '@/shared/db'
import { activities, user } from '@/shared/db/schema'
import { schedulingService } from '@/shared/services/scheduling.service'
import { agentProcedure, createTRPCRouter } from '@/trpc/init'

export const activitiesRouter = createTRPCRouter({
  getAll: agentProcedure
    .query(async ({ ctx }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      return db
        .select({
          ...getTableColumns(activities),
          ownerName: user.name,
          ownerImage: user.image,
        })
        .from(activities)
        .leftJoin(user, eq(user.id, activities.ownerId))
        .where(isOmni ? undefined : eq(activities.ownerId, ctx.session.user.id))
        .orderBy(desc(activities.createdAt))
    }),

  getById: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const [row] = await db
        .select({
          ...getTableColumns(activities),
          ownerName: user.name,
          ownerImage: user.image,
        })
        .from(activities)
        .leftJoin(user, eq(user.id, activities.ownerId))
        .where(eq(activities.id, input.id))

      return row ?? null
    }),

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
    }))
    .mutation(async ({ ctx, input }) => {
      const [created] = await db
        .insert(activities)
        .values({
          ...input,
          ownerId: ctx.session.user.id,
        })
        .returning()

      if (!created) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to create activity' })
      }

      const isSyncable = (gcalSyncableActivityTypes as readonly string[]).includes(created.type)
        && !!created.scheduledFor
      if (isSyncable) {
        await schedulingService
          .pushToGCal(ctx.session.user.id, 'activity', created.id)
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
    }))
    .mutation(async ({ ctx, input }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const { id, ...rest } = input

      if (!isOmni) {
        const [existing] = await db
          .select({ ownerId: activities.ownerId })
          .from(activities)
          .where(eq(activities.id, id))

        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' })
        }

        if (existing.ownerId !== ctx.session.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update this activity' })
        }
      }

      const [updated] = await db
        .update(activities)
        .set(rest)
        .where(eq(activities.id, id))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' })
      }

      await schedulingService
        .pushToGCal(ctx.session.user.id, 'activity', updated.id)
        .catch(() => {})

      return updated
    }),

  complete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [updated] = await db
        .update(activities)
        .set({ completedAt: new Date().toISOString() })
        .where(eq(activities.id, input.id))
        .returning()

      if (!updated) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' })
      }

      return updated
    }),

  delete: agentProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const isOmni = ctx.ability.can('manage', 'all')

      if (!isOmni) {
        const [existing] = await db
          .select({ ownerId: activities.ownerId })
          .from(activities)
          .where(eq(activities.id, input.id))

        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' })
        }

        if (existing.ownerId !== ctx.session.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to delete this activity' })
        }
      }

      await db.delete(activities).where(eq(activities.id, input.id))

      return { deleted: true }
    }),
})
