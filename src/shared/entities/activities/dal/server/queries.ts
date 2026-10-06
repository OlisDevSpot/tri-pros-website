import type { SQL } from 'drizzle-orm'
import type z from 'zod'

import type { PaginatedResult } from '@/shared/dal/lib/query/paginated-result'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'

import { and, count, eq, getTableColumns } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { fieldListInput } from '@/shared/dal/server/lib/query/field-list-input'
import { paginate } from '@/shared/dal/server/lib/query/output'
import { buildSearchWhere } from '@/shared/dal/server/lib/query/search'
import { db } from '@/shared/db'
import { activities } from '@/shared/db/schema/activities'
import { user } from '@/shared/db/schema/auth'
import { ACTIVITY_FIELDS } from '@/shared/entities/activities/dal/activity-fields'
import { ACTIVITY_FIELD_SQL } from '@/shared/entities/activities/dal/server/activity-field-sql'

export const activityListInputSchema = fieldListInput(ACTIVITY_FIELDS, { pagination: true })
export type ActivityListInput = z.infer<typeof activityListInputSchema>

export type ActivityListRow = typeof activities.$inferSelect & { ownerName: string | null, ownerImage: string | null }

// Agents see only their own activities; omni and system callers see all. No user on a scoped caller matches nothing.
function activityOwnerScope(ctx: ScopedContext): SQL | undefined {
  if (ctx.actor.ability.can('manage', 'all')) {
    return undefined
  }
  return eq(activities.ownerId, ctx.actor.userId ?? '')
}

export async function listActivities(ctx: ScopedContext, input: ActivityListInput): Promise<DalReturn<PaginatedResult<ActivityListRow>>> {
  return dalDbOperation(async () => {
    const where = and(
      activityOwnerScope(ctx),
      buildSearchWhere(input.search, [activities.title, activities.description]),
      ACTIVITY_FIELD_SQL.where(input.filters),
    )

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
        .orderBy(...ACTIVITY_FIELD_SQL.orderBy(input.sort))
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
  })
}
