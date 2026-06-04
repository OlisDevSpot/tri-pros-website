# tRPC Procedure & Router Conventions

tRPC is the client-to-server typesafe glue layer. Procedures are thin — they delegate to DAL (for data) or services (for orchestration) and never touch `db` directly. The Entity Server System (ADR-0002) governs how entity routers are composed; this doc covers the non-entity scaffolding.

## Rules

### base-procedure-types

A four-rung procedure ladder in `src/trpc/init.ts`, each rung extending the one above:

| Procedure | Guard | Use |
|---|---|---|
| `baseProcedure` | None | Public endpoints (landing forms, public proposal view by token) |
| `protectedProcedure` | UNAUTHORIZED if no session; attaches CASL `ability` | Any authenticated user (e.g. a homeowner viewing their own proposal) |
| `agentProcedure` | Extends protected; FORBIDDEN unless `can('access', 'Dashboard')` | Agent-facing admin/CRM operations |
| `superAdminProcedure` | Extends agent; FORBIDDEN unless `can('manage', 'all')` | Super-admin-only ops (lead-source admin, campaign binding, disqualify) |

**Why**: explicit auth shape per procedure — no "is this protected?" guessing. Gate roles at the procedure, not with inline checks in the handler body (see `superadmin-gating-at-the-procedure`).
**Reference impl**: `src/trpc/init.ts`
**Enforced by**: tsc (procedure builders return different ctx shapes)

### superadmin-gating-at-the-procedure

Super-admin-only endpoints use `superAdminProcedure` — **never** an inline `if (ctx.session.user.role !== 'super-admin') throw` or a per-router `requireSuperAdmin(role)` helper (both removed 2026-06-04). The gate belongs in the procedure signature so it's visible where the procedure is registered, checked via the centralized CASL ability (`can('manage', 'all')`) rather than a hardcoded role string.

**Migration status**: `lead-sources` + `voip-campaigns` use `superAdminProcedure`. Remaining routers with inline role/ability peeks (e.g. `customer-pipelines.router.ts`) should migrate as they're touched — the goal is zero inline role checks.
**Why**: one source of truth per endpoint; a forgotten inline check is an IDOR (the `voip-campaigns.disqualify` SYSTEM_CONTEXT bug, 2026-06-04).
**Reference impl**: `src/trpc/routers/lead-sources.router.ts`
**Enforced by**: convention

### entity-procedures-from-factory

Entity routers (Customer, Meeting, Proposal, Project) use `createEntityRouter(spec, factory)` and consume `entity.authedProcedure` / `entity.shareableProcedure` / `entity.publicProcedure` from the toolkit. Never call `agentProcedure` directly inside an entity router — you'd lose the scope middleware.

**Why**: scope middleware injects `ctx.scope` (the per-user visibility predicate). Bypassing it means agents could read rows they shouldn't.
**Reference impl**: `src/trpc/routers/proposals.router/index.ts`
**Enforced by**: ADR-0002 + convention (no machine enforcement yet)

### procedure-body-is-thin

A procedure body parses input, calls DAL or a service, and unwraps the result via `dalToTrpc()`. No `db.select()`, no inline SQL, no transaction blocks.

```ts
list: entity.authedProcedure
  .input(proposalListInputSchema)
  .query(async ({ ctx, input }) => {
    return dalToTrpc(await listProposals(ctx, input))
  }),
```

**Why**: business logic in routers can't be reused by jobs/scripts/RSC. DAL is the only layer touching db.
**Reference impl**: `src/trpc/routers/proposals.router/index.ts`
**Enforced by**: convention (compliance sweep tracks violations)

### sub-router-when-2-plus

A flat `*.router.ts` file is fine for one router. When a router has 2+ sub-routers, promote to a directory matching the `notion.router/` pattern.

```
src/trpc/routers/
  notion.router/          ← directory (3 sub-routers: trades, contacts, scopes)
    index.ts
    trades.router.ts
    contacts.router.ts
    scopes.router.ts
  landing.router.ts       ← flat file (single router)
```

**Why**: a 600-line single-file router with five sub-namespaces is impossible to navigate.
**Reference impl**: `src/trpc/routers/notion.router/`, `src/trpc/routers/proposals.router/`
**Enforced by**: convention

### app-router-registers-everything

Every router is registered in `src/trpc/routers/app.ts`. No "private" routers — if a router exists, it's mounted.

**Why**: app router is the single source of truth for tRPC's API surface.
**Reference impl**: `src/trpc/routers/app.ts`
**Enforced by**: convention

### server-only-tRPC-proxy

`src/trpc/server.ts` is marked `server-only` and uses React `cache()` for request deduplication. Never import it into a `'use client'` file — use `useTRPC()` + queryOptions from `@/trpc/helpers` instead.

**Why**: server-only ensures the dev server fails fast if a client component reaches across the boundary.
**Reference impl**: `src/trpc/server.ts`
**Enforced by**: `server-only` package (build fails)

## Anti-patterns

- **Calling `agentProcedure` inside an entity router.** Use the entity toolkit's `authedProcedure`.
- **Inline `db.select()` in a procedure.** Move to DAL.
- **Manual `if (!ctx.session) throw UNAUTHORIZED` in a procedure body.** Use `agentProcedure`.
- **Manual `isOmni`-or-predicate dance.** Use scope middleware (entity routers get this free).

## See also

- ADR-0002 — Entity Server System
- `src/trpc/DOCS.md` — Entity Server System operational rules (procedure types, scope/shareable middleware, factory layer)
- `docs/codebase-conventions/dal-conventions.md` — DAL signature + DalReturn pattern
