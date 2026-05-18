# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (port from PORT env, defaults to 3000)
pnpm dev:mobile   # Start dev + ngrok tunnel + QR code (one command)
pnpm tunnel       # Run only the ngrok tunnel (uses ${PORT:-3000})
pnpm build        # Build for production
pnpm lint         # ESLint
# Database (PostgreSQL via Drizzle)
pnpm db:push      # Push schema changes to Postgres (PROD — prefer db:push:dev for dev work)
pnpm db:reset     # Reset Postgres database
pnpm db:seed      # Seed Postgres database
# Push notifications
pnpm push:test --to <email> --title "..." [--body "..."] [--navigate /path]
                  # Fire a push at any user via web-push (verifies VAPID + delivery + deep-link)
```

Package manager: **pnpm**. Path alias: `@/` → `src/`.

## Mobile testing

`pnpm dev:mobile` runs `next dev` + `ngrok` + a QR-code printer concurrently. Scan the QR with your phone camera to load the app over the static ngrok tunnel (`https://destined-emu-bold.ngrok-free.app`). Auth, cookies, and OAuth all work over the tunnel — better-auth derives the per-request base URL from `APP_HOSTS` in `src/shared/config/roots.ts` and uses the matching Google OAuth callback automatically.

**Per-worktree port (parallel dev):** Each worktree picks its own port via `.env.local` (git-ignored, loaded by Next.js after `.env`):

```
# .env.local in worktree foo
PORT=3001
```

Both `pnpm dev` and `pnpm tunnel` honor `PORT`. Multiple worktrees can run dev simultaneously on different ports.

**One tunnel at a time:** The free ngrok plan allows one active tunnel. Whichever worktree runs `pnpm dev:mobile` first holds it; others get a clear ngrok error. Kill the holder, run again in the new worktree.

**Third-party webhooks (Google Calendar push, QStash callbacks, etc.):** These resolve their public URL via `env.NGROK_URL ?? env.NEXT_PUBLIC_BASE_URL`. Whichever worktree holds the tunnel receives the webhooks — even if a different worktree created the subscription. If you're testing webhook flows, hold the tunnel in the worktree you want to receive callbacks.

**Adding a new host (worktree port, subdomain, etc.):**
1. Add it to `APP_HOSTS` in `src/shared/config/roots.ts` (the single source of truth).
2. If it needs Google sign-in, register `<host>/api/auth/callback/google` in the Google Cloud OAuth Client.

**DevTools mobile viewport:** Chrome — open DevTools, then `Cmd-Shift-M` (macOS) / `Ctrl-Shift-M` (Win/Linux). Safari — Develop menu → Enter Responsive Design Mode.

**When ngrok isn't enough:** Vercel Preview Deploys give a real HTTPS URL on every PR — use those for testing flows that need real domains (e.g., third-party webhook signatures bound to a public URL).

## Architecture

### Database

**PostgreSQL (Neon)** — Application data, managed with **Drizzle ORM**. Schema at `src/shared/db/schema/`. Client at `src/shared/db/index.ts`. Stores proposals, projects, trades, scopes, materials, customers, auth sessions, etc.

### Route Groups

The Next.js App Router uses two route groups:

- `src/app/(frontend)/` — Public-facing site
  - `(site)/` — Marketing pages (landing, about, services, portfolio, blog, contact)
  - `proposal-flow/` — Authenticated customer proposal flow
- `src/app/api/` — API routes: tRPC, auth (better-auth), integrations, qstash-jobs

### Source Organization

