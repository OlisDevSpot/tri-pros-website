# 04 — Branch drift & build baseline (issue-285 worktree)

Worktree: `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/issue-285`
Branch: `refactor/285-refactor-permissions-casl-scope-compiler` @ `b40403b6`
Merge-base with `main`: `bd35a168` · `main` @ `8df1c206`
Generated: 2026-09-06 (read-only; no files edited, no git state changed)

## ⚠️ Two corrections to the task premise (verified)

1. **Ahead/behind is inverted.** `git rev-list --count main..HEAD` = **74** (branch is 74 ahead, incl. the 2026-08-18 merge commit `31181df0`); `git rev-list --count HEAD..main` = **36** (36 behind). The task said 36 ahead / 74 behind. The ledger in §5 therefore has **74 rows**, and §2 groups **36** main commits.
2. **`docs/plans/2026-09-04-customer-pipelines-feature-boundary-refactor.md` is NOT on main.** `git show main:<path>` → "exists on disk, but not in 'main'". It was added on THIS branch by `2243a2d0` (2026-09-04, "mark customer-pipelines read-API rethink as Phase-9 cleanup residual"). Main has **no** customer-pipelines feature-boundary refactor. See §2.5.

---

## 1. Revert feasibility — `3e901178` and `b40403b6`

### 1.1 `3e901178` — "Phase 7 seam — migrate customer CRUD onto CASL scope compiler" (4 files, +53/-8)

| File | Hunk | Class | Verdict |
|---|---|---|---|
| `src/trpc/lib/create-crud-router.ts` (+19/-2) | adds `import type { SQL }`, widens import to `AppAbility`; adds `resolveScope?: (spec, {userId, ability}) => SQL \| null` to `CreateCrudRouterConfig` (+13-line JSDoc); `const resolveScope = config.resolveScope ?? resolveVisibilityScope` and uses it in `authedProcedure`'s `.use()` to stamp `ctx.scope` | **(a) wrong-layer seam** | Revert whole file. It computes scope at the tRPC procedure and keeps `ctx.scope` alive — the re-orientation says `ctx.scope` must retire and scope must be computed in `createCrudDal` off `ctx.actor` so services/jobs/webhooks are covered too. |
| `src/trpc/routers/customers.router/crud.router.ts` (+17) | `import { resolveTrpcActorScope }` + `resolveScope: resolveTrpcActorScope` + 16-line comment | **(a)** | Revert whole file. |
| `src/shared/entities/customers/lib/visibility.ts` (+17/-6) | **comment-only**: deletes the 4-line comment claiming "the legacy and CASL paths agree" (that claim was FALSE — dispatcher branch emits `derivedPipelineWhere(['leads'])` while CASL at `abilities.ts:233` emits `$inDerivedPipeline: ['leads','rehash','dead','fresh']`); adds a `@deprecated DEAD` tombstone. Function body unchanged. | **(b) partially** | The *removal of the false "paths agree" comment* is worth keeping. The "DEAD" tombstone is wrong (corrected by `b40403b6`) and refers to the flip being reverted. Keep-hunk = a short, accurate comment: "dispatcher branch (`['leads']`) DIVERGES from the CASL Customer rule (4 buckets) — known bug until the DAL-layer cutover; do not wire anything new to this fn." |
| `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (+3/-1) | new "⚠️ 2026-09-06 Phase 7 STARTED" status line (l.6); Phase-7 "Progress (2026-09-06)" bullet; AC reworded to "every factory leaf on `resolveScope`=CASL" | **(c) docs** | Superseded by the uncommitted "CASL-native re-orientation" section (§4). Resolve by keeping the re-orientation and demoting these lines to "reverted / historical". |

### 1.2 `b40403b6` — "Phase 7 unit 7a — flip meeting CRUD onto CASL + correct visibility-death timing" (3 files, +41/-15)

| File | Hunk | Class | Verdict |
|---|---|---|---|
| `src/trpc/routers/meetings.router/crud.router.ts` (+19) | `import { resolveTrpcActorScope }` + `resolveScope: resolveTrpcActorScope` + 18-line comment | **(a)** | Revert whole file. |
| `src/shared/entities/customers/lib/visibility.ts` (+18/-11) | **comment-only** rewrite: "NOT dead yet — live via the `customer-notes` child bridge (`parent: customerServerSpec`, still on the legacy factory) until 7b; dispatcher note update/delete on a non-`leads` customer still NOT_FOUND". | **(b) as knowledge, not as text** | The **child-bridge death-timing rule** ("a `*Visibility` fn dies only once its entity AND every child declaring `parent:<spec>` AND every `buildUserContext`/`shareable` consumer are flipped") is a real, reusable finding. Post-revert the fn is trivially live (customer CRUD legacy + child bridge + `buildUserContext`), so the comment text should not survive as written; keep the rule in the epic doc. |
| `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (+4/-4) | corrects the "dead" claims (l.7); rewrites 7a bullet with the **parity analysis** (agent `$participatesViaMeeting:{via:'self'}` compiles byte-for-byte to legacy `userParticipatesInMeeting`; omni→null both sides; dispatcher = intended widening since bookings are system-owned → participation ≈ ∅ → CASL unconditional `read Meeting`); adds 7d death-timing caveat; Progress line. | **(b) keep two facts** | Keep (i) the death-timing rule and (ii) the Meeting parity analysis — it is exactly the per-entity **equivalence gate** the DAL-layer cutover will need (§4 re-orientation item 7). The Track-B/7a–7h ordering prose is superseded anyway. |

