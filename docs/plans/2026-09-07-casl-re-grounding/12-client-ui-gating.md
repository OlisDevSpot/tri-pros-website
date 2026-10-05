# 12 — Client UI gating: how the ability reaches the browser, who consumes it, and how to make "one ability per route" hold on the client

> **Scope.** Research + code trace for README §L4/§L5 ("compute the principal's ability ONCE per route … client receives the same rules"). Read-only against worktree `.worktrees/issue-285` @ `b40403b6`. Every `file:line` is as of that commit. Library facts come from Context7 (`/stalniy/casl`, `/vercel/next.js`) and from a `node -e` probe run against the **installed** packages (no file written): `@casl/ability@6.8.0`, `@ucast/mongo2js@1.4.1`, `@ucast/mongo@2.4.3`, `@ucast/js@3.1.0`, `@ucast/core@1.10.2`, `next@15.5.9`, `react@19.2.4`, `@trpc/server@11.9.0`, `better-auth@1.6.9`.
> **`@casl/react` is NOT installed.** `node_modules/@casl/` contains only `ability`; `pnpm-lock.yaml` lists only `@casl/ability@6.8.0` (L23, L1325). The React integration is hand-rolled (A.1).
> **Decision context (user, 2026-09-08).** `Actor` is dropped (README §L1); the principal IS the ability; a token bearer is an anonymous principal whose ability is built for one row inside the shareable procedure (§L3); the UI must adhere to the current principal's permissions from that same ability — no hand-mirrored logic (README §D5). Section C lays out how the client side can satisfy that; no final decision is made here.

---

## A. Current client-side gating (code facts)

### A.1 How the ability reaches the client today

