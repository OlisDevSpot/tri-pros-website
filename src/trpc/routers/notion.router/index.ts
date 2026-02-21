import { createTRPCRouter } from '@/trpc/init'
import { contactsRouter } from './contacts.router'
import { scopesRouter } from './scopes.router'
import { tradesRouter } from './trades.router'

export const notionRouter = createTRPCRouter({
  trades: tradesRouter,
  scopes: scopesRouter,
  contacts: contactsRouter,
})