### 1.3 Does anything later build on these hunks?

- **`5fec560b`** is **earlier** than `3e901178` (10:57 vs 13:51; `git merge-base --is-ancestor 3e901178 5fec560b` → NO). It touches only `src/shared/domains/permissions/abilities.ts` (+17/-7, dispatcher note/profile grants). **No dependency.**
- **`b0d50234`** is docs-only (epic doc, +27/-11, the Track-B/Phase-7.5 grill). It edits the same Phase-7 block as `3e901178` → doc **conflict on revert**, no code dependency.
- **Uncommitted**: only the epic doc (re-orientation) + untracked `CLAUDE.local.md`. **No code.**
- `git grep resolveScope HEAD -- src` → only the 3 code files from these two commits (`create-crud-router.ts:80,98,100`, `customers.router/crud.router.ts:50`, `meetings.router/crud.router.ts:35`). The other `resolveTrpcActorScope` importers (`customers|meetings|projects|proposals .router/procedures.ts`) are the read-side `xProcedure` middlewares from Phases 1/4/5 and are untouched by a revert (the `customers/lib/visibility.ts` grep hit is comment text only).

### 1.4 Dry-run reverts (via `git merge-tree --write-tree --merge-base=<C> HEAD <C>^`; working tree untouched)

| Revert | Result |
|---|---|
| `b40403b6` (= HEAD) | **exit 0 → clean** (tree `88d8511d`). |
| `3e901178` directly on HEAD | **exit 1 → 2 conflicts**: `src/shared/entities/customers/lib/visibility.ts` (b40403b6 rewrote the same comment block) and the epic doc (b0d50234 + b40403b6 edited the same hunks). `create-crud-router.ts` and `customers.router/crud.router.ts` revert cleanly. |

**Verdicts**
- `b40403b6`: **clean `git revert`** — but a clean revert of it alone RESTORES `3e901178`'s wrong "DEAD" tombstone and the wrong "dead" claims in the doc; it only makes sense paired with the second revert.
- `3e901178`: **partial-keep**. Revert `create-crud-router.ts` + `customers.router/crud.router.ts` wholesale; for `customers/lib/visibility.ts` keep a corrected comment (not the original false one, not the tombstone); leave the doc to the re-orientation edit.
- **Recommended mechanics** (user choice): either (A) `git revert --no-commit b40403b6` then `git revert --no-commit 3e901178` (second is then clean for `visibility.ts`; only the epic doc conflicts — resolve by keeping the working-tree re-orientation), or (B) one hand-authored `revert(permissions): unwind router-seam flips 3e901178 + b40403b6` commit — the code surface is 3 files / ~55 lines, so (B) is less churn and avoids restoring the false comment. Note the uncommitted doc edit must be committed or otherwise parked first in either path (no stash — shared stack).

### 1.5 ⚠️ Regression the revert re-opens (decide before reverting)
Both commits were bug fixes as much as seam work. After revert, until the DAL-layer cutover lands:
- **Dispatcher "Failed to update profile"** on `fresh|rehash|dead` customers returns (legacy `customerVisibility` → `['leads']` at `src/shared/entities/customers/lib/visibility.ts:33` vs CASL 4-bucket rule at `abilities.ts:233` → UPDATE matches zero rows → NOT_FOUND).
- **Dispatcher cannot `getById`/`update` the meeting they booked** returns (legacy `meetingVisibility` participation vs CASL unconditional read).
- Layer-neutral interim option, if dispatchers are live: widen the legacy fn's dispatcher branch to `derivedPipelineWhere(['leads','rehash','dead','fresh'])` (parity with CASL, one line, no router seam) — a (b)-class fix. Not applied; user ruling needed. (`meetingVisibility`'s dispatcher branch was not inspected here.)

---

## 2. Main drift analysis (`bd35a168..main`, 36 commits, 199 files, +11150/-4409)

### 2.1 Main commits grouped by theme

