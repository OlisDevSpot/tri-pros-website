import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  insertMeetingSchema,
  meetings,
  selectMeetingSchema,
} from '@/shared/db/schema'
import { OUTCOME_PIPELINE_MAP } from '@/shared/domains/pipelines/lib/outcome-pipeline-map'
import { MEETING } from '@/shared/entities/meetings/lib/constants'
import { meetingVisibility } from '@/shared/entities/meetings/lib/visibility'

const updateMeetingSchema = insertMeetingSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference. */
export const meetingSchemas = {
  insert: insertMeetingSchema,
  update: updateMeetingSchema,
}

export const meetingServerSpec = {
  entityName: MEETING,
  caslSubject: MEETING,
  visibility: meetingVisibility,
  table: meetings,
  schemas: {
    insert: insertMeetingSchema,
    update: updateMeetingSchema,
    select: selectMeetingSchema,
  },
  hooks: {
    // see ../DOCS.md#meeting-pipeline-storage-vs-derived
    beforeUpdate(data) {
      if (data.meetingOutcome) {
        const pipeline = OUTCOME_PIPELINE_MAP[data.meetingOutcome]
        if (pipeline != null) {
          return { ...data, pipeline }
        }
      }
      return data
    },
    // see ../DOCS.md#duplicate-cherry-picks-setup-fields
    beforeDuplicate(source) {
      return {
        ownerId: source.ownerId,
        customerId: source.customerId,
        meetingType: source.meetingType,
        scheduledFor: source.scheduledFor ?? undefined,
        contextJSON: source.contextJSON,
      }
    },
  },
} satisfies EntityServerSpec<typeof meetings>
