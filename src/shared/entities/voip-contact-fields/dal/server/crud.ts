import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { voipContactFieldServerSpec } from '@/shared/entities/voip-contact-fields/lib/server-spec'

/** Stable CRUD handlers for the voip-contact-fields entity. Single instance, fully typed. */
export const voipContactFieldCrud = createCrudDal(voipContactFieldServerSpec)