| Theme | Commits |
|---|---|
| **A. crud-dal sub-plan B — transaction threading** (`Tx` type, `ctx.tx?`, `withTx`, `exec = ctx.tx ?? db` across crud impls) | `9c68d359` `a8c63c10` `95a7a393` `3a17e4d6` `f1fe7d6e` `fd8071cb` |
| **B. crud-dal sub-plan D — hooks → config factory; `spec.hooks`/`spec.duplicate` DELETED from `EntityServerSpec`; `synthesizeFromSpec` shim deleted; lead-sources + projects onto `createCrudDal`** | `0e66b7b6` `388425df`(customers) `b0db6c27`(proposals) `cc1e52a3`(customer-notes) `43f7dec9`(D-b purge) `909b9066`(lead-sources) `7aca28ca`(projects) `3145b79a`(docs) |
| **C. Projects standardization Phase 3 residuals** — `accounting.service`, `business.router`, `media.router`, `google-drive.router` made `db`-free | `c33adb9c` `5f0b0a53` `92830c01` `01144ab1` `312ae0ab` |
| **D. Providers #248 docs** | `cd234423` `6eaa4488` `8e701a8e` |
| **E. JustCall dialer migration** (CloudTalk→JustCall; entity rename `voip-contact-attributes`→`voip-contact-fields`; `VOIP_CONTACT_ATTRIBUTE`→`VOIP_CONTACT_FIELD` in `abilities.ts`) + build fix (restores cloudtalk provider + `LeadSource` ability subject) | `26c54190` `22974394` `2e3e84ac` |
| **F. JSONB Wave 3 prod cutover docs / W4 pre-design** | `4b28d2a0` `0c235beb` `8df1c206` |
| **G. UI / meetings** (default sort, outcome badge + semantic colors, motion tokens, editor ignore, contract toast) | `79862b85` `ef6282b0` `e7fe7a91` `ffb8aacf` `9050e963` |
| **H. Email deliverability** | `decc360b` |
| **I. Docs catch-up — incl. a self-labelled STALE copy of the CASL epic doc + identical Phase-0 plan** | `27db81b4` `ff4955d9` |

### 2.2 Files touched by BOTH sides (16)

