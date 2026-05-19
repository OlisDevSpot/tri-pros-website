// ─── DAL → tRPC Error Bridge ────────────────────────────────────────────────
// Maps DalReturn errors to TRPCError. This is the boundary between DAL
// (returns DalReturn, never throws) and tRPC (communicates via TRPCError).
//
// Services/jobs handle DalReturn directly — only tRPC uses this bridge.

import type { DalReturn } from '@/shared/dal/server/types'

import { TRPCError } from '@trpc/server'

/**
 * Unwrap DalReturn<T>: return data on success, throw TRPCError on failure.
 *
 * Usage in procedure bodies:
 *   const row = dalToTrpc(await handlers.getById(ctx, input))
 *   const proposal = dalToTrpc(await getFullView(ctx, input))
 */
export function dalToTrpc<T>(result: DalReturn<T>): T {
  if (result.success) {
    return result.data
  }
  switch (result.error.type) {
    case 'not-found':
      throw new TRPCError({ code: 'NOT_FOUND' })
    case 'forbidden':
      throw new TRPCError({ code: 'FORBIDDEN' })
    case 'create-failed':
    case 'duplicate-failed':
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: result.error.type })
    case 'db-error':
    case 'unknown-error':
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', cause: result.error.cause })
  }
}
