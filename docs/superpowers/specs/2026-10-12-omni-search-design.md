# Omni Search: design

Status: design approved in conversation 2026-10-12; spec awaiting owner review.

## Goal

One fast entry point (⌘K on desktop, a dock button on the phone) that finds customers and their related records, and reaches any page, deep link, or global action in the dashboard. Customers come first. Matching is ranked by similarity so it reads as intent, not substring.

## Decisions (owner, 2026-10-12)

| # | Decision |
|---|---|
| D1 | **Customer-anchored now, own fields later.** The term matches customers; meetings, proposals and projects appear because their customer matched. The procedure is shaped so an entity can add its own field matcher later without changing the contract. |
| D2 | **Similarity ranking.** Postgres `pg_trgm` for names and addresses; exact-signal tokens (phone digits, email, house numbers, zip) score above fuzzy hits. No embeddings, no external search engine. |
| D3 | **Features = destinations + deep links + global actions.** Record-scoped verbs on a found customer (call, start meeting) are out of v1, except "Schedule meeting…" via pick-then-act. |
| D4 | **Phone entry point replaces the dock's rightmost button** (Action Center) with Search. The Action Center stays in the sidebar footer (the phone menu sheet) and as a palette action. |
| D5 | **Meetings open in the customer profile modal** (`defaultTab: 'meetings'`, `highlightMeetingId`); proposals and projects open their pages. |

Rejected: external engines (Elasticsearch, Meilisearch, Typesense), which mean a sync pipeline and a second copy of the permission and phone-gating rules; Postgres full-text (`tsvector`), since stemming does nothing for names, phones or addresses; a client-side index of all customers, which ships every customer's fields to each session and grows with the data.

## Scale (dev branch, 2026-10-12)

771 customers · 294 meetings · 115 proposals · 66 projects. `pg_trgm` is available on Neon but not installed (only `plpgsql`).

## Architecture

```
⌘K / sidebar button / dock search button
  └─ OmniSearchDialog (src/features/omni-search/ui), mounted once in the dashboard layout
       ├─ registry entries → cmdk filter, local and instant      → Go to · Actions
       └─ debounced term (≥2 chars) → trpc.search.omni
            └─ searchService.omni: orchestrates, no SQL
                 ├─ customers DAL searchCustomersRanked(ctx, term) → ranked customers
                 └─ top 3 customer ids, in parallel:
                      meetings / proposals / projects DAL listForSearchByCustomerIds(ctx, ids)
            ← { customers, meetings, proposals, projects }, each row with a typed target
```

### Placement

| Piece | Location |
|---|---|
| Dialog, groups, rows, open-state store, registry assembly | `src/features/omni-search/` |
| Router | `src/trpc/routers/search.router.ts`, registered in `app.ts` |
| Service | `src/shared/services/search.service.ts`, one object literal (like `analytics.service.ts`); orchestrates entity DAL calls and holds no SQL |
| Customer ranked matcher | customers DAL, beside `customer-search-sql.ts` (moves with customers when it is promoted to a module) |
| Related-record readers | each entity's own DAL (meetings, proposals module, projects module) |
| Feature labels and aliases | beside each feature's own constants (e.g. calculator aliases in `src/features/calculators/constants/`); omni-search imports them |

### Searcher seam (D1)

Each entity contributes `relatedTo(ctx, customerIds)` now. A later `match(ctx, term)` adds own-field matching. The service merges both; the response shape does not change.

## Ranking (customers)

1. **Normalize:** trim, collapse whitespace, split into tokens.
2. **Classify each token:**
   - Text ("jonh", "elm"): `max(word_similarity(t, name), word_similarity(t, address · ' ' · city))`.
   - Numeric ("9140", "92801", "4471"): prefix or substring on the address, zip, and the **gated** phone digits. No trigram scoring for short numbers.
   - Email-shaped: email prefix.
3. **Match rule:** every token hits something. A whole-query phone-digit or email hit matches by itself and scores 1.0.
4. **Score:** mean of the token scores, plus a small boost for whole-word or prefix hits on the name. Ties break on `updatedAt` descending.
5. **`matchedOn`:** `name | phone | address | email`, whichever field produced the winning hit; the row renders it as a chip.
6. **Indexes:** GIN `gin_trgm_ops` on `customers.name` and on the `address · city` expression, declared in the Drizzle schema. The candidate filter uses the `<%` / `%>` operator form so the indexes apply. The similarity threshold is tuned against dev data during the build.

## Permissions

No new rules.

- Customers: `permit(ctx, 'read', customerServerSpec).sql`, the same scope as `listCustomers`.
- Phone matching and the phone chip use `gatedPhoneSql(canSeeUngatedPhone(ability))`. A caller can only match or see digits the row already renders.
- Meetings, proposals and projects: each filtered by its own `permit(ctx, 'read', meetingServerSpec | proposalServerSpec | projectServerSpec)`. A visible customer can have a hidden meeting; it is left out.
- The procedure uses the same base procedure as other dashboard reads.
- Registry entries are filtered client-side with `useAbility()`, mirroring `getSidebarNav`. Each action uses the same ability check as its existing entry point (e.g. `canAddMeeting` from `useProfileCommands`).

