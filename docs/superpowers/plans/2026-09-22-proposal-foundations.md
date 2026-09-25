# Proposal Foundations (Spec A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a proposal empty-able, section-addressable, explicitly seeded, identically duplicable from every caller, hidden while untouched (`pre-draft`), gated at send and envelope creation by one readiness predicate, and always attached to a meeting — the server foundations specs B–G build on.

**Architecture:** Seven additive commits on `main` (A1–A7, spec §6), each `pnpm tsc` + `pnpm lint` clean, each pushed to the **dev** DB where it carries DDL. One engine change (`duplicate.after` on the `createCrudDal` duplicate config), then everything else inside `src/shared/modules/proposals/` and its consumers: the Zod SOW shape + a one-time id backfill, a `pre-draft` status whose promotion helper is the lock gate's twin, a visibility module applied to every agent-side listing read, a `proposalService.send` verb that writes before it delivers, a `seedSowSections` pure mapper replacing the create-time auto-snapshot, `meeting_id NOT NULL` + `ON DELETE RESTRICT`, and a `modules/proposals/sow/` child unit whose four verbs carry the engine's slot signatures so Wave 4 swaps their bodies for `...proposalSowItemCrud`. Every seam lands where the W4 re-grounding expects it.

**Tech Stack:** Next.js 15 App Router, tRPC v11, Drizzle 0.45 + Postgres (Neon), Zod 4, drizzle-zod, react-hook-form 7.71, pnpm, `tsx` scripts. **No test runner in the repo**: pure helpers are verified by committed `scripts/verify-*.ts` files (`node:assert/strict`, non-zero exit on failure — precedent `scripts/verify-normalize-notion-id.ts`); DB behavior by a session-scoped, never-committed `scripts/tmp-smoke-proposal-foundations.ts` against the dev DB (precedent `scripts/tmp-smoke-proposals-module.ts`).

**Spec:** `docs/superpowers/specs/2026-09-22-proposal-foundations-design.md` — read §4 and §4.11 first. Tracker (canonical decisions C1–C66): `docs/plans/2026-09-20-multi-proposal-meeting-flow-epic.md`. W4 inputs this plan honors: `docs/plans/2026-09-22-wave-4-re-grounding.md` §2 (B6/B7/q8), §3 (placement), §5 step 1, §6 R7.

## Global Constraints

