import { createTRPCRouter } from '../init'
import { tradesRouter } from './trades.router'

export const constructionRouter = createTRPCRouter({
  tradesRouter,
})