## Contract

`search.omni({ term })`, zod-validated, 2–80 characters after trim.

Returns:
- `customers`: up to 5 — id, name, city, pipeline (derived), `matchedOn`, the gated match excerpt, target `profile`.
- `meetings`, `proposals`, `projects`: for the top 3 customers, up to 5 each — label fields (customer name, date or outcome, status or amount, title or address) and a typed target.

Targets are typed, and the UI never builds URLs:
- `{ kind: 'profile', customerId, defaultTab?, highlightMeetingId? }`
- `{ kind: 'route', href }`, with the href built from `ROOTS`

A "See all in Customers →" row appears only if the customers records page already reads a search param. The plan verifies this; v1 does not add one.

## Dialog

### Empty query
- **Recent:** the last ~5 records opened from search (ids and labels in `localStorage`, read and written inside try/catch; losing the list costs nothing).
- **Go to:** the main destinations.

### With a query (cmdk groups, in order)

| Group | Row | Selecting |
|---|---|---|
| Customers | name · city · `matchedOn` chip · pipeline stage | `CustomerProfileModal`, `overview`, through the modal store (`accessor: 'CustomerProfile'`) |
| Meetings | customer · date · outcome | `CustomerProfileModal`, `defaultTab: 'meetings'`, `highlightMeetingId` |
| Proposals | customer · label · status · amount | `ROOTS.dashboard.proposals.byId(id)` |
| Projects | title · customer · address | `ROOTS.dashboard.projects.byId(id)` |
| Go to | label · parent page | `router.push` (never an internal `<a>`) |
| Actions | verb · shortcut hint | run, or enter pick-then-act |

- Record groups are hidden for single-character queries and when empty.
- If the best registry score beats the best customer score, Go to sits above the record groups.

### Registry

Entry: `{ id, label, aliases[], group, icon, href | run, visible(ability) }`. Route strings are never duplicated; entries derive from:

| Source | Entries |
|---|---|
| `getSidebarNav(ability)` | every page |
| `CALCULATOR_TABS` | Remodel ROI calculator, Scope pricing calculator (`?tab=`) |
| `getAccessiblePipelines(ability)` | each pipeline |
| `ANALYTICS_TABS` | each analytics tab |
| `SCHEDULE_SHOW_VALUES` | schedule meetings / activities |

### Actions (v1)

- **Global:** New proposal (`ROOTS.dashboard.proposals.new()`), New project (`ROOTS.dashboard.projects.new()`), Toggle theme, Open Action Center, Sign out.
- **Pick-then-act:** "Schedule meeting…" pushes a cmdk page ("Schedule meeting for…") that reuses the customer search; picking a customer mounts the existing `CreateMeetingModal`.

### States

- **Loading:** previous results stay (`placeholderData: keepPreviousData`) with a thin progress indicator. No empty flash.
- **No match:** "No records match '…'"; Go to and Actions still list.
- **Error:** inline "Search is unavailable, try again" row; registry results keep working.

## Entry points and shared overlay state

- A zustand store holds `searchOpen` and `actionCenterOpen`, in the same style as `src/shared/lib/create-modal-store.ts`.
- The ⌘K / Ctrl-K listener moves out of `SidebarSearchBar` into the dialog host; `SidebarSearchBar` keeps its button and only opens the store.
- **Phone dock:** `MobileDockCapsule`'s rightmost button becomes Search. Its icon and label are settled visually during the build, with screenshots.
- The Action Center reads `actionCenterOpen` from the store. This replaces the separate `useState` copies in `app-sidebar.tsx` and `dashboard-mobile-nav.tsx` and makes the palette action possible.
- `OmniSearchDialog` mounts once at dashboard-layout level, beside `GlobalDialogs`.

## Performance

- Client: 150 ms debounce, `staleTime` 30 s, `keepPreviousData`.
- Server: one round trip; related readers run in parallel. Target p95 under 150 ms.

## Testing

No test runner in the repo; follow the service-wiring recipe (throwaway `tsx` script, `import './lib/load-env'` first, `DRIZZLE_TARGET=dev NODE_OPTIONS=--conditions=react-server`, read-only, deleted when done). Write it first and watch it fail.

Cases:
1. Name typo ("jonh smith") finds the customer.
2. Phone fragment finds the customer, ranked first.
3. House number + street.
4. Multi-word: name + street.
5. Zip.
6. An agent actor that participates in nothing (`buildUserContext('nobody', 'agent', …)`) gets no results.
7. A gated phone can't be matched by digits the row doesn't render.

UI: Playwright screenshots of desktop ⌘K, the phone dock button, and the empty / results / pick-then-act / no-match / error states, in light and dark.

Gates: `pnpm lint && pnpm tsc`.

## Rollout

1. Owner: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` on the dev branch.
2. `pnpm db:push:dev` adds the trigram indexes.
3. Build and verify.
4. At ship: owner runs the extension on prod, then the explicit `db:push:prod`.

## Later (not v1)

- Own-field matchers (project title or address, proposal label) through the searcher seam.
- Record-scoped actions on a found customer (call, start meeting, add note) through the entity action configs.
- `unaccent` for accent-insensitive names, if misses show up.
