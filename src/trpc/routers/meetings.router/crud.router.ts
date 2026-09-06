// ─── Meetings CRUD Router ────────────────────────────────────────────────────
// The 5 single-row operations. Plain leaf: createCrudRouter builds its scoped
// procedures inline from the spec (no createEntityRouter, no cast — epic S6a).
// spec.hooks fire pipeline derivation + GCal/Ably sync on write.

import z from 'zod'

import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { meetingSchemas, meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

import { createCrudRouter } from '../../lib/create-crud-router'
import { resolveTrpcActorScope } from '../../lib/middleware/resolve-trpc-actor-scope'

export const crudRouter = createCrudRouter({
  spec: meetingServerSpec,
  schemas: { ...meetingSchemas, id: z.string().uuid() },
  crud: meetingCrud,
  // Phase-7 Track B, unit 7a: flip the meeting CRUD leaf off the legacy engine
  // onto the CASL compiler — the SAME resolver its sibling read routers
  // (reads/participants/business, via `meetingProcedure`) already run, so this
  // introduces no new predicate for agents. Parity: agent `via:'self'` compiles
  // byte-for-byte to legacy `userParticipatesInMeeting`; omni → null both sides.
  // Dispatcher is an intended widening (participation ≈ ∅ since their bookings
  // are system-owned → CASL `can('read','Meeting')` unconditional) — reconciles
  // the crud leaf with the reads path + the Task-2 grant, and fixes a dispatcher
  // being unable to getById/update the very meeting they booked. No own-record
  // hook on Meeting (write hooks are pipeline/GCal/Ably side-effects), so no
  // Grill-C entanglement.
  //
  // NB: `meetingVisibility` is NOT dead after this flip — it stays live via the
  // legacy bridge from `applications` (parent→meeting, still on the legacy
  // factory; dies at 7c) and `buildUserContext(meetingServerSpec)`
  // (meeting-flow.router / projects business.router; die at 7e). It is deleted
  // in Phase 8 once its last legacy consumer is flipped.
  resolveScope: resolveTrpcActorScope,
})
