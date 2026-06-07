# HANDOFF — Campaigns Control Center, Plan 2 (Frontend)

**Date:** 2026-06-07. **Branch:** `main` (user works directly on main and controls pushes).
**Next action:** Use `superpowers:writing-plans` to write **Plan 2 (Frontend)** → `docs/superpowers/plans/2026-06-07-campaigns-frontend.md`, then execute it via `superpowers:subagent-driven-development` on `main` (fresh implementer per task, review between).

---

## State of the world

- **Design approved + spec committed:** `docs/superpowers/specs/2026-06-06-campaigns-page-ux-redesign-design.md` (read it — it has the full IA, component tree, flows, visual design).
- **Backend plan committed:** `docs/superpowers/plans/2026-06-06-campaigns-backend-foundation.md`.
- **Backend Phase 1 DONE** — 7 commits on `main` (unpushed), `pnpm tsc` + `pnpm lint` green. The full API the frontend consumes EXISTS.
- **Backend Phase 2 DEFERRED** (live CloudTalk signals) — Tasks 0–3 in the backend plan; gated on a CloudTalk `/calls?contact_id` verification. **Do NOT build the live-signal cell or the drawer "Live from CloudTalk" block in Plan 2.** Design components so they slot in later without rework.

## The 6 product decisions (locked)
1. **Scope B** — console + on-demand CT signals. Drawer ships **DB-first** now; live block is Phase 2.
2. **IA C** — three tabs **Overview · Leads · Setup**, tab state in URL via `nuqs`.
3. **Cherry-pick + bulk** enrollment (single `enroll` + multi-select + "enroll all").
4. **DNC first-class** — status filter + mark/clear DNC action (row/drawer/bulk) + DNC view.
5. **No click-to-call** — all dialing stays in CloudTalk.
6. **Deep-link to the customer profile** from lead rows/drawer.

## Visual design (ui-ux-pro-max pass)
- **Data-Dense Dashboard** style, expressed in the EXISTING shadcn token system (no new palette/fonts). `tabular-nums`, muted-foreground, subtle borders, row-hover highlight, `outline`-not-`ring` focus.
- **Status colors** (semantic, dot + text — never color alone): enrolled=green · eligible=neutral · removed=amber · dnc=red · graduated=blue (silent exit, not a row state).
- Tabs = shadcn underline tabs. Drawer = shadcn `Sheet` from right. Bulk bar = motion/react slide-up, destructive actions (disqualify/DNC) in danger color, separated. 150–300ms transitions, skeletons for async, buttons disable+spinner, confirm dialogs on bulk-destructive, `aria-live` on errors, 44px targets.

