# Dispatcher Visibility Corrections — Implementation Plan

> **For agentic workers:** Inline execution (executing-plans). Steps use checkbox (`- [ ]`) syntax. No test runner — verify with `pnpm tsc && pnpm lint` + uncommitted scratch `tsx` probes (`scripts/tmp-phase5-*.ts`, each starting `import './lib/load-env'`, deleted after use).

**Goal:** Let dispatchers work the full operational pipeline (leads + rehash + dead + fresh) — see customers, meetings, and notes, and edit the sales-discovery profile — while *structurally* never seeing financials (proposals + projects), and fix the "Failed to load profile" error a dispatcher hits right after booking a meeting.

**Architecture:** Two coupled walls hide a dispatcher's freshly-booked customer: (1) the customer flips derived pipeline `leads → fresh`, leaving the dispatcher's `$inDerivedPipeline` set; (2) the booking is system-owned, so the dispatcher isn't a meeting participant. We widen the dispatcher's **operational** grants (Customer pipeline set + unconditional Meeting read) to dissolve both. But the profile/list loaders gate proposals *only* by visible-meeting join — so widening meeting visibility would leak deal values. We first **decouple the financial wall** by gating proposals on the Proposal subject scope (`resolveActorScope(proposalServerSpec, actor)`), which denies for any actor lacking `read Proposal` (dispatcher) regardless of meeting visibility. "No financials" thus becomes a property of the absent Proposal grant, the CASL way — completing the per-entity gating the loaders already apply to meetings and projects.

**Tech Stack:** CASL (`@casl/ability`) scope compiler, Drizzle (Postgres/Neon), tRPC, the Phase-5 `Actor`/`ScopedContext`/`resolveActorScope` seam.

**Spec:** This plan. Grounded in `docs/plans/2026-08-10-casl-scope-compiler-epic.md` (Phase 5) and memory `project-casl-phase-5-customer-pipelines`, `project-dispatcher-role`, `project-pipelines-domain-rethink`.

## Global Constraints

- **Branch:** `refactor/285-refactor-permissions-casl-scope-compiler` in worktree `.worktrees/issue-285`. Commit only on explicit user approval; stage by explicit path (never `git add -A`); never commit `CLAUDE.local.md`.
- **Verify:** `pnpm tsc && pnpm lint` ONLY. No `.test.ts`, no `pnpm build`. Scratch probes are uncommitted and deleted after use.
- **Task order is load-bearing:** financial decoupling (Task 1) MUST land before operational widening (Task 2) so no commit in history ever contains the proposal-value leak.
- **Merge policy:** stays in this worktree; single integration pass after the whole overhaul. Do NOT merge to main.
- **Financial subjects unchanged:** dispatcher gets NO `read Proposal` / `read Project` grant. That absence is the wall.

---

### Task 1: Decouple the financial wall (gate proposals by Proposal subject scope)

Close the latent leak *before* widening anything. `proposalServerSpec` is root-shaped (no `parent`); `resolveActorScope(proposalServerSpec, actor)` → `compileScope` → `rulesToAST(ability,'read','Proposal')`. Dispatcher has no rule → `sql\`false\`` (deny-all) → zero proposals structurally. Agent's `read Proposal {$participatesViaMeeting:{via:'meetingId'}}` compiles to the same participation predicate already implied by the meeting join → parity. Omni's `manage all` → `null` → allow.

**Files:**
- Modify: `src/features/customer-pipelines/dal/server/get-customer-profile.ts` (proposal query + `hasSentProposal`)
- Modify: `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` (fresh builder `proposalRows` + `proposalDetailRows`; `hasSentProposal` suppression at entry chokepoint)

**Interfaces:**
- Consumes: `resolveActorScope(spec, actor): SQL | null`, `requireResolvedScope(scope): SQL | undefined`, `proposalServerSpec`.
- Produces: no signature changes; behavior — proposals/value empty for actors without `read Proposal`.

- [ ] **Step 1: Import `proposalServerSpec` in the profile loader**

In `get-customer-profile.ts`, add alongside the existing spec imports (after `projectServerSpec`):
```ts
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
```

- [ ] **Step 2: Gate the profile proposal query**

The proposal query (`.from(proposals).leftJoin(proposalViews...)`) currently filters only by `proposals.meetingId IN (meetingRows...)`. Add the proposal actor-scope to its `.where`, keeping the meeting-id filter:
```ts
.where(and(
  sql`${proposals.meetingId} IN (${sql.join(
    meetingRows.length > 0 ? meetingRows.map(m => sql`${m.id}`) : [sql`NULL`],
    sql`, `,
  )})`,
  requireResolvedScope(resolveActorScope(proposalServerSpec, actor)),
))
```
(`and` is already imported.)

