# CASL Phase 6 — Owned Sub-Entity Cutovers + Homeowner Invariant (Design)

> **Epic:** `docs/plans/2026-08-10-casl-scope-compiler-epic.md` → Phase 6 (the epic's Phase 6 bullet is the boundary-of-record; this spec is the design depth behind it).
> **Branch/worktree:** `refactor/285-refactor-permissions-casl-scope-compiler` in `.worktrees/issue-285`. Ships in this worktree; single merge to `main` at Phase 9.
> **Boundary:** Shape B (full owned sub-entity cutovers), user-ruled 2026-08-20. Defer only on a genuine *sequential* blocker.
> **Status:** design approved in-conversation 2026-08-20; plan is JIT (next artifact).

## 1. Purpose & context

Phase 6 wires the **built-but-dead child bridge** in `resolveActorScope` (`src/shared/dal/server/lib/resolve-actor-scope.ts`) onto the entities that are structurally owned by a parent, and locks the **homeowner ↔ agent** actor-resolution invariant on the shareable seam. It is the last infrastructure phase before the Phase-7 uniform read cutover (Grill B) and the Grill-C mutation/token-authz redesign; those two depend on Phase 6 having declared the child `parent` links and settled precedence.

The child bridge shape (already implemented, currently only exercised by the two media children):

```
resolveActorScope(childSpec, actor) =
  verbOnly(actor, 'read', childSpec.caslSubject)              -- own: verb only
  AND
  childFk IN (SELECT parent.pk FROM parent
              WHERE resolveActorScope(parentSpec, actor))     -- bridge: parent rows
```

The **legacy** engine (`src/shared/dal/server/lib/scope.ts`) has an equivalent bridge (`bridgeToParent`) composed from the parent's legacy `visibility` fn. The `parent` field on `EntityServerSpec` is **engine-agnostic** — both engines read it — so *declaring* `parent` is safe regardless of which resolver a given procedure currently calls. That is the pivot the whole Tier-2 cutover rests on.

### Inventory (re-grounded from code, 2026-08-20)

The epic's 2026-08-12 "6 children / 4 missing specs" count is **stale**. Ground truth:

| Child entity | spec exists? | `parent` declared? | Active resolver | Phase 6 action |
|---|---|---|---|---|
| `proposal-media-files` | ✅ | ✅ (`proposals`, fk `proposalId`) | legacy (`proposalMediaProcedure`) | **flip to CASL** + `isVisible`→`canAccess` |
| `media-files` (project media) | ✅ | ✅ (`projects`, fk `projectId`) | **none — bare `agentProcedure`, `ctx.scope=null`** | **new CASL `projectMediaProcedure`** + de-inline raw db |
| `customer-notes` | ✅ | ❌ (`visibility: customerNoteVisibility`) | legacy factory (`createCrudRouter`) | **declare `parent`**, delete fn, dispatcher grants |
| `applications` | ✅ | ❌ (`visibility: applicationVisibility`) | legacy factory (`createCrudRouter`) | **declare `parent`**, delete fn |

Zero new specs needed. `mutations.ts:37` (customer-pipelines) is the **live** Phase-5 `scopedFor` closure, not a dead probe — nothing to delete there.

## 2. Work units

### 2.1 Tier-2 child bridge — `customer-notes` + `applications`

**Change (both):** add `parent` to the server-spec, remove the `visibility:` field, delete the `*Visibility` fn.

- `applications/lib/server-spec.ts`: `parent: { spec: meetingServerSpec, fk: applications.meetingId }`; drop `visibility: applicationVisibility`.
- `customer-notes/lib/server-spec.ts`: `parent: { spec: customerServerSpec, fk: customerNotes.customerId }`; drop `visibility: customerNoteVisibility`.
- Delete `applications/lib/visibility.ts` (`applicationVisibility`) and `customer-notes/lib/visibility.ts` (`customerNoteVisibility`).

**Resolver stays legacy in Phase 6.** Both entities ride the **generic** `createCrudRouter` → `create-crud-router.ts:85` `resolveVisibilityScope` (legacy). After the change, legacy `resolveEffectiveScope` takes the `bridgeToParent` branch using the parent's legacy `visibility` fn (`customerVisibility` / `meetingVisibility` — both still alive until Phase 7). We do **not** flip these to CASL here: they use the shared factory, so their CASL flip *is* the factory flip = Phase 7 (Grill B). Declaring `parent` now is what makes that Phase-7 flip safe (without it, `resolveActorScope(childSpec)` would hit the root branch → conditionless CASL `read` → allow-all → leak).

**Equivalence gates (must verify before deleting the fns):**

- **`applications` — clean equivalence.**
  Deleted: `applicationVisibility` = `userParticipatesInMeeting(userId, applications.meetingId)`.
  New legacy bridge: `applications.meetingId IN (SELECT meetings.id WHERE meetingVisibility)` where `meetingVisibility` = `userParticipatesInMeeting(userId, meetings.id)`.
  These denote the same set ("the application's meeting is one you participate in"). No behavior change for any role.

- **`customer-notes` — INTENTIONAL dispatcher widening.**
  Deleted: `customerNoteVisibility` = `userCanSeeCustomer(userId, customerNotes.customerId)` — *participation only; deliberately drops the leads-pool branch* (its own comment: the leads predicate can't correlate inside a notes query, and dispatchers "don't edit notes").
  New legacy bridge: `customerNotes.customerId IN (SELECT customers.id WHERE customerVisibility)`. `customerVisibility` **has** the leads-pool branch (`if ability.can('read','LeadsPool') return derivedPipelineWhere(['leads'])`).
  → For **agents**: identical (`userCanSeeCustomer` both ways). For **dispatchers**: WIDENS to "all notes on leads-pool customers." **User-ratified 2026-08-20** — dispatchers are meant to interact with notes like agents.

**Dispatcher CASL grant (required, not optional).** The widening above "works" in Phase 6 only because the legacy engine never consults the CASL verb. The **dispatcher CASL block grants no `CustomerNote` verb at all**, so the Phase-7 CASL factory flip would compute `verbOnly(dispatcher,'read','CustomerNote')` → `false` → **deny-all**, silently revoking the feature. To make it durable across the flip, add to the `dispatcher` case in `src/shared/domains/permissions/abilities.ts`:

```ts
can('read', 'CustomerNote')     // conditionless; row scope from the parent bridge (mirrors agent)
can('create', 'CustomerNote')   // dispatcher authors notes on leads they work
```

Row scope flows from the parent bridge (dispatcher's Customer scope). "Edit/delete own" stays on the imperative `assertNoteAuthorOrAdmin` hook until **Grill C** moves it to a `{authorId}` CASL condition — no `update`/`delete` CustomerNote grant is added in Phase 6.

**Untouched by this unit (verified):** the `customer-notes` create/update/delete `hooks` in the spec reference `customerServerSpec` / `customerNoteCrud`, *not* the deleted `customerNoteVisibility` — deleting the fn does not affect them. `customerServerSpec.visibility` (`customerVisibility`) stays (Tier-1, dies Phase 7); the note create-hook's `buildUserContext(userId, role, customerServerSpec)` probe still resolves.

### 2.2 `project-media` — CASL scoping + de-inline

`projects.router/media.router.ts` runs **entirely on bare `agentProcedure`** (`ctx.scope=null` → DAL executes unscoped) with several raw-`db` IDORs. This is the security core of Phase 6.

**New procedure** in `src/trpc/routers/projects.router/procedures.ts` (beside `projectProcedure`):

```ts
export const projectMediaProcedure = agentProcedure.use(async ({ ctx, next }) =>
  next({ ctx: { ...ctx, scope: resolveTrpcActorScope(mediaFileServerSpec, { userId: ctx.session.user.id, ability: ctx.ability }) } }))
```

Must be **CASL** (`resolveTrpcActorScope`), not legacy: `projectServerSpec` has no legacy `visibility` fn, so a legacy bridge would make `resolveEffectiveScope(projectServerSpec)` **throw**. CASL `read Project` = `ownerId=me OR $participatesViaMeeting(projectId)` (`abilities.ts:149-150`) — participation-scoped, **not** allow-all, so the bridge `projectId IN (SELECT projects WHERE <that>)` is safe. Dispatcher has no `read Project` grant → `verbOnly`→`sql\`false\`` → **sees zero project media** (correct).

**Swap all `agentProcedure` → `projectMediaProcedure`.** `mediaService` already threads `ctx.scope` into `store.crud` (it "never touches `db` itself"), so these scope for free: `create`, `delete`, `bulkDelete`, `reorder`, `rename`, `retryOptimization` (add a `canAccess` probe — see below; `retryOptimization` currently takes no `ctx`).

**De-inline the raw-`db` mutations into `media-files/dal/server/media-ops.ts`** (table-parameterized, scoped, matching the existing `listMediaByOwner`/`reorderMedia` idiom — each composes `requireResolvedScope(ctx.scope)` so out-of-scope ids match nothing, no probe):

```ts
// media-ops.ts — new scoped ops
export function moveMediaPhase(table, ctx, ids: number[], phase): Promise<DalReturn<void>>
  // UPDATE table SET phase WHERE id IN (ids) AND ctx.scope, in one tx. Empty → no-op.

export function setHeroImage(table, ownerColumn, ctx, id: number, isHero: boolean): Promise<DalReturn<void>>
  // getById(scoped) authorizes + yields projectId; if isHero, project-wide unset of
  // isHeroImage=false for that owner (precursor-authorized), then set the target row.
```

Router `movePhase`/`toggleHero` call these via `mediaService` (or directly through the DAL op) — **no raw `db` left in the router**. `toggleHero`'s project-wide unset is authorized by the preceding scoped `getById` (proves the caller can see the project); the unset itself is bounded to that `projectId`.

**Precursor probes → CASL point-form.** Replace legacy `isVisible(...)` with `canAccess(spec, actor, id)` (`resolve-actor-scope.ts`, `action` defaults to `'read'`). Probe the **project** (`projectServerSpec`) for owner-keyed precursors, the **child** (`mediaFileServerSpec`) for row-keyed ones:
- `getUploadUrl`: `canAccess(projectServerSpec, ctx.actor, input.projectId)` (currently NO project check — live IDOR).
- `importFromProposal`: `canAccess(projectServerSpec, ctx.actor, input.projectId)` on the destination project (its source authz — meetings.projectId join — stays).
- `retryOptimization`: `canAccess(mediaFileServerSpec, ctx.actor, input.mediaFileId)` (row-keyed → probe the child bridge; mirrors proposal-media's `retryOptimization`). Thread `ctx` in (the op currently takes none).

**`listImportableProposalMedia` — IDOR gate now, read *shape* deferred.** Add `canAccess(projectServerSpec, ctx.actor, input.projectId)` to close the enumeration IDOR. The query is a bespoke cross-entity read (proposalMediaFiles ⋈ proposals ⋈ meetings); rolling its *shape* onto owning DALs is **Grill B / Phase 7** work — only the gate lands here.

### 2.3 `proposal-media` — CASL flip (remove the lone legacy straggler)

Flip `proposalMediaProcedure` (`proposals.router/procedures.ts`) from `resolveVisibilityScope` → `resolveTrpcActorScope(proposalMediaServerSpec, …)`. Safe: Phase 1 proved Proposal CASL ≡ legacy `proposalVisibility`; the child bridge recurses to `resolveActorScope(proposalServerSpec)` = CASL `read Proposal` = `$participatesViaMeeting(meetingId)`. Replace the two legacy probes in `proposals.router/media.router.ts` — `isVisible(proposalServerSpec, …)` and `isVisible(proposalMediaServerSpec, …)` — with `canAccess(…, ctx.actor, …)`. After this, **no legacy `resolveVisibilityScope`/`isVisible` remains in either media router.**

### 2.4 Homeowner invariant — AGENT-FIRST precedence

Reorder `src/trpc/lib/middleware/shareable-middleware.ts` so the **session branch is evaluated before the token branch**:

```
if (ctx.session)      → userActor  (full ability; a token in the URL is IGNORED)
else if (token)       → tokenActor (scope = eq(tokenColumn, token), ability null)
else                  → throw UNAUTHORIZED
```

This makes **both** invariants hold: *homeowner-always-token* (no session ⇒ always token) AND *agent-always-user* (authenticated ⇒ never token). Add a structural guard asserting the resolved `actor.kind` matches the branch taken (defends a future refactor).

**Bug this fixes:** today (token-first) a logged-in agent who opens a share link is treated as a homeowner (`ability=null`), which strips agent-only capabilities at `contracts.router.ts:191` (`if (ctx.ability == null && envelopeDocumentIds) throw`). Agent-first eliminates it.

**Behavior change to verify (a *tightening*, not a widening):** a token in the URL no longer sideways-grants an authenticated agent a row outside their CASL scope. The token is a homeowner credential, not an agent backdoor. **Verification:** grep agent-side (client) callers of shareable endpoints for any "preview via token while authenticated" flow that would regress; none is expected.

The tokenActor **session-path scope remnant** (`shareable-middleware.ts` session branch still calls legacy `resolveEffectiveScope`) is **NOT** touched here — it is Grill C's (folded there already). Phase 6 changes *precedence only*, never how a tokenActor is *authorized*.

## 3. Explicitly deferred (sequential, not scope-cut)

| Deferred | To | Why sequential |
|---|---|---|
| `customer-notes` + `applications` **factory** CASL flip | Phase 7 (Grill B) | They ride the shared `createCrudRouter`; flipping them = flipping the factory uniformly. Phase 6 only declares `parent` (engine-agnostic, safe now). |
| `listImportableProposalMedia` read **shape** | Phase 7 (Grill B) | Bespoke cross-entity read; rolls through owning DALs in the uniform read cutover. Its IDOR gate lands in Phase 6. |
| tokenActor **authorization** redesign (retire `ability==null` field-gates / system-escalation; A-vs-B fork) | Grill C | Needs action-aware scope + field-`permittedFields`, neither of which exists pre-C. |
| `action`-threading through the child path (`resolve-actor-scope.ts` child branch hardcodes `read`) | Grill C / Phase 7 | Only matters for mutations; Phase 6 reads are `action:'read'`. |

## 4. Error handling & edge cases

- **Out-of-scope child id** (getById/update/delete/reorder/movePhase): resolves to zero matched rows via `requireResolvedScope(ctx.scope)` — NOT_FOUND / idempotent no-op, never a throw or existence leak.
- **Omni (super-admin)**: `resolveTrpcActorScope`/`resolveVisibilityScope` return `null` (allow-all) — bridge short-circuits, sees everything. Unchanged.
- **Dispatcher on project-media**: `verbOnly(dispatcher,'read','Project')` = `false` → `sql\`false\`` → deny-all. Correct (dispatchers have no project book).
- **System context** (jobs/webhooks touching media): `systemActor` → `verbOnly` returns `null`, bridge inherits `resolveActorScope(parent, systemActor)` = allow. Unchanged from today's unscoped behavior for system callers.
- **`toggleHero` unset**: bounded to the authorized `projectId`; if `getById(scoped)` misses, the whole op is a NOT_FOUND (caller can't see the row) — no partial unset.
- **Empty `movePhase`/`reorder` input**: no-op (guarded).

## 5. Verification (no test runner — per project constraints)

- **`pnpm tsc && pnpm lint`** green (the only gate; NEVER `pnpm build`).
- **Equivalence proof (EXPLAIN parity), via uncommitted `scripts/tmp-*.ts` probes** (each starts `import './lib/load-env'`):
  - `applications`: assert `resolveEffectiveScope(applicationServerSpec, agentAuth)` (post-parent) SQL ≡ old `applicationVisibility(agentAuth)` for a sample agent.
  - `customer-notes`: assert agent parity; assert dispatcher NOW returns leads-pool notes (the ratified widening), and that a non-leads customer's notes stay hidden from the dispatcher.
  - `project-media`: assert agent sees only participation/owned project media; dispatcher sees none; omni sees all.
- **Manual role E2E** (dev, `pnpm dev:mobile` if hooks fire): agent, dispatcher, super-admin, homeowner-token — per media child + notes. Confirm no false-ALLOW and no over-deny.
- **`git grep` gates:** `customerNoteVisibility`, `applicationVisibility` → zero; `isVisible`/`resolveVisibilityScope` → zero in the two media routers; raw `db.` in `projects.router/media.router.ts` → zero (except intentionally-deferred `listImportableProposalMedia` shape, which keeps its cross-entity read but gains the gate).

## 6. Risk register

- **customerVisibility legacy/CASL divergence (dispatcher).** Legacy `customerVisibility` returns `['leads']` only; CASL dispatcher Customer read is `['leads','rehash','dead']`. In Phase 6 (legacy bridge) dispatcher notes = leads only; at the Phase-7 CASL flip they widen to leads+rehash+dead. Expected and acceptable (tracks the dispatcher-corrections direction) — flagged so the Phase-7 flip isn't mistaken for a regression.
- **Agent "preview via token" regression** (§2.4) — verify by grep before merge; low likelihood.
- **`toggleHero` project-wide unset** must be authorized by the scoped `getById`, not run unconditionally — the de-inline must not reintroduce an unscoped bulk update.
- **Coordination:** proposal-views + project-media land on projects-standardization's restructured code, not the pre-Phase-1 structure (already true in this worktree).

## 7. Acceptance criteria

- `parent` declared on `customer-notes` + `applications`; both `*Visibility` fns deleted; equivalence-gated (EXPLAIN parity for agents; ratified dispatcher widening confirmed).
- Dispatcher CASL `read` + `create CustomerNote` grants added.
- `project-media` fully scoped via `projectMediaProcedure`; `movePhase`/`toggleHero` de-inlined to `media-ops.ts`; precursor probes and `listImportable` gated via `canAccess`; **zero** raw-`db` mutations / legacy `isVisible` left in the media routers.
- `proposal-media` on CASL; its two `isVisible` → `canAccess`.
- `shareableMiddleware` agent-first, with a structural actor-kind guard.
- `pnpm tsc && pnpm lint` green; `git grep` gates clean.
