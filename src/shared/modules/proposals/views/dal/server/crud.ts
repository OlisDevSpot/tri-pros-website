import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { proposalViewServerSpec } from '@/shared/modules/proposals/views/server-spec'

/**
 * CRUD handlers for proposal views. No config factory: a view has no derived
 * fields, no lock, no rollup. `create` is the ONLY slot the views service exposes
 * (append-only event log); the rest exist because the engine produces them, and
 * stay reachable here for scripts and repair paths.
 */
export const proposalViewCrud = createCrudDal(proposalViewServerSpec)