- [ ] **Step 3: Suppress the `hasSentProposal` existence signal on the profile**

Just after `const canSeeUngated = canSeeUngatedPhone(actor)`, add:
```ts
const canReadProposals = actor.kind !== 'user' || actor.ability.can('read', 'Proposal')
```
Change the customer select's `hasSentProposal: hasSentProposalSql()` to keep the SQL (still needed for staff phone gating) but override in the assembled `customer` object. Where `const customer = { ...customerRow, attribution, enrichment }` is built, replace with:
```ts
const customer = {
  ...customerRow,
  hasSentProposal: canReadProposals ? customerRow.hasSentProposal : false,
  attribution,
  enrichment,
}
```

- [ ] **Step 4: Import `proposalServerSpec` in the list builder**

In `get-customer-pipeline-items.ts`, add after `projectServerSpec`:
```ts
import { proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'
```

- [ ] **Step 5: Gate the fresh builder's aggregate proposal query (`proposalRows`)**

Add the proposal scope to its `.where(and(...))` (currently meeting-scope + `inArray(customers.id, customerIds)`):
```ts
.where(and(
  requireResolvedScope(resolveActorScope(meetingServerSpec, actor)),
  requireResolvedScope(resolveActorScope(proposalServerSpec, actor)),
  inArray(customers.id, customerIds),
))
```

- [ ] **Step 6: Gate the fresh builder's detail proposal query (`proposalDetailRows`)**

Same addition to its `.where(and(...))`:
```ts
.where(and(
  requireResolvedScope(resolveActorScope(meetingServerSpec, actor)),
  requireResolvedScope(resolveActorScope(proposalServerSpec, actor)),
  inArray(meetings.customerId, customerIds),
))
```

- [ ] **Step 7: Suppress `hasSentProposal` at the list entry chokepoint**

In `getCustomerPipelineItems` (the dispatcher-reachable entry), after computing `canSeeUngated`, add:
```ts
const canReadProposals = actor.kind !== 'user' || actor.ability.can('read', 'Proposal')
```
Wrap the four builder returns so the final array is post-processed once. Replace the trailing `return get…PipelineItems(...)` calls' results with a single suppression pass, e.g. capture into `const items = await <builder>(...)` per branch and `return maskFinancials(items, canReadProposals)`, where a local module helper is added to `src/features/customer-pipelines/lib/` (NOT inline in this file — file-level-helper rule):

Create `src/features/customer-pipelines/lib/mask-financials.ts`:
```ts
import type { CustomerPipelineItem } from '@/features/customer-pipelines/types'

/**
 * Strip the "a proposal exists" existence signal from list items for actors
 * without `read Proposal` (dispatchers). Value/count/list are already emptied
 * by the SQL proposal-scope gate; this covers the residual boolean badge.
 */
export function maskFinancials(items: CustomerPipelineItem[], canReadProposals: boolean): CustomerPipelineItem[] {
  if (canReadProposals)
    return items
  return items.map(item => ({ ...item, hasSentProposal: false }))
}
```
Import it and apply at each `return` in `getCustomerPipelineItems`:
```ts
if (pipeline === 'leads')
  return maskFinancials(await getLeadsPipelineItems(customerScope, inBucket, canSeeUngated), canReadProposals)
// …same wrapping for projects, rehash/dead, and fresh branches
```

- [ ] **Step 8: `pnpm tsc && pnpm lint`** — expect green (pre-existing warnings only).

- [ ] **Step 9: Scratch probe — proposal leak closed, agent parity preserved**

Write `scripts/tmp-phase5-financial-decouple.ts` (server-only monkeypatch stub as in prior probes). Pick a `fresh`-bucket customer that HAS ≥1 sent proposal (query `derivedPipelineWhere(['fresh'])` ∩ `hasSentProposalSql`). Then:
- `getCustomerProfile(dispatcherCtx, id)` → assert `allProposals.length === 0`, every `meetings[].proposals` empty, `customer.hasSentProposal === false`.
- `getCustomerProfile(agentCtx, id)` (an agent who participates) → assert `allProposals.length > 0` (parity: unchanged).
- `getCustomerPipelineItems(dispatcherCtx, 'fresh')` → assert every item `proposalCount === 0`, `totalPipelineValue === 0`, `proposals.length === 0`, `hasSentProposal === false`.
- `getCustomerPipelineItems(agentCtx, 'fresh')` → assert at least one item retains `proposalCount > 0` (parity).
Run with `npx tsx`, confirm all PASS, then `rm` the probe.

