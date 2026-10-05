import type { DalReturn, EntityServerSpec, ScopedContext } from '../types'

import type { UserRole } from '@/shared/constants/enums'

import { db } from '@/shared/db'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'

import { dalError, dalSuccess, ThrowableDalError } from '../types'
import { resolveEffectiveScope } from './scope'

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

/**
 * Nested calls flatten onto the ambient tx (no savepoint) — the outermost caller owns it.
 * Inside `fn`, wrap `crud.*` calls in `dalVerifySuccess`: a bare `await crud.*` swallows its
 * DalError and the tx would commit partial state.
 * There is no post-commit hook phase: a hooked mutation's side-effects (QStash/Ably dispatches)
 * fire PRE-COMMIT and are not rolled back — hoist them out of the tx or don't thread it into that mutation.
 */
export async function withTx<T>(
  ctx: ScopedContext,
  fn: (ctx: ScopedContext) => Promise<T>,
): Promise<T> {
  if (ctx.tx)
    return fn(ctx)
  return db.transaction(tx => fn({ ...ctx, tx }))
}

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
    scope: isOmni ? null : resolveEffectiveScope(spec, { userId, ability }),
  }
}

/** For DAL-to-DAL composition; tRPC procedures use `dalToTrpc()` instead. */
export function dalVerifySuccess<T>(result: DalReturn<T>): T {
  if (result.success) {
    return result.data
  }
  throw new ThrowableDalError(result.error)
}
