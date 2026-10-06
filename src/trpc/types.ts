// ─── tRPC Types ─────────────────────────────────────────────────────────────
// tRPC-specific context types + re-exports of shared DAL types.
//
// DAL-layer types (ScopedContext, CrudHandlers, etc.) are
// canonical in `shared/dal/server/types.ts`. This file re-exports them
// so existing tRPC consumers don't break, and adds tRPC-specific context
// types (BaseTRPCContext, HTTPTRPCContext).

import type { SQL } from 'drizzle-orm'

import type { BetterAuthSession } from '@/shared/domains/auth/server'
import type { Actor } from '@/shared/domains/permissions/actor'

// ── Re-exports from DAL types (canonical source) ────────────────────────
// Consumers can import from either location. Prefer `@/shared/dal/server/types`
// for new DAL code; `@/trpc/types` for tRPC layer code.

export type {
  CrudHandlers,
  DalError,
  DalReturn,
  ScopedContext,
  SlotName,
} from '@/shared/dal/server/types'

export {
  dalError,
  dalSuccess,
  SYSTEM_CONTEXT,
  ThrowableDalError,
} from '@/shared/dal/server/types'

/** What every procedure starts with. `protectedProcedure` narrows `session` to non-null; nothing rebuilds the actor. */
export interface BaseTRPCContext {
  session: BetterAuthSession | null
  actor: Actor
  /** The row filter a per-entity procedure resolves. `null` = unrestricted. */
  scope: SQL | null
}

export interface HTTPTRPCContext extends BaseTRPCContext {
  req?: Request
  resHeaders: Headers
}
