# Handoff — tRPC / RSC / route.ts context unification (upstream of permissions)

> Paste the block below into a fresh Claude Code session. It is self-contained. Written 2026-09-09 from the #285 re-grounding grill (`docs/plans/2026-09-07-casl-re-grounding/README.md` §L7); the facts it cites were verified in the worktree at `b40403b6`.
>
> **⚠️ Where to run it — read before starting.** This change rewrites `src/trpc/init.ts`, `src/trpc/lib/create-http-context.ts`, `src/trpc/types.ts`, `src/shared/dal/server/types.ts` (`ScopedContext`) and every `*Procedure` — the same files the #285 DAL cutover edits next. Two safe options: **(A) run it inside `.worktrees/issue-285` as the first unit of the re-oriented Phase 7** (recommended — zero merge risk, and the DAL cutover then builds on it), or **(B) run it on `main` with the "compatibility aliases" in step 6 kept**, so #285 merges main afterwards and deletes the aliases. Do NOT run it on main without the aliases — it will conflict on `create-crud-dal.ts`/`types.ts` with the #285 branch (74 commits ahead).

---

## Prompt

You are working in the Tri Pros Remodeling Next.js 15 / tRPC v11 / better-auth / Drizzle / CASL (`@casl/ability@6.8.0`) repo. Read `CLAUDE.md`, `memory/coding-conventions.md`, `docs/codebase-conventions/trpc-procedures.md`, and `src/trpc/DOCS.md` first. Package manager is pnpm; verification is `pnpm tsc && pnpm lint` (NEVER `pnpm build`). Work on a branch; do not commit or push unless asked.

### Goal

Compute the current user's identity + CASL ability **exactly once per request** and reuse it on every server surface — tRPC procedures, React Server Components (pages/layouts/guards, incl. server-side tRPC prefetch), and `route.ts` handlers — with tRPC middlewares only **narrowing** the context type, never rebuilding it. Today a single dashboard page load builds the ability 7 times across 3 separate session lookups (RSC guard `src/shared/…/protect-dashboard-page.ts:36`, SSR + client `casl-provider.tsx:27` and `app-sidebar.tsx:74`, and once per tRPC procedure in `src/trpc/init.ts:54`), through two independent `cache()` memos (`get-cached-session.ts:19` vs `create-http-context.ts:37`).

### The target shape (decided — do not redesign)

```ts
// src/shared/domains/permissions/actor.ts  (replaces scope/actor.ts)
export interface Actor { ability: AppAbility; userId: string | null }   // userId null ⇒ anonymous bearer or system

// src/shared/domains/permissions/server/get-request-actor.ts  ('server-only')
export const getRequestActor = cache(async (): Promise<{ session: BetterAuthSession | null; actor: Actor }> => {
  const session = await auth.api.getSession({ headers: await headers() })          // the ONE session lookup
  const ability = defineAbilitiesFor(session?.user ?? null)                          // the ONE ability build (null ⇒ deny-all)
  return { session, actor: { ability, userId: session?.user.id ?? null } }
})

// tRPC root context (src/trpc/lib/create-http-context.ts): { session, actor, req?, resHeaders }
// Rungs (src/trpc/init.ts):
//   baseProcedure       ctx: { session: Session | null, actor }         // public; actor.ability = deny-all when anonymous
//   protectedProcedure  ctx: { session: Session,        actor }         // asserts session, narrows type, builds NOTHING
//   agentProcedure      + runtime gate actor.ability.can('access','Dashboard')
//   superAdminProcedure + runtime gate actor.ability.can('manage','all')
// DAL context (src/shared/dal/server/types.ts): ScopedContext = { actor: Actor; tx?: Tx }
//   → any tRPC ctx satisfies ScopedContext structurally, so handlers keep passing `ctx` straight into DAL functions.
```

