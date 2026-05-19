// ─── tRPC Types ─────────────────────────────────────────────────────────────
// tRPC-specific context types + re-exports of shared DAL types.
//
// DAL-layer types (ScopedContext, EntityServerSpec, CrudHandlers, etc.) are
// canonical in `shared/dal/server/lib/types.ts`. This file re-exports them
// so existing tRPC consumers don't break, and adds tRPC-specific context
// types (BaseTRPCContext, AuthedContext, HTTPTRPCContext).

import type { SQL } from 'drizzle-orm'

import type { BetterAuthSession } from '@/shared/domains/auth/server'
import type { AppAbility } from '@/shared/domains/permissions/types'

// ── Re-exports from DAL types (canonical source) ────────────────────────
// Consumers can import from either location. Prefer `@/shared/dal/server/types`
// for new DAL code; `@/trpc/types` for tRPC layer code.

export type {
  CrudHandlers,
  DalError,
  DalReturn,
  EntityServerSpec,
  ScopedContext,
  SlotName,
} from '@/shared/dal/server/types'

export {
  dalError,
  dalSuccess,
  SYSTEM_CONTEXT,
  ThrowableDalError,
} from '@/shared/dal/server/types'

// ── tRPC-specific context types ─────────────────────────────────────────

/**
 * Single shared context shape for all tRPC procedures. Each field starts
 * nullable; middleware layers progressively narrow:
 *   - baseProcedure:      all nullable (public routes)
 *   - protectedProcedure: session + ability non-null
 *   - L1 entity layer:    scope computed (null for omni, SQL for scoped)
 */
export interface BaseTRPCContext {
  session: BetterAuthSession | null
  ability: AppAbility | null
  scope: SQL | null
}

/** Context after protectedProcedure/agentProcedure — session + ability guaranteed non-null. */
export type AuthedContext = BaseTRPCContext & {
  session: BetterAuthSession
  ability: AppAbility
  scope: SQL | null
}

/** HTTP adapter context — extends base with request/response headers. */
export interface HTTPTRPCContext extends BaseTRPCContext {
  req?: Request
  resHeaders: Headers
}