| File | main | branch | merge-tree |
|---|---|---|---|
| `docs/plans/2026-08-10-casl-scope-compiler-epic.md` | +90/-0 (stale draft) | +324/-0 | **CONFLICT add/add** |
| `docs/superpowers/plans/2026-08-10-casl-phase-0-engine-scaffolding.md` | +675 | +675 | identical — clean |
| `src/shared/dal/server/lib/create-crud-dal.ts` | +12/-41 | +4/-4 | **CONFLICT ×3 hunks** |
| `src/shared/dal/server/lib/helpers.ts` | +36 (`withTx`) | +28 (`requireResolvedScope`, actor in `buildUserContext`) | auto |
| `src/shared/dal/server/types.ts` | +4/-58 (`tx?`, hooks/duplicate deleted) | +25 (`actor: Actor`) | **CONFLICT ×1 hunk** |
| `src/shared/domains/permissions/abilities.ts` | +8/-4 | +49/-9 | auto |
| `src/shared/entities/customer-notes/lib/server-spec.ts` | +4/-71 | +16/-27 | **CONFLICT ×3 hunks** |
| `src/shared/entities/customers/DOCS.md` | +4/-5 | +11/-8 | auto |
| `src/shared/entities/customers/dal/server/queries.ts` | +1/-1 | +5/-5 | auto |
| `src/shared/entities/projects/lib/server-spec.ts` | +8/-12 | +0/-2 | auto |
| `src/shared/entities/proposals/dal/server/queries.ts` | +61 | +4/-4 | auto |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts` | +20/-20 | +1/-1 | auto |
| `src/shared/entities/voip-campaign-contacts/lib/visibility.ts` | +1/-1 | deleted | **CONFLICT modify/delete** |
| `src/shared/entities/voip-contact-attributes/lib/server-spec.ts` | deleted (renamed entity) | +0/-2 | **CONFLICT modify/delete** |
| `src/trpc/DOCS.md` | +2/-2 | +5/-3 | auto |
| `src/trpc/routers/projects.router/media.router.ts` | +9/-65 | +39/-48 | **CONFLICT ×4 hunks** |

Plus two rename-related conflicts not in the intersect list: `voip-contact-attributes/lib/visibility.ts` → renamed on main to `voip-contact-fields/lib/visibility.ts` (rename/delete) and `voip-contact-fields/lib/visibility.ts` (modify/delete).

### 2.3 Dry-run merge (`git merge-tree --write-tree main HEAD` → exit 1, result tree `e270c224`) — **9 conflict entries / 8 paths**

| # | Path | Nature | Resolution sketch |
|---|---|---|---|
| 1 | `docs/plans/2026-08-10-casl-scope-compiler-epic.md` | add/add; main's `27db81b4` copy says "STALE DRAFT … LIVE tracker is on branch" | Take branch (working-tree version incl. re-orientation) wholesale. |
| 2 | `src/shared/dal/server/lib/create-crud-dal.ts` | 3 hunks (getById l.84, update l.188, delete l.245 in result tree): main `const exec = ctx.tx ?? db` + `ctx.scope ?? undefined` vs branch `requireResolvedScope(ctx.scope)` + `db` | Keep BOTH: `exec` + `requireResolvedScope(...)`. Mechanical. **This is the exact file/lines the re-orientation targets** (`:117/:213/:264` at HEAD → shift post-merge; the future `resolveActorScope(spec, ctx.actor, <action>)` replaces `requireResolvedScope(ctx.scope)` on these 3 lines; `exec` must be preserved for tx threading). |
| 3 | `src/shared/dal/server/types.ts` | 1 hunk: main `tx?: Tx` vs branch `actor: Actor` inserted at the same point in `ScopedContext` | Keep both fields. (Main's deletion of `spec.hooks`/`spec.duplicate` auto-merges; `hooks?` at result-tree l.149 is on `CrudConfig`, not the spec — fine.) |
| 4 | `src/shared/entities/customer-notes/lib/server-spec.ts` | 3 hunks: branch's imports (`dalVerifySuccess`, `canAccess`, `ThrowableDalError`, `customerServerSpec`, `assertNoteAuthorOrAdmin`) + `hooks:` block (canAccess parent probe from `5a983124`; lazy-import author gates) vs main's removal (hooks relocated to `dal/server/crud.ts` by `cc1e52a3`) | Drop the spec `hooks` (type no longer allows it). **PORT** branch's `canAccess(customerServerSpec, ctx.actor, input.customerId)` probe into main's `customer-notes/dal/server/crud.ts` `create.before`, replacing main's legacy `buildUserContext(userId, role, customerServerSpec)`/`SYSTEM_CONTEXT` probe (result tree l.44-45) — otherwise the dispatcher note-create NOT_FOUND fixed by `5a983124` regresses. Keep main's `crudHandlers.getById` update-gate and G4 row-prefetch `delete.before(row, ctx)` signature. Branch's `parent: { spec: customerServerSpec, fk: customerNotes.customerId }` and the deletion of `customer-notes/lib/visibility.ts` + `visibility:` line **auto-merged correctly** (verified in result tree). |
| 5 | `src/shared/entities/voip-campaign-contacts/lib/visibility.ts` | deleted on branch (Phase A `a8ec6c3f`), 1-line comment edit on main | Delete. Confirm nothing on main re-imports it (`voip-campaign-contacts/lib/server-spec.ts` was on the branch's Phase-A list). |
| 6 | `src/shared/entities/voip-contact-attributes/lib/server-spec.ts` | deleted on main (entity renamed), branch dropped its `visibility:` line | Delete; **re-apply the same `visibility:` removal to `voip-contact-fields/lib/server-spec.ts`** (result tree l.4,17 still wires `voipContactFieldVisibility`). |
| 7 | `voip-contact-attributes/lib/visibility.ts` → `voip-contact-fields/lib/visibility.ts` | rename/delete | Delete the renamed file (after #6). |
| 8 | `src/shared/entities/voip-contact-fields/lib/visibility.ts` | modify/delete | Same as #7. |
| 9 | `src/trpc/routers/projects.router/media.router.ts` | 4 hunks — **both sides refactored the same 3 procedures differently**. Main (`92830c01`): de-inlined to `moveMediaPhase`/`setHeroImage` in `media-files/dal/server/mutations.ts` (scoped via legacy `ctx.scope ?? undefined`) and `listImportableProjectMedia(projectId)` in `proposal-media-files/dal/server/queries.ts` — **unscoped, no actor/ctx**, "authorization by construction" via the meeting→project join (any agent can enumerate proposal media for any `projectId`). Branch (`59676416`/`f286b3c6`): `mediaService.movePhase/setHero(projectMediaStore, ctx, …)` via `media-ops.ts` + `canAccess(projectServerSpec, ctx.actor, input.projectId)` guard + an inline raw `db.select` (which main's Phase 3 outlawed in routers). | Keep branch's `projectMediaProcedure` + `canAccess` guard AND main's DAL extraction: call main's `listImportableProjectMedia` behind the branch's probe (drop the inline `db` select). For movePhase/setHero, pick ONE of `mediaService.*` (branch, `media-ops.ts`) vs main's naked-writer `moveMediaPhase/setHeroImage` — the other is dead post-merge. **Needs a human ruling; worst semantic conflict.** |

### 2.4 Auto-merged but semantically hot (verify with `pnpm tsc` + a read after merging)

- **`spec.hooks` type removal vs branch's spec-hooks users**: at HEAD, `customers`, `customer-notes`, `proposals` `lib/server-spec.ts` still carry `hooks:`. `customers`/`proposals` resolve silently to main's hookless versions (branch never touched them since base; hooks now live in their `dal/server/crud.ts` factories on main) — only `customer-notes` is a textual conflict (#4).
- **`actor: Actor` is required on `ScopedContext`** (branch `d6302917`). Main added many context-construction sites: `SYSTEM_CONTEXT` usage 83→103 (`accounting.service.ts`, `projects/dal/server/crud.ts`, `customers/dal/server/crud.ts`, `customer-notes/dal/server/crud.ts`, JustCall `api/webhooks/justcall/route.ts`, upstash jobs `bulk-enroll|enroll-lead|enroll-source-batch|graduate-from-campaign`, `campaign-sync.service`, `enrollment.service`, `notification.service`) plus `{ ...ctx, scope: null }` ×4 in `lead-sources.router.ts` and ×3 in `projects.router/crud.router.ts`. All use the constant or a spread, and `SYSTEM_CONTEXT.actor = systemActor('legacy:system-context')` at HEAD → **should type-check**; no literal `{ session:…, ability:… }` constructions were added on main (grep). But: (i) branch convention (`4b352564`) prefers `systemContext(reason)` for new privileged writes → ~20 new un-reasoned bypass sites to sweep; (ii) `scope: null` with a non-omni actor are omni-by-construction sites that the **DAL self-scoping cutover will change behavior on** (agents get their real scope) — main's own comment in `projects.router/crud.router.ts` calls this "the #285 tail".
- **Two NEW legacy-engine consumers on main**: `lead-sources/lib/visibility.ts` (`sql\`false\``, super-admin-only via omni) and `voip-contact-fields/lib/visibility.ts` — both wired as `spec.visibility`. Phase A's deletion criteria and Phase 8's engine deletion must cover them.
- `proposals/dal/server/queries.ts`: main adds `getProposalsByIds/ByMeetingId/ByInvoiceIds/ByInvoiceId` with `ctx.scope ?? undefined` (4 new sites) — branch's `7be79ab0` convention says `requireResolvedScope`.
- `abilities.ts`: main adds `LEAD_SOURCE` to `ENTITY_NAMES` + `VoipContactField` rename; branch adds dispatcher conditional rules + `5fec560b` grants. No textual overlap.
- `helpers.ts`: `withTx` (main) + `requireResolvedScope`/actor-stamping `buildUserContext` (branch) coexist.
- `src/trpc/DOCS.md`, `customers/DOCS.md`: prose merges — re-read for stale rules post-merge.