| Question | Answer (code) |
|---|---|
| Provider | `src/shared/components/providers/casl-provider.tsx:19-37` — `AbilityProvider` is a `'use client'` component. It calls `useSession()` (better-auth React store, `src/shared/domains/auth/client.ts:5-24`), reads `session.data?.user?.{id,role}` (`:21-22`), and **rebuilds the ability on the client** with `defineAbilitiesFor(userId ? { id, role } : null)` memoized on `[userId, userRole]` (`:27-30`). It renders React-19 `<AbilityContext value={ability}>` (`:33`). |
| Context / hook | `src/shared/domains/permissions/context.ts:13` — `AbilityContext = createContext<AppAbility>(createMongoAbility())`: the **default is an empty (deny-all) ability**. `src/shared/domains/permissions/hooks.ts:16-18` — `useAbility()` is `use(AbilityContext)`; it has **no subscription to `ability.update()`** (re-render only when the provider's value identity changes). |
| Where mounted | Exactly once, at the root: `src/app/(frontend)/layout.tsx:4,144-146` → `<Providers>` (`src/shared/components/providers/index.tsx:11-33`, `AbilityProvider` at `:15`, nested inside `TRPCReactProvider` and `RealtimeProvider`). No route-group layout (`dashboard/layout.tsx`, `proposal-flow/layout.tsx`) mounts its own provider or passes rules. |
| Rules shipped from the server? | **No.** Nothing is serialized. Both server and client import the same `defineAbilitiesFor` (`src/shared/domains/permissions/abilities.ts:80-278`); the client re-derives from `{id, role}` only. `protectDashboardPage` builds an ability in RSC and returns it (`src/shared/domains/permissions/lib/protect-dashboard-page.ts:36-48`) but it is consumed **server-side only** (`src/app/(frontend)/dashboard/campaigns/page.tsx:23`, `lead-sources/page.tsx:13`) — never passed to a client component. |
| All `defineAbilitiesFor` callers | **Client (2):** `casl-provider.tsx:16,28`; `src/features/agent-dashboard/ui/components/app-sidebar.tsx:40,74` — the sidebar builds a **second, provider-bypassing** ability from the server-passed `user` prop (`dashboard/layout.tsx:24` → `app-sidebar.tsx:44-48`). **Server (5):** `src/trpc/init.ts:7,54` (`protectedProcedure`), `src/trpc/lib/middleware/shareable-middleware.ts:11,40` (session branch), `src/shared/dal/server/lib/helpers.ts:26,70` (`buildUserContext`), `protect-dashboard-page.ts:20,36`, and the module-load self-check `abilities.ts:285` (`assertScopeWiring(userRoles.map(...))` — runs on the client too, building one ability per role at import). |
| Hydration consequence | Because the client ability comes from a client-side session fetch, SSR and the first client render see the deny-all default. The proposal navbar compensates with mount guards: `navbar.tsx:24-32` (`hasMounted && ability.can(...)`) and `navbar-menu.tsx:27-38` (`mounted && ability.can('update','Proposal')`). |

**The conditions matcher on the client.** `abilities.ts:46,88,277` builds every ability with `buildScopeConditionsMatcher()` (`src/shared/domains/permissions/scope/conditions-matcher.ts:41-49`), which is `buildMongoQueryMatcher(instructions)` where each name in `SCOPE_OPERATOR_NAMES` (`scope/operator-names.ts:24`: `participatesViaMeeting`, `hasNoMeeting`, `inDerivedPipeline`) becomes a `{ type: 'document' }` **parsing instruction with NO interpreter** (`conditions-matcher.ts:37-39` says so explicitly: "We supply NO custom interpreters … The Client Mirror (toJS) lands later"). So:

- **Yes, the matcher is in the client bundle** (`abilities.ts` → `conditions-matcher.ts` → `operator-names.ts`; plus `exhaustiveness.ts`). The **SQL bodies are not**: `operators/meeting-participation.ts:1-4` and `operators/derived-pipeline.ts:3` import `db`/schema, and are loaded only via side-effect imports in `scope/interpret.ts:13-14`, whose sole importer is `scope/compile-scope.ts:12`, whose sole importer is the server DAL lib `src/shared/dal/server/lib/resolve-actor-scope.ts:11`. The boundary holds by **import topology + comments only** (`operator-names.ts:4-12`); there is no `import 'server-only'` (README C11).
- **Does the client ever evaluate a rule with a custom operator?** Today, *never on an instance*: there are **0 uses of `subject()`** anywhere in `src/` (grep for `subject(` and `from '@casl/ability'` — only `AbilityBuilder`, `createMongoAbility`, `buildMongoQueryMatcher`, `rulesToAST` are imported). All 41 client checks (A.2) are **subject-type** checks (`can('read','Customer')`), for which CASL ignores conditions entirely.
- **What happens if it does?** Verified with the installed packages:

```
[type-only] read Customer (agent, $participatesViaMeeting rule) → true      (conditions ignored)
[instance]  can('read', subject('Customer', {id}))                → THROWS
            "Unable to interpret "participatesViaMeeting" condition. Did you forget to register interpreter for it?"
[dispatcher] can('read', subject('Customer', {id}))               → THROWS (inDerivedPipeline)
[admin]     manage all → instance check → true                    (no conditions to interpret)
[agent Project] rules [ {ownerId:u1}, {$participatesViaMeeting} ] → instance check THROWS even for ownerId=u1
[agent Project] rules [ {$participatesViaMeeting}, {ownerId:u1} ] → ownerId=u1 → true (short-circuits on the LAST-defined rule)
[default matcher, no instructions] same rules → participates rule silently non-matching; ownerId=u1 → true, u2 → false
[field] can('update', subject('Customer',{id}), 'age') → true; 'name' → false
```

  i.e. with the current matcher an instance check against any rule carrying a custom operator **throws at render time**, and whether it throws depends on rule definition order (CASL evaluates the last-defined rule first). With CASL's default matcher (no instruction) the custom key is treated as non-matching (silent deny for that rule). Neither is usable for UI.

### A.2 Every client consumer, classified

Legend — **CASL**: evaluates the context ability. **MIRROR**: re-implements a server rule by hand. **ROLE-STRING**: compares `role` strings. **SERVER-DERIVED-FLAG**: gates on a boolean/value computed server-side and shipped in data/props.

#### CASL — 41 `can`/`cannot` evaluations in 26 files (25 `useAbility()` call sites in 23 files); all subject-type checks, 0 instance checks

| File | Lines | Check(s) | Note |
|---|---|---|---|
| `src/features/agent-dashboard/lib/get-sidebar-nav.ts` | 59,70,79,85,91,97,101 | `read Customer/Meeting/Proposal/Project`, `manage all` (admin group) | Ability comes from `app-sidebar.tsx:74` (`defineAbilitiesFor` on the server-passed `user`), **not** from `useAbility()`. Pipeline children via `getAccessiblePipelines` (`:60`). |
| `src/features/customer-pipelines/ui/components/pipeline-select.tsx` | 16-17 | via `getAccessiblePipelines(ability)` | see MIRROR row |
| `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` | 35-36,169 | `manage CustomerPipeline` | shows `PipelineSelect` |
| `src/features/landing/ui/components/services/notion-refresh-button.tsx` | 14,27 | `cannot('update','Project')` | marketing page |
| `src/features/meeting-flow/ui/components/table/index.tsx` | 34,85 | `assign Meeting` → `meta.canAssignMeeting` | threaded as a boolean into `meetings/lib/columns-registry.tsx:24,77` |
| `src/features/project-management/ui/components/story-hero.tsx` | 30-31,83 | `update Project` | |
| `src/features/proposal-flow/hooks/use-view-mode.ts` | 15-16 | `update Proposal` (+ `?view=agent`) | the single view-mode chokepoint (`proposal-flow/DOCS.md:47-53`) |
| `src/features/proposal-flow/ui/components/navbar/navbar-menu.tsx` | 25,38 | `update Proposal` | behind `mounted` guard |
| `src/features/proposal-flow/ui/components/navbar/navbar.tsx` | 23,30,32 | `update Proposal` → `viewerRole`; `access Dashboard` → back link | behind `hasMounted` guard |
| `src/features/proposal-flow/ui/components/proposal/heading.tsx` | 19,110,122,136 | `read Customer`, `update Proposal` ×2 | ANDed with `viewMode === 'agent'` |
| `src/features/proposal-flow/ui/components/proposal/index.tsx` | 28,74 | `update Proposal` → `viewerRole` | feeds `generateProposalSteps` |
| `src/features/schedule-management/ui/components/schedule-calendar-dot.tsx` | 24,28-33 | `action.permission` tuples | duplicate of the EntityActionMenu filter |
| `src/shared/components/data-table/lib/use-entity-columns.tsx` | 49,80,94 | `ColumnSpec.permission` tuple | mechanism exists; **0 registries use it** (grep `permission:` in `*/lib/columns-registry.tsx` → none) |
| `src/shared/components/entity-actions/ui/entity-action-menu.tsx` | 25,27-32 | `action.permission` tuples | central filter |
| `src/shared/components/entity-actions/ui/entity-action-dropdown.tsx` | 39,43-48 | `action.permission` tuples | re-filters what the menu already filtered |
| `src/shared/components/navigation/popover-nav.tsx` | 41-42,61 | `access Dashboard` → "TPR Internal" nav | marketing site |
| `src/shared/components/navigation/site-navbar.tsx` → `src/shared/constants/nav-items/index.ts` | 50,68 → 27 | `access Dashboard` | marketing site |
| `src/shared/domains/pipelines/lib/get-accessible-pipelines.ts` | 27,30 | `manage all`, `read LeadsPool` as role proxies | see MIRROR |
| `src/shared/entities/customer-notes/hooks/use-customer-note-action-configs.ts` | 33,42 | `manage all` → `isAdmin` | see MIRROR |
| `src/shared/entities/customers/components/lists/customer-meetings-list.tsx` | 35,52,105 | `create Meeting`, `create Proposal` | |
| `src/shared/entities/customers/components/lists/project-entity-card.tsx` | 31-32,116 | `create Proposal` | |
| `src/shared/entities/customers/components/profile/customer-hero-actions.tsx` | 79,83-84 | `create Meeting`, `create Proposal` | |
| `src/shared/entities/customers/components/profile/customer-hero-header.tsx` → `customers/lib/can-see-phone.ts` | 32,34 → 16 | `manage all` | see MIRROR / SERVER-DERIVED-FLAG |
| `src/shared/entities/customers/hooks/use-customer-edit-form.ts` | 19,23,27,30 | **field-level** `update Customer 'name'`, `'age'`; `update CustomerProfile` | the only field-level client checks besides the next row |
| `src/shared/entities/customers/lib/columns-registry.tsx` | 62-63,80 | **field-level** `update Customer 'leadSourceId'` | |
| `src/shared/entities/meetings/components/participants-slot.tsx` | 124-125, 211-212, 304-305 | `assign Meeting` ×3 | |

Declarative permission tuples consumed by the three filters above: **37** `permission: [action, subject]` entries in 7 constants files — `activities/constants/index.ts:21-24` (4), `customer-notes/constants/note-actions.ts:10,16` (2), `customers/constants/actions.ts:10,17,23,30` (4), `lead-sources/constants/actions.ts:10-48` (7, all `manage all`), `meetings/constants/actions.ts:10-61` (9), `projects/constants/actions.ts:10-30` (4), `proposals/constants/actions.ts:10-49` (7). Type contract: `src/shared/components/entity-actions/types.ts:24-25` (`permission?: [AppAction, AppSubject]` — no instance, no field). `EntityActionConfig` has `isDisabled`/`isLoading` (`types.ts:47-49`) but **no `visible`/`enabled` predicate**; the only `isDisabled:` in any action-config hook is the inert `!toggleActive && false` at `lead-sources/hooks/use-lead-source-action-configs.tsx:98`. `SidebarNavItem.enabled` (`get-sidebar-nav.ts:34`) is the sole `enabled:` predicate, and it is CASL-driven.

#### MIRROR — 4 sites

| # | Site | What it mirrors | Divergence risk |
|---|---|---|---|
| M1 | `customer-notes/hooks/use-customer-note-action-configs.ts:41-42,63-64` — `isAdmin \|\| note.authorId === currentUserId` (`currentUserId` from `useSession()`, `:34,41`); consumed per-row at `customers/components/timeline/timeline-event-item.tsx:40-60,170-177` | Server hook `customer-notes/lib/assert-note-author.ts:7-16` (`manage all` or `authorId === session.user.id`). The CASL rule is conditionless (`abilities.ts:126-129`, `:253-256`) with the comment "CASL can't express 'own record' on plain-string subjects" (`abilities.ts:123-125`, `:204-206`) — README C7 marks that claim false; the probe confirms `can('update', subject('CustomerNote',{authorId}))` works. | Triplication (hook + client + conditionless rule); epic doc L44/L214/L332. |
| M2 | `customers/lib/can-see-phone.ts:12-20` — `manage all ? true : customer.hasSentProposal === true`; consumer `customer-hero-header.tsx:34,91,194-240` (`phoneUnlocked`) | Server `customers/lib/phone-gating-sql.ts:42-46` (`canSeeUngatedPhone`: `manage all` **or `read LeadsPool`**) + `:48-53` (`gatedPhoneSql`). | The client predicate **omits the `read LeadsPool` (dispatcher) branch**: for a dispatcher on a customer without a sent proposal the server returns the raw phone but the client computes `phoneUnlocked=false`. |
| M3 | `domains/pipelines/lib/get-accessible-pipelines.ts:7,18,26-34` — hand-maintained `AGENT_PIPELINES`/`DISPATCHER_PIPELINES` selected by `manage all` / `read LeadsPool` proxies; used client (`pipeline-select.tsx:17`, `get-sidebar-nav.ts:60`) and server (`src/trpc/routers/customer-pipelines.router.ts:35`) | The dispatcher `$inDerivedPipeline: ['leads','rehash','dead','fresh']` rule (`abilities.ts:233`) and the agent comment at `:162-164`. The file's own comment (`:14-16`) says it "MUST stay in lockstep" with the rule. | Two sources of truth for the same fact; no compile-time tie. |
| M4 | `features/proposal-flow/constants/proposal-steps.ts:16,23,30,37,44,51` (`roles: ['homeowner','agent']`) + `generateProposalSteps(userRole)` `:55-59`, fed by a CASL-derived role string (`navbar.tsx:30-31`, `proposal/index.tsx:74-75`) | Nothing server-side; all six steps list both roles, so it is inert today (`proposal-flow/DOCS.md:41`). | Reintroduces a role axis on top of the ability. |

#### ROLE-STRING — 3 sites (excluding the builder's own `switch (user.role)` at `abilities.ts:91`)

| Site | Check | Surface |
|---|---|---|
| `src/app/(frontend)/intake/page.tsx:22-27` | `session?.user.role === 'super-admin'` → redirect to Lead Sources | RSC page (bare `/intake`) |
| `proposal-steps.ts:55-59` via `viewerRole = can('update','Proposal') ? 'agent' : 'homeowner'` (`navbar.tsx:30`, `proposal/index.tsx:74`) | CASL → role string → role-array filter | client (see M4) |
| `src/app/api/dev/playwright-session/route.ts:84` | `userRoles.includes(roleParam)` | dev-only route |

(`role === 'owner' | 'co_owner' | 'helper'` in `meetings/components/participant-picker/*`, `participants-slot.tsx:217`, `users/components/overview-card.tsx:94,186-189` and `s.role === 'Contractor' | 'Homeowner'` in `contract-status-panel/lib/derive-timeline-state.ts:25-26`, `homeowner-contract-view.tsx:41` are **participant/signer roles, not principal roles** — excluded.)

#### SERVER-DERIVED-FLAG — 8 clusters

| # | Flag | Producer → consumer | Gates what |
|---|---|---|---|
| S1 | `isAuthenticated` | `src/app/(frontend)/proposal-flow/layout.tsx:17-19,23` → `ProposalSplashScreen` (`splash-screen/proposal-splash-screen.tsx:10-12`) | **Only** the splash overlay (`useSplashVisibility(!isAuthenticated)`); no content gating. |
| S2 | `session` presence | `src/app/(frontend)/dashboard/layout.tsx:14,24,32,34,37` | RSC: sidebar, push banner, children vs `DashboardSignIn`, mobile nav. |
| S3 | `protectDashboardPage()` result | `protect-dashboard-page.ts:26-49`; 16 dashboard pages | RSC redirect on `cannot('access','Dashboard')` (`:41-43`); `authState.ability` used server-side only (`campaigns/page.tsx:23`, `lead-sources/page.tsx:13`). |
| S4 | `user` prop | `dashboard/layout.tsx:24` → `app-sidebar.tsx:44-48,74` | Client rebuilds a second ability (bypasses provider). |
| S5 | `hasSentProposal` (SQL `hasSentProposalSql`, `phone-gating-sql.ts:32-34`; zeroed for non-proposal readers by `features/customer-pipelines/lib/mask-financials.ts:10-14`) | consumers: `can-see-phone.ts:19`, `customer-hero-header.tsx:34`, `meetings/lib/columns-registry.tsx:58`, `features/meeting-flow/ui/views/meeting-flow.tsx:222`, `steps/closing-step.tsx:25` | "phone locked vs empty" affordance (`customers/DOCS.md:28-35`). |
| S6 | `proposal.token` (row column shipped by `getFullView`, `proposals/dal/server/queries.ts:94` `getTableColumns(proposals)`) | `proposal/index.tsx:71,102,118`; `navbar-menu.tsx:36-37`; `funding.tsx:29` (from nuqs, not the row) | `{token && <PdfFallbackCard>}`; PDF link; token forwarded into every homeowner-capable mutation. |
| S7 | `isAgent` (CASL-derived, threaded) | `proposal/index.tsx:103` → `contract-status-panel/types.ts:6` → `contract-status-panel.tsx:30-52` | Agent vs homeowner agreement card (see A.3). |
| S8 | `canReadProposals` / `maskFinancials` | server only: `customer-pipelines/dal/server/get-customer-pipeline-items.ts:48,55-69`, `get-customer-profile.ts:36` | Data masked before it reaches the client; no client flag. |

### A.3 The bearer (proposal) page

Route: `src/app/(frontend)/proposal-flow/proposal/[proposalId]/page.tsx:18-25` (RSC; only seeds nuqs, renders `<Proposal />`). Layout: `proposal-flow/layout.tsx:12-41` reads the session **only** for the splash flag (S1). The page's data comes from `proposalsRouter.business.getFullView` (`use-get-proposal.ts:14-17` ← `use-current-proposal.ts:4-10`, token from `?token`), which sits on `proposalShareableProcedure` (`src/trpc/routers/proposals.router/procedures.ts:45`, `business.router.ts:16-19`) → `shareable-middleware.ts:31-75`: session wins (`:39-51`, ability built from session); else token → `ability: null`, `scope = eq(proposals.token, token)` (`:59-68`).

**How the client decides "agent vs homeowner" today: the CASL ability from the session, not the token and not `isAuthenticated`.**

| Surface | Gate | Mechanism |
|---|---|---|
| View mode | `use-view-mode.ts:13-20` — `'agent'` only if `?view=agent` **and** `ability.can('update','Proposal')`; default `'customer'` | CASL (type-level). For an anonymous bearer `useSession()` → null → `defineAbilitiesFor(null)` → deny-all (`abilities.ts:85-89`) → always `'customer'`. |
| Shell accent / `data-view-mode` | `proposal-flow-shell.tsx:19-20,31` | via `useViewMode` |
| Navbar toggle, back link, step list | `navbar-menu.tsx:38`, `navbar.tsx:30-32` | CASL + mount guards |
| Heading agent buttons ("View profile", "Edit proposal", "Internal financials") | `heading.tsx:110-147` | `viewMode==='agent' && can(...)`; `InternalFinancialsModal` (and `InternalCalculationBlock`, `internal-financials-modal.tsx:9,35`) is reachable only from here |
| **Funding** | `funding.tsx:26-229` | **No gating at all.** Both principals can pick a finance option (`:53-70` → `updateProposal` with `token`) and save cash-in-deal (`:141-160` → `saveCashInDeal` with `token`). This is by design: `proposal-flow/DOCS.md:83-90` "customer-token-access-is-update-capable". Field-level authorization on the token path is absent (server: `assertCanUpdateFields` is skipped when `ctx.ability` is null — README C6/E1-3). |
| **Agreement** | `proposal/index.tsx:99-112` passes `isAgent={viewMode==='agent'}` + `token` → `contract-status-panel.tsx:30-52` | `isAgent` → `AgentContractView` (`agent-contract-view.tsx:40-86`: `ProposalCard` send flow + `EnvelopeCard` → `EnvelopeConfigurationSection`, `envelope-configuration-section.tsx:48-70`, mutating `applyEnvelopeContext`); else `HomeownerContractView` (`homeowner-contract-view.tsx:22-85`: request-to-move-forward `:30-37,79`, `CustomerAgeForm` `:228-230` → same `applyEnvelopeContext` with `token`). |
| Server counterpart of the envelope gate | `contracts.router.ts:189-196` | `ctx.ability == null && input.envelopeDocumentIds !== undefined → FORBIDDEN` — **"ability is null" used as the role proxy for "bearer"** (the thing §L3 replaces with a real bearer ability). The client mirror of this rule is the `isAgent` prop (S7). |
| PDF fallback | `proposal/index.tsx:118-120` | token presence (S6) |
| View recording | `proposal/index.tsx:32-50` → `views.router.ts:36-44` (`systemProcedure`, `resolveShareTokenActor`) | sends `searchParams.get('token') ?? ''`; a session-only agent (no `?token`) posts `''`, which `validateShareToken` (`validate-share-token.ts:34-44`) rejects → UNAUTHORIZED; the mutation has no `onError`, so it fails silently. (Side observation; not a gating issue.) |

So on the bearer page there is **no bearer ability at all**: the homeowner UI is simply "everything the deny-all ability does not hide". A logged-in agent with a `?token` gets the agent UI from their session ability while the server (session-first) ignores the token (`shareable-middleware.ts:32-38`).

---

## B. Documented patterns (Context7)

### B.1 `@casl/react` (`/stalniy/casl`, `packages/casl-react/README.md`)
- Three exports: **`AbilityProvider`** ("expose the Ability instance via React context"), **`Can`** (declarative; props `I`, `a`, `field`, `where`, `not`), **`useAbility`** ("imperative checks that stay in sync with ability updates" — "re-renders the component when ability rules change"). Quick start: `createMongoAbility([...])` → `<AbilityProvider value={ability}>` → `<Can I="read" a="Post">` / `useAbility().can('create','Post')`.
- Hook-deps guidance: "When using the `ability` object returned by `useAbility` within hook dependencies (like `useMemo`), specify `ability.rules` to ensure updates trigger re-renders correctly" — `useMemo(() => getPosts(ability), [ability.rules])` "calling `ability.update` will update the list".
- Implication for the repo: the hand-rolled `useAbility` (`hooks.ts:16-18`) does **not** subscribe to `ability.update()`; today that is harmless because the provider swaps the instance via `useMemo` (`casl-provider.tsx:27-30`). If the design adopts `ability.update(unpackRules(...))` on a long-lived instance, either install `@casl/react` or subscribe to the `'updated'` event.
- Note: the Context7 excerpts of the current README surface `AbilityProvider`/`Can`/`useAbility` only; `createContextualCan` was not returned as part of the current documented quick-start surface.

### B.2 `packRules` / `unpackRules` (`@casl/ability/extra`, API docs + "Cache abilities" cookbook)
- `packRules(rules, packSubject?)`: "reduces serialized rules size in 2 times … by converting objects to arrays … useful if you plan to cache rules in JWT". **"Don't use result returned by packRules directly, its format is not public and may change in future versions."**
- `unpackRules(rules, unpackSubject?)`: "unpacks rules previously packed by `packRules`, so they can be consumed by `Ability` instance … If the backend sends packed rules, use `unpackRules` before passing them into the `Ability` instance" — example `ability.update(unpackRules(token.rules))`; server side `createMongoAbility(rules)` from the JWT payload (`provideAbility` middleware).
- Probe (installed 6.8.0): `packRules` emits `[action, subject, conditions?, inverted?, fields?]` tuples — e.g. `["read","Customer",{"$participatesViaMeeting":{"via":"customerId"}}]`, `["update","Customer",0,0,"age"]`, `["read","Project",{"ownerId":"u1"}]`. Conditions round-trip as plain JSON; **functions never serialize** (the `toSql` bodies cannot leak through rules by construction). `createMongoAbility(unpackRules(packed), { conditionsMatcher })` and `ability.update(unpackRules(packed))` both reproduce the same answers as the source ability (probe lines `[hydrated]`, `[ability.update]`).

### B.3 Custom operators on the client — what the docs require
- "Customize Ability → Custom conditions matcher implementation": provide a custom `conditionsMatcher`; it "should be synchronous and is suitable for matching logic directly within the application, but not recommended if you need to serialize rules or convert them to database queries."
- "Extend/restrict conditions": the documented way to control the operator set is a **factory with explicit parsing instructions AND interpreters** — `createFactory({ $in, $eq }, { in: within, eq })` from `@ucast/mongo2js` ("can help reduce frontend bundle size by leveraging tree-shaking"). A document operator therefore needs (a) a parsing instruction (what `conditions-matcher.ts:42-44` already registers) **and** (b) a JS interpreter (what it deliberately omits, `:37-39`). Without (b), instance evaluation throws (A.1 probe) — matching the `ScopeOperator.toJS?` slot foreshadowed at `scope/operators.ts:19,25`.
- Consequence: a rule like `$participatesViaMeeting` cannot be honestly evaluated in the browser without either shipping a `toJS` that reads a server-hydrated fact (the catalog's "Client Mirror … reading a server-hydrated `viewerCan`/`viewerParticipates` flag", `docs/permissions/visibility-rules-catalog.md:226-228`) or baking the answer into the row (see C).

### B.4 Instance vs type checks (`guide/restricting-fields`, `guide/subject-type-detection`)
- `ability.can('update', ownArticle, 'title') // true; ability.can('update', anotherArticle, 'title') // false; ability.can('update', 'Article', 'title') // true!` — a **type** check "returns true because the user can update the title of at least one article".
- `subject('Article', article)` — "use the CASL `subject` helper to explicitly define the subject type for plain JavaScript objects (DTOs), enabling correct permission checks."
- Probe: `can('update', subject('CustomerNote', {authorId:'u1'}))` → `true`/`false` by author with a `{ authorId: user.id }` rule and the current matcher (plain `$eq` needs no custom interpreter).

### B.5 Next.js 15 App Router — per-request data into a client provider (`/vercel/next.js`, "Server and Client Components → Context providers"; SPA guide)
- "React context is not supported directly in Server Components. To use context, create a Client Component provider that accepts children and render it inside a Server Component like a layout." Providers "should be rendered as deep in the tree as possible to make it easier for Next.js to optimize the static parts."
- Props crossing the boundary must be serializable; the SPA guide's `UserProvider({ userPromise })` pattern forwards a **server-initiated Promise** through context and unwraps it with React's `use()` — i.e. a layout can `const rules = getRulesForRequest()` (memoized via `cache()`, cf. `get-cached-session.ts:19-21`) and pass either the resolved packed rules or the promise to the client provider.

---

## C. Design options for "one ability per route, UI reads the same ability"

Common ground for all options: the DAL/tRPC side already builds from `defineAbilitiesFor` at the request boundary (`init.ts:54`, `shareable-middleware.ts:40`); the client just needs the **same principal's** ability, hydrated before first paint, and consumers need to stop hand-mirroring (A.2 MIRROR rows).

### C.i Server builds → `packRules` → client provider hydrates (rules shipped per page load; bearer page ships a bearer ability)

**Mechanics.** In the RSC layout that owns the route family (`dashboard/layout.tsx:13`, `proposal-flow/layout.tsx:12`, or the root `(frontend)/layout.tsx:117`), call `getCachedSession()` (already request-memoized, `get-cached-session.ts:19`) → `defineAbilitiesFor(user)` → `packRules(ability.rules)` → `<AbilityProvider rules={packed}>` (client) → `useMemo(() => createMongoAbility(unpackRules(rules), { conditionsMatcher }), [rules])`. Next docs: provider is a client component rendered by the server layout with serializable props (B.5). For the bearer page, the RSC page/layout reads `searchParams.token` (it already does `loadProposalSearchParams`, `page.tsx:22`), validates it (`validateShareToken`, `validate-share-token.ts:28-45`), and packs the **bearer ability** built by the same builder the shareable procedure uses (§L3: `can(['read','update'],'Proposal',{ id: proposalId })` plus field grants such as `financeOptionId`/`cashInDealCents`/`age`). An invalid token → deny-all rules → the page renders the existing error state (`proposal/index.tsx:61-67`) once `getFullView` 401s.

| Own-record affordances | `note.authorId === me` → `ability.can('update', subject('CustomerNote', note))` with a `{ authorId: user.id }` rule (probe: works with the current matcher). `use-customer-note-action-configs.ts:63-64` + `assert-note-author.ts` are deleted (README D4). The `EntityAction.permission` tuple (`types.ts:25`) must grow an instance path: the filters at `entity-action-menu.tsx:27-32` / `entity-action-dropdown.tsx:43-48` / `schedule-calendar-dot.tsx:28-33` already have `entity` in hand — evaluate `ability.can(action, subject(caslSubject, entity))` instead of the type string. |
|---|---|
| `can-see-phone.ts` | Becomes a field rule: `can('read','Customer',['phone'], { $hasSentProposal: true })` (or bake `hasSentProposal` into the row as today, S5, and write the rule against that column-shaped field). Client: `ability.can('read', subject('Customer', customer), 'phone')`. Also fixes M2's missing dispatcher branch, because the dispatcher's `read LeadsPool` grant would be expressed once, server-side, in the rule. Requires the rule's condition to be evaluable on the client → the row must carry the fact (`hasSentProposal` already does). |
| `getAccessiblePipelines` | Either (a) derive from `ability.rulesFor('read','Customer')` conditions (`$inDerivedPipeline` payload is the pipeline list — `abilities.ts:233`; agents have no such condition so the list is a policy decision, not a derivation), or (b) keep one shared pure helper but make it read the rule (`rulesFor` + fallback). Either way the server guard (`customer-pipelines.router.ts:35`) and the two client consumers keep using the same function; the hand-maintained arrays (`get-accessible-pipelines.ts:7,18`) go. |
| EntityActionMenu predicates | Unchanged surface (`permission` tuple), evaluation switches to instance form; `ColumnSpec.permission` (`use-entity-columns.tsx:49`) same. No new `visible`/`enabled` predicate needed. |
| Bearer page | Gets its ability from the URL (`proposalId` + `token`) via the RSC layout, **not** from `getFullView`. `getFullView` stays a data read. `isAgent` (S7) becomes `ability.can('update', subject('Proposal', proposal), 'envelopeDocumentIds')` and `HomeownerContractView` vs `AgentContractView` is chosen on that; the server gate at `contracts.router.ts:189-196` becomes the same field check (`permittedFieldsOf`, README C6). The homeowner-role conditionless `read Proposal` rule (`abilities.ts:208`) must go (§L3 OR-merge hazard). |
| Custom operators on the client | Type-level checks are unaffected. Instance checks against `$participatesViaMeeting`/`$inDerivedPipeline` rules **still throw** (A.1) unless the client matcher registers a `toJS` interpreter that reads a server-hydrated row flag (catalog Part 6 #6), or the UI only ever instance-checks subjects whose rules are plain-column conditions. Pragmatic rule: rows the client can see were already row-scoped by the server, so a client-side instance check for **read** is redundant; instance checks are needed for **own-record write** affordances, whose conditions are plain columns (`authorId`, `ownerId`). Register `toJS: () => true` for the three cross-table operators on the client with a comment stating that reachability was already decided by the server WHERE — or keep the throw as a tripwire and never instance-check `read`. |
| Bundle / security | Ships **only the current principal's** rules (today the whole policy for every role is in the client bundle via `abilities.ts`, plus `assertScopeWiring` building all five role abilities at import, `abilities.ts:285`). Rules contain actions, subject names, plain-JSON conditions, field lists; the only per-user datum is the user's own id inside `{ ownerId: user.id }` (or the bearer's own `proposalId`) — nothing the principal does not already know. SQL bodies cannot ship (functions do not serialize; `operators/*.ts` stay server-only by topology — add `import 'server-only'` per README C11 to make it a build error). `packRules` format is "not public" → always `unpackRules` on the client, never read the packed array. |
| Hydration | The ability exists during SSR and the first client render → `hasMounted`/`mounted` guards (`navbar.tsx:24-32`, `navbar-menu.tsx:27-38`) and the deny-all flash go away. The context default (`context.ts:13`) stays as the anonymous fallback. |
| Costs | One `packRules` per request in the layout (already paying the session read); a second builder run in the browser (`unpackRules` + `createMongoAbility`, cheap). Marketing routes under the root layout would also compute the session unless the provider is mounted per route group (Next docs: as deep as possible) — but `site-navbar.tsx:50` / `popover-nav.tsx:41` on marketing pages consume the ability too, so the root needs *some* provider (hybrid, C.iii). `app-sidebar.tsx:74`'s private rebuild must be replaced with `useAbility()`. |

### C.ii Client rebuilds from `defineAbilitiesFor(session.user)` (today)

| Aspect | Fact |
|---|---|
| What it covers | Role-shaped rules for a **session** user, computed from `{id, role}` after the client session fetch resolves. |
| Why it cannot cover the bearer | The bearer has no session; `useSession()` → null → deny-all (`casl-provider.tsx:21-28`, `abilities.ts:85-89`). A bearer ability needs the **row identity and token validity**, which only the server knows (`validate-share-token.ts:34-44`); rebuilding it client-side from the URL is possible only if the builder is a pure function of `(proposalId, token)` **and** invalidity is acceptable to discover late — i.e. it is the "hybrid" (C.iii), not this option. |
| Why it cannot cover user-baked conditions | Anything the server bakes into a rule at build time that is not derivable from `{id, role}` — e.g. §L6(b) "user id inside custom operators → bake into rule conditions at build time", per-request feature flags, a bearer's row id/field grants, a system principal's `manage all` + audit reason — is invisible to a client that re-derives from the session alone. Any drift between the two builders (there are already two client builders: provider + `app-sidebar.tsx:74`) is silent. |
| Own-record affordances | Possible in principle (rules with `{ authorId: user.id }` can be built client-side since `user.id` is in the session), but the `Actor`-less design wants **one** builder invocation per route; this option keeps a second, client-side invocation per session change. |
| Hydration | Inherits the deny-all first paint (A.1). |
| Bundle / security | Ships the entire policy for all roles (`abilities.ts`) to every visitor, including anonymous marketing traffic; runs `assertScopeWiring` on page load. Nothing secret leaks (no SQL), but the policy shape is public. |

### C.iii Hybrid

Two shapes worth naming:

1. **Rules shipped where a server layout already has the session; client rebuild elsewhere.** `dashboard/layout.tsx` and `proposal-flow/layout.tsx` (both already read the session, `:14` / `:17-18`) mount an `AbilityProvider rules={packed}`; the root keeps today's session-derived provider for marketing pages. Two builders remain (server + client), same function; the root provider is the only place still rebuilding. Trade-off: the "one ability per route" property holds on dashboard/bearer routes but not on marketing routes (`site-navbar`/`popover-nav` gating).
2. **Bearer ability built client-side from the URL, agent ability shipped from the server.** The bearer builder is a pure function `defineBearerAbilityFor({ subject:'Proposal', id, token })` shared with the shareable procedure; the client instantiates it from `useParams()`/`useSearchParams()` without a round-trip, and the server rejects on invalid token as today. Trade-off: bearer UI renders optimistically for an invalid token until `getFullView` fails; no server knowledge is needed because the token *is* the credential and the row id is in the path.

In both hybrids the own-record / phone / pipelines / EntityActionMenu treatment is identical to C.i (instance checks via `subject()`, conditions on plain columns or server-hydrated row facts), and the custom-operator caveat (A.1 throw on instance checks) is identical — it is a property of the matcher, not of where the rules come from.

### Cross-option facts that constrain the choice

- **Instance checks are unavoidable for own-record affordances** (README C7/D5); today there are zero, and the action-tuple contract (`types.ts:25`) has no instance path. Whichever option is chosen, the three filters (`entity-action-menu.tsx:27-32`, `entity-action-dropdown.tsx:43-48`, `schedule-calendar-dot.tsx:28-33`) must pass `subject(caslSubject, entity)`.
- **Custom document operators must not be instance-checked on the client** unless a `toJS` interpreter is registered (docs B.3; probe A.1). Rule-order sensitivity (last-defined rule evaluated first) means a plain-column rule can mask the throw in one role and not another — a tripwire worth a unit test if `subject()` checks land while `$participatesViaMeeting` rules exist on the same subject.
- **Field-level checks already work client-side** (`use-customer-edit-form.ts:23,27`, `columns-registry.tsx:63`) and round-trip through `packRules` (`["update","Customer",0,0,"age"]`).
- **`@casl/react` is optional.** The repo's `AbilityContext` + `use()` hook is equivalent to `AbilityProvider`/`useAbility` as long as the provider swaps instances (new rules → new `createMongoAbility`). Adopt the package only if `ability.update()` on a shared instance is wanted (its `useAbility` subscribes to updates; ours does not).
- **Security boundary today**: no secret leaks through rules in any option; the operator SQL bodies are server-only by import topology (`interpret.ts:13-14` ← `compile-scope.ts:12` ← `resolve-actor-scope.ts:11`), not by a `server-only` marker.
