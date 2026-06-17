# Campaigns-Admin Leads — Review Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use `- [ ]` checkboxes.

**Provenance:** Quality review (`/simplify` + conventions audit) of the recently-pushed campaigns-admin leads work (commits `d8478703..4e5f664b`), then a `/grill-me` design pass. This plan captures the resolved decisions.

**Baseline:** `main` @ `859ae61e`. **Re-baselined mid-planning** — a concurrent `canonical-lead-status` session rewrote the leads backend (`54d803dc` collapsed `listLeadsPaginated` onto canonical predicates; `lead-campaign-status.ts` now exists). Consequences already folded in:
- **Original finding #6 (extract derived-status lib helper) is DONE** — dropped from this plan.
- **#5 re-targets the rewritten `listLeadsPaginated`** (now a single raw `db.execute`, not 5 branches → simpler gate).
- Frontend findings (#1–#4) confirmed **untouched** by the concurrent work; #7 bulk loops confirmed **intact**.

**Tech stack:** Next.js 15, tRPC, Drizzle (Postgres/Neon), Upstash/QStash jobs. NO test framework — verify via `pnpm tsc` + `pnpm lint` (NEVER `pnpm build`). Async jobs via `createJob` (see `enroll-source-batch.ts`).

**Branch:** `main` (concurrent work in progress there — see Sequencing). No PR unless asked.

---

## Decisions (from the grill)

1. **Bulk ops → async jobs, universally.** Every bulk op (`enrollSelected`, `disqualifyBulk`, `removeBulk`, `markDnc`, `unenrollAll`) dispatches a QStash job and returns immediately — mirroring the existing `enrollAll`. Timeout-proof, one consistent pattern. Accepted cost: lose synchronous per-lead counts until a realtime kernel lands.
2. **Three reason-parameterized jobs.** `bulkEnrollJob({customerIds, campaignId})`, `bulkUnenrollJob({customerIds, reason})` (covers disqualify/remove/unenrollAll), `bulkDncJob({customerIds})` (compliance write + unenroll). `unenrollAll`'s procedure resolves ids first, then dispatches `bulkUnenrollJob` — every job takes a uniform `customerIds[]`.
3. **UI feedback = background toast + delayed refetch.** On dispatch: toast "…ing N leads in the background", clear selection, invalidate `listLeads` after a short delay (+1–2 retries). No optimistic status (the per-lead gate chain skips some leads — optimism would lie).
4. **#5 phone gate: thread the real DAL gate now.** Add `ScopedContext` to `listLeadsPaginated`, swap `customers.phone` for `gatedPhoneSql(isSuperAdmin)`. Leak-proof with compiler backing even though behaviorally inert for the current super-admin-only caller.
5. **#3/#4 frontend: feature-wide.** Extract one props-driven `CampaignSelect` (campaigns passed in, never fetched); convert all 4 callers (`lead-campaign-cell`, `bulk-enroll-popover`, `switch-campaign-popover`, `enroll-all-popover`); lift `listCampaigns` to each owning view; thread via `LeadsTableMeta` for the per-row cell.
6. **#1 phone formatter / #2 age:** use `formatAsPhoneNumber` in the Phone cell; render a real relative age via `formatDistanceToNow` (already a dep) for the "Age" column.
7. **zip-to-drift-hash:** fold `zip` into `BuildContactAttributesInput` + the attribute hash so the delta-pusher re-pushes when a customer's zip changes (completes the shipped zip hotfix).

---

## Sequencing (collision-aware)

`#5` edits `queries.ts` — the file the concurrent `canonical-lead-status` session just rewrote. **Do `#5` LAST**, after that session settles. Frontend + jobs don't touch `queries.ts`.

| Slice | Findings | Touches `queries.ts`? | Notes |
|---|---|---|---|
| **1. UI polish + zip-hash** | #1, #2, zip-hash | No | Independent, trivial. Safe to start anytime. |
| **2. CampaignSelect feature-wide** | #3, #4 | No | Touches leads + overview components, owning views, `LeadsTableMeta`. |
| **3. Bulk-op async jobs** | #7 | No | 3 new jobs + 5 procedures + UI feedback. |
| **4. DAL phone gate** | #5 | **Yes** | LAST. Re-verify `listLeadsPaginated` shape before editing. |

**File-overlap watch:** Slices 2 and 3 both touch `leads-bulk-action-bar.tsx` and `hooks/use-campaign-mutations.ts`. Do them in sequence (2 then 3), not parallel worktrees, or expect a small merge.

---

## Slice 1 — UI polish + zip-hash

### Task 1.1: Phone formatter (#1) + relative age (#2)
**File:** `src/features/campaigns-admin/ui/lib/leads-columns.tsx`
- [ ] Phone cell (`:65`): `{row.original.phone ? formatAsPhoneNumber(row.original.phone) : '—'}`. Import `formatAsPhoneNumber` from `@/shared/lib/formatters`.
- [ ] "Age" column (`:90`): replace `formatEnrolledAt(createdAt)` with a relative age. Add a small pure helper (keep `formatEnrolledAt` for the "Enrolled" column, which is a genuine date). Either inline `formatDistanceToNow(new Date(createdAt), { addSuffix: true })` (import from `date-fns`) or add `formatRelativeAge` next to `formatEnrolledAt`. Guard null → `'—'`.
- [ ] `pnpm tsc && pnpm lint` clean.

### Task 1.2: zip → drift hash (zip-hash)
**Files:** `src/shared/services/voip/campaigns/lib/build-contact-attributes.ts`, `enrollment.service.ts`
- [ ] Add `zip: string` to `BuildContactAttributesInput` (alongside `name`, `city`). Update the hash source (`:60`): `JSON.stringify({ name, city, zip: input.zip, values: valueByKey })`. (Comment at `:28-29` already says built-ins are "folded into the hash so a name/city change invalidates the delta-skip" — extend it to zip.)
- [ ] In `enrollment.service.ts`, pass `zip: customer.zip` into the `buildContactAttributes({...})` call (~`:155-161`). `customers.zip` is `notNull`, always present.
- [ ] `pnpm tsc && pnpm lint` clean.
- [ ] Commit: `fix(voip): fold zip into contact-attribute drift hash`

---

## Slice 2 — CampaignSelect feature-wide (#3, #4)

### Task 2.1: Extract the shared primitive
**New:** `src/features/campaigns-admin/ui/components/shared/campaign-select.tsx`
- [ ] `CampaignSelect({ campaigns, value, onChange, excludeId?, includeRemove?, placeholder? })` — props-driven, **never calls tRPC**. Renders the `Select` of `c.ctCampaignName`, optional "Remove from campaign" item (the `__remove__` sentinel stays caller-side), optional `excludeId` filter. One component per file, named export.
- [ ] `pnpm tsc && pnpm lint`.

### Task 2.2: Convert the 4 callers + lift the query
- [ ] **`lead-campaign-cell.tsx`** — drop `useTRPC`/`useQuery`; read `campaigns` from `table.options.meta`. Add `campaigns: VoipCampaign[]` to `LeadsTableMeta` (`leads-columns.tsx`); the view supplies it.
- [ ] **`campaigns-leads-view.tsx`** — already holds `campaignsQuery` (`:36`); add `campaigns: campaignsQuery.data ?? []` to the `meta` object (`:112`).
- [ ] **`bulk-enroll-popover.tsx`** — drop its `useQuery`; accept `campaigns` as a prop from `LeadsBulkActionBar` ← view.
- [ ] **`switch-campaign-popover.tsx`** (`:22`) — drop `useQuery`; accept `campaigns` as a prop from the `LeadDrawer` ← view.
- [ ] **`enroll-all-popover.tsx`** (`:24`, overview area) — drop `useQuery`; lift `listCampaigns` to the overview view and pass down.
- [ ] All five now use `<CampaignSelect campaigns={…} … />`. Verify zero `useQuery(...listCampaigns...)` remain in `ui/components/`: `grep -rn "listCampaigns" src/features/campaigns-admin/ui/components` → should be empty.
- [ ] `pnpm tsc && pnpm lint`.
- [ ] Commit: `refactor(campaigns): props-driven CampaignSelect; views own listCampaigns`

---

## Slice 3 — Bulk-op async jobs (#7)

### Task 3.1: Three jobs (mirror `enroll-source-batch.ts`)
**New:** `bulk-enroll.ts`, `bulk-unenroll.ts`, `bulk-dnc.ts` under `src/shared/services/providers/upstash/jobs/`
- [ ] `bulkEnrollJob = createJob('bulk-enroll', async ({customerIds, campaignId, requestedByUserId}) => …)` — loop `campaignEnrollmentService.enroll(SYSTEM_CONTEXT, {customerId, campaignId})`; count enrolled/skipped; `recordSyncError` on per-customer failure; `console.warn` summary. Carry the `@migration: chunk via cloudtalkClient.bulkContacts` note.
- [ ] `bulkUnenrollJob = createJob('bulk-unenroll', async ({customerIds, reason, requestedByUserId}) => …)` — loop `campaignEnrollmentService.unenroll(SYSTEM_CONTEXT, {customerId, reason})`. `reason: 'disqualified' | 'removed'`.
- [ ] `bulkDncJob = createJob('bulk-dnc', async ({customerIds, requestedByUserId}) => …)` — per customer: `complianceService.addToDnc({customerId, reason: 'admin', addedByUserId})` then `unenroll(…, {reason: 'opted_out'})`.
- [ ] `pnpm tsc && pnpm lint`.

### Task 3.2: Rewire the 5 procedures to dispatch
**File:** `src/trpc/routers/voip-campaigns.router.ts`
- [ ] `enrollSelected` → `assertCampaignDialable` then `void bulkEnrollJob.dispatch({...})`, return `{ queued: customerIds.length }`.
- [ ] `disqualifyBulk` → `void bulkUnenrollJob.dispatch({ customerIds, reason: 'disqualified', ... })`.
- [ ] `removeBulk` → `void bulkUnenrollJob.dispatch({ customerIds, reason: 'removed', ... })`.
- [ ] `markDnc` → `void bulkDncJob.dispatch({ customerIds, ... })`.
- [ ] `unenrollAll` → resolve `ids = listActiveCustomerIdsBySource(sourceSlug)` (DAL, keep), then `void bulkUnenrollJob.dispatch({ customerIds: ids, reason: 'disqualified', ... })`, return `{ queued: ids.length }`.
- [ ] Add `.max(1000)` to every bulk `customerIds` input (QStash payload sanity; not a UX ceiling since jobs handle large N).
- [ ] `requestedByUserId: ctx.session.user.id` on each dispatch.
- [ ] `pnpm tsc && pnpm lint`.

### Task 3.3: UI feedback (background toast + delayed refetch)
**Files:** `hooks/use-campaign-mutations.ts`, `leads-bulk-action-bar.tsx`
- [ ] Update the bulk mutation wrappers: `onSuccess` → toast `Enrolling/Removing/… {queued} leads in the background`, call `onDone`/clear selection, and `setTimeout(() => invalidate(listLeads), 2000)` (+ optionally a second retry at ~5s). Return shape is now `{ queued }`, not `{ requested, enrolled }` — update any consumer reading the old counts.
- [ ] `pnpm tsc && pnpm lint`.
- [ ] Commit: `refactor(voip): bulk campaign ops dispatch async jobs (timeout-safe)`

---

## Slice 4 — DAL phone gate (#5) — LAST

**Pre-req:** confirm the concurrent `canonical-lead-status` session has settled and `listLeadsPaginated` is stable. Re-read it before editing.

**File:** `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts`
- [ ] Add `ctx: ScopedContext` as the first arg of `listLeadsPaginated` (mirror other gated DAL signatures). Derive `isSuperAdmin` from ctx the same way existing `gatedPhoneSql` callers in `customers/dal/server/queries.ts` do.
- [ ] In the `SELECT` (`~:259`), swap `customers.phone AS phone` for `${gatedPhoneSql(isSuperAdmin)} AS phone`. `gatedPhoneSql`/`hasSentProposalSql` live in `src/shared/entities/customers/lib/phone-gating-sql.ts`. Confirm the fragment composes inside the raw `db.execute` with the unaliased `customers` table (it already references `customers.*`).
- [ ] Update the only caller — `listLeads` in `voip-campaigns.router.ts` — to pass `ctx`. (It's `superAdminProcedure`, so phone stays raw for super-admins — behavior unchanged; the gate is now structural.)
- [ ] Consider the search filter (`:223`): `customers.phone ILIKE …` searches raw phone. For super-admin-only that's fine; leave with a comment, or gate consistently.
- [ ] `pnpm tsc && pnpm lint`.
- [ ] Commit: `refactor(voip): gate phone at the DAL in listLeadsPaginated`

---

## Out of scope / deferred
- **Realtime completion feedback** for bulk jobs (live per-lead progress) — deferred to the Ably Realtime Kernel (already an approved, deferred design). Until then, jobs are fire-and-forget + delayed refetch.
- **CT bulk-contacts API** (`≤10 ops/req`) throughput optimization — the `@migration` note stays on the jobs; jobs loop one-at-a-time for now (matches `enroll-source-batch`).
- **#6** (derived-status lib helper) — already shipped by the concurrent `canonical-lead-status` work.

## Self-review
- **Decision coverage:** jobs (3.1) + dispatch (3.2) + feedback (3.3) = decisions 1–3; phone gate (4) = decision 4; CampaignSelect (2) = decision 5; UI polish (1.1) = decision 6; zip-hash (1.2) = decision 7. ✅
- **Staleness handled:** #6 dropped (done upstream); #5 re-verified against rewritten `listLeadsPaginated` (still ungated, still raw phone). ✅
- **Collision risk:** #5 isolated to last slice; overlap of slices 2/3 on `leads-bulk-action-bar` + `use-campaign-mutations` noted. ✅
- **Convention fit:** jobs mirror `enroll-source-batch`; `CampaignSelect` is props-driven (no leaf tRPC); phone gate moves to the DAL per the customers DOCS invariant; one-component-per-file + named exports throughout.
