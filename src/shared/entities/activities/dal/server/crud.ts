import type { ActivityEntityType } from '@/shared/constants/enums'
import type { ScopedContext } from '@/shared/dal/server/types'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { LINKED_RECORD_SPECS } from '@/shared/entities/activities/lib/linked-record-specs'
import { activityServerSpec } from '@/shared/entities/activities/lib/server-spec'

// The linked id comes from the client, so it is probed through the writer's own read rules before it is
// stored: an activity cannot point at a record its owner may not see. A system write links nothing.
async function assertLinkInReach(ctx: ScopedContext, link: { entityType?: ActivityEntityType | null, entityId?: string | null }): Promise<void> {
  if (ctx.actor.userId === null || link.entityType == null || link.entityId == null) {
    return
  }
  if (!(await permit(ctx, 'read', LINKED_RECORD_SPECS[link.entityType]).probe(link.entityId))) {
    throw new ThrowableDalError({ type: 'not-found' })
  }
}

export const activityCrud = createCrudDal(activityServerSpec, () => ({
  hooks: {
    create: {
      // Whoever acts owns what they create; a system caller passes the owner it acts for.
      before: async (input, ctx) => {
        await assertLinkInReach(ctx, input)
        return { ...input, ownerId: ctx.actor.userId ?? input.ownerId }
      },
    },
    update: {
      before: async (data, ctx) => {
        await assertLinkInReach(ctx, data)
        return data
      },
    },
  },
}))
