import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { customerNoteServerSpec } from '@/shared/entities/customer-notes/lib/server-spec'

/** Stable CRUD handlers for the customer-notes entity. Single instance, fully typed. */
export const customerNoteCrud = createCrudDal(customerNoteServerSpec)