- Verification per commit: `pnpm tsc` + `pnpm lint`. **Never `pnpm build`.**
- Stage by explicit path. **Never `git add -A`.** Never stage any `scripts/tmp-*.ts` (22 untracked ones exist; the smoke script of this plan joins them and stays uncommitted).
- Commits happen only under the owner's execution go (approving this plan is that go). Message shape `type(scope): subject`, ending with the line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Schema changes go to the **dev** DB per task via `pnpm db:push:dev`. **Nothing in this plan pushes to prod.** Prod = Push 1 (spec §8), the owner's separate explicit go, with spec D's `meetings` half. Never a `truncate … cascade` plan; the generated SQL is grepped for `truncate` before any push.
- No transactions in the SOW verbs, the send verb, or the duplicate hook (W4 ruling R.1). One DAL abstraction + one tRPC leaf for SOW (R.3; the leaf itself lands with spec D). No permissions work (R.4 — X1/X2 are #285's, C19). New names are exactly the spec §4.11 list plus the five in "Plan-time settlements" below (R.5).
- No meeting-flow UI change. No change to how the homeowner link is built or authorized (C25). No realtime work (C41).
- `proposal_incentives.sow_item_id` stays NULL on every written row (C61).
- W4 prep items A1–A6 untouched: `calc_version`, `CURRENT_CALC_VERSION`, the `incentiveTypes` home, the `sow_item_id` FK/index, the AI hatch.
- A DAL module never imports a service (`docs/codebase-conventions/service-architecture.md#dependency-direction-is-one-way`); a service references another service only inside method bodies (header of `src/shared/modules/proposals/service.ts`).
- Only DAL files import `db` (`docs/codebase-conventions/dal-conventions.md#only-dal-imports-db`); `scripts/` are the sanctioned exception (precedent `scripts/backfill-wave3-scalars.ts`).
- Read the memory file `coding-conventions.md` rules 1, 2, 7, 9, 15, 19, 25, 26, 29 before writing any file (one component per file; constants in `constants/`; pure helpers in `lib/`; named exports; DAL returns `DalReturn`; entity business rules in entity `lib/`; enum const + type co-located; DOCS.md holds business rules).
- Smoke run line (every DB task): `DRIZZLE_TARGET=dev QSTASH_TOKEN= NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-smoke-proposal-foundations.ts`. Pure verify run line: `pnpm tsx scripts/verify-proposal-foundations.ts`.
- Baseline commit for line citations below: `5ed73a2b` (2026-09-22). Re-check any `file:line` before editing — the working tree carries uncommitted comment-only hunks in several of these files (Task 0).

## Plan-time settlements (mirrored into the spec as SA17–SA21 and the tracker as C62–C66)

The W4 re-grounding (§5 step 1) asked spec A's plan to settle two things; three more precisions surfaced while sizing the tasks. All five are decided here and copied into the spec/tracker in the same working-tree change as this plan:

1. **Orphan cost lines (C62).** `sow.update({ id, data: { scopes } })` drops the section's cost lines whose `relatedScopeId` is no longer among the new scope ids — the server twin of the form's cascade (`sow-field.tsx:82-92`). Section incentives are untouched (applications epic, Q22/Q25). W4's child-write guard (R7) keeps the rule.
2. **Readiness at envelope creation (C63).** The contracts router loads no row, so the gate lives in `contractService.createDraft` (`src/shared/services/contracts.service.ts:21`) right after `getFullView`. It throws `ThrowableDalError`; the two router procedures that reach `createDraft` (`createContractDraft`, `resendContract`) catch it and hand it to `dalToTrpc(dalError(…))` so the client gets `PRECONDITION_FAILED: proposal_not_ready:<reasons>`. No new names.
3. **`_v` waiver (C64).** `projectJSON` gains no `_v` (`jsonb-columns.md#mandatory-schema-version`): W4 freezes the column; the id backfill is the shape marker. Recorded as a comment on `projectDataSchema.sow`.
4. **Hook placement + DAL clone twin (C65).** `duplicate.after` is the third key of the `duplicate` config block (`CrudConfig.duplicate.{exclude, overrides, after}`), not a `CrudSlotHookMap` slot, so `CrudMutationSlot`, `CrudHooks` and the callsite hooks stay untouched. Because a DAL module never imports a service, the hook clones incentive rows through a new DAL function `cloneGlobalIncentiveRows` (`incentives/dal/server/mutations.ts`, the body of today's `proposalIncentivesService.clone`); the service verb `clone` is **deleted** (zero callers once the root override dies). W4's `sow.clone` follows the same shape (a DAL function called from the hook).
5. **Shape and status details (C66).** `painPoints` is **required** (no `.default`) — the form schema feeds `zodResolver`, and a defaulted key splits Zod input/output types; the backfill stamps `painPoints: []` beside the id. `notes` stays optional. `LISTABLE_STATUSES` / `HOMEOWNER_VISIBLE_STATUSES` live in `src/shared/constants/enums/proposals.ts` beside `proposalStatuses` (client-safe, enum co-location); `core/lib/proposal-visibility.ts` holds the row predicates + SQL forms. Promotion never overrides an explicit `status` in the payload. The proposals table's status dropdown disables `pre-draft` and its filter offers `LISTABLE_STATUSES` only.

Also folded in from the re-grounding: Q2 ruled scopes as rows (`proposal_sow_scopes`) — no effect on spec A's work, §4.11's "trade / scopes" row is re-worded. The heading's stored-note copy is "A note from Tri Pros Remodeling" (`companyInfo.name`) because `getFullView` carries no owner name.

---

### Task 0: Working-tree preflight (no code)

The tree at `5ed73a2b` carries uncommitted hunks in files this plan edits. Sort them before Task 1 so every later commit contains only its own change.

**Files (read-only unless noted):**
- `src/trpc/routers/proposals.router/crud.router.ts` — uncommitted swap `crud: proposalService` → `crud: proposalCrud` (tracker X7, not ours). Task 2 overwrites this file. **Never commit the swap alone.**
- `src/shared/modules/proposals/core/DOCS.md` — uncommitted K6 truth-pass (stale `duplicateProposalWithIncentives` / `dal/server/duplicate.ts` citations fixed).
- `src/shared/modules/proposals/core/dal/server/crud.ts`, `core/server-spec.ts`, `src/shared/entities/meetings/schemas/index.ts`, `src/shared/entities/meetings/DOCS.md`, `src/shared/entities/customers/dal/server/crud.ts`, `src/trpc/lib/middleware/scope-middleware.ts` — comment/doc-only hunks from the 2026-09-20/22 stale-ref pass.
- `docs/codebase-conventions/enum-standardization.md` — two-line module co-location exception (W4 prep A5's concern, not ours; leave it).

- [ ] **Step 1: Confirm the baseline**

Run:
```bash
git rev-parse --short HEAD
git status --porcelain | grep -v '^??' 
pnpm tsc && pnpm lint
```
Expected: HEAD `5ed73a2b` (or a later main with the same working-tree hunks); tsc and lint clean. If tsc/lint fail before any change, stop and report — do not start Task 1 on a broken baseline.

- [ ] **Step 2: Inspect the hunks in the files this plan touches**

Run:
```bash
git diff --stat -- src/trpc/routers/proposals.router/crud.router.ts src/shared/modules/proposals/core/DOCS.md src/shared/modules/proposals/core/dal/server/crud.ts src/shared/modules/proposals/core/server-spec.ts src/shared/entities/meetings/schemas/index.ts src/shared/entities/meetings/DOCS.md src/shared/entities/customers/dal/server/crud.ts src/trpc/lib/middleware/scope-middleware.ts
git diff -- src/trpc/routers/proposals.router/crud.router.ts
```
Expected: the stat shows the eight files; the `crud.router.ts` diff is exactly the `proposalService` → `proposalCrud` swap (import + `crud:` line).

- [ ] **Step 3: Owner's call — commit the doc/comment truth-pass first (recommended)**

If the owner opts in, commit the seven doc/comment-only files on their own so the plan's commits stay single-purpose:
```bash
git add src/shared/modules/proposals/core/DOCS.md src/shared/modules/proposals/core/dal/server/crud.ts src/shared/modules/proposals/core/server-spec.ts src/shared/entities/meetings/schemas/index.ts src/shared/entities/meetings/DOCS.md src/shared/entities/customers/dal/server/crud.ts src/trpc/lib/middleware/scope-middleware.ts
git commit -m "docs(proposals): truth-pass stale DOCS anchors and comment paths

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
If the owner declines, leave them: the first plan commit that stages each file carries its pre-existing hunk, and that commit's message says so ("carries the 2026-09-22 comment truth-pass hunk").

- [ ] **Step 4: Leave `crud.router.ts` alone**

Do not revert or commit it now. Task 2 rewrites the file to `crud: proposalService` and commits it with the hook that makes that wiring correct.

- [ ] **Step 5: Run the existing module smoke as the regression baseline**

Run:
```bash
DRIZZLE_TARGET=dev QSTASH_TOKEN= NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-smoke-proposals-module.ts
```
Expected: `✅ N passed, 0 failed` (N ≈ 45). Note N; Task 1 re-runs it. (If R2 is not configured it prints one `⏭ buildUploadTarget skipped` line — fine.)

---

### Task 1: Engine — `duplicate.after` on the duplicate config (A1)

**Files:**
- Modify: `src/shared/dal/server/types.ts:63-128` (add `DuplicateAfterMeta`; extend `CrudConfig.duplicate`)
- Modify: `src/shared/dal/server/lib/create-crud-dal.ts:1-27,262-297` (header comment; `duplicateImpl` invokes the hook)

**Interfaces:**
- Produces: `DuplicateAfterMeta<TTable> = { source: Row<TTable> }`; `CrudConfig.duplicate.after?: (row, ctx, meta: DuplicateAfterMeta) => MaybePromise<Row | void>`. Fires once per successful duplicate, after `createImpl` (so after the create before/after hooks), for every caller of `crud.duplicate`. A returned row replaces the result. No `duplicate.before` (overrides is the before-shaping seam). `CrudSlotHookMap`, `CrudMutationSlot`, `CrudHooks`, `CrudCallsiteHooks` are unchanged.

- [x] **Step 1: Add the meta type and the config key**

In `src/shared/dal/server/types.ts`, after the `UpdateAfterMeta` interface (`:69-72`) add:

```ts
/** Meta for a duplicate `after` hook. `source` is the row that was copied. */
export interface DuplicateAfterMeta<TTable extends PgTable> {
  source: Row<TTable>
}
```

Replace the `CrudConfig` interface (`:122-128`) with:

```ts
export interface CrudConfig<TTable extends PgTable, TId extends string | number = string, TInsert = Insert<TTable>, TUpdate = Update<TTable>> {
  hooks?: CrudHooks<TTable, TId, TInsert, TUpdate>
  duplicate?: {
    exclude?: readonly string[]
    overrides?: (source: Row<TTable>, ctx: ScopedContext) => Partial<TInsert>
    /**
     * Fires once the copy exists — after `createImpl` (and therefore after the
     * create before/after hooks) returned success — with the created row and
     * the SOURCE row. The place for child-row cloning the engine cannot express
     * (`duplicateImpl` copies `spec.table` only). Return a replacement row to
     * thread it back to the caller, or void. There is no `duplicate.before`:
     * `overrides` is the before-shaping seam. Fires for every origin.
     */
    after?: (row: Row<TTable>, ctx: ScopedContext, meta: DuplicateAfterMeta<TTable>) => MaybePromise<Row<TTable> | void>
  }
}
```

- [x] **Step 2: Invoke it from `duplicateImpl`**

In `src/shared/dal/server/lib/create-crud-dal.ts`, replace step 4 of `duplicateImpl` (`:295-296`):

```ts
  // 4. Route through createImpl — create.before + create.after fire automatically
  return createImpl<TTable, TId, TInsert, TUpdate>(spec, cfg, ctx, insertData, callsite)
```
with:
```ts
  // 4. Route through createImpl — create.before + create.after fire automatically
  const created = await createImpl<TTable, TId, TInsert, TUpdate>(spec, cfg, ctx, insertData, callsite)
  if (!created.success || !cfg.duplicate?.after) {
    return created
  }

  // 5. duplicate.after — child-row cloning and the like. Runs inside
  // dalDbOperation so a ThrowableDalError thrown by the hook becomes a
  // structured DalError instead of escaping as a throw.
  const after = cfg.duplicate.after
  return dalDbOperation(async () => (await after(created.data, ctx, { source })) ?? created.data)
```

In the file header (`:16-21`), after the line `// \`after\` hooks may return a replacement row (threaded via \`?? result\`) or` … `// void (result unchanged).` add:
```ts
// `duplicate` additionally fires `cfg.duplicate.after(row, ctx, { source })` once
// the copy exists (after createImpl) — the seam for cloning child rows the row
// copy cannot see. It is a duplicate-config key, not a slot hook.
```

- [x] **Step 3: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: clean. (`source` is already in scope at `:275`; `dalDbOperation` is already imported at `:53`.)

- [x] **Step 4: Regression — nothing uses the hook yet, so behavior is unchanged**

Run:
```bash
DRIZZLE_TARGET=dev QSTASH_TOKEN= NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-smoke-proposals-module.ts
```
Expected: the same `N passed, 0 failed` as Task 0 Step 5.

- [x] **Step 5: Commit**

```bash
git add src/shared/dal/server/types.ts src/shared/dal/server/lib/create-crud-dal.ts
git commit -m "feat(dal): duplicate.after hook on the createCrudDal duplicate config

Fires once per successful duplicate with the created row and the source
row, for every caller — the seam for cloning child rows the row copy
cannot see. Duplicate config key, not a slot hook: CrudSlotHookMap and
the callsite hooks are unchanged. Spec A §4.8 (multi-proposal epic C18).

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Proposal duplicate through the hook; the service override dies (A2)

**Files:**
- Modify: `src/shared/modules/proposals/incentives/dal/server/mutations.ts` (add `cloneGlobalIncentiveRows`)
- Modify: `src/shared/modules/proposals/incentives/service.ts:1-21,62-91` (delete `clone`; header)
- Modify: `src/shared/modules/proposals/core/dal/server/crud.ts:83-108` (`duplicate.after`)
- Modify: `src/shared/modules/proposals/service.ts:1-83` (delete the `duplicate` override; header)
- Modify: `src/trpc/routers/proposals.router/crud.router.ts` (back to `crud: proposalService`; header)
- Modify: `src/shared/modules/proposals/core/DOCS.md:367-377` (`#duplicate-resets-and-redrives`)
- Create (never committed): `scripts/tmp-smoke-proposal-foundations.ts`

**Interfaces:**
- Consumes: `CrudConfig.duplicate.after` (Task 1); `listProposalIncentives(proposalId)` and `replaceGlobalIncentiveRows(proposalId, rows)` (existing, `incentives/dal/server/{queries,mutations}.ts`); `recomputeProposalFinancials(proposalId)` (existing).
- Produces: `cloneGlobalIncentiveRows(sourceId: string, targetId: string): Promise<DalReturn<number>>` (rows written, 0 when the source has none). `proposalCrud.duplicate` and `proposalService.duplicate` are now the same function (the engine slot) and both clone incentive rows + re-drive the rollup. `proposalIncentivesService.clone` no longer exists.

- [x] **Step 1: Write the failing smoke — the bare DAL duplicate must clone incentives**

Create `scripts/tmp-smoke-proposal-foundations.ts` (session-scoped; **never staged**). This is the whole file at this task; later tasks insert numbered sections before `finally`.

```ts
// Smoke for spec A (proposal foundations) — multi-proposal epic. Exercises the
// proposals SERVICE tree + the bare DAL against the dev DB the way tRPC and
// scripts do. Creates rows labelled SMOKE-… and deletes them in `finally`.
// Throwaway: never committed (scripts/tmp-* stay out of every commit).
//
// Run:  DRIZZLE_TARGET=dev QSTASH_TOKEN= NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-smoke-proposal-foundations.ts
import './lib/load-env'

import process from 'node:process'

import { count, eq } from 'drizzle-orm'

import type { ScopedContext } from '@/shared/dal/server/types'
import type { Incentive } from '@/shared/modules/proposals/core/schemas'

import { buildUserContext } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { user } from '@/shared/db/schema/auth'
import { meetings } from '@/shared/db/schema/meetings'
import { proposalIncentives } from '@/shared/db/schema/proposal-incentives'
import { proposalCrud } from '@/shared/modules/proposals/core/dal/server/crud'
import { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { listProposalIncentives } from '@/shared/modules/proposals/incentives/dal/server/queries'
import { proposalService } from '@/shared/modules/proposals/service'

import { describeTargetDb } from './lib/describe-target-db'

// ── tiny harness ────────────────────────────────────────────────────────────
const failures: string[] = []
let passed = 0
function check(name: string, ok: boolean, detail?: unknown) {
  if (ok) {
    passed++
    console.log(`  ✅ ${name}`)
  }
  else {
    failures.push(name)
    console.log(`  ❌ ${name}${detail === undefined ? '' : ` — ${JSON.stringify(detail)}`}`)
  }
}
function section(title: string) {
  console.log(`\n── ${title}`)
}
function errType(r: { success: boolean, error?: { type: string, reason?: string } }) {
  return r.success ? 'success' : r.error?.type
}
function errReason(r: { success: boolean, error?: { type: string, reason?: string } }) {
  return r.success ? undefined : r.error?.reason
}

const STARTING_TCP_CENTS = 1_000_000

function smokeProjectJSON() {
  return {
    data: {
      label: 'SMOKE project',
      type: 'general-remodeling' as const,
      timeAllocated: '2 weeks',
      validThroughTimeframe: '30 days' as const,
      projectObjectives: [],
      homeAreasUpgrades: ['kitchen' as const],
      sow: [{
        contentJSON: '{}',
        html: '',
        scopes: [{ id: 'scope-a', label: 'Scope A' }],
        title: 'SMOKE scope',
        trade: { id: 'smoke-trade', label: 'Smoke Trade' },
        financials: { sectionPrice: null, costLines: [], incentives: [] },
      }],
    },
    meta: { enabled: true },
  }
}

async function main() {
  section('0. target + boot')
  const target = describeTargetDb()
  console.log(`  db: ${target.env} → ${target.host}`)
  if (process.env.DRIZZLE_TARGET === 'prod') {
    throw new Error('REFUSING: this smoke test writes rows; never run it against prod')
  }
  const [admin] = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.role, 'super-admin')).limit(1)
  if (!admin) {
    throw new Error('no super-admin user in dev DB — cannot own the smoke proposal')
  }
  console.log(`  owner: ${admin.email}`)
  const sys: ScopedContext = SYSTEM_CONTEXT
  const adminCtx = buildUserContext(admin.id, 'super-admin', proposalServerSpec) // session + omni (duplicate reads ctx.session)

  // Fixture meeting — raw insert on purpose (meetingCrud.create dispatches
  // QStash jobs on scheduledFor); deleted raw in `finally`, after its proposals.
  const [meeting] = await db.insert(meetings).values({ ownerId: admin.id, scheduledFor: new Date().toISOString() }).returning({ id: meetings.id })
  if (!meeting) {
    throw new Error('could not insert the fixture meeting')
  }
  const created: string[] = []

  try {
    // ── 1. create + incentives ─────────────────────────────────────────────
    section('1. create + global incentives')
    const base = await proposalService.create(sys, {
      label: `SMOKE-${Date.now()}`,
      ownerId: admin.id,
      meetingId: meeting.id,
      projectJSON: smokeProjectJSON(),
      startingTcpCents: STARTING_TCP_CENTS,
      depositAmountCents: 0,
      cashInDealCents: 0,
    })
    check('create succeeds', base.success, base)
    if (!base.success) {
      throw new Error('cannot continue without a proposal')
    }
    const p = base.data
    created.push(p.id)
    const incentives: Incentive[] = [
      { type: 'discount', amount: 100, notes: 'smoke discount' },
      { type: 'exclusive-offer', offer: 'Free smoke detector' },
    ]
    const replaced = await proposalService.incentives.replace(sys, { proposalId: p.id, incentives })
    check('incentives.replace wrote 2 global rows', replaced.success && replaced.data.length === 2, replaced)
    const afterReplace = await proposalService.getById(sys, { id: p.id })
    check('rollup after replace = 990,000', afterReplace.success && afterReplace.data?.finalTcpCents === 990_000, afterReplace.success && afterReplace.data?.finalTcpCents)

    // ── 2. duplicate is proposal-complete from EVERY caller ────────────────
    section('2. duplicate: service AND bare DAL clone incentives + re-drive')
    for (const [label, dup] of [
      ['proposalService.duplicate', await proposalService.duplicate(adminCtx, { id: p.id })],
      ['proposalCrud.duplicate (bare DAL)', await proposalCrud.duplicate(adminCtx, { id: p.id })],
    ] as const) {
      check(`${label} succeeds`, dup.success, dup)
      if (!dup.success) {
        continue
      }
      created.push(dup.data.id)
      const copyRows = await listProposalIncentives(dup.data.id)
      const srcRows = await listProposalIncentives(p.id)
      const cloneOk = copyRows.success && srcRows.success && copyRows.data.length === srcRows.data.length
        && copyRows.data.every((r, i) => r.type === srcRows.data[i]?.type && r.amountCents === srcRows.data[i]?.amountCents && r.offer === srcRows.data[i]?.offer && r.position === srcRows.data[i]?.position && r.sowItemId === null)
      check(`${label}: incentive rows cloned (type/amount/offer/position, sow_item_id NULL)`, cloneOk, copyRows)
      check(`${label}: rollup re-driven and merged into the returned row (990,000)`, dup.data.finalTcpCents === 990_000, dup.data.finalTcpCents)
      check(`${label}: copy has "Copy of" label + fresh token`, dup.data.label === `Copy of ${p.label}` && dup.data.token !== p.token, [dup.data.label])
    }
  }
  finally {
    section('cleanup')
    for (const id of created) {
      const del = await proposalService.delete(sys, { id })
      const [inc] = await db.select({ n: count() }).from(proposalIncentives).where(eq(proposalIncentives.proposalId, id))
      check(`deleted ${id.slice(0, 8)}… (incentive rows left: ${inc?.n})`, del.success && inc?.n === 0, del)
    }
    await db.delete(meetings).where(eq(meetings.id, meeting.id))
  }

  console.log(`\n${failures.length === 0 ? '✅' : '❌'} ${passed} passed, ${failures.length} failed`)
  if (failures.length > 0) {
    console.log(failures.map(f => `   - ${f}`).join('\n'))
    process.exitCode = 1
  }
}

main().then(() => process.exit(process.exitCode ?? 0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
```

- [x] **Step 2: Run it — expect the bare-DAL assertions to fail**

Run: `DRIZZLE_TARGET=dev QSTASH_TOKEN= NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-smoke-proposal-foundations.ts`
Expected: `proposalService.duplicate` checks pass (the override still exists); `proposalCrud.duplicate (bare DAL): incentive rows cloned` and `… rollup re-driven` FAIL (the engine copies `spec.table` only).

- [x] **Step 3: Add the DAL clone function**

In `src/shared/modules/proposals/incentives/dal/server/mutations.ts`, change the imports to:

```ts
import type { DalReturn } from '@/shared/dal/server/types'
import type { InsertProposalIncentive } from '@/shared/db/schema/proposal-incentives'

import { and, eq, isNull } from 'drizzle-orm'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { proposalIncentives } from '@/shared/db/schema/proposal-incentives'

import { listProposalIncentives } from './queries'
```

and append at the end of the file:

```ts
/**
 * Copy the source proposal's GLOBAL rows (sow_item_id IS NULL) onto the target,
 * preserving type/position/label/amount/offer/notes/expiresAt, in ONE multi-row
 * write (the same atomic swap `replaceGlobalIncentiveRows` does — on a fresh
 * copy the delete half is a no-op). Pure data operation: no scope, no lock
 * gate, no rollup re-drive — the caller (the proposals `duplicate.after` hook)
 * re-drives once, using the returned count to skip it when nothing was copied.
 * A DAL function (not a service verb) because the hook lives in a DAL module,
 * and a DAL module never imports a service. sow_item_id stays NULL (C61).
 * see ../../../core/DOCS.md#duplicate-resets-and-redrives
 */
export async function cloneGlobalIncentiveRows(
  sourceId: string,
  targetId: string,
): Promise<DalReturn<number>> {
  return dalDbOperation(async () => {
    const source = dalVerifySuccess(await listProposalIncentives(sourceId))
    if (source.length === 0) {
      return 0
    }
    return dalVerifySuccess(await replaceGlobalIncentiveRows(
      targetId,
      source.map(row => ({
        proposalId: targetId,
        sowItemId: null,
        type: row.type,
        position: row.position,
        label: row.label,
        amountCents: row.amountCents,
        offer: row.offer,
        notes: row.notes,
        expiresAt: row.expiresAt,
      })),
    ))
  })
}
```

Update the file's header comment first line block (`:1-9`) so it reads: `// proposal_incentives multi-row writes (Wave 2): the delete-all + insert-all of a` / `// proposal's GLOBAL rows in one transaction, and the source→target clone built on` / `// it — the ONLY incentive writes the CRUD engine cannot express. …` (keep the rest of the paragraph as is).

- [x] **Step 4: Delete the service's `clone` verb**

In `src/shared/modules/proposals/incentives/service.ts` delete the whole `clone` method (`:62-91`, the doc comment included) and the header lines `:12-14` (`//   clone   orchestration: …` through `uses); the caller re-drives the rollup once.`). Replace them with:

```ts
//   (no clone verb)            the source→target row copy is the DAL function
//                              `cloneGlobalIncentiveRows` (dal/server/mutations.ts),
//                              called from the proposals `duplicate.after` hook —
//                              a DAL module never imports a service.
```

- [x] **Step 5: The hook on the proposals duplicate config**

In `src/shared/modules/proposals/core/dal/server/crud.ts`, add the import (alphabetical, after the `getProposalLockSignals` import):

```ts
import { cloneGlobalIncentiveRows } from '@/shared/modules/proposals/incentives/dal/server/mutations'
```

Replace the `duplicate:` block (`:86-108`) with:

```ts
  // see ../../DOCS.md#duplicate-resets-and-redrives
  // Default: copy full row minus PK. Exclude derived/status/timeline fields.
  // Routed through createImpl — create.before re-derives kind + generates fresh token.
  duplicate: {
    exclude: [
      'createdAt',
      'updatedAt',
      'status',
      'kind',
      'token',
      'sentAt',
      'approvedAt',
      'contractSentAt',
      'contractViewedAt',
      'contractSignedAt',
      'contractDeclinedAt',
      'contractEnvelopeId',
      'qbInvoiceId',
      'qbPaymentStatus',
    ],
    overrides: (source, ctx) => ({
      label: `Copy of ${source.label}`,
      ownerId: ctx.session!.user.id,
      status: 'draft' as const,
    }),
    // Proposal-COMPLETE duplicate for EVERY caller (router, meeting flow,
    // scripts): the engine copies `spec.table` only, so the source's GLOBAL
    // incentive rows are cloned here and the rollup re-driven once, merged into
    // the returned row. Sequential, no transaction (W4 ruling R.1). W4 adds the
    // SOW child rows' clone beside this call.
    async after(row, _ctx, { source }) {
      const cloned = dalVerifySuccess(await cloneGlobalIncentiveRows(source.id, row.id))
      if (cloned === 0) {
        return
      }
      const { finalTcpCents } = dalVerifySuccess(await recomputeProposalFinancials(row.id))
      return { ...row, finalTcpCents }
    },
  },
```

- [x] **Step 6: Delete the root service's `duplicate` override**

In `src/shared/modules/proposals/service.ts`:
- Delete the `duplicate` method (`:53-72`, doc comment included).
- Change the imports to:
```ts
import type { SpecCrudHandlers } from '@/shared/dal/server/types'

import type { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalCrud } from '@/shared/modules/proposals/core/dal/server/crud'

import { proposalIncentivesService } from './incentives/service'
import { proposalMediaService } from './media/service'
import { proposalViewsService } from './views/service'
```
- Replace header lines `:11-13` (`//   <slot override>   a slot redefined …` through `cloned, rollup re-driven)`) with:
```ts
//   <slot override>   a slot redefined when the entity needs more than the engine
//                     does. None today: the proposal-COMPLETE duplicate (incentive
//                     rows cloned, rollup re-driven) is the `duplicate.after` hook
//                     in core/dal/server/crud.ts, so it fires for every caller.
```

- [x] **Step 7: Wire the router back to the service**

Replace the whole of `src/trpc/routers/proposals.router/crud.router.ts` with:

```ts
// ─── Proposals CRUD Router ──────────────────────────────────────────────────
// The 5 single-row operations. Plain leaf: createCrudRouter builds its scoped
// procedures inline from the spec (no createEntityRouter, no cast — epic S6a).
// see ../../DOCS.md#crud-five-slots-fixed
//
// `crud` is the proposal module service itself: it carries the engine's five
// slots on its top level (spread from proposalCrud) plus the module's verbs, so
// the router and every other caller share ONE server API. Create enrichment,
// the lock ladder and the proposal-COMPLETE duplicate (incentive rows cloned +
// rollup re-driven in `duplicate.after`) all live in the createCrudDal config
// factory (modules/proposals/core/dal/server/crud.ts) — never here.
// see ../../../shared/modules/proposals/core/DOCS.md#duplicate-resets-and-redrives

import z from 'zod'

import { proposalSchemas, proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { proposalService } from '@/shared/modules/proposals/service'

import { createCrudRouter } from '../../lib/create-crud-router'

export const crudRouter = createCrudRouter({
  spec: proposalServerSpec,
  schemas: { ...proposalSchemas, id: z.string().uuid() },
  crud: proposalService,
})
```

- [x] **Step 8: Rewrite the DOCS rule**

In `src/shared/modules/proposals/core/DOCS.md` replace the whole `### duplicate-resets-and-redrives` section (`:367-377`, up to but not including `### proposal-media`) with:

```markdown
### duplicate-resets-and-redrives

Duplicating a proposal: status resets to `draft`, ownership reassigns to the current user, token + kind are freshly server-derived via `hooks.create.before` (which fires automatically because duplicate routes through `createImpl`). `duplicateImpl` copies the whole source row minus `duplicate.exclude` + the PK, applies `duplicate.overrides`, routes the result through `createImpl` (Zod-parsed against `insertProposalSchema`), and then fires **`duplicate.after`** with the created row and the source. What survives the row copy: `projectJSON`, the Wave-3 scalars (`priceDisplayMode`, `startingTcpCents`, `depositAmountCents`, `cashInDealCents`, `miscPriceCents`, `envelopeDocumentIds`), and `financeOptionId` / `meetingId`. The frozen blobs do NOT survive — `insertProposalSchema.omit()` strips them, so duplicates are born with both NULL. `finalTcpCents` / `calcVersion` are omitted and re-derived by `create.after`.

**Global incentive rows ARE copied — by the `duplicate.after` hook, for every caller.** `proposal_incentives` (Wave 2 child table) is invisible to the row copy (`dal-conventions.md`'s "CRUD `duplicate` slot does NOT copy child rows" rule), and `create.after` recomputes `final_tcp_cents` against zero rows. The hook in `dal/server/crud.ts` clones the source's GLOBAL rows (`sow_item_id IS NULL`) onto the copy through `cloneGlobalIncentiveRows` (`../incentives/dal/server/mutations.ts`, one multi-row write) and re-runs `recomputeProposalFinancials`, merging the fresh value into the returned row. Because it is a config-factory hook, duplicate behaves identically from the proposals table (`proposals.router/crud.router.ts`, constructed over `proposalService`), the meeting flow, and any script calling `proposalCrud.duplicate` — there is no service-level override left to bypass. Sequential, un-transacted (W4 ruling R.1). W4 adds the SOW child rows' clone to this same hook.

**Why**: a duplicate is "start a new proposal from this template," not "clone." Server-derivation prevents the duplicate from inheriting stale state (wrong kind if the meeting has changed projects, an existing-but-disclosed share token, etc.); a hook instead of an override means no caller can produce a half-copy.
**Reference impl**: `dal/server/crud.ts:duplicate` (exclude + overrides + after); `dal/server/crud.ts:hooks.create.before` (kind + token derivation fires on every create, including duplicates); `../incentives/dal/server/mutations.ts:cloneGlobalIncentiveRows`; engine `src/shared/dal/server/lib/create-crud-dal.ts:duplicateImpl`
**Enforced by**: the config-factory hook (fires on every origin); `createCrudDal` offers no per-caller escape from it

```

Then grep the DOCS for leftovers of the old story and fix each hit in place:
```bash
grep -n "proposalService.duplicate\|service-level slot override\|incentives.clone\|proposalIncentivesService.clone" src/shared/modules/proposals/core/DOCS.md
```
Expected after the edit: no hits.

- [x] **Step 9: Type-check, lint, smoke**

Run: `pnpm tsc && pnpm lint`
Expected: clean. (`dalDbOperation` and `recomputeProposalFinancials` are no longer imported by `service.ts`; lint flags unused imports — they were removed in Step 6.)

Run: `DRIZZLE_TARGET=dev QSTASH_TOKEN= NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-smoke-proposal-foundations.ts`
Expected: every check passes, including both bare-DAL duplicate assertions.

- [x] **Step 10: Commit**

```bash
git add src/shared/modules/proposals/incentives/dal/server/mutations.ts src/shared/modules/proposals/incentives/service.ts src/shared/modules/proposals/core/dal/server/crud.ts src/shared/modules/proposals/service.ts src/trpc/routers/proposals.router/crud.router.ts src/shared/modules/proposals/core/DOCS.md
git commit -m "refactor(proposals): proposal-complete duplicate via duplicate.after, override deleted

The incentive-row clone + rollup re-drive move from the proposalService
duplicate override into the createCrudDal duplicate.after hook, so
duplicate behaves identically from the router, the meeting flow and any
script (tracker X7 closed). Clone body becomes the DAL function
cloneGlobalIncentiveRows; the zero-caller service clone verb is deleted.
crud.router.ts is wired back to proposalService. Spec A §4.8, C18/C55/C65.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
(If Task 0 Step 3 was declined, `crud.ts` and `DOCS.md` carry the pre-existing comment truth-pass hunks — say so in the message body.)

---

### Task 3: SOW section shape — ids, rep inputs, empty SOW, backfill (A3)

**Files:**
- Modify: `src/shared/modules/proposals/core/schemas/index.ts:37-44,69-80,219-244`
- Modify: `src/shared/modules/proposals/core/lib/create-empty-sow-section.ts`
- Create: `src/shared/modules/proposals/core/lib/regenerate-sow-section-ids.ts`
- Modify: `src/shared/modules/proposals/core/dal/server/crud.ts` (`duplicate.overrides`)
- Modify: `src/features/proposal-flow/ui/components/form/project-fields.tsx:54-77,95-151`
- Modify: `src/shared/entities/customers/components/lists/proposal-row.tsx:41-43`
- Modify: `scripts/verify-financials-facade.ts` (fixture literals)
- Create: `scripts/backfill-sow-section-ids.ts`
- Create: `scripts/verify-proposal-foundations.ts` (pure checks; grows in Tasks 4–6)
- Modify (never committed): `scripts/tmp-smoke-proposal-foundations.ts`

**Interfaces:**
- Produces: `sowSchema` = `{ id: uuid, contentJSON, html, scopes, title, trade, financials, painPoints: string[], notes?: string }`; `projectDataSchema.sow: z.array(sowSchema)` (empty valid); `createEmptySowSection(overrides?)` assigns a fresh `id` and `painPoints: []`; `regenerateSowSectionIds(projectJSON: ProjectSection): ProjectSection` (pure); `scripts/backfill-sow-section-ids.ts [--dry-run]` (idempotent).
- Downstream: Tasks 6–7 build sections only through `createEmptySowSection`; Task 7's `sow` verbs address sections by `id`.

- [ ] **Step 1: Write the failing pure checks**

Create `scripts/verify-proposal-foundations.ts`:

```ts
/* eslint-disable no-console */
// Pure checks for spec A's helpers (multi-proposal epic). No DB, no env.
// Run: pnpm tsx scripts/verify-proposal-foundations.ts
import assert from 'node:assert/strict'

import { createEmptySowSection } from '@/shared/modules/proposals/core/lib/create-empty-sow-section'
import { regenerateSowSectionIds } from '@/shared/modules/proposals/core/lib/regenerate-sow-section-ids'
import { projectSectionSchema, sowSchema } from '@/shared/modules/proposals/core/schemas'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── SOW section shape ──────────────────────────────────────────────────────
console.log('[1] SOW section shape')
const a = createEmptySowSection()
const b = createEmptySowSection()
assert.match(a.id, UUID_RE, 'createEmptySowSection assigns a uuid id')
assert.notEqual(a.id, b.id, 'every call mints a fresh id')
assert.deepEqual(a.painPoints, [], 'painPoints defaults to []')
assert.equal(a.notes, undefined, 'notes absent by default')
assert.equal(createEmptySowSection({ id: 'fixed', title: 'T' }).id, 'fixed', 'an override id wins')
assert.ok(sowSchema.safeParse(a).success, 'an empty section parses')
assert.equal(sowSchema.safeParse({ ...a, id: undefined }).success, false, 'id is required')
assert.equal(sowSchema.safeParse({ ...a, painPoints: undefined }).success, false, 'painPoints is required (no read-time default)')

const project = {
  data: {
    label: 'x',
    type: 'general-remodeling' as const,
    timeAllocated: '',
    validThroughTimeframe: '60 days' as const,
    projectObjectives: [],
    homeAreasUpgrades: [],
    sow: [],
  },
  meta: { enabled: true },
}
assert.ok(projectSectionSchema.safeParse(project).success, 'sow: [] is a valid project blob (min(1) is gone)')

// ── regenerateSowSectionIds ────────────────────────────────────────────────
console.log('[2] regenerateSowSectionIds')
const source = { ...project, data: { ...project.data, sow: [createEmptySowSection({ title: 'one' }), createEmptySowSection({ title: 'two' })] } }
const copy = regenerateSowSectionIds(source)
assert.equal(copy.data.sow.length, 2, 'same section count')
assert.deepEqual(copy.data.sow.map(s => s.title), ['one', 'two'], 'order and content preserved')
assert.ok(copy.data.sow.every((s, i) => s.id !== source.data.sow[i]!.id && UUID_RE.test(s.id)), 'every id regenerated')
assert.equal(source.data.sow[0]!.id, source.data.sow[0]!.id, 'source untouched (pure)')
assert.notEqual(copy.data.sow, source.data.sow, 'new array, not a mutation')

console.log('✅ proposal foundations helpers verified')
```

- [ ] **Step 2: Run it — expect a module-not-found / type failure**

Run: `pnpm tsx scripts/verify-proposal-foundations.ts`
Expected: fails to import `regenerate-sow-section-ids` (file does not exist yet).

- [ ] **Step 3: The schema**

In `src/shared/modules/proposals/core/schemas/index.ts` replace `sowSchema` (`:37-44`) with:

```ts
export const sowSchema = z.object({
  // Stable section identity (multi-proposal epic C47). Survives every save; is
  // regenerated only by the form's duplicate-section action and by proposal
  // duplicate (`regenerateSowSectionIds`); becomes `proposal_sow_items.id`
  // verbatim in W4 (a pure lift — no minting, no remap). Legacy blobs were
  // stamped once by scripts/backfill-sow-section-ids.ts, so no read-time default.
  id: z.string().uuid(),
  contentJSON: z.string(),
  html: z.string(),
  scopes: z.array(constructionItemSchema),
  title: z.string(),
  trade: constructionItemSchema,
  financials: sowFinancialsSchema,
  // Rep inputs (C29): painPoints are homeowner-visible; notes are rep-private
  // and join #285's never-to-homeowner projection. painPoints is REQUIRED (no
  // `.default`) so the form schema's Zod input and output types stay identical
  // for zodResolver — the backfill stamps `[]` on legacy sections. W4 columns:
  // `pain_points text[]` (identity-free value array, replaced whole) + `notes text`.
  painPoints: z.array(z.string()),
  notes: z.string().optional(),
})
```

Replace the `sow` line of `projectDataSchema` (`:79`) with:

```ts
  // Empty is valid (C4): "has a scope of work" is the readiness predicate
  // (lib/proposal-readiness.ts) enforced at send / envelope creation, not a
  // schema rule. This blob carries no `_v` (jsonb-columns.md
  // #mandatory-schema-version waived, C64): W4 freezes the column, and the id
  // backfill is the shape marker.
  sow: z.array(sowSchema),
```

In `proposalFormBaseDefaultValues` (`:225`) change `sow: [createEmptySowSection()],` to `sow: [],`. Remove the now-unused import `import { createEmptySowSection } from '../lib/create-empty-sow-section'` (`:4`).

- [ ] **Step 4: `createEmptySowSection` mints the id**

Replace the whole of `src/shared/modules/proposals/core/lib/create-empty-sow-section.ts` with:

```ts
import type { SOW } from '../types'

// see ../DOCS.md#sow-section-ids
const EMPTY_SOW_SECTION: Omit<SOW, 'id'> = {
  contentJSON: '',
  html: '',
  scopes: [],
  title: '',
  trade: { id: '', label: '' },
  financials: {
    sectionPrice: null,
    costLines: [],
    incentives: [],
  },
  painPoints: [],
}

/**
 * A fresh section with a fresh `id`. THE constructor for SOW sections — the
 * form's "+" button, the seed (`seedSowSections`) and the SOW child service all
 * build through it. `overrides` may carry an `id` (a client-supplied section id).
 */
export function createEmptySowSection(overrides?: Partial<SOW>): SOW {
  return structuredClone({ ...EMPTY_SOW_SECTION, id: crypto.randomUUID(), ...overrides })
}
```

- [ ] **Step 5: The pure id regenerator**

Create `src/shared/modules/proposals/core/lib/regenerate-sow-section-ids.ts`:

```ts
import type { ProjectSection } from '../types'

/**
 * Pure: the same project blob with every SOW section re-identified. Used by
 * proposal duplicate (`dal/server/crud.ts:duplicate.overrides`) because the
 * copy's section ids are its future `proposal_sow_items` PKs (W4) and must not
 * collide with the source's. Dies with the blob in W4 (`sow.clone` remaps ids).
 * see ../DOCS.md#sow-section-ids
 */
export function regenerateSowSectionIds(projectJSON: ProjectSection): ProjectSection {
  return {
    ...projectJSON,
    data: {
      ...projectJSON.data,
      sow: projectJSON.data.sow.map(section => ({ ...section, id: crypto.randomUUID() })),
    },
  }
}
```

- [ ] **Step 6: Duplicate regenerates ids**

In `src/shared/modules/proposals/core/dal/server/crud.ts` add the import (alphabetical, after `proposal-lock`):

```ts
import { regenerateSowSectionIds } from '@/shared/modules/proposals/core/lib/regenerate-sow-section-ids'
```

and change `overrides` to:

```ts
    overrides: (source, ctx) => ({
      label: `Copy of ${source.label}`,
      ownerId: ctx.session!.user.id,
      status: 'draft' as const,
      // Fresh section ids on the copy (C59): they are the copy's future row PKs.
      projectJSON: regenerateSowSectionIds(source.projectJSON),
    }),
```

- [ ] **Step 7: The form — duplicate-section regenerates the id; zero sections renders an empty state**

In `src/features/proposal-flow/ui/components/form/project-fields.tsx`:

Add the import `import { EmptyState } from '@/shared/components/states/empty-state'` (after the `Textarea` import).

In `handleDuplicateSection` (`:54-64`) replace the `duplicate` object with:

```ts
    const duplicate = {
      ...source,
      // A new section identity (spec A §4.1): section ids are the future row
      // PKs, so a copy never shares one with its source.
      id: crypto.randomUUID(),
      title: source.title ? `${source.title} (copy)` : '',
      financials: {
        sectionPrice: source.financials.sectionPrice,
        costLines: source.financials.costLines.map(line => ({ ...line, id: crypto.randomUUID() })),
        incentives: source.financials.incentives.map(inc => ({ ...inc, id: crypto.randomUUID() })),
      },
    }
```

Above `useFieldArray` (`:22`) add this comment — it records a react-hook-form fact the next reader will otherwise trip on:

```ts
  // `fields[i].id` is react-hook-form's own row key (keyName 'id'), NOT the
  // section's stored id: RHF shadows it in the `fields` view only. The form
  // VALUES keep the section id (getValues / submit), which is what persists.
```

Inside the `<div className="flex flex-col gap-4 w-full">` (`:98`), immediately before `{fields.map((fieldOfArray, index) => {` add:

```tsx
            {fields.length === 0 && (
              <EmptyState
                title="No scope of work yet"
                description="Add a trade to start the scope of work."
                className="h-auto"
              />
            )}
```

- [ ] **Step 8: Customer-profile row — a proposal with no scope**

In `src/shared/entities/customers/components/lists/proposal-row.tsx` replace lines `:41-43`:

```tsx
          {proposal.trade && (
            <span className="text-xs text-muted-foreground truncate">{proposal.trade}</span>
          )}
```
with:
```tsx
          <span className="text-xs text-muted-foreground truncate">{proposal.trade ?? 'No scope yet'}</span>
```
(`trade` comes from `get-customer-profile.ts:99`'s positional SQL `->'sow'->0->'trade'->>'label'`, which yields `null` for an empty SOW; the SQL itself is W4's to replace — amendment B5.)

- [ ] **Step 9: Zero-section readers — audit, no change**

Run:
```bash
grep -rn "sow\[0\]\|\.sow\.length\|sow\.at(0)\|sow?\.\[0\]" src --include=*.ts --include=*.tsx | grep -v "features/meeting-flow"
```
Expected exactly three hits, all already tolerant of an empty array: `heading.tsx:63` (`sow[0]?.trade.label`), `map-proposal-row-to-card-data.ts:39` (`sow[0]?.trade.label ?? null`), `assemble-envelope.ts:251` (`const firstSow = sow[0]` — read the following lines and confirm every use is optional-chained; it is at baseline). If a new hit appears, guard it the same way. PDF builders, `sowToPlaintext`, the financials façade and `proposalFormSchema.superRefine` iterate and are fine with `[]`.

- [ ] **Step 10: Fixture literals that no longer type-check**

Run `pnpm tsc`. Expected failures: `scripts/verify-financials-facade.ts` (its `sow` fixture objects lack `id` / `painPoints`) and possibly `scripts/tmp-*.ts` (ignore those — they are untracked and not this plan's). For **each** object literal in `verify-financials-facade.ts`'s `const sow: ProjectSection['data']['sow'] = [ … ]` array add two properties right after the opening brace, with a distinct fixed uuid per literal:

```ts
  {
    id: '00000000-0000-4000-8000-000000000001',
    painPoints: [],
    contentJSON: '',
    html: '',
    scopes: [{ id: 'scope-1', label: 'Demo scope' }],
    title: 'Kitchen',
    trade: { id: 'trade-1', label: 'Kitchen Remodel' },
    financials: {
```
(second literal `…000002`, and so on). Re-run `pnpm tsc` until only `scripts/tmp-*` errors remain, then `pnpm tsx scripts/verify-financials-facade.ts` — expected: its 17 checks still pass.

- [ ] **Step 11: The one-time backfill script**

Create `scripts/backfill-sow-section-ids.ts`:

```ts
/* eslint-disable no-console */
// One-time, idempotent backfill (multi-proposal epic, spec A §4.1 / C47): every
// `projectJSON.data.sow[]` section gains a stable `id` (uuid) and a `painPoints`
// array where missing. Sections already carrying both are untouched, so a
// second run reports 0 touched. Runs on dev right after the schema commit; on
// prod ONLY under the owner's explicit go and BEFORE the code that requires
// these keys deploys (Push 1 runbook, spec A §8). W4 lifts `id` verbatim into
// proposal_sow_items.id. Writes the minimally-transformed blob back (never the
// Zod OUTPUT — parsing would strip unknown legacy keys); Zod is the gate only.
//
// Usage:
//   pnpm tsx scripts/backfill-sow-section-ids.ts --dry-run   # report only
//   pnpm tsx scripts/backfill-sow-section-ids.ts             # write
//   DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-sow-section-ids.ts [--dry-run]
import './lib/load-env'
import process from 'node:process'
import { eq } from 'drizzle-orm'
import type { ProjectSection } from '@/shared/modules/proposals/core/types'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema/proposals'
import { projectSectionSchema } from '@/shared/modules/proposals/core/schemas'
import { describeTargetDb } from './lib/describe-target-db'

const dryRun = process.argv.includes('--dry-run')

interface RawSection { id?: unknown, painPoints?: unknown, [key: string]: unknown }

function needsBackfill(section: RawSection): boolean {
  return typeof section.id !== 'string' || !Array.isArray(section.painPoints)
}

async function main() {
  const { env, host } = describeTargetDb()
  console.log(`[backfill-sow-section-ids] ${dryRun ? 'DRY RUN' : 'LIVE'}`)
  console.log(`DB target: ${env}`)
  console.log(`DB host:  ${host}`)

  const rows = await db.select({ id: proposals.id, projectJSON: proposals.projectJSON }).from(proposals)

  const failures: string[] = []
  let touchedRows = 0
  let touchedSections = 0
  for (const row of rows) {
    const blob = row.projectJSON as unknown as { data?: { sow?: RawSection[] } }
    const sow = blob?.data?.sow
    if (!Array.isArray(sow)) {
      failures.push(`${row.id}: projectJSON.data.sow is not an array`)
      continue
    }
    const missing = sow.filter(needsBackfill)
    if (missing.length === 0) {
      continue
    }
    const next = {
      ...blob,
      data: {
        ...blob.data,
        sow: sow.map(section => ({
          ...section,
          id: typeof section.id === 'string' ? section.id : crypto.randomUUID(),
          painPoints: Array.isArray(section.painPoints) ? section.painPoints : [],
        })),
      },
    }
    const parsed = projectSectionSchema.safeParse(next)
    if (!parsed.success) {
      failures.push(`${row.id}: zod ${parsed.error.message}`)
      continue
    }
    touchedRows++
    touchedSections += missing.length
    if (dryRun) {
      console.log(`[dry-run] ${row.id}: would stamp ${missing.length} section(s)`)
      continue
    }
    await db.update(proposals).set({ projectJSON: next as unknown as ProjectSection }).where(eq(proposals.id, row.id))
  }

  console.log(`${dryRun ? 'would touch' : 'touched'} ${touchedRows} row(s), ${touchedSections} section(s) of ${rows.length} proposal(s)`)
  if (failures.length > 0) {
    console.error(`✗ ${failures.length} failure(s):\n${failures.map(f => `  - ${f}`).join('\n')}`)
    process.exit(1)
  }
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 12: Run the backfill on dev (dry, live, dry again)**

Run:
```bash
pnpm tsx scripts/backfill-sow-section-ids.ts --dry-run
pnpm tsx scripts/backfill-sow-section-ids.ts
pnpm tsx scripts/backfill-sow-section-ids.ts --dry-run
```
Expected: first dry run reports N rows / M sections to stamp; the live run touches the same N/M; the second dry run reports `would touch 0 row(s), 0 section(s)` (idempotent). Zero failures on all three.

- [ ] **Step 13: Pure checks, type-check, lint, smoke**

Run: `pnpm tsx scripts/verify-proposal-foundations.ts` → `✅ proposal foundations helpers verified`.

Run: `pnpm tsc && pnpm lint` → clean (tmp scripts excepted).

Update the smoke's fixture: in `scripts/tmp-smoke-proposal-foundations.ts` `smokeProjectJSON()`, add `id: crypto.randomUUID(), painPoints: [],` as the first two keys of the one `sow` literal. Then insert the following section before `finally` (after section 2):

```ts
    // ── 3. SOW shape ─────────────────────────────────────────────────────
    section('3. SOW shape: empty SOW valid; duplicate regenerates section ids')
    const empty = await proposalService.create(sys, {
      label: `SMOKE-empty-${Date.now()}`,
      ownerId: admin.id,
      meetingId: meeting.id,
      projectJSON: { ...smokeProjectJSON(), data: { ...smokeProjectJSON().data, sow: [] } },
      startingTcpCents: 0,
      depositAmountCents: 0,
      cashInDealCents: 0,
    })
    check('create with sow: [] succeeds (min(1) gone)', empty.success, empty)
    if (empty.success) {
      created.push(empty.data.id)
    }
    const dupIds = await proposalService.duplicate(adminCtx, { id: p.id })
    check('duplicate succeeds (ids)', dupIds.success, dupIds)
    if (dupIds.success) {
      created.push(dupIds.data.id)
      const srcAgain = await proposalService.getById(sys, { id: p.id })
      const srcIds = srcAgain.success ? srcAgain.data!.projectJSON.data.sow.map(s => s.id) : []
      const copyIds = dupIds.data.projectJSON.data.sow.map(s => s.id)
      check('copy has fresh section ids', copyIds.length === srcIds.length && copyIds.every(id => !srcIds.includes(id)), [srcIds, copyIds])
      check('source section ids untouched', srcIds.length === 1 && srcIds[0] === p.projectJSON.data.sow[0]!.id, srcIds)
    }
```

Run the smoke → all pass.

- [ ] **Step 14: Commit**

```bash
git add src/shared/modules/proposals/core/schemas/index.ts src/shared/modules/proposals/core/lib/create-empty-sow-section.ts src/shared/modules/proposals/core/lib/regenerate-sow-section-ids.ts src/shared/modules/proposals/core/dal/server/crud.ts src/features/proposal-flow/ui/components/form/project-fields.tsx src/shared/entities/customers/components/lists/proposal-row.tsx scripts/verify-financials-facade.ts scripts/backfill-sow-section-ids.ts scripts/verify-proposal-foundations.ts
git commit -m "feat(proposals): SOW sections carry an id and rep inputs; an empty SOW is valid

sowSchema gains id (uuid, required), painPoints (required, homeowner-
visible) and notes (optional, rep-private); sow.min(1) is gone and the
form default is []. createEmptySowSection mints the id; duplicate
regenerates every section id (regenerateSowSectionIds); the form's
duplicate-section action does too. scripts/backfill-sow-section-ids.ts
stamps legacy blobs once (idempotent; run on dev). Spec A §4.1, C3/C4/
C47/C59/C64/C66; W4 lifts the ids verbatim.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `pre-draft` status, promotion, listing visibility (A4)

**Files:**
- Modify: `src/shared/constants/enums/proposals.ts:1-2`
- Create: `src/shared/modules/proposals/core/lib/proposal-pre-draft.ts`
- Create: `src/shared/modules/proposals/core/lib/proposal-visibility.ts`
- Modify: `src/shared/modules/proposals/core/dal/server/crud.ts` (`create.before`, `update.before`, `duplicate.overrides`)
- Modify: `src/shared/modules/proposals/core/dal/server/queries.ts:66-81,164-278,326-337`
- Modify: `src/shared/entities/meetings/dal/server/queries.ts:179,292`
- Modify: `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts:187-203,236-251,410-421`
- Modify: `src/features/customer-pipelines/dal/server/get-customer-profile.ts:89-115`
- Modify: `src/shared/components/contract-status-panel/lib/get-status-badge.ts:28-41`
- Modify: `src/shared/modules/proposals/core/constants/proposal-status-colors.ts`, `proposal-row-styles.ts`
- Modify: `src/shared/modules/proposals/core/components/overview-card.tsx:203-208`
- Modify: `src/shared/modules/proposals/core/lib/columns-registry.tsx:87-99`
- Modify: `src/features/proposal-flow/constants/proposal-table-filter-config.ts:4,25-28`
- Modify: `src/shared/modules/proposals/core/DOCS.md` (`#duplicate-resets-and-redrives` first sentence)
- Modify: `scripts/verify-proposal-foundations.ts`; `scripts/tmp-smoke-proposal-foundations.ts` (never committed)

**Interfaces:**
- Produces: `proposalStatuses = ['pre-draft', 'draft', 'sent', 'approved', 'declined']`; `LISTABLE_STATUSES`, `HOMEOWNER_VISIBLE_STATUSES` (enums file); `shouldPromotePreDraft(signals: Pick<Proposal,'status'>, data: Record<string, unknown>): boolean`; `isListableProposal(p)`, `isHomeownerVisibleProposal(p)`, `listableProposalSql(col)`, `homeownerVisibleProposalSql(col)`; `listProposals` input `filters.includePreDraft?: boolean`.
- Consumers later: Task 5's send verb (`pre-draft → sent`), Task 7's `sow` verbs (promotion through the root update), spec C (`includePreDraft`), spec F (`homeownerVisible*`).

- [ ] **Step 1: Write the failing pure checks**

Append to `scripts/verify-proposal-foundations.ts` (imports at the top with the others; sections before the final `console.log`):

```ts
import { HOMEOWNER_VISIBLE_STATUSES, LISTABLE_STATUSES, proposalStatuses } from '@/shared/constants/enums/proposals'
import { shouldPromotePreDraft } from '@/shared/modules/proposals/core/lib/proposal-pre-draft'
import { isHomeownerVisibleProposal, isListableProposal } from '@/shared/modules/proposals/core/lib/proposal-visibility'
```

```ts
// ── pre-draft promotion ────────────────────────────────────────────────────
console.log('[3] shouldPromotePreDraft')
assert.equal(shouldPromotePreDraft({ status: 'pre-draft' }, { label: 'x' }), true, 'label write promotes')
assert.equal(shouldPromotePreDraft({ status: 'pre-draft' }, { projectJSON: {} }), true, 'projectJSON write promotes')
assert.equal(shouldPromotePreDraft({ status: 'pre-draft' }, { startingTcpCents: 1 }), true, 'funding scalar promotes')
assert.equal(shouldPromotePreDraft({ status: 'pre-draft' }, { sentAt: 'now' }), false, 'lifecycle-only write does not promote')
assert.equal(shouldPromotePreDraft({ status: 'pre-draft' }, { sentMessage: 'hi' }), false, 'sentMessage does not promote')
assert.equal(shouldPromotePreDraft({ status: 'pre-draft' }, { label: 'x', status: 'sent' }), false, 'an explicit status in the payload is respected')
assert.equal(shouldPromotePreDraft({ status: 'draft' }, { label: 'x' }), false, 'only pre-draft promotes')
assert.equal(shouldPromotePreDraft({ status: 'sent' }, { projectJSON: {} }), false, 'sent never promotes')

// ── listing visibility ─────────────────────────────────────────────────────
console.log('[4] visibility predicates')
assert.deepEqual([...proposalStatuses], ['pre-draft', 'draft', 'sent', 'approved', 'declined'], 'status vocabulary')
assert.deepEqual([...LISTABLE_STATUSES], ['draft', 'sent', 'approved', 'declined'])
assert.deepEqual([...HOMEOWNER_VISIBLE_STATUSES], ['sent', 'approved', 'declined'])
assert.equal(isListableProposal({ status: 'pre-draft' }), false)
assert.equal(isListableProposal({ status: 'draft' }), true)
assert.equal(isHomeownerVisibleProposal({ status: 'draft' }), false)
assert.equal(isHomeownerVisibleProposal({ status: 'sent' }), true)
assert.equal(isHomeownerVisibleProposal({ status: 'declined' }), true, 'declined stays visible to the homeowner (C20)')
```

Run: `pnpm tsx scripts/verify-proposal-foundations.ts` → fails (missing modules).

- [ ] **Step 2: The enum and the two status subsets**

Replace `src/shared/constants/enums/proposals.ts:1-2` with:

```ts
// `pre-draft` = created, never edited (multi-proposal epic C43): every create is
// born there and the first write touching a user-authored field promotes it to
// `draft` (modules/proposals/core/lib/proposal-pre-draft.ts). The column default
// stays 'draft' (C53): the create hook is the rule, the default the fallback.
export const proposalStatuses = ['pre-draft', 'draft', 'sent', 'approved', 'declined'] as const
export type ProposalStatus = (typeof proposalStatuses)[number]

/** What every agent-side listing/count shows by default (C43/P13): pre-drafts are filtered, never deleted. */
export const LISTABLE_STATUSES = ['draft', 'sent', 'approved', 'declined'] as const satisfies readonly ProposalStatus[]
/** What the homeowner's meeting proposals page shows (C20) — applied by spec F's single token resolver. */
export const HOMEOWNER_VISIBLE_STATUSES = ['sent', 'approved', 'declined'] as const satisfies readonly ProposalStatus[]
```

- [ ] **Step 3: The promotion helper**

Create `src/shared/modules/proposals/core/lib/proposal-pre-draft.ts`:

```ts
import type { Proposal } from '@/shared/db/schema/proposals'

import { touchesFrozenLockedFields } from './proposal-lock'

/**
 * The lock gate's twin (C58): a `pre-draft` proposal becomes `draft` on the
 * first write that touches a user-authored (locked) field — the SAME field set
 * and the SAME probe the lock ladder uses, so whatever write the ladder would
 * refuse on a frozen proposal promotes an untouched one. Lifecycle-only writes
 * (status, timestamps, contract ids, sentMessage) never promote, and a payload
 * that sets `status` itself is respected as-is (C66). Called from
 * `dal/server/crud.ts:hooks.update.before` right after the gate; W4 moves both
 * into the SOW child unit's hooks together. see ../DOCS.md#pre-draft-status
 */
export function shouldPromotePreDraft(
  signals: Pick<Proposal, 'status'>,
  data: Record<string, unknown>,
): boolean {
  return signals.status === 'pre-draft' && data.status === undefined && touchesFrozenLockedFields(data)
}
```

- [ ] **Step 4: The visibility module**

Create `src/shared/modules/proposals/core/lib/proposal-visibility.ts`:

```ts
import type { SQL } from 'drizzle-orm'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

import type { Proposal } from '@/shared/db/schema/proposals'

import { sql } from 'drizzle-orm'

import { HOMEOWNER_VISIBLE_STATUSES, LISTABLE_STATUSES } from '@/shared/constants/enums/proposals'

// see ../DOCS.md#listing-visibility
// ONE module for "which proposals does a listing show": the row form for
// in-memory checks, the SQL form for WHERE clauses. Both derive from the two
// status subsets in constants/enums/proposals.ts. Ad-hoc `status <> 'pre-draft'`
// literals anywhere else are forbidden — the lock ladder's discipline.

function inStatuses(col: SQL | AnyPgColumn, statuses: readonly string[]): SQL {
  return sql`${col} IN (${sql.join(statuses.map(status => sql`${status}`), sql`, `)})`
}

/** Every agent-side listing/count (spec A §4.5): hides `pre-draft`. */
export function isListableProposal(proposal: Pick<Proposal, 'status'>): boolean {
  return (LISTABLE_STATUSES as readonly string[]).includes(proposal.status)
}

/** The homeowner's meeting proposals page (C20); applied by spec F's single token resolver (H11). */
export function isHomeownerVisibleProposal(proposal: Pick<Proposal, 'status'>): boolean {
  return (HOMEOWNER_VISIBLE_STATUSES as readonly string[]).includes(proposal.status)
}

/** SQL twin of `isListableProposal`. `col` is the status column, or an aliased fragment such as sql`p.status` inside a raw subquery. */
export function listableProposalSql(col: SQL | AnyPgColumn): SQL {
  return inStatuses(col, LISTABLE_STATUSES)
}

/** SQL twin of `isHomeownerVisibleProposal`. */
export function homeownerVisibleProposalSql(col: SQL | AnyPgColumn): SQL {
  return inStatuses(col, HOMEOWNER_VISIBLE_STATUSES)
}
```

- [ ] **Step 5: The hooks — born `pre-draft`, promoted by the gate's twin**

In `src/shared/modules/proposals/core/dal/server/crud.ts`:

Add the import (alphabetical, after `proposal-lock`):
```ts
import { shouldPromotePreDraft } from '@/shared/modules/proposals/core/lib/proposal-pre-draft'
```

In `create.before` make BOTH return statements carry `status: 'pre-draft' as const` (the no-meeting branch dies in Task 7):
```ts
        if (!input.meetingId) {
          return { ...input, kind: deriveProposalKind(null), token: generateShareToken(), status: 'pre-draft' as const }
        }
        …
        return { ...enriched, kind, token, status: 'pre-draft' as const }
```
and add above the hook's existing comment lines:
```ts
      // see ../../DOCS.md#pre-draft-status — every create is born `pre-draft`
      // (blank, seeded, duplicate); a client-sent status never survives.
```

Replace the `update.before` body (`:57-66`) with:
```ts
      async before(input, _ctx, meta) {
        if (!touchesFrozenLockedFields(input)) {
          return input
        }
        const signals = dalVerifySuccess(await getProposalLockSignals(String(meta.id)))
        if (isProposalFrozen(signals)) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: 'proposal_frozen' })
        }
        // Promotion is the gate's twin (C58): same probe, same field set. A
        // first content write on a pre-draft makes it a draft. see ../../DOCS.md#pre-draft-status
        return shouldPromotePreDraft(signals, input) ? { ...input, status: 'draft' as const } : input
      },
```

In `duplicate.overrides` change `status: 'draft' as const,` to `status: 'pre-draft' as const,` and in `src/shared/modules/proposals/core/DOCS.md` `#duplicate-resets-and-redrives` change its first words `Duplicating a proposal: status resets to \`draft\`,` to `Duplicating a proposal: status resets to \`pre-draft\` (\`#pre-draft-status\`),`.

- [ ] **Step 6: UI vocabulary consumers**

`src/shared/components/contract-status-panel/lib/get-status-badge.ts` — in `getProposalStatusBadge` add before `case 'draft':`:
```ts
    case 'pre-draft':
      return { label: 'Pre-draft', className: 'bg-muted text-muted-foreground' }
```

`src/shared/modules/proposals/core/constants/proposal-status-colors.ts` — add as the first entry:
```ts
  'pre-draft': 'bg-slate-500/10 text-slate-500',
```
(the `Record<Proposal['status'], string>` type requires it).

`src/shared/modules/proposals/core/constants/proposal-row-styles.ts` — add before the `draft:` entry, same values as `draft`:
```ts
  'pre-draft': { bg: 'hover:bg-background/50', icon: FileTextIcon, iconClass: 'text-muted-foreground', textClass: 'text-muted-foreground', valueClass: 'text-muted-foreground' },
```

`src/shared/modules/proposals/core/components/overview-card.tsx` — in `StatusDot`'s `dotColors` add `'pre-draft': 'bg-slate-300',` before `draft`.

`src/shared/modules/proposals/core/lib/columns-registry.tsx` — on the `StatusDropdownCell` (`:92-97`) add the prop `isStatusDisabled={status => status === 'pre-draft'}` (a birth state, never hand-set; the current value is never disabled by the component).

`src/features/proposal-flow/constants/proposal-table-filter-config.ts` — change the import to `import { LISTABLE_STATUSES } from '@/shared/constants/enums'` and the options to `options: LISTABLE_STATUSES.map(s => ({ …same mapping… }))` (the default listing hides pre-drafts, so offering the value would filter to nothing).

- [ ] **Step 7: `listProposals` — hidden by default, `includePreDraft` opt-in; `getProposalsByMeetingId`**

In `src/shared/modules/proposals/core/dal/server/queries.ts`:

Add the import (alphabetical, after `ThrowableDalError`'s import block):
```ts
import { listableProposalSql } from '@/shared/modules/proposals/core/lib/proposal-visibility'
```

In `proposalListFiltersSchema` (`:67-78`) add:
```ts
  /** Opt-in (C43/D6/S5): only the meeting flow lists pre-drafts (the switcher + the gate). Every other listing hides them. */
  includePreDraft: z.boolean().optional(),
```

In `listProposals`, add to the `buildFilterWhere` predicate map (it is opt-in per key, `dal/server/lib/query/filters.ts:31-56`, so an unknown key would be silently ignored — declare it explicitly as "no fragment"):
```ts
      includePreDraft: () => undefined,
```
and replace `const where = and(ctx.scope ?? undefined, searchWhere, filterWhere)` with:
```ts
    // see ../../DOCS.md#listing-visibility — pre-drafts are hidden unless the
    // caller opts in (meeting flow only).
    const visibilityWhere = input.filters?.includePreDraft ? undefined : listableProposalSql(proposals.status)
    const where = and(ctx.scope ?? undefined, visibilityWhere, searchWhere, filterWhere)
```

Replace `getProposalsByMeetingId` (`:326-337`) with:
```ts
/** Minimal LISTABLE proposals of a meeting — id + projectJSON — feeds the project-create gate + scope derivation. Pre-drafts have no authored content and do not count (#listing-visibility). */
export async function getProposalsByMeetingId(
  ctx: ScopedContext,
  meetingId: string,
): Promise<DalReturn<{ id: string, projectJSON: ProjectSection }[]>> {
  return dalDbOperation(async () =>
    db
      .select({ id: proposals.id, projectJSON: proposals.projectJSON })
      .from(proposals)
      .where(and(eq(proposals.meetingId, meetingId), listableProposalSql(proposals.status), ctx.scope ?? undefined)),
  )
}
```

- [ ] **Step 8: Meeting `proposalCount` (two sites)**

In `src/shared/entities/meetings/dal/server/queries.ts` add the import:
```ts
import { listableProposalSql } from '@/shared/modules/proposals/core/lib/proposal-visibility'
```
and at BOTH `proposalCount` sites (`:179` in `listMeetings`, `:292` in `getByIdWithJoins`) replace
```ts
proposalCount: sql<number>`(SELECT count(*) FROM proposals p WHERE p.meeting_id = ${meetings.id})`.as('proposal_count'),
```
with
```ts
proposalCount: sql<number>`(SELECT count(*) FROM proposals p WHERE p.meeting_id = ${meetings.id} AND ${listableProposalSql(sql`p.status`)})`.as('proposal_count'),
```
(`hasSentProposal` / `hasApprovedProposal` on the next lines are status-specific — unchanged.)

- [ ] **Step 9: Pipeline items and the customer profile**

`src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` — add the import `import { listableProposalSql } from '@/shared/modules/proposals/core/lib/proposal-visibility'` and add `listableProposalSql(proposals.status),` as the first argument of the `and(` in each of the three proposal reads: the aggregate (`:198-201` — this is what keeps `compute-fresh-stage.ts:30` correct), the per-customer detail rows (`:248-251`), and the per-meeting rows (`:420` — wrap the existing `inArray(...)` in `and(listableProposalSql(proposals.status), inArray(proposals.meetingId, meetingIds))`).

`src/features/customer-pipelines/dal/server/get-customer-profile.ts` — add the same import and change the `.where(` of the `proposalRows` query (`:106-113`) to:
```ts
    .where(and(
      listableProposalSql(proposals.status),
      sql`${proposals.meetingId} IN (${sql.join(
        meetingRows.length > 0
          ? meetingRows.map(m => sql`${m.id}`)
          : [sql`NULL`],
        sql`, `,
      )})`,
    ))
```
(`and` is already imported at `:6`.) The customer timeline (`entities/customers/lib/build-timeline-events.ts:54-63`) is fed by this query, so it emits `proposal_created` for listable proposals only with no change of its own.

- [ ] **Step 10: Audit — every `from(proposals)` read, with its verdict**

Run `grep -rn "from(proposals)" src --include=*.ts --include=*.tsx` and confirm the table below covers every hit (add any newcomer to the right row):

| Read | Verdict |
|---|---|
| `core/dal/server/queries.ts` `listProposals`, `getProposalsByMeetingId` | predicate applied (Step 7) |
| `core/dal/server/queries.ts` `getFullView`, `getProposalsByIds`, `getProposalsByInvoiceIds`, `getProposalByInvoiceId`, `getByContractEnvelopeId`, `getProposalLockSignals` | single-row / id-keyed reads — untouched by design |
| `core/dal/server/mutations.ts` (`recompute…`, `setCashInDeal`) | writes by id — untouched |
| meetings `queries.ts:179,292` `proposalCount` | predicate applied (Step 8) |
| `get-customer-pipeline-items.ts` ×3 | predicate applied (Step 9) |
| `get-customer-profile.ts` | predicate applied (Step 9) |
| `get-action-queue.ts:131` | `status = 'sent'` — already excludes pre-draft |
| `move-customer-pipeline-item.ts:138` | `status = 'sent'` — same |
| `entities/customers/lib/phone-gating-sql.ts` (`EXISTS_SENT_PROPOSAL`) | `status IN ('sent','approved')` — same |
| `domains/permissions/lib/validate-share-token.ts:36` | token path — spec F applies `homeownerVisibleProposalSql` in its single resolver (H11) |
| `services/providers/ai/client.ts:98` | W4 prep A3's raw hatch — untouched |
| `modules/proposals/media/dal/server/queries.ts:88` | media join by proposal id — untouched |

Client-side status checks that need no change: `assign-project-dialog.tsx:80` (`sent || draft`), `compute-fresh-stage.ts` (its inputs are now listable-only).

- [ ] **Step 11: Pure checks, type-check, lint**

Run: `pnpm tsx scripts/verify-proposal-foundations.ts` → `✅`. Run: `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 12: Smoke — insert section 4 before `finally`**

```ts
    // ── 4. pre-draft + listing visibility ──────────────────────────────────
    section('4. pre-draft: born, promoted by content, hidden from listings')
    const fresh = await proposalService.create(sys, {
      label: `SMOKE-pre-${Date.now()}`,
      ownerId: admin.id,
      meetingId: meeting.id,
      projectJSON: smokeProjectJSON(),
      startingTcpCents: 0,
      depositAmountCents: 0,
      cashInDealCents: 0,
    })
    check('create ⇒ pre-draft', fresh.success && fresh.data.status === 'pre-draft', fresh.success && fresh.data.status)
    if (fresh.success) {
      created.push(fresh.data.id)
      const f = fresh.data
      const dupPre = await proposalService.duplicate(adminCtx, { id: f.id })
      check('duplicate ⇒ pre-draft', dupPre.success && dupPre.data.status === 'pre-draft', dupPre.success && dupPre.data.status)
      if (dupPre.success) {
        created.push(dupPre.data.id)
      }
      const lifecycle = await proposalService.update(sys, { id: f.id, data: { sentAt: new Date().toISOString() } })
      check('lifecycle-only write keeps pre-draft', lifecycle.success && lifecycle.data.status === 'pre-draft', lifecycle.success && lifecycle.data.status)
      const hidden = await listProposals(adminCtx, { pagination: { limit: 200, offset: 0 }, filters: { meetingId: meeting.id } })
      check('listProposals hides pre-drafts by default', hidden.success && !hidden.data.rows.some(r => r.id === f.id), hidden.success && hidden.data.rows.map(r => [r.id.slice(0, 8), r.status]))
      const shown = await listProposals(adminCtx, { pagination: { limit: 200, offset: 0 }, filters: { meetingId: meeting.id, includePreDraft: true } })
      check('listProposals shows them with includePreDraft', shown.success && shown.data.rows.some(r => r.id === f.id), shown)
      // Every SMOKE proposal so far (sections 1–4) was created and never
      // content-written, so all of them are pre-draft: the meeting counts 0.
      const mtgBefore = await getByIdWithJoins(adminCtx, { id: meeting.id })
      check('meeting proposalCount ignores pre-drafts (0)', mtgBefore.success && Number(mtgBefore.data?.proposalCount) === 0, mtgBefore.success && mtgBefore.data?.proposalCount)
      const promoted = await proposalService.update(sys, { id: f.id, data: { label: 'SMOKE-promoted' } })
      check('label write promotes pre-draft → draft', promoted.success && promoted.data.status === 'draft', promoted.success && promoted.data.status)
      const mtgAfter = await getByIdWithJoins(adminCtx, { id: meeting.id })
      check('meeting proposalCount counts the promoted draft (1)', mtgAfter.success && Number(mtgAfter.data?.proposalCount) === 1, mtgAfter.success && mtgAfter.data?.proposalCount)
      const explicit = await proposalService.update(sys, { id: f.id, data: { label: 'SMOKE-explicit', status: 'declined' } })
      check('an explicit status in a content write is respected', explicit.success && explicit.data.status === 'declined', explicit.success && explicit.data.status)
    }
```
Add the imports `import { getByIdWithJoins } from '@/shared/entities/meetings/dal/server/queries'` and `import { listProposals } from '@/shared/modules/proposals/core/dal/server/queries'` (`listProposals` returns `PaginatedResult<ProposalListRow>` = `{ rows, total }`, `src/shared/dal/server/lib/query/output.ts:5-8`).

Run the smoke → all pass.

- [ ] **Step 13: Commit**

```bash
git add src/shared/constants/enums/proposals.ts src/shared/modules/proposals/core/lib/proposal-pre-draft.ts src/shared/modules/proposals/core/lib/proposal-visibility.ts src/shared/modules/proposals/core/dal/server/crud.ts src/shared/modules/proposals/core/dal/server/queries.ts src/shared/entities/meetings/dal/server/queries.ts src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts src/features/customer-pipelines/dal/server/get-customer-profile.ts src/shared/components/contract-status-panel/lib/get-status-badge.ts src/shared/modules/proposals/core/constants/proposal-status-colors.ts src/shared/modules/proposals/core/constants/proposal-row-styles.ts src/shared/modules/proposals/core/components/overview-card.tsx src/shared/modules/proposals/core/lib/columns-registry.tsx src/features/proposal-flow/constants/proposal-table-filter-config.ts src/shared/modules/proposals/core/DOCS.md scripts/verify-proposal-foundations.ts
git commit -m "feat(proposals): pre-draft status, promotion as the lock gate's twin, listing visibility

Every create is born pre-draft; the first write touching a locked field
promotes it (shouldPromotePreDraft, same probe as the lock ladder). One
visibility module (isListable / listableProposalSql) hides pre-drafts on
listProposals (includePreDraft opt-in), getProposalsByMeetingId, meeting
proposalCount, pipeline items and the customer profile. Spec A §4.4–4.5,
C43/C53/C58/C66.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Readiness predicate, `send` verb, `sent_message` (A5)

**Files:**
- Create: `src/shared/modules/proposals/core/lib/proposal-readiness.ts`
- Create: `src/shared/modules/proposals/core/constants/readiness-reason-labels.ts`
- Modify: `src/shared/db/schema/proposals.ts:35-37` (add `sentMessage`) → `pnpm db:push:dev`
- Modify: `src/shared/modules/proposals/service.ts` (add `send`)
- Modify: `src/trpc/routers/proposals.router/delivery.router.ts:8-67`
- Modify: `src/shared/services/contracts.service.ts:1-31`
- Modify: `src/trpc/routers/proposals.router/contracts.router.ts:14-30,71-75,101-105`
- Modify: `src/shared/modules/proposals/core/dal/server/crud.ts` (`duplicate.exclude` + `'sentMessage'`)
- Modify: `src/features/proposal-flow/ui/components/proposal/heading.tsx:65-100`
- Modify: `src/features/proposal-flow/ui/components/proposal/index.tsx:99-111`
- Modify: `src/shared/components/contract-status-panel/ui/contract-status-panel.tsx`, `agent-contract-view.tsx`, `proposal-card.tsx`, `envelope-card.tsx` (thread `readiness`; disable + reason)
- Modify: `scripts/verify-proposal-foundations.ts`; `scripts/tmp-smoke-proposal-foundations.ts` (never committed)

**Interfaces:**
- Produces: `ReadinessReason = 'no-sow-section' | 'declined'`; `ReadinessInput = { status: ProposalStatus; sow: Pick<SOW,'trade'>[] }`; `ProposalReadiness = { ready: true } | { ready: false; reasons: ReadinessReason[] }`; `getProposalReadiness(input)`; `assertProposalReady(input)` (throws `ThrowableDalError precondition-failed: proposal_not_ready:<reasons>`); `READINESS_REASON_LABELS: Record<ReadinessReason, string>`; column `proposals.sent_message text NULL` (`sentMessage`); `proposalService.send(ctx, { id, recipient: { email, customerName }, message? }): Promise<DalReturn<Proposal>>`.
- Consumes: `getFullView`, `proposalCrud.update`, `deriveOutcomeOnProposalSent`, `emailService.sendProposalEmail` (all existing).
- Unchanged surface: `deliveryRouter.sendProposalEmail` name + `sendEmailSchema` input; `useSendProposal`; the link mechanism.

- [ ] **Step 1: Failing pure checks**

Append to `scripts/verify-proposal-foundations.ts`:

```ts
import { assertProposalReady, getProposalReadiness } from '@/shared/modules/proposals/core/lib/proposal-readiness'
```
```ts
// ── readiness ──────────────────────────────────────────────────────────────
console.log('[5] getProposalReadiness / assertProposalReady')
const withTrade = [createEmptySowSection({ trade: { id: 'kitchen', label: 'Kitchen' } })]
const blankTrade = [createEmptySowSection()]
assert.deepEqual(getProposalReadiness({ status: 'draft', sow: withTrade }), { ready: true })
assert.deepEqual(getProposalReadiness({ status: 'pre-draft', sow: withTrade }), { ready: true }, 'a pre-draft with a trade is ready (send skips draft)')
assert.deepEqual(getProposalReadiness({ status: 'approved', sow: withTrade }), { ready: true }, 'approved may be re-delivered')
assert.deepEqual(getProposalReadiness({ status: 'draft', sow: [] }), { ready: false, reasons: ['no-sow-section'] })
assert.deepEqual(getProposalReadiness({ status: 'draft', sow: blankTrade }), { ready: false, reasons: ['no-sow-section'] }, 'a placeholder section without a trade id does not count')
assert.deepEqual(getProposalReadiness({ status: 'declined', sow: withTrade }), { ready: false, reasons: ['declined'] })
assert.deepEqual(getProposalReadiness({ status: 'declined', sow: [] }), { ready: false, reasons: ['no-sow-section', 'declined'] }, 'every reason is reported')
assert.doesNotThrow(() => assertProposalReady({ status: 'sent', sow: withTrade }))
assert.throws(() => assertProposalReady({ status: 'declined', sow: [] }), (err: unknown) => {
  const dalError = (err as { dalError?: { type: string, reason?: string } }).dalError
  return dalError?.type === 'precondition-failed' && dalError.reason === 'proposal_not_ready:no-sow-section,declined'
}, 'assert throws a ThrowableDalError carrying the reasons')
```
Run `pnpm tsx scripts/verify-proposal-foundations.ts` → fails (missing module).

- [ ] **Step 2: The predicate**

Create `src/shared/modules/proposals/core/lib/proposal-readiness.ts`:

```ts
import type { ProposalStatus } from '@/shared/constants/enums'
import type { SOW } from '../types'

import { ThrowableDalError } from '@/shared/dal/server/types'

// see ../DOCS.md#readiness-predicate
// THE canonical "can this proposal go to the homeowner" rule (C4/C48). Every
// gate — the send verb, envelope creation, the UI affordances — derives from
// here; ad-hoc `sow.length` checks are forbidden (the lock ladder's discipline).
// Takes the DOMAIN sow list, never the column: callers pass
// `row.projectJSON.data.sow` today and `toSowInputs(row)` after W4 (C57).

export type ReadinessReason = 'no-sow-section' | 'declined'

export interface ReadinessInput {
  status: ProposalStatus
  sow: Pick<SOW, 'trade'>[]
}

export type ProposalReadiness = { ready: true } | { ready: false, reasons: ReadinessReason[] }

/** Rules v1: at least one section with a trade id; not `declined` (permanent — re-sending would resurrect it). Approved is ready: re-delivering a signed proposal's link is legitimate. */
export function getProposalReadiness(input: ReadinessInput): ProposalReadiness {
  const reasons: ReadinessReason[] = []
  if (!input.sow.some(section => section.trade.id !== '')) {
    reasons.push('no-sow-section')
  }
  if (input.status === 'declined') {
    reasons.push('declined')
  }
  return reasons.length === 0 ? { ready: true } : { ready: false, reasons }
}

/** Throws `precondition-failed: proposal_not_ready:<reason,…>` — inside `dalDbOperation` it becomes a `DalReturn` error, and `dalToTrpc` maps it to PRECONDITION_FAILED with the reason as message. */
export function assertProposalReady(input: ReadinessInput): void {
  const readiness = getProposalReadiness(input)
  if (!readiness.ready) {
    throw new ThrowableDalError({ type: 'precondition-failed', reason: `proposal_not_ready:${readiness.reasons.join(',')}` })
  }
}
```

Create `src/shared/modules/proposals/core/constants/readiness-reason-labels.ts`:

```ts
import type { ReadinessReason } from '../lib/proposal-readiness'

/** Agent-facing copy for a not-ready proposal (shown under the disabled Send / Create Draft actions). */
export const READINESS_REASON_LABELS: Record<ReadinessReason, string> = {
  'no-sow-section': 'Add a scope of work with a trade before sending.',
  'declined': 'A declined proposal cannot be sent again — duplicate it instead.',
}
```

- [ ] **Step 3: The column (dev push)**

In `src/shared/db/schema/proposals.ts` after `qbPaymentStatus: text('qb_payment_status'),` (`:37`) add:

```ts
  // The rep's note stored with the send (C44/C45): shown on the homeowner's
  // proposal view ("A note from …"). Lifecycle, not content — NOT in
  // frozenProposalLockedFields (a locked proposal can still be re-sent with a
  // new note) and excluded from duplicate. Written only by proposalService.send.
  // see ../../modules/proposals/core/DOCS.md#send-verb
  sentMessage: text('sent_message'),
```

Run: `pnpm db:push:dev` → expected one statement `ALTER TABLE "proposals" ADD COLUMN "sent_message" text;` and no data-loss prompt. (`insertProposalSchema` picks the nullable column up as optional — the send verb writes it through `proposalCrud.update`.)

- [ ] **Step 4: The `send` verb**

In `src/shared/modules/proposals/service.ts` set the imports to:

```ts
import type { DalReturn, ScopedContext, SpecCrudHandlers } from '@/shared/dal/server/types'
import type { Proposal } from '@/shared/db/schema/proposals'

import type { proposalServerSpec } from '@/shared/modules/proposals/core/server-spec'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
import { deriveOutcomeOnProposalSent } from '@/shared/entities/meetings/dal/server/mutations'
import { proposalCrud } from '@/shared/modules/proposals/core/dal/server/crud'
import { getFullView } from '@/shared/modules/proposals/core/dal/server/queries'
import { assertProposalReady } from '@/shared/modules/proposals/core/lib/proposal-readiness'
import { emailService } from '@/shared/services/email.service'

import { proposalIncentivesService } from './incentives/service'
import { proposalMediaService } from './media/service'
import { proposalViewsService } from './views/service'
```

and add the verb after `...proposalCrud,` (before the getters):

```ts
  /**
   * Send the proposal to the homeowner (C44/C45; DOCS #send-verb). Readiness
   * first, then WRITE, then deliver: under C20 the homeowner page shows a
   * proposal only once it is `sent`, so delivering before writing would hand
   * out a link to a proposal the page refuses to show. The first send stamps
   * `status: 'sent'` + `sentAt` (`pre-draft → sent` skips draft, P12); a resend
   * re-stores the message and re-delivers, status untouched. A delivery failure
   * after the write leaves the row `sent` and surfaces the provider error —
   * the rep resends. Sequential, no transaction (W4 R.1). The link mechanism is
   * unchanged (C25): the row's own token, the same email template.
   */
  async send(
    ctx: ScopedContext,
    input: { id: string, recipient: { email: string, customerName: string }, message?: string },
  ): Promise<DalReturn<Proposal>> {
    return dalDbOperation(async () => {
      const row = dalVerifySuccess(await getFullView(ctx, { id: input.id }))
      if (!row) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      assertProposalReady({ status: row.status, sow: row.projectJSON.data.sow })

      const firstSend = row.status === 'pre-draft' || row.status === 'draft'
      const updated = dalVerifySuccess(await proposalCrud.update(ctx, {
        id: row.id,
        data: {
          sentMessage: input.message?.trim() ? input.message.trim() : null,
          ...(firstSend ? { status: 'sent' as const, sentAt: new Date().toISOString() } : {}),
        },
      }))

      // Cross-entity side-effect, system context: not gated by the agent's
      // proposal visibility. see entities/meetings/DOCS.md#outcome-flips-on-proposal-sent
      if (row.meetingId) {
        dalVerifySuccess(await deriveOutcomeOnProposalSent(SYSTEM_CONTEXT, { meetingId: row.meetingId }))
      }

      await emailService.sendProposalEmail({
        proposalId: row.id,
        token: row.token,
        customerName: input.recipient.customerName,
        email: input.recipient.email,
        message: input.message,
        replyTo: ctx.session?.user.email,
        repName: ctx.session?.user.name,
      })

      return updated
    })
  },
```

Also add to the header comment's `<verbs>` line: `//   <verbs>           orchestrations composing the slots with reads, peers and jobs` → append ` (\`send\`: readiness → write → deliver)`.

- [ ] **Step 5: The delivery router becomes a thin adapter**

In `src/trpc/routers/proposals.router/delivery.router.ts` replace the imports (`:8-20`) with:

```ts
import { TRPCError } from '@trpc/server'
import z from 'zod'

import { getFullView } from '@/shared/modules/proposals/core/dal/server/queries'
import { proposalService } from '@/shared/modules/proposals/service'
import { notificationService } from '@/shared/services/notification.service'

import { createTRPCRouter } from '../../init'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { proposalProcedure, proposalShareableProcedure } from './procedures'
```

and replace the `sendProposalEmail` procedure (`:31-67`) with:

```ts
  /**
   * Thin adapter over `proposalService.send` (spec A §4.3 / C50): the name,
   * the input and the link mechanism stay until the access grill (Q14).
   * `input.token` is accepted and ignored — the verb builds the link from the
   * row's own token. Readiness, the write-before-deliver order, the meeting
   * outcome flip and the email all live in the verb.
   * see `src/shared/modules/proposals/core/DOCS.md#send-verb`
   */
  sendProposalEmail: proposalProcedure
    .input(sendEmailSchema)
    .mutation(async ({ ctx, input }) => {
      const proposal = dalToTrpc(await proposalService.send(ctx, {
        id: input.proposalId,
        recipient: { email: input.email, customerName: input.customerName },
        message: input.message,
      }))
      return { proposal }
    }),
```
Run `grep -rn "sendProposalEmail" src --include=*.ts --include=*.tsx` and confirm no consumer reads the removed `data` key of the old `{ data, proposal }` result (`use-send-proposal.ts` reads `variables` only; `proposal-card.tsx` awaits and toasts).

- [ ] **Step 6: The envelope gate in the contracts service; the router maps it**

In `src/shared/services/contracts.service.ts` add the import `import { assertProposalReady } from '@/shared/modules/proposals/core/lib/proposal-readiness'` and in `createDraft` (`:21-31`) insert after the not-found check:

```ts
    // Readiness gate (spec A §4.2 / C63): an envelope needs a scope of work and
    // a non-declined proposal. Throws ThrowableDalError — the router maps it to
    // PRECONDITION_FAILED. Lives here because the router loads no row.
    assertProposalReady({ status: proposal.status, sow: proposal.projectJSON.data.sow })
```

In `src/trpc/routers/proposals.router/contracts.router.ts` add `import { dalError, SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'` (replacing the existing `SYSTEM_CONTEXT` import line) and rewrite the two procedures that reach `createDraft`:

```ts
  createContractDraft: proposalProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await contractService.createContractEnvelope(ctx, input.proposalId)
      }
      catch (err) {
        // The readiness gate inside createDraft throws a ThrowableDalError —
        // surface it as PRECONDITION_FAILED with its reason (proposal_not_ready:…).
        if (err instanceof ThrowableDalError) {
          return dalToTrpc(dalError(err.dalError))
        }
        throw err
      }
    }),
```
```ts
  resendContract: proposalProcedure
    .input(z.object({ proposalId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await contractService.resendContractEnvelope(ctx, input.proposalId)
      }
      catch (err) {
        if (err instanceof ThrowableDalError) {
          return dalToTrpc(dalError(err.dalError))
        }
        throw err
      }
    }),
```

- [ ] **Step 7: Duplicate never copies the note**

In `src/shared/modules/proposals/core/dal/server/crud.ts` add `'sentMessage',` to `duplicate.exclude` (after `'sentAt',`).

- [ ] **Step 8: The homeowner-facing note**

In `src/features/proposal-flow/ui/components/proposal/heading.tsx`, inside `<div className="flex flex-col items-center gap-4 text-center">`, after the `{firstTrade && (<p …>…</p>)}` block (`:85-99`) add:

```tsx
        {proposal.data.sentMessage && (
          <div className="max-w-md rounded-lg border bg-muted/30 px-4 py-3 text-left text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {`A note from ${companyInfo.name}`}
            </p>
            <p className="whitespace-pre-line">{proposal.data.sentMessage}</p>
          </div>
        )}
```
(`companyInfo` is already imported at `:11`; the heading renders in customer and agent view alike.)

- [ ] **Step 9: The UI disables Send / Create Draft with the reason**

`src/features/proposal-flow/ui/components/proposal/index.tsx` — add the import `import { getProposalReadiness } from '@/shared/modules/proposals/core/lib/proposal-readiness'` and pass a new prop to the agreement step (`:100-111`), after `proposalSentAt={proposalData.sentAt}`:
```tsx
                    readiness={getProposalReadiness({ status: proposalData.status, sow: proposalData.projectJSON.data.sow })}
```

`src/shared/components/contract-status-panel/ui/contract-status-panel.tsx` — add `import type { ProposalReadiness } from '@/shared/modules/proposals/core/lib/proposal-readiness'`; add `readiness?: ProposalReadiness` to `ContractStatusPanelProps` (with the doc line `/** Send / Create Draft are disabled with the reason while not ready (spec A §4.2). */`); destructure it; pass `readiness={readiness}` to `AgentContractView`.

`src/shared/components/contract-status-panel/ui/agent-contract-view.tsx` — same type import; add `readiness?: ProposalReadiness` to the props; pass `readiness={readiness}` to BOTH `ProposalCard` and `EnvelopeCard`.

`src/shared/components/contract-status-panel/ui/proposal-card.tsx` — add the imports
```ts
import type { ProposalReadiness } from '@/shared/modules/proposals/core/lib/proposal-readiness'
import { READINESS_REASON_LABELS } from '@/shared/modules/proposals/core/constants/readiness-reason-labels'
```
add `readiness?: ProposalReadiness` to `ProposalCardProps`, destructure it, and after `const statusBadge = …` add:
```ts
  const notReadyReason = readiness && !readiness.ready ? READINESS_REASON_LABELS[readiness.reasons[0]!] : undefined
```
On the "Send Proposal Email" `ActionButtonWithImpact` (`:161-170`) change `disabled={isPending}` to `disabled={isPending || !!notReadyReason}` and, directly under that button inside its wrapping div, add:
```tsx
            {notReadyReason && (
              <p className="text-xs text-muted-foreground">{notReadyReason}</p>
            )}
```

`src/shared/components/contract-status-panel/ui/envelope-card.tsx` — the same two imports, `readiness?: ProposalReadiness` on `EnvelopeCardProps`, the same `notReadyReason` const after `const statusBadge = getEnvelopeStatusBadge(requestStatus)` (`:60`); on the "Create Draft" `ActionButtonWithImpact` (`:218-227`) change `disabled={isPending}` to `disabled={isPending || !!notReadyReason}` and add the same `<p>` under it.

- [ ] **Step 10: Pure checks, type-check, lint**

Run: `pnpm tsx scripts/verify-proposal-foundations.ts` → `✅`. Run: `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 11: Smoke — insert section 5 before `finally`**

Sending really emails through Resend: use a throwaway inbox the owner controls (`SMOKE_EMAIL`) or expect the provider error branch. The write-before-deliver order makes the status assertions valid either way.

```ts
    // ── 5. readiness + send ────────────────────────────────────────────────
    section('5. readiness gate + send verb (write before deliver)')
    const smokeEmail = process.env.SMOKE_EMAIL
    const recipient = { email: smokeEmail ?? 'smoke@example.invalid', customerName: 'Smoke Customer' }
    if (empty.success) {
      const notReady = await proposalService.send(adminCtx, { id: empty.data.id, recipient, message: 'hi' })
      check('send refuses a zero-SOW proposal', errType(notReady) === 'precondition-failed' && errReason(notReady) === 'proposal_not_ready:no-sow-section', notReady)
    }
    const declined = await proposalService.create(sys, {
      label: `SMOKE-declined-${Date.now()}`,
      ownerId: admin.id,
      meetingId: meeting.id,
      projectJSON: smokeProjectJSON(),
      startingTcpCents: 0,
      depositAmountCents: 0,
      cashInDealCents: 0,
    })
    if (declined.success) {
      created.push(declined.data.id)
      await proposalService.update(sys, { id: declined.data.id, data: { status: 'declined' } })
      const sendDeclined = await proposalService.send(adminCtx, { id: declined.data.id, recipient })
      check('send refuses a declined proposal', errType(sendDeclined) === 'precondition-failed' && errReason(sendDeclined) === 'proposal_not_ready:declined', sendDeclined)
    }
    const first = await proposalService.send(adminCtx, { id: p.id, recipient, message: '  Looking forward to it!  ' })
    const afterFirst = await proposalService.getById(sys, { id: p.id })
    if (smokeEmail) {
      check('first send succeeds (SMOKE_EMAIL set)', first.success, first)
    }
    else {
      console.log(`  ℹ️  SMOKE_EMAIL unset — delivery to a fake inbox may fail AFTER the write: ${errType(first)}`)
    }
    check('first send wrote status=sent + sentAt + trimmed message BEFORE delivering', afterFirst.success && afterFirst.data?.status === 'sent' && afterFirst.data.sentAt !== null && afterFirst.data.sentMessage === 'Looking forward to it!', afterFirst.success && [afterFirst.data?.status, afterFirst.data?.sentAt, afterFirst.data?.sentMessage])
    const sentAtFirst = afterFirst.success ? afterFirst.data?.sentAt : null
    await proposalService.send(adminCtx, { id: p.id, recipient, message: 'Second note' })
    const afterSecond = await proposalService.getById(sys, { id: p.id })
    check('resend keeps sentAt, replaces the message, stays sent', afterSecond.success && afterSecond.data?.sentAt === sentAtFirst && afterSecond.data.sentMessage === 'Second note' && afterSecond.data.status === 'sent', afterSecond.success && [afterSecond.data?.sentAt, afterSecond.data?.sentMessage])
    const noteOnly = await proposalService.update(sys, { id: p.id, data: { sentMessage: 'edited note' } })
    check('sentMessage is lifecycle: writable, never a locked field', noteOnly.success && noteOnly.data.sentMessage === 'edited note', noteOnly)
    const dupNote = await proposalService.duplicate(adminCtx, { id: p.id })
    if (dupNote.success) {
      created.push(dupNote.data.id)
      check('duplicate excludes sentMessage', dupNote.data.sentMessage === null, dupNote.data.sentMessage)
    }
```
(`p` was created in section 1 and content-written by nothing since, so it is still `pre-draft` here: the first send moves it `pre-draft → sent` directly, which is P12.)

Run the smoke → all pass (the `ℹ️` line is informational).

- [ ] **Step 12: Commit**

```bash
git add src/shared/modules/proposals/core/lib/proposal-readiness.ts src/shared/modules/proposals/core/constants/readiness-reason-labels.ts src/shared/db/schema/proposals.ts src/shared/modules/proposals/service.ts src/trpc/routers/proposals.router/delivery.router.ts src/shared/services/contracts.service.ts src/trpc/routers/proposals.router/contracts.router.ts src/shared/modules/proposals/core/dal/server/crud.ts src/features/proposal-flow/ui/components/proposal/heading.tsx src/features/proposal-flow/ui/components/proposal/index.tsx src/shared/components/contract-status-panel/ui/contract-status-panel.tsx src/shared/components/contract-status-panel/ui/agent-contract-view.tsx src/shared/components/contract-status-panel/ui/proposal-card.tsx src/shared/components/contract-status-panel/ui/envelope-card.tsx scripts/verify-proposal-foundations.ts
git commit -m "feat(proposals): readiness predicate, send verb, stored send message

getProposalReadiness/assertProposalReady (domain sow in, never the
column) gate proposalService.send and contractService.createDraft; the
delivery router is a thin adapter; send writes status/sentAt/sentMessage
before it delivers; the homeowner heading shows the note; Send and
Create Draft are disabled with the reason. New column sent_message
(dev pushed; prod = Push 1). Spec A §4.2–4.3, C44/C45/C48–C50/C57/C63.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `seedSowSections`; the create-time auto-snapshot retires (A6)

**Files:**
- Create: `src/shared/modules/proposals/core/lib/seed-sow-sections.ts`
- Delete: `src/shared/modules/proposals/core/lib/snap-sow-from-meeting.ts`
- Modify: `src/shared/modules/proposals/core/dal/server/crud.ts:12,23-42` (import + `create.before`)
- Modify: `src/features/meeting-flow/lib/build-proposal-defaults.ts:6-7,20-28,68-77`
- Modify: `src/shared/modules/proposals/core/DOCS.md:50-56` (`#sow-snapshot-from-meeting-on-create` → `#sow-seeded-explicitly`)
- Modify: `src/shared/entities/meetings/DOCS.md:174-180` (`#trade-selections-snapshot-source`)
- Modify: `scripts/verify-proposal-foundations.ts`

**Interfaces:**
- Produces: `seedSowSections(requested: TradeSelection[]): SOW[]` — one section per selection; `trade { id: tradeId, label: tradeName }`, `scopes` copied, `painPoints` (blank entries dropped), `notes` only when non-blank; fresh ids. The one mapping spec C's dialog and spec D's migration reuse.
- Removes: `snapSowFromMeeting`; the `painPoints → projectObjectives` copy in `buildProposalDefaults`.

- [ ] **Step 1: Failing pure checks**

Append to `scripts/verify-proposal-foundations.ts`:

```ts
import { seedSowSections } from '@/shared/modules/proposals/core/lib/seed-sow-sections'
```
```ts
// ── seedSowSections ────────────────────────────────────────────────────────
console.log('[6] seedSowSections')
const seeded = seedSowSections([
  { tradeId: 'roofing', tradeName: 'Roofing', selectedScopes: [{ id: 's1', label: 'Tear-off' }, { id: 's2', label: 'Underlayment' }], painPoints: ['Leaks', '', 'Mold'], notes: '  keep gutters  ' },
  { tradeId: 'hvac', tradeName: 'HVAC', selectedScopes: [], painPoints: [], notes: '' },
])
assert.equal(seeded.length, 2, 'one section per requested trade')
assert.deepEqual(seeded[0]!.trade, { id: 'roofing', label: 'Roofing' })
assert.deepEqual(seeded[0]!.scopes, [{ id: 's1', label: 'Tear-off' }, { id: 's2', label: 'Underlayment' }])
assert.deepEqual(seeded[0]!.painPoints, ['Leaks', 'Mold'], 'blank pain points dropped')
assert.equal(seeded[0]!.notes, 'keep gutters', 'notes trimmed')
assert.equal(seeded[1]!.notes, undefined, 'blank notes omitted')
assert.deepEqual(seeded[1]!.scopes, [])
assert.ok(seeded.every(s => UUID_RE.test(s.id)) && seeded[0]!.id !== seeded[1]!.id, 'fresh ids')
assert.deepEqual(seeded[0]!.financials, { sectionPrice: null, costLines: [], incentives: [] }, 'no financials seeded')
assert.ok(seeded.every(s => sowSchema.safeParse(s).success), 'every seeded section parses')
assert.deepEqual(seedSowSections([]), [], 'blank = []')
```
Run → fails (missing module).

- [ ] **Step 2: The seed**

Create `src/shared/modules/proposals/core/lib/seed-sow-sections.ts`:

```ts
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { SOW } from '../types'

import { createEmptySowSection } from './create-empty-sow-section'

/**
 * THE mapping from requested trades to SOW sections (C27/P8): one section per
 * selection, carrying the trade, its picked scopes and the rep's inputs
 * (`painPoints` homeowner-visible, `notes` rep-private — C29). Pure and
 * deterministic except for the fresh `id` per section. Used by today's
 * proposals-table create path (`features/meeting-flow/lib/build-proposal-defaults.ts`),
 * spec C's create dialog (preview + payload) and spec D's migration /
 * `initialRequestedTrades` re-point. Replaces the deleted create-time
 * auto-snapshot (`snapSowFromMeeting`). Blank in = `[]` out.
 * see ../DOCS.md#sow-seeded-explicitly
 */
export function seedSowSections(requested: TradeSelection[]): SOW[] {
  return requested.map((selection) => {
    const notes = selection.notes?.trim()
    return createEmptySowSection({
      trade: { id: selection.tradeId, label: selection.tradeName },
      scopes: selection.selectedScopes.map(scope => ({ id: scope.id, label: scope.label })),
      painPoints: selection.painPoints.filter(point => point.trim() !== ''),
      ...(notes ? { notes } : {}),
    })
  })
}
```

- [ ] **Step 3: Delete the snapshot**

```bash
git rm src/shared/modules/proposals/core/lib/snap-sow-from-meeting.ts
```
In `src/shared/modules/proposals/core/dal/server/crud.ts`: delete the `snapSowFromMeeting` import (`:12`) and the comment line `// see ../../DOCS.md#sow-snapshot-from-meeting-on-create`; in `create.before` delete `const enriched = snapSowFromMeeting(input, meeting?.flowStateJSON ?? null)` and return `{ ...input, kind, token, status: 'pre-draft' as const }`. Then `grep -rn "snapSowFromMeeting\|snap-sow-from-meeting" src docs scripts` — expected: no hits in `src/` (doc mentions are fixed in Step 5).

- [ ] **Step 4: `buildProposalDefaults` — trades half onto the seed, objectives copy gone**

In `src/features/meeting-flow/lib/build-proposal-defaults.ts`:
- Replace the import `import { createEmptySowSection } from '@/shared/modules/proposals/core/lib/create-empty-sow-section'` with `import { seedSowSections } from '@/shared/modules/proposals/core/lib/seed-sow-sections'`.
- Replace the block `// Map trade selections → SOW entries` … `}` (`:20-28`) with:
```ts
  // Requested trades → SOW sections: THE mapping (spec A §4.7). Pain points and
  // notes ride on the sections (C29) — no projectObjectives copy any more.
  defaults.project.data.sow = seedSowSections(flowState.tradeSelections ?? [])
```
- Delete the block `// Map pain points → project objectives` … `}` (`:68-77`).
- Leave the funding half (`dealStructure → funding`), the program block and the label block untouched (spec E owns D8/D9).

- [ ] **Step 5: DOCS**

In `src/shared/modules/proposals/core/DOCS.md` replace the whole `### sow-snapshot-from-meeting-on-create` section (`:50-56`) with:

```markdown
### sow-seeded-explicitly

A proposal's first SOW sections come from **one pure mapping**, `lib/seed-sow-sections.ts:seedSowSections(requested)` — requested trades (today `meetings.flowStateJSON.tradeSelections`; `meetings.initialRequestedTrades` from spec D on) → sections carrying the trade, its scopes, `painPoints` and `notes` (`#sow-rep-inputs`). The CALLER decides whether to seed: the proposals-table create path seeds from the meeting's selections (`features/meeting-flow/lib/build-proposal-defaults.ts`); the meeting flow's create dialog offers Blank or seeded (spec C, C27). The server never snapshots on create: the former create-time auto-snapshot (`snapSowFromMeeting`, retired 2026-09) made "Blank" impossible and was unreachable through the API anyway. After creation the SOW is independent of the meeting's selections.

**Why**: the agent's meeting-time picks are a starting point the agent chooses to use, not a rule the server imposes; one mapping keeps a dialog's preview and its payload identical.
**Reference impl**: `lib/seed-sow-sections.ts`; consumer `features/meeting-flow/lib/build-proposal-defaults.ts`
**Enforced by**: `create.before` performs no SOW enrichment (`dal/server/crud.ts`)
```

In `src/shared/entities/meetings/DOCS.md` replace the `### trade-selections-snapshot-source` section's body (`:176-180`) with:

```markdown
`meetings.flowStateJSON.tradeSelections` is the meeting-time scope picker output. When a proposal is created from the meeting, the CALLER seeds the proposal's SOW from these selections through the one mapping `modules/proposals/core/lib/seed-sow-sections.ts` (`../../modules/proposals/core/DOCS.md#sow-seeded-explicitly`) — the server no longer snapshots on create. After seeding, the proposal SOW is independent.

**Why**: the agent picks trades during the meeting; that picks-list flows into the first proposal as a starting point. Once the proposal exists, the agent edits the SOW independently — re-pulling from meeting state would erase their work.
**Reference impl**: `../../modules/proposals/core/lib/seed-sow-sections.ts` (the mapping); `features/meeting-flow/lib/build-proposal-defaults.ts` (today's caller); `dal/server/google-calendar.ts:getMeetingForGCal` (also reads tradeSelections for the GCal event description)
**Enforced by**: convention
```

Then `grep -rn "sow-snapshot-from-meeting-on-create" src docs` — fix any remaining anchor reference to `#sow-seeded-explicitly`.

- [ ] **Step 6: Pure checks, type-check, lint, smoke**

Run: `pnpm tsx scripts/verify-proposal-foundations.ts` → `✅`. Run: `pnpm tsc && pnpm lint` → clean. Run the smoke → all pass (no new section: the create path is unchanged for payloads carrying `sow`).

- [ ] **Step 7: Commit**

```bash
git add src/shared/modules/proposals/core/lib/seed-sow-sections.ts src/shared/modules/proposals/core/lib/snap-sow-from-meeting.ts src/shared/modules/proposals/core/dal/server/crud.ts src/features/meeting-flow/lib/build-proposal-defaults.ts src/shared/modules/proposals/core/DOCS.md src/shared/entities/meetings/DOCS.md scripts/verify-proposal-foundations.ts
git commit -m "feat(proposals): seedSowSections is the one meeting→SOW mapping; auto-snapshot retired

snapSowFromMeeting (create.before) is deleted — it made Blank impossible
(C27) and W4's B6/q9 becomes moot. buildProposalDefaults seeds through
seedSowSections; pain points and notes ride on the sections instead of
projectObjectives (C29). Funding half stays until spec E. Spec A §4.7,
C52.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
(If Task 0 Step 3 was declined, `src/shared/entities/meetings/DOCS.md` carries its pre-existing truth-pass hunk — say so.)

---

### Task 7: A proposal requires a meeting; the SOW child unit; DOCS; tracker (A7)

**Files:**
- Modify: `src/shared/db/schema/proposals.ts:74-75` → `pnpm db:push:dev` (after the dev pre-check)
- Modify: `src/shared/modules/proposals/core/dal/server/crud.ts:29-42` (`create.before`)
- Modify: `src/shared/modules/proposals/core/dal/server/queries.ts` (add `countProposalsForMeeting`)
- Modify: `src/shared/entities/meetings/dal/server/crud.ts:1-15,163-188` (`delete.before`)
- Modify: `src/features/proposal-flow/ui/views/create-new-proposal-view.tsx:74`
- Modify: `src/shared/modules/proposals/service.ts` (send guard; `sow` getter)
- Create: `src/shared/modules/proposals/sow/schemas/index.ts`, `src/shared/modules/proposals/sow/dal/server/queries.ts`, `src/shared/modules/proposals/sow/service.ts`
- Modify: `src/shared/modules/proposals/core/DOCS.md` (K2 rewrite — §4.10)
- Modify: `docs/plans/2026-09-20-multi-proposal-meeting-flow-epic.md` (ticks)
- Modify: `scripts/tmp-smoke-proposal-foundations.ts` (never committed)

**Interfaces:**
- Produces: `proposals.meeting_id` NOT NULL, FK `ON DELETE RESTRICT`; `insertProposalSchema.meetingId` required; `create.before` ⇒ `precondition-failed: meeting_not_found`; meetings `delete.before` ⇒ `precondition-failed: meeting_has_proposals`; `countProposalsForMeeting(meetingId): Promise<DalReturn<number>>`.
- Produces (`proposalService.sow`): `getById(ctx, { id }): DalReturn<SOW | undefined>` · `create(ctx, input: SowSectionInsert): DalReturn<SOW>` (appends) · `update(ctx, { id, data: SowSectionUpdate }): DalReturn<SOW>` (never reorders; `scopes` replacement drops orphaned cost lines) · `delete(ctx, { id }): DalReturn<void>` (compacts). Zod: `sowSectionFieldsSchema = sowSchema.omit({ id, financials }).strict()`, `sowSectionInsertSchema` (+ `proposalId`, optional `id`), `sowSectionUpdateSchema` (partial). Errors: unknown id ⇒ `not-found`; `create` with an id already on any proposal ⇒ `precondition-failed: sow_section_exists`; a payload with `financials` ⇒ rejected by Zod. Lock gate, promotion and rollup fire through the root `update`.
- W4 landing: this unit gains `server-spec.ts` + `dal/server/crud.ts`; `service.ts` becomes `{ ...proposalSowItemCrud, replace, clone }`; `dal/server/queries.ts`'s blob locator is replaced by row reads. No caller changes.

- [ ] **Step 1: Dev pre-check — no proposal without a meeting**

Run (dev DB, read-only):
```bash
DRIZZLE_TARGET=dev pnpm tsx -e "import './scripts/lib/load-env'; import { sql } from 'drizzle-orm'; import { db } from '@/shared/db'; const r = await db.execute(sql\`SELECT count(*)::int AS n FROM proposals WHERE meeting_id IS NULL\`); console.log(r.rows[0]); process.exit(0)"
```
Expected: `{ n: 0 }`. If not 0, list them (`SELECT id, label, created_at FROM proposals WHERE meeting_id IS NULL`) and, on dev only, either delete leftover `SMOKE-…` rows through `proposalService.delete` or attach real ones to a meeting by hand — the NOT NULL push fails otherwise.

- [ ] **Step 2: Schema (dev push)**

In `src/shared/db/schema/proposals.ts` replace (`:74-75`):
```ts
  meetingId: uuid('meeting_id')
    .references(() => meetings.id, { onDelete: 'set null' }),
```
with:
```ts
  // A proposal MUST be attached to a meeting (C38/D11): visibility, the homeowner
  // page and "Assign to meeting" all derive from it. `restrict`: deleting a
  // meeting that still has proposals is refused (the meetings delete.before
  // hook surfaces `meeting_has_proposals`; move them first). Push 1 tightens
  // the existing nullable column — ALTER COLUMN SET NOT NULL, never a rebuild.
  meetingId: uuid('meeting_id')
    .notNull()
    .references(() => meetings.id, { onDelete: 'restrict' }),
```
Run: `pnpm db:push:dev` → expected statements: `ALTER TABLE "proposals" ALTER COLUMN "meeting_id" SET NOT NULL;` and the FK drop/re-add with `ON DELETE RESTRICT`. Abort if the printed plan contains `truncate` or a table rebuild.

- [ ] **Step 3: `create.before` — the meeting must exist**

In `src/shared/modules/proposals/core/dal/server/crud.ts` replace the `create.before` body (`:29-42`) with:
```ts
      async before(input, _ctx) {
        // see ../../DOCS.md#proposal-requires-meeting — hooks run BEFORE the
        // Zod parse (createImpl), so a direct DAL caller may still hand in no
        // meetingId; tRPC callers were already refused by the insert schema.
        const meeting = input.meetingId
          ? dalVerifySuccess(await meetingCrud.getById(SYSTEM_CONTEXT, { id: input.meetingId }))
          : undefined
        if (!meeting) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: 'meeting_not_found' })
        }
        return {
          ...input,
          kind: deriveProposalKind(meeting.projectId),
          token: generateShareToken(),
          status: 'pre-draft' as const,
        }
      },
```
(`input.meetingId` is a required string now — drizzle-zod derives it from `.notNull()`.)

- [ ] **Step 4: The count query and the meetings delete guard**

Append to `src/shared/modules/proposals/core/dal/server/queries.ts`:
```ts
/** Every proposal on a meeting, pre-drafts included — the pre-check behind `proposals.meeting_id ON DELETE RESTRICT` (meetings delete.before). */
export async function countProposalsForMeeting(meetingId: string): Promise<DalReturn<number>> {
  return dalDbOperation(async () => {
    const [row] = await db.select({ c: count(proposals.id) }).from(proposals).where(eq(proposals.meetingId, meetingId))
    return row?.c ?? 0
  })
}
```

In `src/shared/entities/meetings/dal/server/crud.ts` add the imports:
```ts
import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import { countProposalsForMeeting } from '@/shared/modules/proposals/core/dal/server/queries'
```
and replace the `delete.before` hook body (`:183-187`) with:
```ts
      async before(row: Meeting) {
        // A proposal must stay attached to its meeting (proposals.meeting_id is
        // NOT NULL + ON DELETE RESTRICT): refuse with a clear reason instead of
        // a raw FK error. Move the proposals first ("Assign to meeting", spec B).
        // see ../../../../modules/proposals/core/DOCS.md#proposal-requires-meeting
        const proposalCount = dalVerifySuccess(await countProposalsForMeeting(row.id))
        if (proposalCount > 0) {
          throw new ThrowableDalError({ type: 'precondition-failed', reason: 'meeting_has_proposals' })
        }
        if (row.gcalEventId) {
          await deleteMeetingEventJob.dispatchOrThrow({ gcalEventId: row.gcalEventId })
        }
      },
```
(Import direction: meetings DAL → proposals DAL queries. `core/dal/server/queries.ts` imports schema, helpers and the incentives/media query modules only — no path back into the meetings crud, so no module cycle.)

- [ ] **Step 5: Consumers of the required `meetingId`**

`src/features/proposal-flow/ui/views/create-new-proposal-view.tsx:74`: change `meetingId: meetingId || undefined,` to `meetingId,` (the view already refuses to render without one).

`src/shared/modules/proposals/service.ts` `send`: replace
```ts
      if (row.meetingId) {
        dalVerifySuccess(await deriveOutcomeOnProposalSent(SYSTEM_CONTEXT, { meetingId: row.meetingId }))
      }
```
with
```ts
      dalVerifySuccess(await deriveOutcomeOnProposalSent(SYSTEM_CONTEXT, { meetingId: row.meetingId }))
```

Run `pnpm tsc` and fix any further `meetingId` nullability fallout it reports (expected: none beyond these two; `getFullView` joins are `leftJoin` and stay valid).

- [ ] **Step 6: The SOW child unit — schemas**

Create `src/shared/modules/proposals/sow/schemas/index.ts`:
```ts
import z from 'zod'

import { sowSchema } from '@/shared/modules/proposals/core/schemas'

// Content-only section inputs (spec A §4.6 / C56): no `id` (addressed
// separately) and no `financials` — section price, cost lines and section
// incentives belong to the whole-SOW save (today the editor's projectJSON
// write; in W4 `replaceProposalSow` / `proposals.sow.replace`). `.strict()` so
// a payload carrying `financials` is REJECTED, not silently stored.
export const sowSectionFieldsSchema = sowSchema.omit({ id: true, financials: true }).strict()
export type SowSectionFields = z.infer<typeof sowSectionFieldsSchema>

export const sowSectionInsertSchema = sowSectionFieldsSchema.extend({
  proposalId: z.string().uuid(),
  id: z.string().uuid().optional(),
}).strict()
export type SowSectionInsert = z.infer<typeof sowSectionInsertSchema>

export const sowSectionUpdateSchema = sowSectionFieldsSchema.partial().strict()
export type SowSectionUpdate = z.infer<typeof sowSectionUpdateSchema>
```

- [ ] **Step 7: The SOW child unit — the blob locator (DAL)**

Create `src/shared/modules/proposals/sow/dal/server/queries.ts`:
```ts
// Blob-backed locator for the SOW child unit (spec A §4.6). Section ids are
// uuids, unique across proposals, so ONE scoped containment query resolves the
// owning proposal. An internal detail that dies with the blob: W4 replaces it
// with `proposal_sow_items` row reads in this same file.
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Proposal } from '@/shared/db/schema/proposals'

import { and, sql } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { db } from '@/shared/db'
import { proposals } from '@/shared/db/schema/proposals'

/** The (scoped) proposal whose `projectJSON.data.sow` holds a section with this id, or undefined. */
export async function getProposalBySowSectionId(
  ctx: ScopedContext,
  sectionId: string,
): Promise<DalReturn<Proposal | undefined>> {
  return dalDbOperation(async () => {
    const needle = JSON.stringify([{ id: sectionId }])
    const [row] = await db
      .select()
      .from(proposals)
      .where(and(
        sql`${proposals.projectJSON}->'data'->'sow' @> ${needle}::jsonb`,
        ctx.scope ?? undefined,
      ))
      .limit(1)
    return row as Proposal | undefined
  })
}
```

- [ ] **Step 8: The SOW child unit — the service**

Create `src/shared/modules/proposals/sow/service.ts`:
```ts
// SOW child service — `proposalService.sow` (spec A §4.6 / C56). Per-section
// CONTENT verbs for surfaces that never hold the whole document (Specialties,
// spec D). The verbs carry the engine's slot signatures (`CrudHandlers`:
// getById / create / update / delete, `{ id }` / `{ id, data }`) from day one,
// so W4 replaces these blob-backed bodies with `...proposalSowItemCrud` (a
// child server-spec + config-factory hooks in this unit) and changes no caller.
// Financial fields are not accepted here (schemas/): they belong to the
// whole-SOW save — the editor's projectJSON write today, `replaceProposalSow` /
// `proposals.sow.replace` in W4.
//
// Bodies today: locate the owning proposal (dal/server/queries.ts — one scoped
// containment query), rebuild the `sow` array, write through the ROOT's update
// slot, so the lock ladder, the pre-draft promotion and the rollup re-drive all
// fire (core/dal/server/crud.ts). Array index is the section's order (W4
// `position`): create appends, delete compacts, update never reorders. No
// transaction (W4 R.1): one read + one write per verb. Two agents editing the
// SAME proposal concurrently can lose an update until W4 makes sections rows —
// a known, W4-resolved hazard (../core/DOCS.md#sow-child-service).
//
// The root is referenced only inside method bodies — call time, never module
// top level (the import-cycle rule in ../service.ts).
// see ../core/DOCS.md#sow-child-service

import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Proposal } from '@/shared/db/schema/proposals'
import type { SOW } from '@/shared/modules/proposals/core/types'
import type { SowSectionInsert, SowSectionUpdate } from '@/shared/modules/proposals/sow/schemas'

import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
import { createEmptySowSection } from '@/shared/modules/proposals/core/lib/create-empty-sow-section'
import { proposalService } from '@/shared/modules/proposals/service'
import { getProposalBySowSectionId } from '@/shared/modules/proposals/sow/dal/server/queries'
import { sowSectionInsertSchema, sowSectionUpdateSchema } from '@/shared/modules/proposals/sow/schemas'

async function locate(ctx: ScopedContext, sectionId: string): Promise<{ proposal: Proposal, index: number }> {
  const proposal = dalVerifySuccess(await getProposalBySowSectionId(ctx, sectionId))
  const index = proposal?.projectJSON.data.sow.findIndex(section => section.id === sectionId) ?? -1
  if (!proposal || index < 0) {
    throw new ThrowableDalError({ type: 'not-found' })
  }
  return { proposal, index }
}

/** One whole-document write through the root update slot: lock gate → promotion → write → rollup. */
async function writeSow(ctx: ScopedContext, proposal: Proposal, sow: SOW[]): Promise<void> {
  const projectJSON = { ...proposal.projectJSON, data: { ...proposal.projectJSON.data, sow } }
  dalVerifySuccess(await proposalService.update(ctx, { id: proposal.id, data: { projectJSON } }))
}

/** Zod `.partial()` admits explicit `undefined`; a spread would then blank a required field. Drop them. */
function definedFields<T extends object>(data: T): Partial<T> {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)) as Partial<T>
}

export const proposalSowService = {
  async getById(ctx: ScopedContext, input: { id: string }): Promise<DalReturn<SOW | undefined>> {
    return dalDbOperation(async () => {
      const proposal = dalVerifySuccess(await getProposalBySowSectionId(ctx, input.id))
      return proposal?.projectJSON.data.sow.find(section => section.id === input.id)
    })
  },

  /** Appends a section (array index = W4 `position`). `id` optional; an id already present on ANY proposal ⇒ `sow_section_exists`. The parent probe is scoped: an invisible proposal is `not-found`. */
  async create(ctx: ScopedContext, input: SowSectionInsert): Promise<DalReturn<SOW>> {
    return dalDbOperation(async () => {
      const { proposalId, id, ...fields } = sowSectionInsertSchema.parse(input)
      const proposal = dalVerifySuccess(await proposalService.getById(ctx, { id: proposalId }))
      if (!proposal) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (id && dalVerifySuccess(await getProposalBySowSectionId(SYSTEM_CONTEXT, id))) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: 'sow_section_exists' })
      }
      const section = createEmptySowSection({ ...definedFields(fields), ...(id ? { id } : {}) })
      await writeSow(ctx, proposal, [...proposal.projectJSON.data.sow, section])
      return section
    })
  },

  /** Replaces the named fields; nested arrays (`scopes`, `painPoints`) are replaced wholesale, never merged. Replacing `scopes` drops the section's cost lines whose scope is gone (C62). Never reorders. */
  async update(ctx: ScopedContext, input: { id: string, data: SowSectionUpdate }): Promise<DalReturn<SOW>> {
    return dalDbOperation(async () => {
      const data = definedFields(sowSectionUpdateSchema.parse(input.data))
      const { proposal, index } = await locate(ctx, input.id)
      const current = proposal.projectJSON.data.sow[index]!
      const next: SOW = { ...current, ...data }
      if (data.scopes) {
        const scopeIds = new Set(data.scopes.map(scope => scope.id))
        next.financials = {
          ...current.financials,
          costLines: current.financials.costLines.filter(line => scopeIds.has(line.relatedScopeId)),
        }
      }
      await writeSow(ctx, proposal, proposal.projectJSON.data.sow.map((section, i) => (i === index ? next : section)))
      return next
    })
  },

  /** Removes the section and compacts the array (order of the rest preserved). */
  async delete(ctx: ScopedContext, input: { id: string }): Promise<DalReturn<void>> {
    return dalDbOperation(async () => {
      const { proposal } = await locate(ctx, input.id)
      await writeSow(ctx, proposal, proposal.projectJSON.data.sow.filter(section => section.id !== input.id))
    })
  },
} as const

export type ProposalSowService = typeof proposalSowService
```

- [ ] **Step 9: Reach it as `proposalService.sow`**

In `src/shared/modules/proposals/service.ts` add `import { proposalSowService } from './sow/service'` beside the other child imports, and a getter after `media`:
```ts
  get sow() {
    return proposalSowService
  },
```
In the header comment's `<children>` line add `proposalService.sow.update` to the examples.

- [ ] **Step 10: Type-check, lint**

Run: `pnpm tsc && pnpm lint` → clean. Boot-order check for the root ↔ sow cycle: the smoke imports the child first (next step) — a TDZ ReferenceError there means a top-level root reference sneaked into `sow/service.ts`.

- [ ] **Step 11: Smoke — sections 6 and 7 before `finally`, plus imports**

Add `import { proposalSowService } from '@/shared/modules/proposals/sow/service'` as the FIRST `@/shared/modules/proposals/…` import (worst-case order for the cycle) and `import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'`.

```ts
    // ── 6. meeting required ────────────────────────────────────────────────
    section('6. a proposal must be attached to a meeting')
    const ghostMeeting = await proposalService.create(sys, {
      label: 'SMOKE-ghost',
      ownerId: admin.id,
      meetingId: crypto.randomUUID(),
      projectJSON: smokeProjectJSON(),
      startingTcpCents: 0,
      depositAmountCents: 0,
      cashInDealCents: 0,
    })
    check('create with a missing meeting ⇒ meeting_not_found', errType(ghostMeeting) === 'precondition-failed' && errReason(ghostMeeting) === 'meeting_not_found', ghostMeeting)
    const noMeeting = await proposalService.create(sys, {
      label: 'SMOKE-no-meeting',
      ownerId: admin.id,
      projectJSON: smokeProjectJSON(),
      startingTcpCents: 0,
      depositAmountCents: 0,
      cashInDealCents: 0,
    } as never)
    check('create without meetingId ⇒ meeting_not_found (hook runs before the Zod parse; tRPC rejects it earlier)', errType(noMeeting) === 'precondition-failed' && errReason(noMeeting) === 'meeting_not_found', noMeeting)
    const delMeeting = await meetingCrud.delete(sys, { id: meeting.id })
    check('deleting a meeting with proposals ⇒ meeting_has_proposals', errType(delMeeting) === 'precondition-failed' && errReason(delMeeting) === 'meeting_has_proposals', delMeeting)

    // ── 7. sow child service ───────────────────────────────────────────────
    section('7. proposalService.sow: engine-shaped, content-only, by section id')
    check('root exposes the sow child (getter identity)', proposalService.sow === proposalSowService)
    const host = await proposalService.create(sys, {
      label: `SMOKE-sow-${Date.now()}`,
      ownerId: admin.id,
      meetingId: meeting.id,
      projectJSON: { ...smokeProjectJSON(), data: { ...smokeProjectJSON().data, sow: [] } },
      startingTcpCents: 0,
      depositAmountCents: 0,
      cashInDealCents: 0,
    })
    if (!host.success) {
      throw new Error('cannot continue sow checks')
    }
    created.push(host.data.id)
    const s1 = await proposalService.sow.create(sys, { proposalId: host.data.id, contentJSON: '', html: '', scopes: [{ id: 'sc-1', label: 'One' }], title: 'First', trade: { id: 'roofing', label: 'Roofing' }, painPoints: ['leak'] })
    const s2 = await proposalService.sow.create(sys, { proposalId: host.data.id, contentJSON: '', html: '', scopes: [], title: 'Second', trade: { id: 'hvac', label: 'HVAC' }, painPoints: [], notes: 'rep only' })
    check('create ×2 succeeds and appends in order', s1.success && s2.success, [s1, s2])
    if (s1.success && s2.success) {
      const hostAfter = await proposalService.getById(sys, { id: host.data.id })
      check('host promoted to draft by the section write', hostAfter.success && hostAfter.data?.status === 'draft', hostAfter.success && hostAfter.data?.status)
      check('array order = creation order', hostAfter.success && hostAfter.data?.projectJSON.data.sow.map(s => s.id).join() === [s1.data.id, s2.data.id].join())
      const got = await proposalService.sow.getById(sys, { id: s2.data.id })
      check('getById by section id alone round-trips (notes included)', got.success && got.data?.title === 'Second' && got.data.notes === 'rep only', got)
      const dupId = await proposalService.sow.create(sys, { proposalId: host.data.id, id: s1.data.id, contentJSON: '', html: '', scopes: [], title: 'Dup', trade: { id: 'x', label: 'X' }, painPoints: [] })
      check('create with an existing id ⇒ sow_section_exists', errType(dupId) === 'precondition-failed' && errReason(dupId) === 'sow_section_exists', dupId)
      const withMoney = await proposalService.sow.update(sys, { id: s1.data.id, data: { financials: { sectionPrice: 1, costLines: [], incentives: [] } } as never })
      check('update carrying financials is rejected (strict Zod)', !withMoney.success, withMoney)
      // Seed a cost line through the whole-document path (the editor's write),
      // then prune it through sow.update({ scopes }).
      const hostBlob = hostAfter.success ? hostAfter.data!.projectJSON : host.data.projectJSON
      const sowWithLine = hostBlob.data.sow.map(s => s.id === s1.data.id
        ? { ...s, financials: { ...s.financials, costLines: [{ id: crypto.randomUUID(), label: 'Shingles', amount: 10, relatedScopeId: 'sc-1' }] } }
        : s)
      const seededLine = await proposalService.update(sys, { id: host.data.id, data: { projectJSON: { ...hostBlob, data: { ...hostBlob.data, sow: sowWithLine } } } })
      check('whole-document save seeded a cost line on section 1', seededLine.success && seededLine.data.projectJSON.data.sow[0]?.financials.costLines.length === 1, seededLine)
      const pruned = await proposalService.sow.update(sys, { id: s1.data.id, data: { scopes: [{ id: 'sc-2', label: 'Two' }] } })
      check('update({ scopes }) replaces wholesale and drops orphaned cost lines (C62)', pruned.success && pruned.data.scopes.length === 1 && pruned.data.scopes[0]?.id === 'sc-2' && pruned.data.financials.costLines.length === 0, pruned)
      const retitled = await proposalService.sow.update(sys, { id: s2.data.id, data: { title: 'Second (edited)' } })
      check('update({ title }) keeps every other field', retitled.success && retitled.data.title === 'Second (edited)' && retitled.data.notes === 'rep only' && retitled.data.trade.id === 'hvac', retitled)
      const ghost = await proposalService.sow.update(sys, { id: crypto.randomUUID(), data: { title: 'x' } })
      check('update unknown id ⇒ not-found', errType(ghost) === 'not-found', ghost)
      const del = await proposalService.sow.delete(sys, { id: s1.data.id })
      const hostFinal = await proposalService.getById(sys, { id: host.data.id })
      check('delete compacts, order of the rest preserved', del.success && hostFinal.success && hostFinal.data?.projectJSON.data.sow.map(s => s.id).join() === s2.data.id, hostFinal.success && hostFinal.data?.projectJSON.data.sow.map(s => s.id))
      const delAgain = await proposalService.sow.delete(sys, { id: s1.data.id })
      check('delete twice ⇒ not-found', errType(delAgain) === 'not-found', delAgain)
      const nobodyCtx = buildUserContext('smoke-nobody', 'agent', proposalServerSpec)
      const scoped = await proposalService.sow.getById(nobodyCtx, { id: s2.data.id })
      check('a non-participant agent cannot see the section (scoped locator)', scoped.success && scoped.data === undefined, scoped)
      const frozen = await proposalService.update(sys, { id: host.data.id, data: { contractEnvelopeId: 'SMOKE-ENVELOPE' } })
      const lockedWrite = await proposalService.sow.update(sys, { id: s2.data.id, data: { title: 'nope' } })
      check('sow.update on a draft-locked proposal ⇒ proposal_frozen (gate fires through the root)', frozen.success && errType(lockedWrite) === 'precondition-failed' && errReason(lockedWrite) === 'proposal_frozen', lockedWrite)
      await proposalService.update(sys, { id: host.data.id, data: { contractEnvelopeId: null } })
    }
```

Run the smoke → all pass. (Cleanup already deletes proposals before the raw meeting delete, which the `restrict` FK now requires.)

- [ ] **Step 12: DOCS — the K2 rewrite (spec §4.10)**

In `src/shared/modules/proposals/core/DOCS.md`:

(a) Replace the Lifecycle diagram block (`:9-19`) and the sentence under it with:

```markdown
```
   pre-draft ──► draft ──► sent ──► approved ──► (project created — separate agent action)
       │                    ▲
       └────────────────────┘  first send skips draft (P12)
                            │
                            ├── contractSentAt        (Zoho envelope out)
                            ├── contractViewedAt      (Zoho webhook: viewed)
                            ├── contractSignedAt      (Zoho webhook: completed → auto-approves)
                            └── contractDeclinedAt    (Zoho webhook: declined — status unchanged)

   declined                (terminal; agent recovers manually if relevant)
```

`status` has five values: `pre-draft | draft | sent | approved | declined`. `pre-draft` is a birth state (`#pre-draft-status`); contract events are separate timestamp columns (not status values) — set by Zoho Sign webhooks independent of status.
```

(b) In `### kind-derived-from-meeting-project` append to the first paragraph: ` A proposal always has a meeting (\`#proposal-requires-meeting\`), so the input is always the meeting's \`projectId\`.`

(c) In `### proposal-lock-ladder`, after the sentence listing lifecycle fields (`Lifecycle fields (status, sentAt/approvedAt, signing ids, contract timestamps, QB refs) stay writable`), add: ` \`sentMessage\` is lifecycle too — a locked proposal can be re-sent with a new note (\`#send-verb\`).`

(d) Insert the following eight rules after `### one-approved-initial-sale-per-meeting` (before `### conversion-trigger`):

```markdown
### pre-draft-status

Every create — blank, seeded, duplicate — is born `pre-draft` (`create.before` overwrites any client-sent status; `duplicate.overrides` sets it too). The first write that touches a user-authored field promotes it to `draft`: `lib/proposal-pre-draft.ts:shouldPromotePreDraft` is called in `update.before` right after the lock gate, with the same probe (`getProposalLockSignals`) and the same field set (`frozenProposalLockedFields`) — promotion is the lock gate's twin, so whatever write the ladder would refuse on a frozen proposal promotes an untouched one. Lifecycle-only writes (status, timestamps, contract ids, `sentMessage`) never promote; a payload that sets `status` itself is respected; media uploads never promote (a photo is not authorship). `send` moves `pre-draft` straight to `sent`. The column default stays `'draft'` (the hook is the rule); rows created before this rule are not reclassified. Stale pre-drafts are filtered (`#listing-visibility`), never auto-deleted.

**Why**: the meeting flow mints a proposal per started sit (C6/C43); untouched ones must not contaminate every listing. Tying promotion to the lock ladder's field set keeps one definition of "user content".
**Reference impl**: `lib/proposal-pre-draft.ts`; `dal/server/crud.ts:hooks.create.before`, `hooks.update.before`, `duplicate.overrides`
**Enforced by**: the config-factory hooks (every origin). W4 moves the gate and the promotion together into the SOW child unit's hooks for child-row writes.

### listing-visibility

Two predicates, one module — `lib/proposal-visibility.ts`, row form + SQL form, both derived from the status subsets in `src/shared/constants/enums/proposals.ts`:

| Predicate | Statuses | Applied by |
|---|---|---|
| `isListableProposal` / `listableProposalSql` | `draft, sent, approved, declined` | EVERY agent-side listing/count: `listProposals` (opt-out `filters.includePreDraft`, meeting flow only), `getProposalsByMeetingId`, meeting `proposalCount`, pipeline items, the customer profile (and through it the timeline) |
| `isHomeownerVisibleProposal` / `homeownerVisibleProposalSql` | `sent, approved, declined` | the homeowner's meeting proposals page, inside spec F's single token resolver (H11) |

Status-specific reads (`status = 'sent'`, `IN ('sent','approved')`) are already narrower and stay as they are. Ad-hoc `status <> 'pre-draft'` literals anywhere else are forbidden.

**Why**: "which proposals does a list show" is one business rule with two consumers; scattering it is how the token path's four hand-rolled compares happened.
**Reference impl**: `lib/proposal-visibility.ts`; `dal/server/queries.ts:listProposals` (`includePreDraft`)
**Enforced by**: convention + the `from(proposals)` audit in the spec A plan (Task 4, Step 10)

### readiness-predicate

`lib/proposal-readiness.ts:getProposalReadiness({ status, sow })` is THE rule for "can this proposal go to the homeowner": at least one SOW section with a trade id, and not `declined` (permanent — re-sending would resurrect it). `approved` is ready (re-delivering a signed proposal's link is legitimate; status untouched). It takes the DOMAIN sow list, never the column — callers pass `row.projectJSON.data.sow` today and `toSowInputs(row)` after W4. `assertProposalReady` throws `precondition-failed: proposal_not_ready:<reasons>`. Enforced at `proposalService.send` (`#send-verb`) and `contractService.createDraft` (envelope creation; the router maps the error to `PRECONDITION_FAILED`). The UI disables Send / Create Draft and shows the reason (`constants/readiness-reason-labels.ts`). Ad-hoc `sow.length` checks are forbidden — the lock ladder's discipline.

**Why**: an empty proposal is valid (`#sow-seeded-explicitly`), so "has a scope of work" had to become a gate at the moments it matters instead of a schema rule.
**Reference impl**: `lib/proposal-readiness.ts`; gates in `../service.ts:send` and `src/shared/services/contracts.service.ts:createDraft`
**Enforced by**: the two server gates; the UI is affordance-only

### send-verb

`proposalService.send(ctx, { id, recipient, message? })` is the ONE way a proposal reaches the homeowner: load → `assertProposalReady` → **write** (`sentMessage`; on the first send also `status: 'sent'` + `sentAt` — `pre-draft → sent` skips draft) → flip the meeting outcome (`deriveOutcomeOnProposalSent`) → **deliver** (the same email template and `ROOTS.public.proposalReview(id, token)` link as before — C25 keeps the mechanism). Write before deliver: under C20 the homeowner page shows a proposal only once it is `sent`, so delivering first would hand out a link to a proposal the page refuses to show; a delivery failure after the write leaves the row `sent` and surfaces the provider error — the rep resends. A resend re-stores the message and re-delivers, status untouched. Sequential, no transaction (W4 R.1). `deliveryRouter.sendProposalEmail` is a thin adapter (name and input unchanged until the access grill, Q14). The stored note renders on the proposal heading, customer and agent view alike.

**Why**: send was an unguarded router procedure (any status, message never stored); one verb gives every caller the gate, the order and the stored note.
**Reference impl**: `../service.ts:send`; `src/trpc/routers/proposals.router/delivery.router.ts:sendProposalEmail`; display `features/proposal-flow/ui/components/proposal/heading.tsx`
**Enforced by**: the router calls the verb only; `sent_message` has no other writer

### sow-rep-inputs

Each SOW section carries the rep's meeting-time inputs: `painPoints: string[]` (homeowner-visible — rendered from the sections, never copied into `projectObjectives`) and `notes?: string` (rep-private — on the never-to-homeowner list #285's projection enforces; until then it reaches token holders like every other `projectJSON` key, tracker X2). Seeded by `seedSowSections` (`#sow-seeded-explicitly`), edited per section through `proposalService.sow.update`. W4 columns: `pain_points text[]`, `notes text`.

**Why**: the meeting's pain points and notes belong to the trade they were said about; a proposal is where they are acted on (C29).
**Reference impl**: `schemas/index.ts:sowSchema`; `lib/seed-sow-sections.ts`
**Enforced by**: Zod (`painPoints` required, stamped `[]` by the one-time backfill; `notes` optional)

### sow-section-ids

Every SOW section has a stable uuid `id` (required by `sowSchema`, minted by `createEmptySowSection`, stamped once onto legacy blobs by `scripts/backfill-sow-section-ids.ts`). It survives every save and is regenerated in exactly two places: the form's duplicate-section action and proposal duplicate (`lib/regenerate-sow-section-ids.ts` in `duplicate.overrides`), because the copy's ids are its future row PKs. Array index is the section's order. The `projectJSON` blob carries no `_v` — W4 freezes it, and the backfill is the shape marker (jsonb-columns `#mandatory-schema-version` waived, C64).

**Why**: sections were addressed by array position; per-section edits from the meeting flow (spec D) and W4's `proposal_sow_items.id` (a pure lift of these ids) both need identity.
**Reference impl**: `lib/create-empty-sow-section.ts`; `lib/regenerate-sow-section-ids.ts`; `scripts/backfill-sow-section-ids.ts`
**Enforced by**: Zod (`id: z.string().uuid()`)

### sow-child-service

`proposalService.sow` (`../sow/service.ts`) is the per-section CONTENT API: `getById` / `create` / `update` / `delete`, addressed by section id alone, with the engine's slot signatures (`{ id }` / `{ id, data }`) so W4 swaps the bodies for `...proposalSowItemCrud` and no caller changes. Content only: `financials` (section price, cost lines, section incentives) is rejected at the Zod input — money is written by the whole-SOW save (today the editor's `projectJSON` write; in W4 `replaceProposalSow` / `proposals.sow.replace`, in this same unit and the same `proposals.sow.*` leaf). Today's bodies locate the owning proposal with one scoped containment query and write through the root's `update` slot, so the lock ladder, the promotion and the rollup all fire. `create` appends, `delete` compacts, `update` never reorders and replaces nested arrays wholesale; replacing `scopes` drops the section's cost lines tied to removed scopes (the server twin of the editor's cascade; incentives untouched). No transaction (W4 R.1): two agents editing the same proposal concurrently can lose an update until W4 makes sections rows — known, W4-resolved. tRPC exposure (`proposals.router/sow.router.ts` → `proposals.sow.{create,update,delete}`) lands with its first consumer, spec D.