### 2.5 `docs/plans/2026-09-04-customer-pipelines-feature-boundary-refactor.md` vs Phase-5 work

- **Provenance**: branch commit `2243a2d0` (2026-09-04), status "DEFERRED — NOT part of #285 … land as its own grill AFTER the permissions epic merges; coordinate with Phase 7 Grill B". Not a main-side refactor.
- **What it says**: `customer-pipelines` is a legitimate *feature*, but (1) `src/trpc/routers/customer-pipelines.router.ts:4-7` imports its reads from `features/` (forbidden `shared/trpc ← features` inversion); (2) the Grill-D dispatcher financial wall (`c62813d5`) is a defensive patch — per-builder `resolveActorScope(proposalServerSpec, actor)` gates, a threaded `canReadProposals` boolean, a `maskFinancials()` post-pass, inline suppression in `get-customer-profile.ts` — user ruling: "NOT good code"; (3) param-threading smell `(actor, customerScope, inBucket, canSeeUngated, canReadProposals)` all recomputable from `ctx.actor` + pipeline; (4) business logic in the router (`getRecordingUrl`, `getCustomerProjects` — unscoped `db.select` returning proposals — `assignToProject`); (5) `get-customer-pipeline-items.ts` ~21KB/5 builders.
- **Overlap with Phase 5** (`db87d28d` derive 5-bucket pipeline from meeting outcomes; `a9808587` drop `leadsPoolVisibility`; `30268c71` profile/move/router onto `ctx.actor`; `13f361bb` list rewrite onto actor scope + single-bucket + pipeline-access guard): the doc **critiques Phase 5's own output** — the param-threading and the router-hosted reads are exactly what `30268c71`/`13f361bb` produced, and the `maskFinancials` layer is `c62813d5`. Its point 3 ("collapse into … a self-scoping DAL keyed on the actor") is a direct consequence of the re-orientation's model (DAL self-scopes off `ctx.actor`), so this doc should be **re-pointed at the re-orientation section** rather than at "Phase 7 Grill B".
- **Merge overlap with main: none.** Main did not touch `src/features/customer-pipelines/dal/**`, `customer-pipelines.router.ts`, or `src/shared/domains/pipelines/**`; its only file under the feature is `ui/components/create-project-form.tsx` (+185/-158, UI-only), which the branch does not touch.