```
src/
  features/          # Feature modules (proposal-flow, landing)
    proposal-flow/   # constants, contexts, hooks, lib, schemas, types, ui/
  shared/
    config/          # Env validation — client-env.ts (public vars), server-env.ts (all vars)
    constants/       # App-wide enums (userRoles, tradeLocations, homeAreas, etc.)
    components/      # Shared React components
    dal/             # Data Access Layer, split into client/ and server/
    db/              # Drizzle client, schema, migrations, seeds
    domains/         # Cross-cutting domain modules with their own internal structure: auth/ (better-auth client + server), construction/, permissions/ (CASL abilities), pipelines/
    entities/        # Business logic per entity — each has lib/, hooks/, components/, dal/server/ (DalReturn queries+mutations), dal/client/ (tRPC hooks)
    hooks/           # Shared React hooks
    lib/             # Utilities (formatters, loan-calculations, etc.)
    services/        # External service clients (ai, docusign, notion, r2, resend, upstash). monday/ and pipedrive/ are LEGACY — do not use.
    types/           # Shared TypeScript types
  trpc/              # tRPC setup and routers (typesafe glue — calls DAL, never db)
    init.ts          # Procedure types: baseProcedure, agentProcedure (auth-required)
    server.ts        # Server-side tRPC client (server-only)
    lib/             # Entity factories, middleware (scope, shareable), dal-to-trpc bridge
    routers/         # app, ai, construction, docusign, landing, notion, proposal
```

### tRPC + Entity Server System

tRPC is the **client-to-server typesafe glue layer**, not the place for business logic. Two base procedure types in `src/trpc/init.ts`:

- `baseProcedure` — public, no auth required
- `agentProcedure` — throws UNAUTHORIZED if no session

**Entity routers** use `createEntityRouter(spec, factory)` which provides pre-configured procedures with scope middleware:

```ts
export const proposalsRouter = createEntityRouter(proposalServerSpec, (entity) =>
  createTRPCRouter({
    crud: createTRPCRouter({ /* inlined CRUD using entity.authedProcedure / entity.shareableProcedure */ }),
    business: createTRPCRouter({ /* entity-specific queries */ }),
    delivery: deliveryRouter,  // service-layer sub-router (deferred)
  })
)
```

The entity toolkit: `entity.authedProcedure` (agent + scope), `entity.shareableProcedure` (token-or-session + scope), `entity.publicProcedure` (no auth), `entity.crud()` (generic CRUD sub-router), `entity.spec`.

**tRPC procedures call DAL and unwrap with `dalToTrpc()`** — see DAL section below.

The server-side proxy (`src/trpc/server.ts`) is marked `server-only` and uses React `cache()` for request deduplication.

### Backend Layers: tRPC → Services → DAL → DB

Three layers, strict dependency direction. Every request — browser or server-initiated — flows through the same core functions.

| Layer | Role | Imports `db`? | Examples |
|-------|------|:---:|---------|
| **tRPC** | Client-to-server typesafe glue | No | Entity routers, middleware |
| **Services** | External system orchestration | No | contracts.service, email.service, pdf.service, Upstash jobs |
| **DAL** | Database boundary (ONLY layer touching DB) | **Yes** | `entities/*/dal/server/`, `shared/dal/server/lib/` |

**Client-initiated flow** (browser → user action):
```
Browser → tRPC hook → tRPC procedure (middleware resolves auth/scope)
  → procedure body calls DAL or Service
  → dalToTrpc() maps DalReturn errors to HTTP responses
```

**Server-initiated flow** (jobs, webhooks, cron, RSC):
```
Trigger → Service or job handler
  → constructs context: SYSTEM_CONTEXT (full access) or buildUserContext(userId, role, spec)
  → calls DAL directly → inspects DalReturn { success, data/error }
```

