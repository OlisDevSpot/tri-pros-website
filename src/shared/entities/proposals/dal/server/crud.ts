import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'

/** Stable CRUD handlers for the proposals entity. Single instance, fully typed. */
export const proposalCrud = createCrudDal(proposalServerSpec)
