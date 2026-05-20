import z from 'zod'

import { meetingSchemas, meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { createCrudRouter } from '../../lib/create-crud-router'
import { createEntityRouter } from '../../lib/create-entity-router'
import { createParticipantsRouter } from './participants.router'
import { createMeetingReadsRouter } from './reads.router'

export const meetingsRouter = createEntityRouter(meetingServerSpec, (entity) => {
  return createTRPCRouter({
    crud: createCrudRouter({
      spec: meetingServerSpec,
      schemas: { ...meetingSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
    }),
    reads: createMeetingReadsRouter(entity),
    participants: createParticipantsRouter(entity),
  })
})
