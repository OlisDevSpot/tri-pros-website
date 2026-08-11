// ─── Applications Business Reads ─────────────────────────────────────────────
// Paginated list + single application-with-answers. Plain leaf importing the
// pre-scoped applicationProcedure from ./procedures.

import z from 'zod'
import {
  applicationListInputSchema,
  getApplicationWithAnswers,
  listApplications,
} from '@/shared/entities/applications/dal/server/queries'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { applicationProcedure } from './procedures'

export const businessRouter = createTRPCRouter({
  list: applicationProcedure
    .input(applicationListInputSchema)
    .query(async ({ ctx, input }) => {
      return dalToTrpc(await listApplications(ctx, input))
    }),

  getWithAnswers: applicationProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return dalToTrpc(await getApplicationWithAnswers(ctx, input))
    }),
})
