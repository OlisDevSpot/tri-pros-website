# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev          # Start dev server (binds to 0.0.0.0:3000)
pnpm build        # Build for production
pnpm lint         # ESLint
pnpm generate:types  # Regenerate Payload CMS TypeScript types (src/payload-types.ts)

# Database (PostgreSQL via Drizzle)
pnpm db:push      # Push schema changes to Postgres
pnpm db:reset     # Reset Postgres database
pnpm db:seed      # Seed Postgres database
```

Package manager: **pnpm**. Path alias: `@/` → `src/`.

## Architecture

### Dual-Database Setup

Two separate databases serve different purposes:

1. **PostgreSQL (Neon)** — Application data, managed with **Drizzle ORM**. Schema at `src/shared/db/schema/`. Client at `src/shared/db/index.ts`. Stores proposals, projects, trades, scopes, materials, customers, auth sessions, etc.

2. **MongoDB** — Blog/CMS content, managed by **Payload CMS**. Config at `src/payload.config.ts`. Collections: Users, Media, Blogposts.

### Route Groups

The Next.js App Router uses two route groups:

- `src/app/(frontend)/` — Public-facing site
  - `(site)/` — Marketing pages (landing, about, services, portfolio, blog, contact)
  - `proposal-flow/` — Authenticated customer proposal flow
- `src/app/(payload)/` — Payload CMS admin UI (`/admin`)
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
    services/        # External service clients (ai, docusign, hubspot, monday, notion, pipedrive, r2, resend, upstash)
    types/           # Shared TypeScript types
  payload/           # Payload CMS collections and fields
  trpc/              # tRPC setup and routers
    init.ts          # Procedure types: baseProcedure, agentProcedure (auth-required), payloadProcedure
    server.ts        # Server-side tRPC client (server-only)
    routers/         # app, ai, construction, docusign, hubspot, landing, notion, proposal
```

### tRPC

tRPC is the primary API layer, used with TanStack React Query. Three procedure types defined in `src/trpc/init.ts`:

- `baseProcedure` — public, no auth required
- `agentProcedure` — throws UNAUTHORIZED if no session
- `payloadProcedure` — injects Payload CMS instance into context

The server-side proxy (`src/trpc/server.ts`) is marked `server-only` and uses React `cache()` for request deduplication.

### Authentication

**better-auth** with Drizzle adapter (Postgres). Google OAuth and HubSpot OAuth are configured. Users signing up with a `@triprosremodeling.com` email are auto-assigned the `agent` role.

User roles: `user`, `homeowner`, `agent`, `super-admin`.

### Environment Variables

Validated at startup with Zod — the app will exit with a clear error if required vars are missing.

- `src/shared/config/server-env.ts` — All server-side env vars (DATABASE_URL, PAYLOAD_SECRET, BETTER_AUTH_SECRET, third-party API keys, etc.)
- `src/shared/config/client-env.ts` — Only `NEXT_PUBLIC_*` vars

Env file: `.env` at project root. See `server-env.ts` for the full list of required variables (Resend, Monday, Pipedrive, HubSpot, DocuSign, Notion, Cloudflare R2, Upstash QStash).

### Key Integrations

- **DocuSign** — E-signature for proposals
- **HubSpot / Pipedrive / Monday.com** — CRM integrations
- **Cloudflare R2** — File storage (S3-compatible)
- **Upstash QStash** — Background job queue (handlers at `/api/qstash-jobs`)
- **Resend + React Email** — Transactional email
- **Notion** — Blog content source
- **Google Maps** — via `@vis.gl/react-google-maps`
- **AI (Vercel AI SDK + OpenAI)** — Project summary generation

### UI

Tailwind v4, shadcn/ui (Radix primitives), lucide-react icons, motion for animations. Component config at `components.json`.
