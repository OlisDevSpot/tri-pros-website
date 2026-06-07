# Campaigns Control Center — UX Redesign

**Date:** 2026-06-06
**Status:** Design approved (brainstorm + ui-ux-pro-max pass). Ready for implementation plan.
**Page:** `/dashboard/campaigns` (super-admin only)
**Supersedes the UI of:** `src/features/campaigns-admin/` ring-1 scaffold (functional, but flat/cramped).
**Builds on:** voip-campaigns EPIC (`docs/plans/voip-campaigns/EPIC.md`, decisions 2026-06-04 "perfect separation"). Does **not** change the perfect-separation data model.

---

## Goal

Turn the ring-1 campaigns scaffold into a real-world operations console for managing CloudTalk lead-conversion campaigns. The current page crams a one-time setup table above a thin source→leads master-detail; it offers no way to see *who* is eligible, no per-lead visibility, and no DNC management. This redesign makes the page the daily driver for: pushing leads into CloudTalk, curating who gets dialed, and inspecting individual leads — while CloudTalk remains the source of truth for the lead lifecycle.

## The defining constraint (carried from the EPIC)

**Perfect separation:** our DB stores no call outcomes, dispositions, attempt counts, or conversation history — CloudTalk owns all of it. This page therefore is an **enrollment & bridge-control surface**, not a call-analytics dashboard. The one exception is the lead drawer (below), which reads a few CloudTalk signals **live, on demand, and never persists them.**

## Decisions (resolved during brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | **Scope** — how far the page reaches into CloudTalk data | **B: console + on-demand signals.** Control surface + a per-lead drawer that fetches a few live CT signals on open, read-through, never stored. |
| 2 | **Information architecture** | **C: three tabs** — Overview · Leads · Setup (`nuqs` `tab` param). |
| 3 | **Enrollment model** | **Cherry-pick + bulk** — individual enroll, multi-select batch, and per-source "enroll all eligible". |
| 4 | **DNC** | **First-class** — a status filter + a "mark DNC" action (row/drawer/bulk) + a DNC view. |
| 5 | **Manual click-to-call** | **No** — all pre-meeting dialing stays in CloudTalk's AI cadence (avoids double-dialing). |
| 6 | **Profile linking** | **Yes** — lead rows/drawer deep-link to the full customer profile. |

---

## Information architecture

`/dashboard/campaigns` → three tabs, tab state in the URL (`nuqs`), super-admin gated (page already redirects non-super-admins).

### ① Overview — daily landing ("what needs attention?")
- **Totals strip** across all sources (enrolled / eligible / DNC), `tabular-nums`. DB counts only — no CT calls, fast.
- **Per-source rollup cards** (responsive grid): source name, default-campaign chip, **enrolled / eligible / DNC** stats, a full-width **"Enroll all eligible"** primary action (campaign picker popover), and a **binding-health warning** (amber) when a source has eligible leads but no bound/default campaign (links to Setup).

### ② Leads — the power tool
- **Filter bar:** Source ▾ · Campaign ▾ · Status ▾ (`eligible | enrolled | removed | dnc`) · search (name/phone) · "Enroll all eligible ▾". Filter state in URL (`nuqs`), restored on back.
- **Table** (reuses the shared `DataTable` + `usePaginatedQuery` toolkit): select ☐ · Name (↗ profile) · Campaign · Status badge · **Live-signal cell** (lazy) · Enrolled date · row action.
  - Eligible rows show an inline **Enroll** button; enrolled rows open the drawer on click.
  - Sticky header, row-hover highlight, `overflow-x-auto` on small screens.
- **Live-signal cell:** lazily fetches a compact CT summary (attempts + last outcome) per *visible* row; shimmer skeleton → value, so the table paints instantly.
- **Bulk action bar** (appears on selection, motion/react slide-up): Enroll · Remove · Switch campaign · **Disqualify** · **Mark DNC**. Destructive actions in danger color, visually separated.

