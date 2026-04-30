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
pnpm db:push      # Push schema changes to Postgres
pnpm db:reset     # Reset Postgres database
pnpm db:seed      # Seed Postgres database
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
    auth/            # better-auth setup — client.ts and server.ts
    config/          # Env validation — client-env.ts (public vars), server-env.ts (all vars)
    constants/       # App-wide enums (userRoles, tradeLocations, homeAreas, etc.)
    components/      # Shared React components
    dal/             # Data Access Layer, split into client/ and server/
    db/              # Drizzle client, schema, migrations, seeds
    entities/        # Business logic
    hooks/           # Shared React hooks
    lib/             # Utilities (formatters, loan-calculations, etc.)
    permissions/     # Role-based access control helpers
    services/        # External service clients (ai, docusign, notion, r2, resend, upstash) + domain services. monday/ and pipedrive/ are LEGACY — do not use.
    types/           # Shared TypeScript types
  trpc/              # tRPC setup and routers
    init.ts          # Procedure types: baseProcedure, agentProcedure (auth-required)
    server.ts        # Server-side tRPC client (server-only)
    routers/         # app, ai, construction, docusign, landing, notion, proposal
```

### tRPC

tRPC is the primary API layer, used with TanStack React Query. Two procedure types defined in `src/trpc/init.ts`:

- `baseProcedure` — public, no auth required
- `agentProcedure` — throws UNAUTHORIZED if no session

The server-side proxy (`src/trpc/server.ts`) is marked `server-only` and uses React `cache()` for request deduplication.

### Authentication

**better-auth** with Drizzle adapter (Postgres). Google OAuth is configured. Users signing up with a `@triprosremodeling.com` email are auto-assigned the `agent` role.

User roles: `user`, `homeowner`, `agent`, `super-admin`.

### Environment Variables

Validated at startup with Zod — the app will exit with a clear error if required vars are missing.

- `src/shared/config/server-env.ts` — All server-side env vars (DATABASE_URL, BETTER_AUTH_SECRET, third-party API keys, etc.)
- `src/shared/config/client-env.ts` — Only `NEXT_PUBLIC_*` vars

Env file: `.env` at project root. See `server-env.ts` for the full list of required variables (Resend, DocuSign, Notion, Cloudflare R2, Upstash QStash).

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