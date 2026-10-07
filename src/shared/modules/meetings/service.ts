// @migration(modules-consolidation): the meetings core (crud, schemas, components, hooks) still lives in
// src/shared/entities/meetings. It moves to ./core when entities/ folds into modules/; this file and its
// children stay where they are, and only the import paths below change.

import type { SpecCrudHandlers } from '@/shared/dal/server/types'
import type { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { getRescheduleChain } from '@/shared/entities/meetings/dal/server/queries'

import { meetingBusinessService } from './business/service'
import { meetingMessageService } from './messages/service'

export const meetingService = {
  ...meetingCrud,

  // A getter: `satisfies SpecCrudHandlers` rejects an extra data property on the literal but not an accessor.
  get queries() {
    return { getRescheduleChain }
  },

  // A getter, not a property: a child that reaches a peer service would otherwise be read while this literal is still being built.
  get business() {
    return meetingBusinessService
  },

  get messages() {
    return meetingMessageService
  },
} satisfies SpecCrudHandlers<typeof meetingServerSpec>

export type MeetingService = typeof meetingService
