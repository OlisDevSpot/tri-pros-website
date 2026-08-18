# CASL Scope Compiler — Phase 3 (Robustness Gate) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the built-but-dead child-bridge branch and the never-called `token`/`system` principals *safe to wire later* — add ONE loud guardrail against a mis-pointed `parent.fk`, and prove (via uncommitted scratch EXPLAIN) that the bridge + both principals emit correct SQL. No production wiring, no child cutovers.

**Architecture:** Phase 3 is a robustness/proof gate, not propagation. It touches exactly one production file — `resolve-scope.ts` — folding a §11.2 FK-ownership check into `fkColumn(spec)` (the single access point the child bridge uses). Everything else is uncommitted scratch verification whose evidence is recorded in this plan's verification log and the epic tracker. The child cutovers, the 4 missing specs, and the actor-construction seam (`tokenActor`/`systemActor` call sites, `shareableMiddleware` replacement) are **Phase P (Propagation)** and explicitly out of scope here.

**Tech Stack:** TypeScript, Drizzle ORM 0.45, `@casl/ability` 6.8, `tsx` (scratch runner), Postgres/Neon (per-worktree branch).

**Problem statement (READ FIRST):** `docs/superpowers/specs/2026-08-12-casl-phase-3-children-and-actors-problem-statement.md`. **Design:** `docs/superpowers/specs/2026-08-10-casl-scope-compiler-design.md` §5 (sub-entity bridge), §3 (Actor seam), §11.2 (fk-validate). **Epic tracker:** `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (Phase 3).

**Resolves the problem statement's §6 open questions:**
1. **fk-validation mechanism** → *validate-explicit* via table-name comparison folded into `fkColumn` (lazy, at bridge-use; registry-free — fires the moment any child resolves through the new engine). Chosen over derive-from-Drizzle-metadata (`getTableConfig`, unused in repo, heavier) — a `parent.fk` is always authored explicitly, so validating the authored column is sufficient and direct.
2. **Proof coverage** → the real `proposal_media_files → Proposal` topology (already declares `parent`), under all four principal cases: agent-user (participation), deny-user (own-term `sql\`false\``), `token` (through the bridge), `system` (allow-all bridge).
3. **Scope of specs touched** → prove on `proposal_media_files` ONLY. Declaring `parent` on the other 5 children is Front A = Propagation (Phase P).

## Global Constraints

- **No test runner in this repo.** Verify every task with `pnpm tsc && pnpm lint` (both green) + scratch `tsx` EXPLAIN. **Do NOT** add vitest/jest, a `test` script, or any committed test/verification file (user ruling). **NEVER run `pnpm build`** (ignore any worktree instruction that says otherwise).
- **Scratch verifiers are uncommitted and run from INSIDE the worktree root.** The session scratchpad is outside the repo, so `node_modules`/`@/` aliases do NOT resolve there — write the scratch to a `__verify_*.ts` file at the worktree root, run it, capture output into this plan's verification log, then `rm` it. Never `git add` a `__verify_*.ts` file.
- **Staging is explicit, by path. NEVER `git add -A`.** This worktree is the home for the whole epic — **no PR, no push, no merge.** Per standing instruction, only run the `git commit` steps when the user has approved the commit; otherwise leave the change staged/described.
- **Additive only.** No child cutovers, no new specs, no deletion of bespoke child scoping, no `tokenActor`/`systemActor` call sites, no `shareableMiddleware` changes. If a task seems to require any of those, STOP — it belongs to Phase P.
- **Sentinel semantics (unchanged, load-bearing):** `resolveScope` → `null` = allow-all (no WHERE); `sql\`false\`` = deny; non-null SQL = the compiled predicate. The risk surface is entirely false-ALLOW.

---

### Task 1: `parent.fk` mis-wiring guardrail in `fkColumn`

