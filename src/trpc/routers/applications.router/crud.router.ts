// ─── Applications CRUD Router ────────────────────────────────────────────────
// The 5 single-row operations (create = agent starts a draft; status defaults
// to 'draft'). Plain leaf: createCrudRouter builds its scoped procedures inline
// from the spec (no createEntityRouter, no cast — epic S6a).

import z from 'zod'

import { applicationSchemas, applicationServerSpec } from '@/shared/entities/applications/lib/server-spec'

import { createCrudRouter } from '../../lib/create-crud-router'

export const crudRouter = createCrudRouter({
  spec: applicationServerSpec,
  schemas: { ...applicationSchemas, id: z.string().uuid() },
})
