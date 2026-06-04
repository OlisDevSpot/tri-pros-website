# Environment, Auth & Public URLs

Environment variables are validated at startup with Zod — the app exits with a clear error if required vars are missing. Auth is **better-auth** with the Drizzle Postgres adapter. Public-facing URLs go through one helper so dev (ngrok) and prod (vercel) Just Work.

## Rules

### env-validated-at-startup

All env vars are declared with Zod in two files:

- `src/shared/config/server-env.ts` — server-side vars (DATABASE_URL, BETTER_AUTH_SECRET, third-party API keys, VAPID keys)
- `src/shared/config/client-env.ts` — only `NEXT_PUBLIC_*` vars

Import the validated `env` object from these files — never `process.env.X` directly in app code.

When a provider's env vars must be `.optional()` (feature ships before it's configured everywhere — see the voip precedent in `commit da028029`), the provider colocates a `lib/config.ts` that exports a Zod fragment + runtime-config builder; `server-env` spreads the fragment into its central schema and re-exports a cached `getXConfig()` accessor. Consumers import the accessor from `server-env`, never from the provider's `lib/config.ts` directly. Full pattern at [service-architecture.md#provider-env-config-when-optional](service-architecture.md).

**Why**: typos in env var names fail loudly at startup, not silently at runtime; provider-optional env vars get a single seam where `string | undefined` narrows to `string` instead of leaking the optionality to every call site.
**Reference impl**: `src/shared/config/server-env.ts` + `src/shared/services/providers/twilio/lib/config.ts`
**Enforced by**: Zod (startup throws on missing required var) + convention (provider-optional pattern)

### use-getpublicbaseurl-for-external-urls

Any external-facing absolute URL (push notification `navigate`, webhook callbacks, qstash callback URLs, GCal watch URL, email links) uses `getPublicBaseUrl()` from `src/shared/config/public-url.ts`. Never hand-roll `env.NGROK_URL ?? env.NEXT_PUBLIC_BASE_URL`.

```ts
import { getPublicBaseUrl } from '@/shared/config/public-url'
const url = `${getPublicBaseUrl()}/dashboard/meetings/${id}`
```

**Why**: ngrok holding rules differ per worktree; centralizing the fallback prevents one site from baking in the wrong base.
**Reference impl**: `src/shared/config/public-url.ts`
**Enforced by**: convention

### apphosts-is-source-of-truth-for-hosts

The list of valid app hosts (prod, dev, ngrok tunnel, per-worktree ports) lives in `APP_HOSTS` in `src/shared/config/roots.ts`. Adding a new host means editing this list. better-auth derives the per-request base URL from `APP_HOSTS` and uses the matching Google OAuth callback automatically.

If a new host needs Google sign-in: also register `<host>/api/auth/callback/google` in the Google Cloud OAuth Client.

**Why**: one source of truth. Auth, OAuth, ngrok tunnel, vercel preview — everything reads from here.
**Reference impl**: `src/shared/config/roots.ts:APP_HOSTS`
**Enforced by**: convention

### vapid-keys-never-rotate

`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` are optional in env validation (push features no-op when missing). **Generate ONCE** with `node scripts/generate-vapid-keys.mjs` and never rotate — every existing push subscription is bound to the public key.

Same keys in dev + prod. The `NEXT_PUBLIC_*` one is inlined into the client bundle at build time, so it must be set before any prod build.

**Why**: rotating invalidates every existing user's push subscription. Silent and irreversible at user level.
**Reference impl**: `src/shared/config/server-env.ts` (validation); `scripts/generate-vapid-keys.mjs`
**Enforced by**: convention (no machine guard)

## Authentication

### better-auth-with-drizzle

Auth is better-auth backed by the Drizzle Postgres adapter. Google OAuth is configured. Users signing up with a `@triprosremodeling.com` email are auto-assigned the `agent` role.

User roles: `user`, `homeowner`, `agent`, `super-admin`.

**Reference impl**: `src/shared/domains/auth/`
**Enforced by**: better-auth + database constraint

### casl-for-row-level-and-action-permissions

CASL abilities live in `src/shared/domains/permissions/abilities.ts`. Every entity declares its `caslSubject` in the entity's server-spec. Per-role rules in `defineAbilitiesFor`. tRPC middleware (`scopeMiddleware`) resolves `ctx.ability` and `ctx.scope` per request.

**Why**: separates "can this user perform action X" (CASL) from "which rows can they see" (visibility predicate SQL).
**Reference impl**: `src/shared/domains/permissions/abilities.ts`; ADR-0002
**Enforced by**: middleware

## Key integrations

- **DocuSign** — legacy contract signing (zoho-sign is the active path)
- **Zoho Sign** — e-signature; see `src/shared/services/providers/zoho-sign/` + `zoho-sync.service.ts`
- **Cloudflare R2** — S3-compatible file storage; provider at `services/providers/r2/`
- **Upstash QStash** — background job queue; handlers at `/api/qstash-jobs`; jobs in `services/providers/upstash/jobs/`
- **Resend + React Email** — transactional email; provider at `services/providers/resend/`
- **Notion** — trades/scopes/SOW data source + temporary CRM (contacts). Contacts will migrate to in-house CRM (see `docs/plans/notion-crm-migration-design.md`)
- **Google Maps** — `@vis.gl/react-google-maps`
- **AI (Vercel AI SDK + OpenAI)** — project summary generation, currently via `services/providers/ai/`
- **Web Push (Declarative Web Push)** — iOS PWA + desktop push; manifest scope MUST stay `/` for deep links

**Legacy, do not use**: Monday.com, Pipedrive (provider files preserved for migration scripts only).

## See also

- `docs/codebase-conventions/service-architecture.md` — where integrations live
- ADR-0003 — service & provider architecture
- `memory/pattern-push-notifications.md` — how to add a new push type