A `parent.fk` that points at a column on **another** table (classically the parent's own pk) makes the bridge emit `parent.pk IN (SELECT parent.pk FROM parent WHERE …)` — a self-correlated wrong-join that passes **every** child row (false-ALLOW, spec §11.2). `fkColumn(spec)` is the single place the bridge reads that column, so the check belongs there. Today it returns the column unvalidated.

**Files:**
- Modify: `src/shared/dal/server/lib/resolve-scope.ts` (import line 8; `fkColumn`, lines 97-102)
- Verify (worktree root, **uncommitted**): `__verify_fk_guard.ts`

**Interfaces:**
- Consumes: `EntityServerSpec.parent.fk: PgColumn`; `resolveScope(spec, actor)` (drives the bridge that calls `fkColumn`).
- Produces: `fkColumn(spec)` — signature unchanged (`(spec: EntityServerSpec) => PgColumn`); now **throws** `Error` when `spec.parent.fk` is not a column on `spec.table`.

- [ ] **Step 1: Write the scratch that exercises the gap**

Write `__verify_fk_guard.ts` at the worktree root. It drives the (private) `fkColumn` through the public `resolveScope`, once with the real spec and once with a spec whose `parent.fk` is deliberately mis-pointed at the parent's pk:

```ts
// __verify_fk_guard.ts — pnpm tsx __verify_fk_guard.ts   (uncommitted; rm after)
import type { EntityServerSpec } from '@/shared/dal/server/types'
import { sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema/proposals'
import { resolveScope } from '@/shared/dal/server/lib/resolve-scope'
import { systemActor } from '@/shared/domains/permissions/scope/actor'
import { proposalMediaServerSpec } from '@/shared/entities/proposal-media-files/lib/server-spec'

const good = proposalMediaServerSpec as unknown as EntityServerSpec
// MIS-WIRE: fk points at the PARENT's own pk instead of the child's proposal_id.
const bad = { ...good, parent: { spec: good.parent!.spec, fk: proposals.id } } as EntityServerSpec

function run(label: string, spec: EntityServerSpec) {
  try {
    const scope = resolveScope(spec, systemActor('verify'))
    const printed = scope == null
      ? 'NULL'
      : db.select({ x: sql`1` }).from(spec.table).where(scope).toSQL().sql
    console.log(`${label} → NO THROW; scope: ${printed}`)
  }
  catch (e) {
    console.log(`${label} → THREW: ${(e as Error).message}`)
  }
}

run('good (proposal_id → own table)', good)
run('bad  (proposals.id → parent table)', bad)
```

- [ ] **Step 2: Run it to capture the pre-fix behavior**

Run: `pnpm tsx __verify_fk_guard.ts`
Expected (BEFORE the fix — documents the gap): **both** lines print `NO THROW`, and `bad` emits a wrong-join whose subquery selects `proposals.id` filtered by `proposals.id IN (...)` — a self-correlated no-op filter. Paste both lines into the verification log below.

- [ ] **Step 3: Implement the guardrail**

In `src/shared/dal/server/lib/resolve-scope.ts`, add `getTableName` to the drizzle import (line 8):

```ts
import { and, eq, getTableName, inArray, sql } from 'drizzle-orm'
```

Replace `fkColumn` (lines 97-102) with:

```ts
/**
 * The child→parent FK column. Guards §11.2: a `parent.fk` pointing at a column
 * on ANOTHER table (e.g. the parent's own pk) would emit a self-correlated
 * `parent.pk IN (SELECT parent.pk …)` wrong-join that silently passes every
 * child row — a false-ALLOW leak. Turn that mis-wire into a loud throw here,
 * the single point the bridge reads this column.
 */
function fkColumn(spec: EntityServerSpec): PgColumn {
  if (!spec.parent)
    throw new Error(`[scope] ${spec.entityName} has no parent fk`)
  const fk = spec.parent.fk
  if (getTableName(fk.table) !== getTableName(spec.table))
    throw new Error(
      `[scope] ${spec.entityName}.parent.fk must be a column on ${spec.entityName}'s own table `
      + `(got ${getTableName(fk.table)}.${fk.name}) — a mis-pointed FK emits a wrong-join (spec §11.2)`,
    )
  return fk
}
```

- [ ] **Step 4: Re-run the scratch to verify the fix**

Run: `pnpm tsx __verify_fk_guard.ts`
Expected (AFTER the fix):
- `good … → NO THROW; scope: … "proposal_media_files"."proposal_id" in (select "proposals"."id" from "proposals" where true)` — the real spec still resolves.
- `bad … → THREW: [scope] ProposalMediaFile.parent.fk must be a column on ProposalMediaFile's own table (got proposals.id) — a mis-pointed FK emits a wrong-join (spec §11.2)`

Paste both lines into the verification log. (Exact quoting/entityName string may differ — the throw on `bad` and the no-throw on `good` are what matter.)

- [ ] **Step 5: Green + delete the scratch**

Run: `pnpm tsc && pnpm lint`
Expected: green (no new errors vs. the pre-task baseline). Then: `rm __verify_fk_guard.ts`

- [ ] **Step 6: Commit** *(only if the user has approved committing)*

```bash
git add src/shared/dal/server/lib/resolve-scope.ts
git commit -m "refactor(permissions): guard mis-pointed child parent.fk in fkColumn (spec §11.2)"
```

---

### Task 2: EXPLAIN-prove the bridge branch + `token`/`system` principals; close out Phase 3

Prove the dead child-bridge branch and the never-run principals emit correct SQL, on the real `proposal_media_files → Proposal` topology, under all four principals. No production code changes — evidence-only, then update the tracker.

