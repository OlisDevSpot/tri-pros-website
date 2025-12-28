import { createTRPCRouter } from '../init'
import { tradesRouter } from './trades.router'

export const proposalRouter = createTRPCRouter({
  tradesRouter,
})
