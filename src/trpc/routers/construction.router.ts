import { createTRPCRouter } from '../init'
import { tradesRouter } from './notion.router/trades.router'

export const constructionRouter = createTRPCRouter({
  tradesRouter,
})
