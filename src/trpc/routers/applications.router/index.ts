import z from 'zod'

import { saveDraft, submitApplication, withdraw } from '@/shared/entities/applications/dal/server/mutations'
import {
  applicationListInputSchema,
  getApplicationWithAnswers,
  listApplications,
} from '@/shared/entities/applications/dal/server/queries'
import { applicationSchemas, applicationServerSpec } from '@/shared/entities/applications/lib/server-spec'
import { applicationDraftSchema } from '@/shared/entities/applications/schemas'

import { createTRPCRouter } from '../../init'
import { createCrudRouter } from '../../lib/create-crud-router'
import { createEntityRouter } from '../../lib/create-entity-router'
import { dalToTrpc } from '../../lib/dal-to-trpc'

export const applicationsRouter = createEntityRouter(applicationServerSpec, (entity) => {
  return createTRPCRouter({
    // ── CRUD (create = agent starts a draft; status defaults to 'draft') ──
    crud: createCrudRouter({
      spec: applicationServerSpec,
      schemas: { ...applicationSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
    }),

    // ── Business reads ────────────────────────────────────────────────────
    business: createTRPCRouter({
      list: entity.authedProcedure
        .input(applicationListInputSchema)
        .query(async ({ ctx, input }) => {
          return dalToTrpc(await listApplications(ctx, input))
        }),

      getWithAnswers: entity.authedProcedure
        .input(z.object({ applicationId: z.string().uuid() }))
        .query(async ({ ctx, input }) => {
          return dalToTrpc(await getApplicationWithAnswers(ctx, input))
        }),
    }),

    // ── Draft lifecycle (agent + homeowner via the engine) ────────────────
    draft: createTRPCRouter({
      // Autosave target — sub-project #2's DB StepPersistenceAdapter calls this.
      save: entity.authedProcedure
        .input(z.object({
          applicationId: z.string().uuid(),
          state: applicationDraftSchema,
        }))
        .mutation(async ({ ctx, input }) => {
          return dalToTrpc(await saveDraft(ctx, input))
        }),

      submit: entity.authedProcedure
        .input(z.object({ applicationId: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
          return dalToTrpc(await submitApplication(ctx, input))
        }),

      withdraw: entity.authedProcedure
        .input(z.object({ applicationId: z.string().uuid() }))
        .mutation(async ({ ctx, input }) => {
          return dalToTrpc(await withdraw(ctx, input))
        }),
    }),
  })
})