**Why**: Specialties edits one section at a time and never holds the whole document; W4 needs one unit and one leaf (R.3), pre-shaped.
**Reference impl**: `../sow/service.ts`; locator `../sow/dal/server/queries.ts`; inputs `../sow/schemas/index.ts`
**Enforced by**: `.strict()` Zod inputs; every write routed through `proposalCrud.update`

### proposal-requires-meeting

`proposals.meeting_id` is NOT NULL with `ON DELETE RESTRICT`. `create.before` refuses a payload whose meeting does not exist (`precondition-failed: meeting_not_found`); the meetings `delete.before` hook refuses to delete a meeting that still has proposals (`precondition-failed: meeting_has_proposals`, via `countProposalsForMeeting` — pre-drafts count) — move them first ("Assign to meeting", spec B). `kind` derives from the meeting's `projectId` directly.

**Why**: visibility, the homeowner page and "Assign to meeting" all derive from the meeting (C38); a meeting-less proposal had no owner surface.
**Reference impl**: `src/shared/db/schema/proposals.ts`; `dal/server/crud.ts:hooks.create.before`; `src/shared/entities/meetings/dal/server/crud.ts:hooks.delete.before`; `dal/server/queries.ts:countProposalsForMeeting`
**Enforced by**: Postgres (NOT NULL + FK restrict) + the two hooks for clear errors

