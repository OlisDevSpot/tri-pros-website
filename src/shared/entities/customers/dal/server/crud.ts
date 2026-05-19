import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'

/** Stable CRUD handlers for the customers entity. Single instance, fully typed. */
export const customerCrud = createCrudDal(customerServerSpec)
