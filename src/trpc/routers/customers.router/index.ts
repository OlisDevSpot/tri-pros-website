import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { createEntityRouter } from '../../lib/create-entity-router'
import { createCustomerBusinessRouter } from './business.router'

export const customersRouter = createEntityRouter(customerServerSpec, (entity) => {
  return createTRPCRouter({
    business: createCustomerBusinessRouter(entity),
  })
})
