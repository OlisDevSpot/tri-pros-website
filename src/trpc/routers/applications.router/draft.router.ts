// ─── Applications Draft Lifecycle ────────────────────────────────────────────
// Autosave + submit + withdraw (agent + homeowner via the engine). Plain leaf
// importing the pre-scoped applicationProcedure from ./procedures. `save` is
// the target of sub-project #2's DB StepPersistenceAdapter.

import z from 'zod'

import { saveDraft, submitApplication, withdraw } from '@/shared/entities/applications/dal/server/mutations'
import { applicationDraftSchema } from '@/shared/entities/applications/schemas'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { applicationProcedure } from './procedures'

export const draftRouter = createTRPCRouter({
  save: applicationProcedure
    .input(z.object({
      applicationId: z.string().uuid(),
      state: applicationDraftSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await saveDraft(ctx, input))
    }),

  submit: applicationProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await submitApplication(ctx, input))
    }),

  withdraw: applicationProcedure
    .input(z.object({ applicationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await withdraw(ctx, input))
    }),
})