**Files:**
- Verify (worktree root, **uncommitted**): `__verify_bridge.ts`
- Modify: `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (check Phase 3 box + evidence note)
- Update (global memory, NOT a repo commit): `memory/project-permissions-casl-compiler.md`

**Interfaces:**
- Consumes: `resolveScope`, `verbOnly` (`dal/server/lib/resolve-scope.ts`); `userActor`/`tokenActor`/`systemActor` (`scope/actor.ts`); `defineAbilitiesFor` (`domains/permissions/abilities.ts`); `proposalMediaServerSpec`.
- Produces: no code; the epic tracker's Phase 3 box checked with pasted EXPLAIN evidence.

- [ ] **Step 1: Write the bridge-proof scratch**

Write `__verify_bridge.ts` at the worktree root. It resolves `proposalMediaServerSpec` under four principals and prints each emitted WHERE, plus the raw `verbOnly` own-term for each:

```ts
// __verify_bridge.ts — pnpm tsx __verify_bridge.ts   (uncommitted; rm after)
import type { Actor } from '@/shared/domains/permissions/scope/actor'
import { sql } from 'drizzle-orm'
import { db } from '@/shared/db'
import { resolveScope, verbOnly } from '@/shared/dal/server/lib/resolve-scope'
import { systemActor, tokenActor, userActor } from '@/shared/domains/permissions/scope/actor'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { proposalMediaServerSpec } from '@/shared/entities/proposal-media-files/lib/server-spec'

const spec = proposalMediaServerSpec
const agent: Actor = userActor('U1', defineAbilitiesFor({ id: 'U1', role: 'agent' }))
const deny: Actor = userActor('U2', defineAbilitiesFor(null)) // no rules → own-verb denied
const token: Actor = tokenActor(sql`"proposals"."token" = 'T'`, 'Proposal')
const system: Actor = systemActor('verify')

function show(label: string, actor: Actor) {
  const own = verbOnly(actor, 'read', spec.caslSubject)
  const scope = resolveScope(spec as never, actor)
  const printed = scope == null ? 'NULL' : db.select({ x: sql`1` }).from(spec.table).where(scope).toSQL().sql
  console.log(`\n[${label}]`)
  console.log('  verbOnly(read Proposal) →', own == null ? 'NULL' : own)
  console.log('  resolveScope →', printed)
}

show('agent (participation)', agent)
show('deny  (no Proposal rule)', deny)
show('token (bearer via bridge)', token)
show('system (unrestricted)', system)
```

- [ ] **Step 2: Run it and record the emitted SQL**

Run: `pnpm tsx __verify_bridge.ts`
Confirm each case matches the expected structure (quoting/params may vary — structure must match). Paste the four `resolveScope` lines into the verification log.

| Principal | `verbOnly` own-term | `resolveScope` WHERE (structure) |
|---|---|---|
| agent | `NULL` (agent has `read Proposal`) | `"proposal_media_files"."proposal_id" in (select "proposals"."id" from "proposals" where exists (select 1 from "meetings" inner join "meeting_participants" on "meeting_participants"."meeting_id" = "meetings"."id" where "meetings"."id" = "proposals"."meeting_id" and "meeting_participants"."user_id" = $1))` |
| deny | `sql\`false\`` | `(false and "proposal_media_files"."proposal_id" in (select "proposals"."id" from "proposals" where false))` — deny |
| token | `NULL` (token skips verb) | `"proposal_media_files"."proposal_id" in (select "proposals"."id" from "proposals" where "proposals"."token" = $1)` |
| system | `NULL` (system unrestricted) | `"proposal_media_files"."proposal_id" in (select "proposals"."id" from "proposals" where true)` — allow-all bridge |

**Highest-value check (epic risk note, line 112):** the agent case's parent correlation must be `"meetings"."id" = "proposals"."meeting_id"` (the Proposal's own FK), NOT `ctx.pk`. If it correlates on anything else, STOP and ping — the `via:'meetingId'` topology is mis-emitting.

- [ ] **Step 3: EXPLAIN the two live-SQL cases against the DB**

For the `agent` and `token` cases, wrap the emitted query in `EXPLAIN` to confirm it is valid, planbut-executable SQL (not just a string). Extend the scratch's `show` for those two, e.g.:

