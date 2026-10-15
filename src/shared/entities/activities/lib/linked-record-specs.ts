import type { ActivityEntityType } from '@/shared/constants/enums'

import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { projectServerSpec } from '@/shared/modules/projects/core/server-spec'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'

/** The entity each activity link type points at, so the read filter and the write probe follow the same rules. */
export const LINKED_RECORD_SPECS = {
  customer: customerServerSpec,
  meeting: meetingServerSpec,
  project: projectServerSpec,
  proposal: proposalServerSpec,
} as const satisfies Record<ActivityEntityType, unknown>
