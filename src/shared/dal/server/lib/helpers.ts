// ─── DAL Helpers ────────────────────────────────────────────────────────────
// Composable wrappers for DAL functions. Every DAL function should use
// `dalDbOperation` for DB calls. Context is constructed differently
// depending on the caller:
//
//   tRPC middleware  → ScopedContext already resolved, pass through
//   Service / job    → SYSTEM_CONTEXT (full access) or buildUserContext()
//
// Adapted from WebDevSimplified/next-js-data-access-layer.
//
// Standard composition:
//   export async function getFullView(ctx: ScopedContext, input) {
//     return dalDbOperation(() => {
//       const [row] = await db.select()...where(and(..., ctx.scope ?? undefined))
//       if (!row) throw new ThrowableDalError({ type: 'not-found' })
//       return row
//     })
//   }

import type { DalReturn, EntityServerSpec, ScopedContext } from '../types'

import type { UserRole } from '@/shared/constants/enums'

import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'

import { dalError, dalSuccess, ThrowableDalError } from '../types'

// ── dalDbOperation ──────────────────────────────────────────────────────
//
// Wraps any DB operation. Catches errors and returns structured DalReturn.
// For business logic errors mid-query, throw ThrowableDalError inside
// the operation — it will be caught and converted to a DalError.

export async function dalDbOperation<T>(
  operation: () => Promise<T>,
): Promise<DalReturn<T>> {
  try {
    const result = await operation()
    return dalSuccess(result)
  }
  catch (e) {
    if (e instanceof ThrowableDalError) {
      return dalError(e.dalError)
    }
    return dalError({ type: 'db-error', cause: e })
  }
}

// ── Context Builders ────────────────────────────────────────────────────
//
// For server-side callers (services, jobs, webhooks) that don't have
// tRPC middleware to resolve context.

/**
 * Build a visibility-scoped context for a specific user on a specific entity.
 * Use when a service/job acts on behalf of a user (e.g., "process proposals
 * this agent can see").
 *
 * Resolves CASL ability and visibility predicate from the entity spec.
 */
export function buildUserContext(
  userId: string,
  userRole: UserRole,
  spec: EntityServerSpec,
): ScopedContext {
  const ability = defineAbilitiesFor({ id: userId, role: userRole })
  const isOmni = ability.can('manage', 'all')
  return {
    session: { user: { id: userId, role: userRole } } as ScopedContext['session'],
    ability,
    scope: isOmni ? null : spec.visibility(userId),
  }
}

// ── DalReturn Narrowing Helpers ─────────────────────────────────────────
//
// Progressively narrow the error union at the call site. Each helper
// handles one error type and returns the narrowed result.
//
// Usage:
//   // In tRPC procedure — map all errors to TRPCError
//   const result = dalVerifySuccess(await getFullView(ctx, input))
//
//   // In server component — redirect on auth errors, throw on DB errors
//   const result = dalLoginRedirect(await getFullView(ctx, input))
//   const data = dalVerifySuccess(result)
//
//   // In service — handle specific errors inline
//   const result = await getFullView(ctx, input)
//   if (!result.success) { log(result.error); return }

/**
 * Unwrap a DalReturn or throw. Use in tRPC procedures where you want
 * to convert any DalError into a thrown error (for DAL-to-DAL composition).
 * tRPC callers should use `dalToTrpc()` instead.
 */
export function dalVerifySuccess<T>(result: DalReturn<T>): T {
  if (result.success) {
    return result.data
  }
  throw new ThrowableDalError(result.error)
}