```ts
// append inside __verify_bridge.ts after the show() calls:
for (const [label, actor] of [['agent', agent], ['token', token]] as const) {
  const scope = resolveScope(spec as never, actor)!
  const q = db.select({ x: sql`1` }).from(spec.table).where(scope)
  const { sql: text, params } = q.toSQL()
  const plan = await db.execute(sql.raw(`EXPLAIN ${text}`) as never) // params are bound positionally
  console.log(`\nEXPLAIN [${label}] ok (rows:`, Array.isArray(plan) ? plan.length : (plan as any).rows?.length, ')')
}
```

Run: `pnpm tsx __verify_bridge.ts`
Expected: both EXPLAINs return a plan without a SQL error (a successful plan proves the bridge SQL is well-formed against the real schema). If `db.execute` with positional `$1` params needs the params supplied, bind them via the driver's parameterized `execute` instead; the goal is only "the planner accepts it." Record "EXPLAIN agent ok / EXPLAIN token ok" in the log.

- [ ] **Step 4: Green + delete the scratch**

Run: `pnpm tsc && pnpm lint`
Expected: green. Then: `rm __verify_bridge.ts`

- [ ] **Step 5: Record evidence + check the Phase 3 box in the epic tracker**

Edit `docs/plans/2026-08-10-casl-scope-compiler-epic.md`: change Phase 3's `- [ ]` to `- [x]`, and append a one-line **Phase 3 verified (2026-08-12):** note under its bullet with the agent + token emitted WHERE and "mis-pointed fk throws; EXPLAIN agent/token ok".

- [ ] **Step 6: Commit the tracker update** *(only if the user has approved committing)*

```bash
git add docs/plans/2026-08-10-casl-scope-compiler-epic.md docs/superpowers/plans/2026-08-12-casl-phase-3-robustness-gate.md
git commit -m "docs(casl-epic): Phase 3 robustness gate — fk guardrail + bridge/principal EXPLAIN proof"
```

- [ ] **Step 7: Update global memory** *(not a repo commit)*

Append a one-line "Phase 3 CLOSED (robustness gate: fk guardrail + bridge/principal proof); child cutovers + actor-seam wiring remain Phase P" note to `memory/project-permissions-casl-compiler.md` (global auto-memory), so the next session doesn't re-open Phase 3 as "cut children over."

---

## Verification Log

Observed 2026-08-12 (scratch runs via `NODE_OPTIONS='--conditions=react-server' pnpm tsx`; both scratch files deleted):

- **Task 1 — pre-fix:** both NO THROW; `bad` emitted the wrong-join `select 1 from "proposal_media_files" where "proposals"."id" in (select "id" from "proposals" where true)` — self-correlated no-op that passes every child row (the false-ALLOW leak).
- **Task 1 — post-fix:** `good` → NO THROW (`… "proposal_media_files"."proposal_id" in (select "id" from "proposals" where true)`); `bad` → THREW `[scope] ProposalMediaFile.parent.fk must be a column on ProposalMediaFile's own table (got proposals.id) — a mis-pointed FK emits a wrong-join (spec §11.2)`.
- **Task 2 — agent:** own `NULL`; `… "proposal_media_files"."proposal_id" in (select "id" from "proposals" where exists (select "id" from "meeting_participants" where ("meeting_participants"."meeting_id" = "proposals"."meeting_id" and "meeting_participants"."user_id" = $1)))`. **Correlation on `"proposals"."meeting_id"` — the `via:'meetingId'` high-value check passes.** (Actual emission is the direct `meeting_participants` EXISTS, tighter than the meetings-join shape guessed in Step 2's table — structurally correct: proposal visible iff viewer participates in that proposal's meeting.)
- **Task 2 — deny:** own `sql\`false\``; `… where (false and "proposal_media_files"."proposal_id" in (select "id" from "proposals" where false))` — deny.
- **Task 2 — token:** own `NULL`; `… "proposal_media_files"."proposal_id" in (select "id" from "proposals" where "proposals"."token" = $1)`.
- **Task 2 — system:** own `NULL`; `… "proposal_media_files"."proposal_id" in (select "id" from "proposals" where true)` — allow-all bridge.
- **Task 2 — EXPLAIN:** agent ok (10 plan lines), token ok (8 plan lines) — both well-formed against the live schema.
- **`pnpm tsc && pnpm lint`:** tsc clean; lint exit 0, 0 errors (pre-existing warnings only).

---

## Self-Review

**Spec coverage (against epic Phase 3 AC):**
- "bridge branch EXPLAIN-proven (both principals + deny case)" → Task 2 (agent/token/deny/system + EXPLAIN) ✓
- "mis-pointed `parent.fk` throws loud" → Task 1 ✓
- "tsc+lint green" → Task 1 Step 5, Task 2 Step 4 ✓
- "NO child cutovers, NO bespoke-scoping deletion, NO actor-seam wiring" → Global Constraints forbid; no task does any ✓

**Placeholder scan:** the only `_pending_` entries are the verification log (filled at execution) — every code/expected-SQL block is concrete. ✓

**Type consistency:** `fkColumn(spec) => PgColumn` unchanged; `getTableName(fk.table)` / `fk.name` verified to type-check (drizzle 0.45 probe); `resolveScope`/`verbOnly`/`userActor`/`tokenActor`/`systemActor`/`defineAbilitiesFor` signatures match their source files. ✓

**Scope check:** single production-file change + evidence-only proofs — focused, one plan. ✓
