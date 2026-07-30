import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { applicationServerSpec } from '@/shared/entities/applications/lib/server-spec'

/** Stable CRUD handlers for the applications entity. Single instance, fully typed. */
export const applicationCrud = createCrudDal(applicationServerSpec)