DAL pattern adapted from [WebDevSimplified/next-js-data-access-layer](https://github.com/WebDevSimplified/next-js-data-access-layer). Every DAL function returns `DalReturn<T>` (never throws, never redirects). Full conventions in `memory/coding-conventions.md` Rules 15 + 19.

**Entity DAL** at `entities/<entity>/dal/server/` (queries.ts + mutations.ts). Generic CRUD via `createCrudDal(spec)`. Key files: `shared/dal/server/lib/types.ts`, `shared/dal/server/lib/helpers.ts`, `trpc/lib/dal-to-trpc.ts`. See ADR-0002.

### Query toolkit (pagination + sort + search + filters + page-size)

The query toolkit is **the** way we hit any paginated tRPC procedure — never hand-roll page state, debounced search, sort wiring, filter URL state, or `placeholderData`. Four layers, each replaceable.

**Server primitives** (`src/shared/dal/server/query/`):
- `paginatedQueryInput(filtersShape)` — Zod composer for procedure inputs. Returns `{ pagination: { limit, offset }, sort?: { sortBy, sortDir }, search?, filters?: { ...consumerShape } }`. Procedures `.extend({ id })` to add business inputs at the top level.
- `paginate({ query, count })` — runs the page query + count in parallel, returns `PaginatedResult<T> = { rows, total }`.
- `buildSearchWhere(input.search, [columns])` — `ilike` OR fragment, returns undefined for empty.
- `buildOrderBy(input.sort, columnMap, fallback)` — whitelisted sort, never throws on bad keys.
- `buildFilterWhere(input.filters, predicateMap)` — composes per-key Drizzle predicates.

**Client hook** (`src/shared/dal/client/query/`):
- `usePaginatedQuery(factory, extra, options)` — bundles page + page-size + debounced search + sort + filters into one URL-persisted state machine. Auto-applies `placeholderData: keepPreviousData`. Prefetches next page. Clamps to `pageCount` when total shrinks. Stable-keys `extra` so reference instability doesn't trigger refetches.
- Options: `paramPrefix`, `pageSize`, `pageSizeOptions`, `searchDebounceMs`, `enabled`, `prefetchNextPage`, `defaultSort`, `filters: FilterDefinition[]`.
- Filter types (compile-time registry in `filter-parser-registry.ts`): `select | multi-select | date-range | boolean`.
- Reserved URL key suffixes: `p`, `q`, `sort`, `dir`, `ps`. Filter ids must avoid these.

**UI primitive** (`src/shared/components/query-toolbar/`):
- `<QueryToolbar pagination={p}>` compound component — context-driven. Slots: `Search`, `Filters`, `Filter` (single by id, with optional render-prop), `ActiveFilterChips`, `PageSize`, `ClearAll`, `Sort` (dropdown variant). Container-agnostic — same toolbar above DataTable, Kanban, or Card grid.

**Container adapters** (`src/shared/components/data-table/lib/`):
- `toDataTablePagination(p)` — converts to `DataTableServerPagination`.
- `toDataTableSorting(p, { fallbackVisual })` — converts to `DataTableServerSorting`. DataTable runs in `manualSorting + manualPagination + manualFiltering` mode when these are set; column-header clicks route to `setSort` automatically.
- New containers (kanban, calendar) get their own adapter — never bypass `usePaginatedQuery`.

**Reference impls:** `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx` and `all-customers-section.tsx`. Both wire the full stack: server filters (pipeline multi-select + createdAt date-range), sortable column headers, page-size selector, URL-persisted state with `?src_*` / `?all_*` prefixes.

**Legacy filter scaffolding** (in active use by un-migrated tables, marked `@deprecated`):
- `DataTableFilterConfig` / `DataTableFilterBar` / `useTableUrlFilters` / `DataTableTimePresetFilter` — for client-side filtering on the Activities table. Records pages (Meetings, Proposals, Projects) and Customer Pipelines have been migrated to the toolkit. Each remaining migration is a follow-up issue.

### TanStack Query — `placeholderData: keepPreviousData`

For any `useQuery` whose `queryKey` changes in response to user-controlled input (pagination, filter chip, search box, tab selector, date-range picker), pass `placeholderData: keepPreviousData`. Prior data stays visible (with `isPlaceholderData === true`) until the new fetch resolves; without it, the UI unmounts to a skeleton on every key change.

```ts
import { keepPreviousData, useQuery } from '@tanstack/react-query'

useQuery({ ...trpc.x.y.queryOptions(input), placeholderData: keepPreviousData })
```

`usePaginatedQuery` already applies this. For ad-hoc queries with dynamic keys (modals, drawers with tab state, etc.), opt in explicitly. Do **not** apply when stale data would be misleading (e.g. switching to a different entity in a detail panel — show a skeleton instead).

### Authentication

**better-auth** with Drizzle adapter (Postgres). Google OAuth is configured. Users signing up with a `@triprosremodeling.com` email are auto-assigned the `agent` role.

User roles: `user`, `homeowner`, `agent`, `super-admin`.

### Environment Variables

Validated at startup with Zod — the app will exit with a clear error if required vars are missing.

- `src/shared/config/server-env.ts` — All server-side env vars (DATABASE_URL, BETTER_AUTH_SECRET, third-party API keys, etc.)
- `src/shared/config/client-env.ts` — Only `NEXT_PUBLIC_*` vars
- `src/shared/config/public-url.ts` — `getPublicBaseUrl()` server-only helper returning `env.NGROK_URL ?? env.NEXT_PUBLIC_BASE_URL`. Use this for ANY external-facing absolute URL (push notification `navigate`, webhook callbacks, qstash callback URLs, GCal watch URL). Never hand-roll the `?? NEXT_PUBLIC_BASE_URL` fallback.

Env file: `.env` at project root. See `server-env.ts` for the full list of required variables (Resend, DocuSign, Notion, Cloudflare R2, Upstash QStash, Web Push VAPID).

**Web Push VAPID** — `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` are all optional in env validation; push features no-op gracefully when missing. Generate ONCE with `node scripts/generate-vapid-keys.mjs` and **never rotate** — every existing subscription is bound to the public key. Same keys in dev + prod (the `NEXT_PUBLIC_*` one is inlined into the client bundle at build time, so it must be set before any prod build).

### Key Integrations

- **DocuSign** — E-signature for proposals
- **Cloudflare R2** — File storage (S3-compatible)
- **Upstash QStash** — Background job queue (handlers at `/api/qstash-jobs`)
- **Resend + React Email** — Transactional email
- **Notion** — Trades/scopes/SOW data source + temporary CRM (contacts). Contacts will migrate to in-house CRM.
- ~~**Monday.com**~~ — LEGACY, do not use
- ~~**Pipedrive**~~ — LEGACY, do not use
- **Google Maps** — via `@vis.gl/react-google-maps`
- **AI (Vercel AI SDK + OpenAI)** — Project summary generation
- **Web Push (Declarative Web Push)** — iOS PWA + desktop browser push notifications. `web-push` library; payload format `{web_push: 8030, notification: {title, body, navigate, ...}}`. Service worker at `public/sw.js`; manifest scope MUST stay `/` for deep links to route into the standalone PWA. Add new notification types in `src/shared/services/notification.service.ts` calling `sendPushToUser(userId, {title, body, navigate})`. See memory `pattern-push-notifications.md`.

### UI

Tailwind v4, shadcn/ui (Radix primitives), lucide-react icons, motion for animations. Component config at `components.json`.

## GitHub Workflow

**Project Board:** https://github.com/users/OlisDevSpot/projects/3
**Issues:** https://github.com/OlisDevSpot/tri-pros-website/issues

### Branch Convention
`{type}/{issue-number}-{short-description}`
Types: `feat`, `fix`, `refactor`, `chore`

### PR Process
1. Create branch from `main`
2. Work + commit (conventional commits: `feat(scope):`, `fix(scope):`, etc.)
3. Self-review: run `pnpm lint` + `pnpm build`, review diff
4. Open PR with template (Summary, Changes, Self-Review, Test Plan)
5. Link issue with `Closes #N`
6. Wait for CI + human review

### Labels
- **Area:** `area:frontend`, `area:backend`, `area:infrastructure`, `area:sales-flow`, `area:integrations`, `area:showroom`
- **Priority:** `P0` (urgent), `P1` (important), `P2` (nice-to-have), `P3` (backlog)
- **Type:** `type:feature`, `type:bug`, `type:refactor`, `type:chore`
- **Agent:** `claude` — tags issues as agent-eligible (not a status — status lives on the project board)

### Project Board Status (source of truth)
The GitHub Projects board Status field is the **single source of truth** for issue progress:
`Backlog` → `Ready` → `In Progress` → `In Review` → `Done`

**Do NOT use labels for status.** Always update the board directly via `gh project item-edit`.

#### Board IDs (for `gh project item-edit`)
```
Project ID:       PVT_kwHOCqZfGM4BSgDZ
Status field ID:  PVTSSF_lAHOCqZfGM4BSgDZzhAA_t4
Options:
  Backlog:        0046b823
  Ready:          9a551858
  In Progress:    8a3f5937
  In Review:      e461e967
  Done:           254997a9
```

#### How to move an issue on the board
```bash
# 1. Find the item ID for the issue
gh project item-list 3 --owner OlisDevSpot --format json | python3 -c "
import json,sys; items=json.load(sys.stdin)['items']
for i in items: print(f'#{i[\"content\"][\"number\"]} {i[\"title\"]}: item_id={i[\"id\"]} status={i[\"status\"]}')"

# 2. Move it (replace ITEM_ID and OPTION_ID)
gh project item-edit --project-id PVT_kwHOCqZfGM4BSgDZ \
  --id ITEM_ID \
  --field-id PVTSSF_lAHOCqZfGM4BSgDZzhAA_t4 \
  --single-select-option-id OPTION_ID
```

#### Built-in automations (already enabled)
- **Item closed** → moves to `Done` (triggered by `Closes #N` in merged PR)
- **Pull request merged** → moves to `Done`
- **Item reopened** → moves back

### Agent Workflow
1. Check board for issues in `Ready` status with `claude` label
2. Move issue to `In Progress` on the board via `gh project item-edit`
3. Create branch → work → self-review (lint + build + diff review)
4. Open PR with `Closes #N` → move issue to `In Review` on the board
5. When blocked: move issue to `Backlog`, add a comment explaining what's needed
6. On merge: GitHub automatically moves to `Done`
7. When discovering new work: create a new issue, add to project board in `Backlog`

### Parallel Issue Work — `pnpm dispatch`

**Canonical mechanism for working multiple GitHub issues in parallel.** Slot-tracked (max 3), port-assigned (3001-3003), board-aware (auto-moves status). Worktrees are real `git worktree`s in `.worktrees/issue-<#>/` (gitignored) — not directory copies. `.env` is symlinked, `node_modules/` is pnpm-hardlinked into the shared store, so 3 slots ≈ 1× project disk.

- `pnpm dispatch start <#>` — create worktree + branch + deps + auto-generated `CLAUDE.local.md`, move issue to In Progress
  - `--tmux` flag: also opens the slot in a tmux window with claude + dev panes
- `pnpm dispatch run <#>` — launch Claude in the slot
- `pnpm dispatch dev <#>` — start Next.js on the slot's assigned port
- `pnpm dispatch tmux <#>` — open or focus the slot's tmux window (claude 70% / dev 30% layout)
- `pnpm dispatch all <#> <#> ...` — start multiple slots and open them all in tmux, then attach
- `pnpm dispatch review <#>` / `pr <#>` / `park <#>` / `cleanup <#>` — full lifecycle (park/cleanup auto-close the tmux window)
- `pnpm dispatch loop` — AFK execution engine that picks Ready+`claude`-labeled issues by P0→P3
- `pnpm dispatch help` — full command surface

**Tmux conventions**: session = repo basename (`tri-pros-website`); window = `WT-<branch-without-type-prefix>` capped at 30 chars (e.g. `WT-23-build-pipeline-page` for issue 23 on branch `feat/23-build-pipeline-page`); layout = `npx claude` (left ~70%) | `PORT=<port> pnpm dev` (right ~30%). The `WT-` prefix distinguishes dispatched slot windows from `main` or ad-hoc shells. `prefix 1`–`9` jumps to windows by index. With `tmux-resurrect` + `tmux-continuum` configured (see `~/.tmux.conf`), session layouts survive WSL/OS restarts; relaunch claude with `claude --continue` after restart to reattach to the prior conversation.

This script is kept in sync with `olis-v3/nextjs/otautomations/scripts/dispatch.sh`. Only the CONFIG block at the top differs — propagate any logic change to both files.

See `memory/reference-dispatch-system.md` for the complete reference. Do **not** invent a parallel-work flow — always go through dispatch.

## WHO WE ARE

### COMPANY

We are Tri Pros Remodeling, a Southern-California based residential construction & remodeling company.
We are currently a small team of highly specialized tech, business, and construction professionals.
Our expertise in sales shines through our understanding of human psychology and customer needs.

### INDUSTRY

### REVENUE MODEL

We generate in-home meetings through telemarketing & social media services. 

### SALES CYCLE

1. Set up in-home appointment
2. Schedule in-home meeting with customer
3. 