- [ ] **Step 10: Checkpoint — list touched files (`git diff --name-status`) for approval, then commit**

```bash
git add src/features/customer-pipelines/dal/server/get-customer-profile.ts \
        src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts \
        src/features/customer-pipelines/lib/mask-financials.ts
git commit -m "fix(customer-pipelines): gate proposals by Proposal subject scope (decouple financial wall from meeting visibility)"
```

---

### Task 2: Widen dispatcher operational visibility (fresh-wide)

With financials structurally gated, safely open the operational layer. Add `fresh` to the dispatcher's customer pipeline set (dissolves wall #1), make Meeting read unconditional (dissolves wall #2 — the system-owned booking no longer needs a participant row), and keep the tab-access list in lockstep.

**Files:**
- Modify: `src/shared/domains/permissions/abilities.ts` (dispatcher Customer + Meeting rules)
- Modify: `src/shared/domains/pipelines/lib/get-accessible-pipelines.ts` (`DISPATCHER_PIPELINES`)
- Modify: `src/shared/domains/permissions/scope/operators/derived-pipeline.ts` (doc comment)

**Interfaces:**
- Consumes: `pipelines` const (`['projects','fresh','leads','rehash','dead']`).
- Produces: dispatcher accessible pipelines `['fresh','leads','rehash','dead']`; dispatcher Customer scope = those four derived buckets; dispatcher Meeting scope = null (allow-all).

- [ ] **Step 1: Widen the dispatcher Customer pipeline set**

In `abilities.ts`, dispatcher block, change:
```ts
can('read', 'Customer', { $inDerivedPipeline: ['leads', 'rehash', 'dead'] })
```
to:
```ts
// Dispatcher works the whole operational pipeline — the cold pool (leads /
// rehash / dead) PLUS fresh, so a lead they just booked (which flips
// leads→fresh) stays visible. NOT 'projects' (converted = the agent's book).
// Financials stay hidden via the absent Proposal/Project grants, not via bucket.
can('read', 'Customer', { $inDerivedPipeline: ['leads', 'rehash', 'dead', 'fresh'] })
```

- [ ] **Step 2: Make dispatcher Meeting read unconditional**

Change the dispatcher's:
```ts
can('read', 'Meeting', { $participatesViaMeeting: { via: 'self' } })
```
to:
```ts
// Unconditional: a dispatcher's bookings land SYSTEM-owned (unassigned), so a
// participation check would hide the meeting they just created. Meetings carry
// no financials (proposals are a separate, ungranted subject).
can('read', 'Meeting')
```

- [ ] **Step 3: Widen `DISPATCHER_PIPELINES`**

In `get-accessible-pipelines.ts`, change the const to:
```ts
const DISPATCHER_PIPELINES: readonly Pipeline[] = ['fresh', 'leads', 'rehash', 'dead']
```
(Canonical `pipelines` ordering makes `getAccessiblePipelines` return `['fresh','leads','rehash','dead']`.) Update its doc comment to include `fresh`.

- [ ] **Step 4: Refresh the operator doc comment**

In `derived-pipeline.ts`, update the "Canonical dispatcher visibility" line to `['leads','rehash','dead','fresh']` (user ruling 2026-08-20 — the full operational pipeline).

- [ ] **Step 5: `pnpm tsc && pnpm lint`** — expect green.

- [ ] **Step 6: Scratch probe — booking no longer ejects; tabs consistent**

Write `scripts/tmp-phase5-fresh-wide.ts`. Assert:
- `getAccessiblePipelines(dispatcher)` deep-equals `['fresh','leads','rehash','dead']`; agent + omni unchanged.
- Compiled dispatcher Customer scope count === `derivedPipelineWhere(['leads','rehash','dead','fresh'])` count, and ≥ the old `['leads','rehash','dead']` count.
- For a `fresh`-bucket customer, `getCustomerProfile(dispatcherCtx, id)` resolves (no `NOT_FOUND`) and returns ≥1 meeting (the booked one) with `proposals: []`.
- API guard: `getAccessiblePipelines(dispatcher).includes('projects') === false` (still fenced out of converted deals).
Run, confirm PASS, `rm`.

- [ ] **Step 7: Checkpoint — list touched files, then commit**

```bash
git add src/shared/domains/permissions/abilities.ts \
        src/shared/domains/pipelines/lib/get-accessible-pipelines.ts \
        src/shared/domains/permissions/scope/operators/derived-pipeline.ts
git commit -m "feat(permissions): dispatcher works fresh-wide operational pipeline (leads+rehash+dead+fresh, all meetings); fixes post-booking profile error"
```