---

## 3. Build baseline (worktree, HEAD `b40403b6` + uncommitted doc edit)

| Check | Result | Log |
|---|---|---|
| `pnpm tsc` (`tsc --noEmit`) | **PASS — exit 0, zero errors** | `<scratchpad>/tsc.log` |
| `pnpm lint` | **PASS — exit 0; 0 errors, 63 warnings** (pre-existing classes: `react/no-array-index-key`, `react-hooks-extra/no-direct-set-state-in-use-effect`, e.g. `src/shared/domains/funnels/ui/funnel-landing.tsx:121`, `src/shared/domains/multi-step-flow/hooks/use-step-engine.ts:45,56,61`, `src/shared/services/providers/resend/emails/proposal-email.tsx:174`) | `<scratchpad>/lint.log` |

Nothing was fixed. Baseline is green; any post-revert / post-merge red is new.

---

## 4. Working-tree state

`git status --short`:
```
 M docs/plans/2026-08-10-casl-scope-compiler-epic.md
?? CLAUDE.local.md
```

**Uncommitted diff — epic doc** (+50/-2, all in the tracker header + Phase-7 block):
- Adds a **"⚠️ CURRENT NORTH STAR (2026-09-06)"** pointer line after "Related:", and a new section **"## CASL-native re-orientation (2026-09-06 research — SUPERSEDES the router-seam approach + the Track B/C split)"**: *What got WRONG* (`3e901178`/`b40403b6` = wrong layer, revert; Track-B/Track-C(7.5) split = wrong cut, 7.5 folds back into 7; "scope = f(actor,subject,action)" framing off — CASL already is that fn) · *Agreed model* (DAL/CRUD self-scopes off `ctx.actor` via `resolveActorScope(spec, actor, action)`; Phase 5's "factory never reads `ctx.actor`" superseded by Grill B; action-aware from the start; `ctx.scope` + `spec.visibility` retire) · *CASL does this natively* (`can(action, subject, fields?, conditions?)`, `rulesToAST` per action, `permittedFieldsOf` replaces `assertCanUpdateFields`, `packRules` for client/server parity) · *Our engine is canonical* (`compileScope` ≡ `accessibleBy` pipeline; ucast has no Drizzle target) · *Reference impl* `WebDevSimplified/casl-crash-course` "cloned at `<session scratchpad>/casl-crash-course`" · *7-item Phase-7 work list* · **OPEN grill question**: `resolveActorScope`'s CHILD branch is `verbOnly` + parent bridge and would silently ignore an own-column condition like `{authorId}` on CustomerNote — shape (a) child branch compiles own-column conditions AND parent bridge, vs (b) model own-record entities as ROOTS with a `$customerVisible`-style operator · *Exact CASL API surface*.
- Rewrites the Phase-7 heading to "**DAL self-scopes off `ctx.actor` (CASL-native, action-aware)**", marks the block as RE-ORIENTED, and strikes the "Track B ONLY" sentence; the 7a–7h prose is left "for history".
- ⚠️ Flags: the clone path `<session scratchpad>/casl-crash-course` is session-specific and will not exist for a fresh session; `@ucast/core` must be added as an explicit dependency if its condition classes are imported directly (currently transitive).

**`CLAUDE.local.md` (untracked dispatch file) — STALE**: header + issue body still describe **Phase 0** ("Additive/unwired CASL to SQL scope compiler … git grep confirms zero production wiring; EXPLAIN parity with `userCanSeeCustomer`/`leadsPoolVisibility`"), whereas the branch is at Phase 7 with the engine fully wired (`leadsPoolVisibility` was deleted in `a9808587`). Its "When Done" step 2 says **`pnpm build`**, contradicting the project rule (never `pnpm build` unless asked). Port 3003. Treat as informational only; do not follow its issue body.

---

## 5. Branch commit ledger (`main..HEAD`, 74 commits, oldest → newest)

Type = conventional-commit type; Files = `git diff-tree --name-only` count. ⚠️ = wrong-layer commit to revert.

| # | SHA | Date | Phase | Type | Files | Note |
|---|---|---|---|---|---|---|
| 1 | `7ccc622f` | 08-11 | P0 | docs | 2 | epic tracker + Phase 0 plan |
| 2 | `d28d8137` | 08-11 | P0 | feat | 1 | `Actor` seam (`scope/actor.ts`) |
| 3 | `950c8d7f` | 08-11 | P0 | feat | 1 | scope AST structural types |
| 4 | `a82ea956` | 08-11 | P0 | feat | 1 | scope operator registry |
| 5 | `c0eb6c0b` | 08-11 | P0 | feat | 1 | meeting-participation operators |
| 6 | `e9f87cf6` | 08-11 | P0 | feat | 1 | AST interpreter |
| 7 | `78397928` | 08-11 | P0 | feat | 1 | `compileScope` |
| 8 | `18c842a6` | 08-11 | P0 | feat | 1 | `resolveScope` + `verbOnly` + `canAccess` (DAL) |
| 9 | `2203fd9d` | 08-11 | P0 | docs | 1 | Phase 0 complete w/ EXPLAIN evidence |
| 10 | `e3186a28` | 08-11 | P0 | fix | 2 | fail-loud on unsupported compound ops; canAccess action-drop doc |
| 11 | `40184db7` | 08-11 | P0→1 | docs | 1 | review carry-forwards |
| 12 | `88e6ff2b` | 08-11 | P1 | feat | 4 | CASL custom-operator parser wired |
| 13 | `dd6d4a2d` | 08-11 | P1 | feat | 3 | `$inDerivedPipeline` operator (dispatcher) |
| 14 | `ce76fc04` | 08-11 | P1 | feat | 1 | scope-wiring exhaustiveness assert |
| 15 | `4e30a4ef` | 08-11 | P1 | feat | 1 | ability built w/ conditions matcher + startup assert |
| 16 | `523a31cc` | 08-11 | P1 | feat | 1 | `resolveActorScope` (tRPC request-scope helper) |
| 17 | `9dca3d72` | 08-11 | P1 | refactor | 1 | align `$participatesViaMeeting` EXISTS projection |
| 18 | `2cb7c451` | 08-11 | P1 | refactor | 2 | compile Customer row-visibility (adds dispatcher rehash) |
| 19 | `cf776d9e` | 08-12 | P1 | refactor | 1 | hold dispatcher Customer at leads-only |
| 20 | `ead96d15` | 08-12 | P1 | refactor | 2 | compile Meeting row-visibility |
| 21 | `603a4c1d` | 08-12 | P1 | refactor | 2 | compile Proposal row-visibility |
| 22 | `e2a8fd12` | 08-12 | P2 | refactor | 4 | compile Project row-visibility; drop `isPublic` drift |
| 23 | `b9d4170d` | 08-12 | P1 | docs | 5 | Phase 1 complete; defer rehash + pipeline rethink |
| 24 | `886137ff` | 08-12 | P2 | docs | 1 | reconcile Phase 2 wording |
| 25 | `cfb51c39` | 08-12 | P1/2 | fix | 5 | keep scope-operator SQL out of client bundle |
| 26 | `8c6797d9` | 08-12 | P4 | docs | 1 | log P4-a/P4-b customer-profile point-read gaps |
| 27 | `4d10cac9` | 08-13 | P3 | refactor | 10 | rename resolvers (`resolveActorScope`/`resolveTrpcActorScope`) |
| 28 | `dbb9206c` | 08-18 | P3 | refactor | 3 | robustness gate — `parent.fk` mis-wire guardrail |
| 29 | `1d6e7c94` | 08-18 | P4–8 | docs | 1 | resequence epic into Phase 4→8 + actor-seam conventions |
| 30 | `31181df0` | 08-18 | — | merge | 0 | Merge `main` into branch |
| 31 | `96f5dcd3` | 08-18 | P3 | fix | 1 | keep projects on CASL scope post-merge |
| 32 | `d1751dfc` | 08-18 | P4 | docs | 1 | rename deny-safe helper → `requireResolvedScope`; merge outcome |
| 33 | `95a814dd` | 08-18 | P4 | docs | 1 | Phase 4 actor-seam hardening plan |
| 34 | `4b352564` | 08-18 | P4 | refactor | 3 | `SystemReason` union + `systemContext` factory |
| 35 | `7be79ab0` | 08-18 | P4 | refactor | 15 | `requireResolvedScope` at 22 DAL sites |
| 36 | `f77e88a9` | 08-18 | P4 | fix | 4 | canonical share-token→`tokenActor` path (§8-3) |
| 37 | `126356be` | 08-18 | P4 | fix | 1 | meeting-flow `updateCustomerProfile` row-probe (§8-1) |
| 38 | `b39537fd` | 08-18 | P4 | fix | 1 | `contracts.age` named systemContext (§8-2) |
| 39 | `d239b476` | 08-18 | P4 | fix | 1 | `assignToProject` probes meeting+project (#4) |
| 40 | `e70fa9b9` | 08-18 | P4 | fix | 1 | `getRecordingUrl` customer read-probe (#6) |
| 41 | `ac614fcb` | 08-18 | P4 | fix | 1 | activities owner-check (#7) |
| 42 | `2167e65c` | 08-18 | P4 | docs | 1 | `scope.ts:94` residual noted |
| 43 | `e012eeab` | 08-18 | P4 | docs | 2 | share-token comment refresh |
| 44 | `d00179e8` | 08-18 | P4 | docs | 1 | Phase 4 DONE; fold phone cutover into P5 |
| 45 | `d6302917` | 08-19 | P5 | refactor | 12 | **`actor` on `ScopedContext`** (Phase 5 seam) |
| 46 | `db87d28d` | 08-19 | P5 | refactor | 5 | derive 5-bucket pipeline from meeting outcomes |
| 47 | `b3a34dc8` | 08-19 | P5 | docs | 1 | Phase 5 customer-pipelines adoption plan |
| 48 | `a9808587` | 08-19 | P5 | refactor | 4 | drop `leadsPoolVisibility`; leads = `derivedPipelineWhere(['leads'])` |
| 49 | `30268c71` | 08-19 | P5 | refactor | 3 | customer-pipelines profile/move/router onto `ctx.actor` |
| 50 | `13f361bb` | 08-19 | P5 | refactor | 2 | customer-pipelines list onto actor scope + pipeline-access guard |
| 51 | `3390aaff` | 08-19 | P5 | refactor | 8 | phone gate reads the actor |
| 52 | `7492dbb8` | 08-19 | P5 | docs | 1 | Phase 5 DONE |
| 53 | `e136cd58` | 08-20 | finding | docs | 1 | CASL/legacy mutation split finding + B/C grills |
| 54 | `21758862` | 08-20 | disp | feat | 3 | dispatcher visibility → rehash + dead |
| 55 | `a8ec6c3f` | 08-20 | Phase A | chore | 24 | delete dead legacy visibility code |
| 56 | `8ecaf8d7` | 08-20 | Grill B | docs | 1 | Grill B outcome; financial chokepoint → P7 |
| 57 | `270e07be` | 08-20 | C/D | docs | 1 | anchor work-units C and D |
| 58 | `3d9ec42b` | 08-20 | P6 | docs | 1 | re-ground Phase 6 to Shape B; Grill-C token-authz frame |
| 59 | `4b705e81` | 08-24 | P6 | refactor | 3 | bridge applications → Meeting parent |
| 60 | `c215c3d2` | 08-24 | P6 | refactor | 3 | bridge customer-notes → Customer parent + dispatcher note grants |
| 61 | `59676416` | 08-25 | P6 | refactor | 2 | scoped `moveMediaPhase`/`setHeroImage` DAL ops (`media-ops.ts`) |
| 62 | `f286b3c6` | 08-28 | P6 | refactor | 2 | project-media via `projectMediaProcedure` + close IDORs |
| 63 | `07442fb8` | 09-03 | P6 | refactor | 2 | proposal-media → CASL scope + `canAccess` probes |
| 64 | `ac8efe45` | 09-03 | P6 | refactor | 2 | agent-first precedence on shareable seam |
| 65 | `6c565a66` | 09-03 | P6 | docs | 2 | Phase 6 spec + plan |
| 66 | `c62813d5` | 09-04 | Grill D | fix | 3 | customer-pipelines: gate proposals by Proposal scope (`maskFinancials`) |
| 67 | `2243a2d0` | 09-04 | P9 | docs | 2 | customer-pipelines read-API rethink → Phase-9 residual (adds the 2026-09-04 doc) |
| 68 | `ad71a076` | 09-04 | disp | feat | 3 | dispatcher fresh-wide operational pipeline |
| 69 | `5a983124` | 09-06 | disp | fix | 1 | note-create parent probe via `canAccess` |
| 70 | `b37695ca` | 09-06 | status | docs | 2 | Phases 0–6 + dispatcher corrections DONE |
| 71 | `5fec560b` | 09-06 | disp | feat | 1 | dispatchers write notes + full discovery profile (`abilities.ts` only) |
| 72 | `3e901178` | 09-06 | P7 | feat | 4 | ⚠️ **WRONG LAYER** — `resolveScope` seam on `createCrudRouter`; customer CRUD flipped |
| 73 | `b0d50234` | 09-06 | P7 | docs | 1 | Phase 7 sequencing grill (Track B / 7.5) — superseded by re-orientation |
| 74 | `b40403b6` | 09-06 | P7 | feat | 3 | ⚠️ **WRONG LAYER** — meeting CRUD flipped; death-timing correction (keep the rule) |

---

## Appendix — commands run (all read-only)
`git rev-parse/merge-base/rev-list --count`, `git log`, `git show`, `git diff --stat/--numstat/--name-only`, `git merge-tree --write-tree main HEAD` (result tree `e270c224`), `git merge-tree --write-tree --merge-base=<C> HEAD <C>^` for both reverts, `git grep … HEAD`, `git cat-file -e <tree>:<path>`, `pnpm tsc`, `pnpm lint`. Logs: `<scratchpad>/tsc.log`, `<scratchpad>/lint.log`, `<scratchpad>/merge-tree.log`, `<scratchpad>/revert-3e9.log`.
