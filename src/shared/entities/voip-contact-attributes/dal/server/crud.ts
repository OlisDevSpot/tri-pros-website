import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { voipContactAttributeServerSpec } from '@/shared/entities/voip-contact-attributes/lib/server-spec'

/** Stable CRUD handlers for the voip-contact-attributes entity. Single instance, fully typed. */
export const voipContactAttributeCrud = createCrudDal(voipContactAttributeServerSpec)