Rules for the shape:
- `Actor` is a **plain record**. It is NOT a tagged union; there is no `kind`, no `token`/`system` variant, no `scope` field. (The old `src/shared/domains/permissions/scope/actor.ts` union `user | token | system` is being retired by the #285 permissions epic; this task only introduces the new record and the builder, and leaves the old union's engine consumers untouched — see "Out of scope".)
- `ctx.ability` and `ctx.scope` are **redundant** with `actor` and are removed from the tRPC context type; readers migrate to `ctx.actor.ability`. `ctx.scope` has no replacement here (the DAL will derive row scope from the ability in the permissions epic); until then keep the per-entity `<entity>Procedure`s stamping `scope` exactly as they do today, but reading `ctx.actor.ability` / `ctx.session.user.id` instead of `ctx.ability`.
- `defineAbilitiesFor` is called in exactly ONE server place (`getRequestActor`) plus the token branch of `shareable-middleware.ts` (out of scope to redesign; just make its session branch reuse `ctx.actor` instead of rebuilding at `shareable-middleware.ts:40-46`).

### Steps

1. **Create `Actor` + `getRequestActor()`** as above. Fold `src/trpc/lib/get-cached-session.ts` and the RSC branch of `create-http-context.ts` into it (one memo, not two). Keep the HTTP branch's `req`/`resHeaders`.
2. **`createHTTPTRPCContext` / RSC caller context** → `{ ...(await getRequestActor()), req, resHeaders }`. tRPC's fetch adapter already calls `createContext` once per HTTP batch, so the `cache()` is inert there — fine.
3. **Rewrite `src/trpc/init.ts`**: `protectedProcedure` asserts `ctx.session` and calls `next({ ctx: { ...ctx, session: ctx.session } })` — nothing else. `agentProcedure`/`superAdminProcedure` gate on `ctx.actor.ability`. Delete the `scope: null` stamp at `init.ts:60`. Delete `systemProcedure` (`init.ts:39`, an alias of `baseProcedure`) and repoint its consumers (`grep -rn systemProcedure src`) to `baseProcedure` with a one-line comment stating why auth is external there.
4. **RSC guards**: `protect-dashboard-page.ts` calls `getRequestActor()` and returns its `actor` (it currently builds and discards an ability at `:36-39`). Any `page.tsx`/`layout.tsx` that reads the session directly (`grep -rn "getSession\|getCachedSession" src/app`) switches to `getRequestActor()`.
5. **Client provider**: `casl-provider.tsx` and `app-sidebar.tsx:74` must stop calling `defineAbilitiesFor` independently. Minimal version for this task: the dashboard layout (RSC) gets `actor` from `getRequestActor()` and passes `packRules(actor.ability.rules)` to the provider, which hydrates with `createMongoAbility(unpackRules(rules), { conditionsMatcher: buildScopeConditionsMatcher() })` — the matcher is the SAME module the server uses (`src/shared/domains/permissions/scope/conditions-matcher.ts`; it has no SQL and is already in the client bundle). The sidebar reads `useAbility()`. This also removes the deny-all first paint that today's `hasMounted` guards hide. If `@casl/react` is adopted, use v7.0.1's `AbilityProvider` / `useAbility<AppAbility>()` (the `createContextualCan` API was removed in 7.0).
6. **Compatibility aliases (ONLY if running on `main`, delete them in the #285 merge):** keep `ability` and `scope` on the tRPC ctx type as `@deprecated` getters/fields mirroring `actor.ability` / the per-entity stamp, so the 47 `ctx.ability` and 64 `ctx.scope` readers compile untouched. If running inside the #285 worktree, migrate the readers instead (`ctx.ability` → `ctx.actor.ability`; `ctx.session.user.id` may stay).
7. **Route handlers** (`src/app/api/**/route.ts`, 15 files): the two that authenticate by session today do not exist — none reads the session. Add `getRequestActor()` to any handler that should be session-gated and flag in your report the two that currently have **no auth at all**: `google-calendar/webhook/route.ts` and `quickbooks/callback/route.ts`. Do not touch the token-based proposal `pdf`/`summary` routes or the webhook signature routes — they belong to the permissions epic.
8. Update `src/trpc/DOCS.md` sections that describe `ctx` (`#scope-resolution-is-the-core-superpower`, the ladder description, the `if (ctx.ability)` token-path note) and `docs/codebase-conventions/trpc-procedures.md` to the new shape. Fix the three dead slug anchors while there: `scope-middleware.ts:1,17` → `#scope-resolution-is-the-core-superpower`; the four `*.router/procedures.ts:5` refs to `#entity-router-via-factory` → `#procedures-defined-once`.
9. `pnpm tsc && pnpm lint` green. Then report: builds-per-page-load after (trace `/dashboard/pipeline/[pipeline]`), every file changed, every `defineAbilitiesFor` call site remaining (must be: `getRequestActor`, shareable token branch, and the test/seed scripts if any).

### Out of scope (owned by the #285 permissions epic — do not touch)
The Drizzle scope engine (`src/shared/domains/permissions/scope/**`, `src/shared/dal/server/lib/resolve-actor-scope.ts`, `create-crud-dal.ts` slot logic), the legacy `spec.visibility`/`resolveEffectiveScope` engine, the `createCrudRouter` `resolveScope?` option, `shareable-middleware.ts`'s token branch and `tokenActor`, `SYSTEM_CONTEXT` classification, per-entity `<entity>Procedure` deletion, `abilities.ts` rule authoring. If a step above forces you into one of these, stop and report instead of working around it.

### Facts you can rely on (verified 2026-09-08)
- `ctx.session` is read 79× (53 are `.user.id`), `ctx.ability` 47×, `ctx.scope` 64× (26 via `requireResolvedScope`), `ctx.actor` 21× — counts from `docs/plans/2026-09-07-casl-re-grounding/06-primitive-inventory.md` S1 (in the #285 worktree).
- The DAL reads `ctx.session` only for `user.id` and "is there a user?" (7 sites: `meetings/dal/server/crud.ts:34,125,185`, `meetings/lib/resolve-owner.ts:14-15`, `customer-notes/lib/server-spec.ts:61`, `customer-notes/lib/assert-note-author.ts:8-9`, `proposals/lib/server-spec.ts:119`). `Actor.userId` covers all of them.
- tRPC v11 docs: identity belongs in `createContext` (once per request, shared across a batch); middlewares narrow via `next({ ctx })`; `.meta()`-driven auth cannot narrow `ctx` types. React 19 `cache()` memoizes per server render across layout + page + prefetch; it does nothing in `route.ts`.