```

(e) In `## Anti-patterns` append before `## See also`:

```markdown
- **Hand-writing `status <> 'pre-draft'` (or `IN ('sent', …)` for the homeowner) anywhere but `lib/proposal-visibility.ts`.** One module, two predicates — see `#listing-visibility`.
- **Checking `sow.length` to decide whether a proposal can be sent or enveloped.** Use `getProposalReadiness` — see `#readiness-predicate`.
- **Sending a proposal from a router or job without `proposalService.send`.** The verb owns readiness, write-before-deliver and the stored note — see `#send-verb`.
- **Writing `financials` through `proposalService.sow.*`.** Content only; money goes through the whole-SOW save — see `#sow-child-service`.
- **Snapshotting the meeting's trade selections on the server at create.** Seeding is the caller's choice through `seedSowSections` — see `#sow-seeded-explicitly`.
```

(f) Update the footer to `**Last updated**: 2026-09-22 (spec A — proposal foundations: pre-draft, listing visibility, readiness, send verb, SOW ids + rep inputs, SOW child service, meeting required; multi-proposal epic)`.

(g) Also update the header paragraph's directory list sentence to include `the SOW child unit (\`../sow/\`)` after `dal/server/`.

Then `grep -n "four values\|snapSowFromMeeting\|sow-snapshot" src/shared/modules/proposals/core/DOCS.md` — expected: no hits.

- [ ] **Step 13: Tracker ticks**

In `docs/plans/2026-09-20-multi-proposal-meeting-flow-epic.md`:
- §0 row A: replace the status cell `[~] awaiting the owner's go → writing-plans` with `[x] built on dev 2026-<mm-dd> (7 commits A1–A7); Push 1 pending (owner's go)`.
- §1 requirement rows P1, P2, P3, P4, P5, P6, P7, P8, P10, P12, P13, D11, H15 (agent half), H16, K2: append ` — built (spec A, <short hash of the commit that landed it>)` to each Status cell; H15's note says `agent half built; homeowner half = spec F`.
- Status line at the top of the file: `Spec A BUILT on dev (2026-…); Push 1 pending; spec B/C next.`

- [ ] **Step 14: Type-check, lint, full smoke, pure checks**

Run: `pnpm tsc && pnpm lint && pnpm tsx scripts/verify-proposal-foundations.ts` → clean / `✅`. Run the smoke → all pass.

- [ ] **Step 15: Commit**

```bash
git add src/shared/db/schema/proposals.ts src/shared/modules/proposals/core/dal/server/crud.ts src/shared/modules/proposals/core/dal/server/queries.ts src/shared/entities/meetings/dal/server/crud.ts src/features/proposal-flow/ui/views/create-new-proposal-view.tsx src/shared/modules/proposals/service.ts src/shared/modules/proposals/sow/schemas/index.ts src/shared/modules/proposals/sow/dal/server/queries.ts src/shared/modules/proposals/sow/service.ts src/shared/modules/proposals/core/DOCS.md docs/plans/2026-09-20-multi-proposal-meeting-flow-epic.md
git commit -m "feat(proposals): meeting required; SOW child service; DOCS for spec A

proposals.meeting_id NOT NULL + ON DELETE RESTRICT (dev pushed; prod =
Push 1): create refuses a missing meeting, meeting delete refuses while
proposals exist. New unit modules/proposals/sow (proposalService.sow):
engine-shaped content-only getById/create/update/delete by section id,
routed through the root update so lock, promotion and rollup fire — the
bodies W4 replaces with ...proposalSowItemCrud. DOCS rules for every
spec A seam. Spec A §4.6, §4.9, §4.10; C38/C54/C56/C62.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: End-to-end verification on dev; Push 1 preflight (no prod push)

**Files:** none new. Read-only checks plus the smoke.

- [ ] **Step 1: Everything green from a clean tree**

Run:
```bash
git status --porcelain | grep -v '^??'      # expected: empty (or only the owner's own unrelated hunks)
pnpm tsc && pnpm lint
pnpm tsx scripts/verify-proposal-foundations.ts
pnpm tsx scripts/verify-financials-facade.ts
pnpm tsx scripts/backfill-sow-section-ids.ts --dry-run       # expected: would touch 0
DRIZZLE_TARGET=dev QSTASH_TOKEN= NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-smoke-proposal-foundations.ts
```

- [ ] **Step 2: Browser checks (dev server, agent session)**

Start `pnpm dev`; sign in as an agent (or use `/api/dev/playwright-session` per `memory/reference-playwright-auth.md` with the Playwright MCP). Walk:
1. `/dashboard/proposals/new?meetingId=<a dev meeting with tradeSelections>` — the form is pre-seeded with one section per selected trade (pain points/notes ride along; `projectObjectives` is empty). Remove every section: the empty state "No scope of work yet" renders; the form still submits (a proposal with `sow: []`).
2. The proposals table — the just-created proposal is **absent** (pre-draft). Open it via the meeting's proposals (`/dashboard/proposals/<id>`), edit the label, save — it now appears in the table as Draft. The status filter offers no "Pre-draft"; the status dropdown shows Pre-draft greyed out on a pre-draft row reached with `includePreDraft` (none reachable today — fine).
3. On the zero-SOW proposal's Agreement step: "Send Proposal Email" and "Create Draft" are disabled with "Add a scope of work with a trade before sending." Add a section with a trade, save: both enable.
4. Send it with a personal note. Reload `/proposals/<id>?token=<token>` (homeowner view): the note renders under the greeting as "A note from Tri Pros Remodeling". Status badge Sent. Resend with a different note: the new note shows, `sentAt` unchanged (check the "Sent to … on" line).
5. Edit a proposal with two sections, save, reload, open DevTools → the `getFullView` payload: section ids are unchanged after the save. Duplicate the section in the form: the copy has a different id. Duplicate the proposal from the table action: its sections have new ids, the source's are unchanged, incentives are cloned, the copy is not listed (pre-draft) until edited.
6. Delete a meeting that has proposals from the meetings table: the toast reads `meeting_has_proposals` (raw reason — friendly copy is spec B's, with "Assign to meeting").

- [ ] **Step 3: Push 1 preflight (prepare; the owner runs the prod steps)**

Nothing here touches prod. Prepare and hand over:
1. **Generated SQL, grepped.** From a tree at the commit to deploy, run `DRIZZLE_TARGET=dev pnpm drizzle-kit push --verbose` (prints the statements; answer "No" to any prompt on a DB that is already current) and record the statement list. It must contain only: `ADD COLUMN "sent_message" text`, `ALTER COLUMN "meeting_id" SET NOT NULL`, the FK drop/re-add with `ON DELETE RESTRICT`. `grep -i truncate` on the captured output must be empty.
2. **Prod pre-checks (owner-run, read-only):**
   ```sql
   SELECT count(*) FROM proposals WHERE meeting_id IS NULL;
   SELECT count(*) FROM proposals p, jsonb_array_elements(p."project_JSON"->'data'->'sow') s WHERE s->>'id' IS NULL OR s->'painPoints' IS NULL;
   ```
   Any row in the first query is hand-assigned under the owner's eye (or via "Assign to meeting" once spec B ships) BEFORE the tighten.
3. **Runbook order (spec §8, B9):** fresh Neon snapshot → `DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-sow-section-ids.ts --dry-run` → live run → `pnpm db:push:prod` from a tree whose `src/shared/db/schema` is exactly the deployed commit → deploy the code (DDL before deploy) → `DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-sow-section-ids.ts --dry-run` as the drift check (0). Push 1 ships together with spec D's `meetings` half under **one explicit owner go**.
4. Write these three items into the tracker's Push 1 section (§0) as the runbook stub if not already there.

- [ ] **Step 4: Report**

Report to the owner: the seven commit hashes, the smoke's pass count, the dev backfill counts, the browser walk results (each of the six items pass/fail), and the Push 1 preflight artifacts (statement list, grep result). Do not push to prod.

---

## Self-review notes (run after writing; kept for the executor)

- **Spec coverage.** §4.1 → Task 3; §4.2 → Task 5 (+ UI); §4.3 → Task 5; §4.4 → Task 4; §4.5 → Task 4 (every row of the spec's table has a step, plus `getProposalsByMeetingId`); §4.6 → Task 7; §4.7 → Task 6; §4.8 → Tasks 1–3; §4.9 → Task 7; §4.10 → Task 7 Step 12; §4.11 → honored throughout (no W4 prep item touched; ids/painPoints/notes/position/promotion/duplicate/readiness seams as specified); §6 A1–A7 = Tasks 1–7; §7 smoke items → Tasks 2–7 sections 1–7 + Task 8; §8 → Task 8 Step 3.
- **Type consistency.** `shouldPromotePreDraft(signals, data)` (Task 4) is what Task 4's `update.before` calls; `assertProposalReady({ status, sow })` (Task 5) is what Task 5's `send` and `createDraft` call; `cloneGlobalIncentiveRows(sourceId, targetId)` (Task 2) is what the hook calls; `seedSowSections(TradeSelection[])` (Task 6) is what `buildProposalDefaults` calls; `SowSectionInsert` / `SowSectionUpdate` (Task 7 schemas) are the `sow.create` / `sow.update` input types; `listableProposalSql(col)` takes a column or `sql\`p.status\`` everywhere it is used; `PaginatedResult.rows` is the list field.
- **Deviations from the spec text, all recorded as C62–C66 in the tracker and SA17–SA21 in the spec:** hook on the duplicate config (not `CrudSlotHookMap`); DAL clone twin + service `clone` deleted; `painPoints` required (no `.default`); constants in `constants/enums/`; promotion respects explicit `status`; readiness gate in `contractService.createDraft` + router error mapping; orphan cost-line pruning; `_v` waiver.
