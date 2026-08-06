# Adaptive Agent Dashboard — Design Spec (v1)

**Date:** 2026-08-06
**Status:** Approved structural design — pending UI-shaping pass
**Scope:** The main dashboard at `/dashboard` (currently a "Coming Soon" stub).

> This spec settles **structure and behavior only**. It makes **zero visual/styling
> decisions**. All UI shaping (hierarchy, typography, spacing, motion, card looks,
> the strip) is handed off to the mandated methodology
> `ui-ux-pro-max → web-design-guidelines → impeccable`, which runs **after** this
> spec is approved and **before** any UI code. See §9.

---

## 1. Philosophy

This is an **operational** dashboard ("what do I do next?"), not an analytical one
("what happened and why?"). Research (NN/g, Pencil&Paper, Smashing, Pipedrive/Close/
JobNimbus/Leap) converges on:

- Lead with a **triaged task queue**, not a wall of charts. KPIs live elsewhere.
- **"Today"** is the default scope; overdue → today → upcoming.
- Cap the above-the-fold to **~5 status-first blocks**; clear the morning sweep in <5 min.
- Encode urgency **redundantly** (color + label + icon — never color alone).
- **Every row is a launch point** into its record without losing context.
- Show **skeletons, empty states, freshness**; never a bare number without a baseline.
- **Construction-specific:** "proposal sent — awaiting signature" deserves a first-class
  surface; never let a record sit with no next step; field/mobile is the primary context.