### ③ Setup — rare config, out of the way
- **Resync from CloudTalk** button.
- **Campaign → source binding table** (today's `CloudtalkSyncCard`/`CampaignBindingRow`, relocated): bind each synced campaign to a lead source + per-source default toggle.
- **Contact-attributes readout:** the synced `lead_source` / `primary_trade` / `trades_interested` bridge, so the merge-field wiring is verifiable.

---

## The lead drawer (centerpiece of scope B)

shadcn `Sheet` from the right. Sections top-to-bottom:

1. **Header** — name + status badge + **"Open full profile ↗"** deep-link.
2. **Identity** (from our DB, instant) — phone, city, lead source, interested trades, enrolled campaign + enrolled date + membership tag.
3. **Live from CloudTalk** (fetched on open, **never stored**) — last disposition + when, attempts (x/10), next scheduled dial, assigned DID, last-call recording link. Has its **own** loading (⟳ skeleton) / data / error (`role="alert"`) state, in a tinted panel, with a *"fetched live — not stored"* caption. Degrades gracefully: shows what CloudTalk returns, hides what it doesn't.
4. **Actions** (status-contextual) — Switch campaign ▾ · Remove · Disqualify · Mark DNC · (Re-enroll when status = removed).

---

## Visual design (ui-ux-pro-max pass)

- **Style:** Data-Dense Dashboard — compact cards, real data table, minimal padding, maximum scannability — expressed entirely in the **existing shadcn token system** (no new palette/fonts; consistency over the skill's generic suggestion).
- **Status colors** (semantic; never color-alone — each badge carries a dot **and** text label):
  - enrolled = green · eligible = neutral/muted · removed = amber · DNC = red · graduated = blue (silent exit, not a row state the user acts on).
  - Binding-health warning reuses the amber/removed token.
- **Tabs:** shadcn underline tabs; active = foreground text + 2px bottom border.
- **Cards/table/drawer:** subtle borders, `tabular-nums` for all counts, muted-foreground for secondary text, row-hover highlight, `outline-not-ring` for focus (project convention).
- **Motion:** 150–300ms transitions; bulk bar slide-up; drawer slide-in from trigger side; `prefers-reduced-motion` respected; animate transform/opacity only.
- **Async UX:** skeletons for the live-signal cell + drawer CT block; mutation buttons disable + spinner; toasts auto-dismiss; confirm dialogs on bulk-destructive (disqualify/DNC/unenroll-all).
- **A11y:** 44px touch targets, focus order matches visual order, `aria-live`/`role="alert"` on the drawer error, color-not-only, contrast ≥4.5:1 in light + dark.

---

## Entities involved

| Entity | Role |
|---|---|
| `voip_campaigns` | CT campaign ↔ source bridge (name, status, membership tag, sourceSlug, cadence). |
| `voip_campaign_contacts` | per-customer participation (enrolledAt/unenrolledAt/unenrollReason/dialAttempts/ctContactId) — the lead's campaign state. |
| `voip_contact_attributes` | CT attribute ↔ app-key bridge (Setup readout). |
| `customers` | identity, phone, city, `leadMetaJSON.interestedTradesRaw`, DNC fields, pipeline (eligibility). |
| `lead_sources` | slug/name/isActive, `voipConfigJSON.campaigns` (enabled, defaultCampaignId). |
| *CloudTalk contact activity* | **not an entity** — fetched live for the drawer, never stored. |

## tRPC surface — reuse vs new

**Reuse (exist in `voipCampaignsRouter`):** `listCampaigns`, `listAttributes`, `getSourceCampaignSummaries`, `resyncFromCloudtalk`, `bindCampaignToSource`, `setDefaultCampaign`, `enroll` (single — *finally surfaced*), `enrollAll`, `disqualify`, `disqualifyBulk`, `removeFromCampaign`, `unenrollAll`.

**New:**
- `listLeads` — unified workspace query: filter by source/campaign/status (`eligible|enrolled|removed|dnc`) + search + pagination. **Biggest new backend lift**; a new DAL read that unions the eligibility-gate pool + enrolled + removed + DNC with correct joins. Must use the existing pagination toolkit shape.
- `getLeadCtActivity` — drawer's live block; calls a **new provider method `cloudtalkClient.getContactActivity(ctContactId)`** → `{ lastDisposition, lastContactedAt, attempts, nextDialAt?, didUsed?, recordingUrl? }`. Read-through, unstored. Also feeds the lazy per-row live-signal cell (a lighter projection).
- `getOverviewSummaries` — extend the existing summary with **DNC counts** + a binding-health flag.
- `enrollSelected(customerIds, campaignId)` — cherry-pick bulk (vs per-source `enrollAll`).
- `removeBulk(customerIds)` — bulk neutral remove (reason `removed`).
- `markDnc` / `removeDnc` (single + bulk) — DNC first-class; wrap existing `complianceService.addToDnc` with `addedByUserId = current super-admin`.
- `switchCampaign(customerId, toCampaignId)` — atomic re-point (remove old membership tag → add new → update `voip_campaign_id`); a customer is in exactly one campaign. New service method on `campaignEnrollmentService`.

**New provider method:** `cloudtalkClient.getContactActivity(ctContactId)` — live read of CT call history/disposition/attempts/recording for one contact.

## Component tree (one component/file, named exports, no barrels)

```
features/campaigns-admin/
  ui/views/
    campaigns-view.tsx              # shell: tab strip + nuqs `tab`, renders active tab
    campaigns-overview-view.tsx     # ① Overview
    campaigns-leads-view.tsx        # ② Leads (filters + table + drawer orchestration)
    campaigns-setup-view.tsx        # ③ Setup
  ui/components/overview/
    overview-totals-strip.tsx
    source-rollup-card.tsx
    enroll-all-popover.tsx          # campaign picker + enroll-all (shared w/ Leads filter bar)
  ui/components/leads/
    leads-filter-bar.tsx
    leads-table.tsx                 # wraps shared DataTable + usePaginatedQuery
    lead-table-row.tsx
    lead-status-badge.tsx
    lead-live-signal-cell.tsx       # lazy per-row CT signal
    leads-bulk-action-bar.tsx
    lead-drawer.tsx                 # Sheet shell + orchestration
    lead-drawer-identity.tsx
    lead-drawer-ct-activity.tsx     # the live block; own query + loading/error
    lead-drawer-actions.tsx
    switch-campaign-popover.tsx
  ui/components/setup/
    cloudtalk-sync-card.tsx         # moved from current root
    campaign-binding-row.tsx        # moved
    contact-attributes-readout.tsx  # new
  hooks/
    use-campaign-mutations.ts       # extend: enrollSelected, removeBulk, markDnc/removeDnc, switchCampaign
    use-lead-filters.ts             # nuqs filter state
  lib/
    lead-status.ts                  # status derivation (enrolled|eligible|removed|dnc)
    format-ct-signal.ts             # live-signal formatting
```

**Retired** (logic salvaged into the above): `source-enrollment-panel.tsx`, `campaign-source-list.tsx`, `enrolled-leads-list.tsx`, `enrolled-lead-row.tsx`.

## Common user flows

1. **First-run setup** — Setup → Resync → bind each campaign→source → set default → confirm attributes readout.
2. **Bulk enroll** — Overview → source with eligible>0 → Enroll all eligible → pick campaign → background job → counts update.
3. **Cherry-pick enroll** — Leads → Status=Eligible + Source filter → select N (or single Enroll) → enrolled.
4. **Inspect** — Leads → click enrolled → drawer → live CT activity loads → see attempts/outcome/recording.
5. **Disqualify (bad lead)** — row/drawer/bulk → reason `disqualified`.
6. **Remove (neutral)** — reason `removed` → returns to eligible, re-enrollable.
7. **DNC** — Mark DNC (single/bulk) → DNC set + unenrolled + excluded from eligible (also fires automatically via the CT webhook).
8. **Switch campaign** — drawer → Switch campaign ▾ → atomic re-point.
9. **Re-enroll removed** — Leads → Status=Removed → Enroll.
10. **Graduation (automatic)** — meeting booked → drops from enrolled (reason `graduated`); shows only as a count change.
11. **Jump to context** — any lead → Open full profile → customer profile.

## Reuse / convention notes

- **Leads table** uses the shared `src/shared/components/data-table` + the `usePaginatedQuery` pagination toolkit (per `docs/codebase-conventions/query-toolkit.md`) — not a bespoke table.
- **DNC mutations** wrap the existing `complianceService.addToDnc` (already used by the CT webhook) — no new compliance logic.
- **Switch campaign** and bulk ops live as **service verbs** in `services/voip/campaigns/`, composing entity DAL mutations — the router stays glue (per ADR-0003 / services-orchestrate-dal-implements).
- Status-color tokens centralized in `lib/lead-status.ts` (mirrors how meetings/proposals colocate status colors).

## Risks / open items

- **CloudTalk API verification (the one real unknown):** confirm CT exposes a per-contact activity/call-history endpoint with the fields the drawer + live-signal cell need (disposition, attempts, next dial, recording). If a field isn't available, the drawer degrades gracefully (hide it). **Must verify before building `getContactActivity`.**
- **`listLeads` unified query** is the largest backend lift — the eligibility "eligible" branch must reuse the existing `derivedPipelineWhere('leads')` gate, not reinvent it.
- **Live-signal cell at scale / rate limits:** per-row live fetch must be lazy (visible rows only), debounced, and cached briefly in-memory to avoid hammering the CT API. If CT rate limits bite, fall back to fetching the signal only in the drawer (drop the per-row cell).

## Out of scope (deferred — ring 2+)

Stored CT analytics / funnel charts, reconciliation cron, holiday-pause, attempt-counter→cadence_exhausted persistence, voicemail handling, in-house click-to-call from this page, a dedicated customer-profile VoIP panel.
