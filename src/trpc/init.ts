import type { HTTPTRPCContext } from '@/trpc/types'

import { initTRPC, TRPCError } from '@trpc/server'
import superjson from 'superjson'
import { ZodError } from 'zod'

import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'

export { createHTTPTRPCContext } from '@/trpc/lib/create-http-context'

const t = initTRPC.context<HTTPTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    }
  },
})

export const createTRPCRouter = t.router
export const createMiddleware = t.middleware
export const createCallerFactory = t.createCallerFactory
export const baseProcedure = t.procedure

// ── protectedProcedure ────────────────────────────────────────────────────
// Any authenticated user. Use for endpoints that homeowners/default users
// might need in the future (e.g., viewing their own proposal).
// Attaches CASL ability to context so downstream handlers can do
// granular checks like `ctx.ability.can('read', 'Proposal')`.
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be signed in to perform this action',
    })
  }

  const ability = defineAbilitiesFor({
    id: ctx.session.user.id,
    role: ctx.session.user.role,
  })

  return await next({
    ctx: { ...ctx, session: ctx.session, ability, scope: null },
  })
})

// ── agentProcedure ────────────────────────────────────────────────────────
// Internal users only (agent, super-admin). This is the main guard for
// dashboard/CRM endpoints. Extends protectedProcedure, so session and
// ability are already on ctx.
//
// The CASL check `can('access', 'Dashboard')` is equivalent to checking
// if the user is agent or super-admin, but uses the centralized permission
// system instead of hardcoded role checks.
export const agentProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.ability.cannot('access', 'Dashboard')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have permission to access this resource',
    })
  }

  return await next({ ctx })
})

// ── superAdminProcedure ────────────────────────────────────────────────────
// Super-admin only. Extends agentProcedure, so session + ability + the
// Dashboard guard are already in place. Use this for privileged,
// cross-source/global operations (resync, campaign binding, disqualify,
// destructive lead-source admin) INSTEAD of an inline
// `if (ctx.session.user.role !== 'super-admin') throw` in the handler body —
// procedure-level gating is the convention. see DOCS.md#superadmin-procedure
//
// Uses the centralized CASL ability (`can('manage', 'all')` is super-admin's
// omni grant — see domains/permissions/abilities.ts) rather than a hardcoded
// role string, mirroring agentProcedure's `can('access', 'Dashboard')`.
export const superAdminProcedure = agentProcedure.use(async ({ ctx, next }) => {
  if (ctx.ability.cannot('manage', 'all')) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Super-admin access required.',
    })
  }

  return await next({ ctx })
})