Closest analogs: **Close Inbox** (what's slipping), **JobNimbus** (lifecycle board),
**Leap SalesPro** (in-home flow — reused via existing meeting-flow, not rebuilt here).

---

## 2. Scope & Decisions

| Decision | Choice |
| --- | --- |
| Structure | **One adaptive dashboard** at `/dashboard`, role-aware via CASL |
| Role focus | **Agent-first.** Super-admin = same layout, omni data. **Dispatcher parked** (own spec later) |
| Device | **Mobile-first, field-primary.** Phone layout canonical; desktop widens it |
| Composition | **Approach A** — single vertical scroll, in-module tabs |
| Component reuse | Compose existing compound cards via `EntityList` + `EntityActionMenu`. **No bespoke cards.** Do **not** reuse the bespoke `ActionCard` |
| Global actions | **Per-module actions only** in v1. No FAB, no Cmd+K |
| Personal stats | **Tiny motivational strip** — action-linked counts that jump to their module. No charts, no vanity totals |

**Overriding engineering constraint:** **reuse existing infra by expanding its API
surface — never add thin/ad-hoc implementations.** Every data need below is resolved
as "already supported by X" or "EXPAND X", never "new ad-hoc query". (Canonical rule:
`docs/codebase-conventions/` reuse conventions + memory `feedback-reuse-existing-api-surface`.)

**Parked for later (named so they're not silently dropped):** dispatcher dashboard,
FAB / Cmd+K command palette, personal KPI / analytics surface, live "now" meeting
detection, super-admin team roll-up / per-agent breakdown.

---

## 3. The Vertical Stack (top → bottom)

Single scrolling `DashboardView` (Approach A). Order is the agreed spine.

1. **Snapshot strip** — 3 action-linked counts: *meetings today · proposals awaiting
   signature · follow-ups due*. Each count is a jump-link that scrolls to its module.
   Counts only; no charts. Derived from the same queries the modules use (no separate
   count endpoint).

2. **Meetings hub** — segmented tabs **Today / Upcoming / Past** (default **Today**).
   Each tab is an `EntityList` of `MeetingOverviewCard` with `ParticipantsSlot` and an
   inline `EntityActionMenu` (start, log outcome, create proposal, navigate). Capped at
   top N with **"See all →"** to `/dashboard/meetings`.

3. **Action queue** — `getActionQueue` grouped by tier (Hot / Follow-up due / Stale /
   No-proposal). **Urgent triage only.** Each row: customer + suggested next action +
   one-tap primary verb + launch into the record. This is the user's "follow-up /
   what's pending". Capped top N with "See all →".

4. **Proposals awaiting signature** — the **calm, complete roster** of sent-unsigned
   proposals (not urgency-filtered; the urgent ones already surface in the queue).
   `EntityList` of `ProposalOverviewCard` (viewCount, days-since-sent). "See all →"
   to `/dashboard/proposals`.

5. **My open projects** — active projects with stage + next action, via the existing
   `ProjectEntityCard` composition. "See all →" to `/dashboard/projects`.

**Division of labor (queue vs proposals):** the **action queue = triage** (only
proposals needing action now — cold/stale/never-viewed); the **proposals module =
roster** (all awaiting-signature, calm). A proposal appears in the queue only when
urgent; it always appears in the roster.

---

## 4. Architecture

- `/dashboard/page.tsx` (server component, `force-dynamic`): `protectDashboardPage()`
  → `prefetch()` each module query when authenticated → `<HydrateClient>` →
  `DashboardView`.
- New view: `src/features/agent-dashboard/ui/views/dashboard-view.tsx` composing one
  component per module. Reuse existing `agent-dashboard` infra (`getActionQueue`,
  `action-tiers`, `follow-up-cadence`, `group-items-by-tier`).
- **Role adaptation is data-level, not structural.** The same components render for
  agent and super-admin; difference is `isOmni` (own rows vs all rows) resolved in the
  procedures via `scopeMiddleware`, plus owner avatars shown on cards in omni mode.
  CASL hides any module/action a role can't access — no role branches in the view.
- Each module component is small and independently understandable: it takes its query
  result + a "see all" href, renders `EntityList` + the entity's compound card, and
  owns its own empty/loading state. No module reaches into another's data.

---

## 5. Component Reuse Contract

Building blocks (all already exist):

- `EntityList` (`src/shared/components/entity-list/ui/entity-list.tsx`) — collection
  primitive: header/count/empty/loading chrome + `renderItem`. `variant="card"|"flush"`.
- `EntityActionMenu` (`src/shared/components/entity-actions/ui/entity-action-menu.tsx`)
  — CASL-filtered, `mode="compact"|"bar"`. Backed by each entity's
  `use<Entity>ActionConfigs` hook.
- `MeetingOverviewCard`, `ProposalOverviewCard`, `UserOverviewCard` — compound cards,
  parent-enriched (never self-fetch), slot-based.
- `ParticipantsSlot` — avatar stack / participant list for a meeting.
- Composition templates to follow: `CustomerKanbanCard`
  (`src/features/customer-pipelines/ui/components/customer-kanban-card.tsx`) and
  `ProjectEntityCard` (`src/shared/entities/customers/components/lists/project-entity-card.tsx`).

Rules:
- **Cards never self-fetch.** Parent flattens denormalized data onto the card's data
  prop (meeting/proposal `meta`-prop pattern).
- **No new bespoke card types.** Projects/customers lack the full compound pattern;
  use `ProjectEntityCard`'s proven composition. Any gap is documented and handed to the
  UI-shaping pass — it is **not** solved with an ad-hoc card here.
- Actions always come from the entity's `use<Entity>ActionConfigs` hook via
  `EntityActionMenu`; the dashboard adds no new action wiring.

---

## 6. Data Layer — Reuse Verdicts

Reuse the shared pagination toolkit for every module's "top N + see all":
`paginatedQueryInput` + `usePaginatedQuery` + the entity's `*_TABLE_QUERY_CONFIG`
(so the dashboard's small-`limit` query and the records page share one query
shape/key). Only `getActionQueue` is off-toolkit today.

| Dashboard need | Verdict | Action |
| --- | --- | --- |
| Meetings today/upcoming/past by owner | **Already supported** | `meetings.reads.list` / `listMeetings` via `filters.scheduledFor` dateRange + `sort` + `scopeMiddleware`. Pass window bounds per tab. |
| Meeting card with proposals + `sowSummary` flattened | **EXPAND** | `listMeetings` currently emits only `proposalCount`. Expand it to attach per-meeting proposals+`sowSummary` **using the existing builder in `getCustomerProfile`** (`get-customer-profile.ts`) — do not write a new flattener. |
| Proposals status=`sent` by owner | **Already supported** | `proposals.business.list` / `listProposals` via `filters.status=['sent']` + `sort.sentAt`; owner scoping automatic. |
| Proposals "awaiting signature" bucket | **EXPAND** | Add a contract-state filter key to `proposalListFiltersSchema` (contract sent & not signed/declined). |
| Action queue top-N + tier filter | **EXPAND** | `getActionQueue` takes no input today. Add an input schema (`limit`, optional tier filter) so it conforms to the toolkit; keep its existing omni + phone-gating behavior. |
| Projects active by owner | **EXPAND (real gap)** | `status='active'` already supported by `projects.crud.list`; **owner scoping does not exist.** Add an `ownerId` filter **and** wire a project visibility predicate + `scopeMiddleware` the same way meetings/proposals do (`projectVisibility` → predicate on `projects.ownerId`). This is the only non-trivial backend addition. |
| Owner-vs-omni scoping | **Already supported** | `scopeMiddleware` + entity `visibility` predicates for meetings/proposals; projects to be brought into the same pattern (row above). |
| Phone gating | **Already supported** | `canSeeUngatedPhone` / `gatedPhoneSql`, already composed by `listMeetings` and `getActionQueue`. |

**Net backend work:** three small expansions (`listMeetings` proposal enrichment via
existing builder; `proposalListFiltersSchema` contract-state filter; `getActionQueue`
input schema) + one real addition (project owner-scoping wired into the existing
`scopeMiddleware`/visibility pattern). **No new DB tables.**

---

## 7. States (research-mandated)

- **Loading:** skeleton per module (not spinners), matching the card shape.
- **Empty:** each module has an empty state with a next-step action
  (e.g. "No meetings today — book one", "No proposals awaiting signature").
- **Caps:** each module renders top N (per `pagination.limit`) + "See all →" to the
  records page; the dashboard never renders an unbounded list.
- **Freshness:** React Query cache; modules revalidate on focus. No manual "last
  updated" chrome in v1 (data is request-fresh via prefetch + hydration).

---

## 8. Role Behavior (v1)

- **Agent:** own meetings/proposals/projects; action queue scoped to own via
  `getActionQueue(userId, isOmni=false)`.
- **Super-admin:** identical layout; `isOmni=true` everywhere → all rows; owner avatars
  shown on cards (already available via `UserOverviewCard.Avatar` / `ownerName`
  enrichment). No dedicated team features in v1.
- **Dispatcher:** parked. Keeps current experience; CASL already hides proposals/
  projects. Their leads-pool-centric dashboard is a separate spec.

---

## 9. UI-Shaping Handoff

This spec deliberately contains **no visual design**. Before any dashboard UI code,
run the mandated methodology in order:

1. `ui-ux-pro-max` — layout/UX intelligence for the module composition and strip.
2. `web-design-guidelines` — compliance review of the intended UI.
3. `impeccable` — the actual UI shaping (visual hierarchy, typography, spacing, motion,
   card/strip look, empty/loading treatment).

The impeccable pass consumes this spec's **structure** (the stack, the modules, the
reuse contract, the states) and produces the **look**. Implementation follows only
after that.

---

## 10. Out of Scope / Future

Dispatcher dashboard · FAB / Cmd+K palette · personal KPI/analytics surface · live
"now" meeting detection · super-admin team roll-up & per-agent breakdown · offline
mode. Each is a candidate follow-up spec; none blocks v1.
