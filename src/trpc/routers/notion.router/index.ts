import { revalidateTag } from 'next/cache'

import { agentProcedure, createTRPCRouter } from '@/trpc/init'
import { contactsRouter } from './contacts.router'
import { scopesRouter } from './scopes.router'
import { tradesRouter } from './trades.router'

export const notionRouter = createTRPCRouter({
  trades: tradesRouter,
  scopes: scopesRouter,
  contacts: contactsRouter,
  revalidateNotionCache: agentProcedure.mutation(async () => {
    revalidateTag('notion-trades')
    revalidateTag('notion-scopes')
    return { success: true, revalidatedAt: new Date().toISOString() }
  }),
})
