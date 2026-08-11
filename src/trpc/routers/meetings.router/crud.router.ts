// ─── Meetings CRUD Router ────────────────────────────────────────────────────
// The 5 single-row operations. Plain leaf: createCrudRouter builds its scoped
// procedures inline from the spec (no createEntityRouter, no cast — epic S6a).
// spec.hooks fire pipeline derivation + GCal/Ably sync on write.

import z from 'zod'

import { meetingSchemas, meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

import { createCrudRouter } from '../../lib/create-crud-router'

export const crudRouter = createCrudRouter({
  spec: meetingServerSpec,
  schemas: { ...meetingSchemas, id: z.string().uuid() },
})
