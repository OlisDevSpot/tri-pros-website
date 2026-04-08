import { createTRPCRouter } from '../../init'
import { contractsRouter } from './contracts.router'
import { crudRouter } from './crud.router'
import { deliveryRouter } from './delivery.router'

export const proposalsRouter = createTRPCRouter({
  crud: crudRouter,
  delivery: deliveryRouter,
  contracts: contractsRouter,
})
