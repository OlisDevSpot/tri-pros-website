import { TRPCError } from '@trpc/server'
import { and, count, desc, eq, getTableColumns, gte, ilike, inArray, lte, or } from 'drizzle-orm'
import z from 'zod'

import { activityEntityTypes, activityTypes, gcalSyncableActivityTypes } from '@/shared/constants/enums'
import { buildFilterWhere } from '@/shared/dal/server/query/filters'
import { paginate } from '@/shared/dal/server/query/output'
import { dateRangeSchema, paginatedQueryInput } from '@/shared/dal/server/query/schemas'
import { buildOrderBy } from '@/shared/dal/server/query/sort'
import { db } from '@/shared/db'
import { activities, user } from '@/shared/db/schema'
import { schedulingService } from '@/shared/services/scheduling.service'
import { agentProcedure, createTRPCRouter } from '@/trpc/init'

export const activitiesRouter = createTRPCRouter({
  // Server-paginated activities list. Drives the Activities table; the schedule
  // calendar consumes this with a larger pagination.limit until it pushes a
  // date-windowed scheduledFor filter through the toolkit.
  //
  // Filters (URL-driven via the query toolkit):
  //   type:        multi-select on activities.type
  //   entityType:  multi-select on activities.entityType
  //   scheduledFor: date-range
  //   ownerId:     multi-select on activities.ownerId
  //
  // Search: ilike against activities.title OR activities.description.
  // Sort whitelist: title, type, scheduledFor, dueAt, createdAt.
  // Default order: createdAt DESC.
  list: agentProcedure
    .input(paginatedQueryInput({
      type: z.array(z.enum(activityTypes)).optional(),
      entityType: z.array(z.enum(activityEntityTypes)).optional(),
      scheduledFor: dateRangeSchema.optional(),
      ownerId: z.array(z.string().uuid()).optional(),
    }))
    .query(async ({ ctx, input }) => {
      const isOmni = ctx.ability.can('manage', 'all')

      const baseScope = isOmni ? undefined : eq(activities.ownerId, ctx.session.user.id)

      const searchTerm = input.search?.trim()
      const searchWhere = searchTerm
        ? or(
            ilike(activities.title, `%${searchTerm}%`),
            ilike(activities.description, `%${searchTerm}%`),
          )
        : undefined

      const filterWhere = buildFilterWhere(input.filters, {
        type: v => (v.length > 0 ? inArray(activities.type, v) : undefined),
        entityType: v => (v.length > 0 ? inArray(activities.entityType, v) : undefined),
        scheduledFor: v => and(
          v.from ? gte(activities.scheduledFor, v.from) : undefined,
          v.to ? lte(activities.scheduledFor, v.to) : undefined,
        ),
        ownerId: v => (v.length > 0 ? inArray(activities.ownerId, v) : undefined),
      })

      const where = and(baseScope, searchWhere, filterWhere)

      const orderBy = buildOrderBy(input.sort, {
        title: activities.title,
        type: activities.type,
        scheduledFor: activities.scheduledFor,
        dueAt: activities.dueAt,
        createdAt: activities.createdAt,
      }, desc(activities.createdAt))

      return paginate({
        query: () => db
          .select({
            ...getTableColumns(activities),
            ownerName: user.name,
            ownerImage: user.image,
          })
          .from(activities)
          .leftJoin(user, eq(user.id, activities.ownerId))
          .where(where)
          .orderBy(...orderBy)
          .limit(input.pagination.limit)
          .offset(input.pagination.offset),
        count: async () => {
          const [row] = await db
            .select({ c: count(activities.id) })
            .from(activities)
            .where(where)
          return row?.c ?? 0
        },
      })
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
