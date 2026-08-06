import z from 'zod'

import { customerNoteSchemas, customerNoteServerSpec } from '@/shared/entities/customer-notes/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { createCrudRouter } from '../../lib/create-crud-router'
import { createEntityRouter } from '../../lib/create-entity-router'

export const customerNotesRouter = createEntityRouter(customerNoteServerSpec, (entity) => {
  return createTRPCRouter({
    crud: createCrudRouter({
      spec: customerNoteServerSpec,
      schemas: { ...customerNoteSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
    }),
  })
})