---

### Task 3: Corrections (a) — dispatcher notes + sales-discovery profile

Grant note CRUD (author/admin-scoped by existing hook) and full sales-discovery profile edit (`CustomerProfile` subject, same as agents), plus the one Customer-owned discovery field (`age`).

**Files:**
- Modify: `src/shared/domains/permissions/abilities.ts` (dispatcher block)

**Interfaces:**
- Consumes: existing subjects `CustomerNote`, `CustomerProfile`; the `assertNoteAuthorOrAdmin` hook in `customerNoteServerSpec` (enforces own-note update/delete — CASL can't express it on string subjects).
- Produces: dispatcher can create/read notes, update/delete their own; read+update the full `customer_profiles` discovery record; write `age`.

- [ ] **Step 1: Add note grants** to the dispatcher block:
```ts
// Notes: any dispatcher may read/create; update/delete are author-or-admin,
// enforced in customerNoteServerSpec hooks (assertNoteAuthorOrAdmin).
can('read', 'CustomerNote')
can('create', 'CustomerNote')
can('update', 'CustomerNote')
can('delete', 'CustomerNote')
```

- [ ] **Step 2: Add sales-discovery profile grants** to the dispatcher block:
```ts
// Full sales-discovery profile (customer_profiles child table, Addendum B).
can('read', 'CustomerProfile')
can('update', 'CustomerProfile')
```

- [ ] **Step 3: Add `age` to the dispatcher's Customer update field list**

Change:
```ts
can('update', 'Customer', ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage'])
```
to include `'age'` (the sole Customer-owned discovery field; the other 23 live on `CustomerProfile`):
```ts
can('update', 'Customer', ['name', 'phone', 'email', 'address', 'city', 'state', 'zip', 'pipelineStage', 'age'])
```

- [ ] **Step 4: `pnpm tsc && pnpm lint`** — expect green.

- [ ] **Step 5: Scratch probe — grants present, note ownership still enforced**

Write `scripts/tmp-phase5-dispatcher-grants.ts`. Build the dispatcher ability and assert:
- `can('create','CustomerNote') === true`, `can('read','CustomerNote') === true`.
- `can('read','CustomerProfile') === true`, `can('update','CustomerProfile') === true`.
- `can('read','Proposal') === false`, `can('read','Project') === false` (financial wall intact).
Confirm PASS, `rm`. (Own-note update/delete enforcement lives in the DAL hook — out of scope for a CASL probe; note it in the checkpoint.)

- [ ] **Step 6: Checkpoint — list touched files, then commit**

```bash
git add src/shared/domains/permissions/abilities.ts
git commit -m "feat(permissions): dispatchers can write customer notes + full sales-discovery profile"
```

---

## Task 4: Final verification sweep

- [ ] **Step 1: Audit for other dispatcher-reachable proposal loads**

`git grep -n "from(proposals)\|proposals\." src/features src/trpc/routers/customer-pipelines.router.ts` — confirm the only dispatcher-reachable proposal reads are the two loaders gated in Task 1. Flag any other surface (e.g. a handler that loads proposals without `resolveActorScope(proposalServerSpec, actor)`) to the user rather than silently fixing.

- [ ] **Step 2: `pnpm tsc && pnpm lint`** final green.

- [ ] **Step 3: Confirm scratch probes removed** — `git status --short` shows only the three committed files' absence from the worktree tree and no `scripts/tmp-*` residue; `CLAUDE.local.md` remains untracked (never staged).

- [ ] **Step 4: Report** — summarize the three commits, the leak that was closed, and the residual "unconditional Meeting read" consequence. Await direction on the in-app manual-smoke matrix and Phase 6.

## In-app manual-smoke matrix (user eyeball, `pnpm dev` as dispatcher seed user)

1. Book a meeting for a leads customer → profile stays open (no "Failed to load profile"); the new meeting shows.
2. Fresh tab → lists the just-booked customer; **no deal value, no proposal count/badge** on any card.
3. Open a fresh customer with a known sent proposal → profile shows meetings but **zero proposals**, no `$` anywhere; projects section empty.
4. Rehash / dead / leads tabs still work; no proposal existence badge on any.
5. Create a note on a customer → succeeds; edit own note → succeeds; (attempt to edit an agent's note → blocked by hook).
6. Edit sales-discovery profile fields (pain, timeline, credit score) → persists.
7. Projects tab absent from dispatcher sidebar; API `list({pipeline:'projects'})` → FORBIDDEN.
8. Agent regression: agent still sees their own deal values + proposals unchanged; sidebar Fresh/Projects only.