## API surface available NOW (in `voipCampaignsRouter`, super-admin)
**Reads:**
- `getSourceCampaignSummaries` → `{ sourceSlug, name, isActive, defaultCampaignId, dncCount, eligibleCount, enrolledCount, needsBinding }[]` (Overview cards + filter options).
- `listLeads` — **paginated**, input via `paginatedQueryInput({ status: 'eligible'|'enrolled'|'removed'|'dnc', sourceSlug?, campaignId? })` + `search`. Returns `PaginatedResult<CampaignLeadRow>` where `CampaignLeadRow = { customerId, name, status, campaignId, campaignName, enrolledAt, leadSourceId }`. (Type `LeadStatus`/`CampaignLeadRow` live in `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts` — re-export into the entity's `schemas/` or import from there for filter chips.)
- `listCampaigns`, `listAttributes`, `listEnrolledLeads` (legacy per-source), `getEnrollmentCounts`.

**Mutations:**
- Setup: `resyncFromCloudtalk`, `bindCampaignToSource`, `setDefaultCampaign`.
- Enroll: `enroll({customerId, campaignId?})`, `enrollSelected({customerIds, campaignId})` → `{requested, enrolled}`, `enrollAll({sourceSlug, campaignId})` (QStash bg job).
- Remove/curate: `removeFromCampaign({customerId})`, `removeBulk({customerIds})` → `{requested, removed}`, `disqualify`, `disqualifyBulk`, `unenrollAll({sourceSlug})`, `switchCampaign({customerId, toCampaignId})`.
- DNC: `markDnc({customerIds})` → `{count}` (DNCs **and** unenrolls), `removeDnc({customerId})`.

**Deferred (Phase 2, do NOT consume yet):** `getLeadCtActivity` (live drawer block).

## 3 Minor follow-ups → bake into Plan 2 as UX requirements
- Bulk ops return counts, not reasons → surface "X of Y succeeded — check eligibility (already-enrolled / DNC / no phone)" toast/inline.
- `markDnc` returns `{count}` → just show success.
- Always pass `status` to `listLeads` (it defaults to `eligible` if omitted).

## Component tree (from spec — one component/file, named exports, no barrels)
```
features/campaigns-admin/
  ui/views/ campaigns-view.tsx (shell+tabs) · campaigns-overview-view.tsx · campaigns-leads-view.tsx · campaigns-setup-view.tsx
  ui/components/overview/ overview-totals-strip.tsx · source-rollup-card.tsx · enroll-all-popover.tsx
  ui/components/leads/ leads-filter-bar.tsx · leads-table.tsx · lead-table-row.tsx · lead-status-badge.tsx ·
                       leads-bulk-action-bar.tsx · lead-drawer.tsx · lead-drawer-identity.tsx ·
                       lead-drawer-actions.tsx · switch-campaign-popover.tsx
                       (DEFER to Phase 2: lead-live-signal-cell.tsx, lead-drawer-ct-activity.tsx)
  ui/components/setup/ cloudtalk-sync-card.tsx (move) · campaign-binding-row.tsx (move) · contact-attributes-readout.tsx (new)
  hooks/ use-campaign-mutations.ts (extend) · use-lead-filters.ts (nuqs)
  lib/ lead-status.ts (status→label/color) · format-ct-signal.ts (Phase 2)
```
**Existing scaffold to handle:** retire `source-enrollment-panel.tsx`, `campaign-source-list.tsx`, `enrolled-leads-list.tsx`, `enrolled-lead-row.tsx` (salvage logic). Relocate `cloudtalk-sync-card.tsx` + `campaign-binding-row.tsx` into `setup/`. Current shell `campaigns-view.tsx` becomes the tab shell. Page route already wired: `src/app/(frontend)/dashboard/campaigns/page.tsx` renders `CampaignsView` (super-admin redirect in place). Sidebar nav + `ROOTS.dashboard.campaigns()` exist.

## MUST-follow conventions (read before coding)
- **No test runner.** Verify with `pnpm tsc` + `pnpm lint` ONLY. **NEVER `pnpm build`. NEVER `pnpm db:push`** (no schema changes in Plan 2).
- ONE React component/file; named exports only; no `export default`; no file-level consts/helpers in component files (→ `constants/`/`lib/`); no barrels in ui/components, ui/views, hooks, lib, constants.
- **Leads table MUST use the shared `DataTable` + `usePaginatedQuery` toolkit** (`docs/codebase-conventions/query-toolkit.md`). Reference impl: `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx`. Use `QueryToolbar` + `toDataTablePagination`/`toDataTableSorting`. Do NOT hand-roll page state/search debounce.
- tRPC client: `useTRPC()` from `@/trpc/helpers`; mutations via `useMutation(trpc.x.y.mutationOptions(...))`; invalidate via the existing `use-invalidation` patterns. Optimistic updates pattern: `memory/pattern-optimistic-updates.md`.
- `nuqs` for tab + filter URL state. shadcn `Sheet`/`Tabs`/`Select`/`Badge`; `motion/react` for the bulk bar. `useConfirm` hook for destructive confirms (already used in the scaffold).
- Find the customer-profile route for the deep-link (`ROOTS` in `src/shared/config/roots.ts`).
- Commit per task, conventional messages, end with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Open question to confirm with the user before/while writing Plan 2
- The lead **drawer** ships DB-first (identity + enrolled campaign/date + actions). Confirm the identity block's data source: `listLeads` returns `name`/`campaignName`/`enrolledAt`/`leadSourceId` but NOT phone/city/trades. Either (a) add those columns to `CampaignLeadRow`/`listLeads` (small backend tweak), or (b) the drawer fetches the customer via an existing customer query on open. Decide during Plan 2.
