# Mobile Dev Testing DX — Stable Tunnel Workflow

**Issue:** [#98](https://github.com/OlisDevSpot/tri-pros-website/issues/98)
**Date:** 2026-04-29
**Status:** Design approved, pending implementation plan

## Problem

Mobile dev testing today is brittle. The static ngrok tunnel exists (`pnpm tunnel` → `https://destined-emu-bold.ngrok-free.app`), but:

1. **Auth is broken through the tunnel.** Better-auth hardcodes `baseURL` and the Google OAuth `redirectURI` to `NEXT_PUBLIC_BASE_URL` (`http://localhost:3000` in dev). When the phone hits the tunnel and clicks "Sign in with Google", Google bounces the user back to localhost — unreachable from the phone, and any cookie lands on the wrong domain.
2. **`NGROK_URL` is not in `trustedOrigins`,** so even if the redirect were correct, CSRF/origin checks would still reject the tunnel.
3. **No one-command workflow** to start dev + tunnel with a discoverable URL on the phone.
4. **No documentation** — the `tunnel` script is undocumented.

## Goals

- Auth works from both localhost (any dev port) and the tunnel **simultaneously**, with no env flipping or restart.
- One command starts dev + tunnel + prints a QR code that points to the tunnel URL.
- Multiple git worktrees can each run their own `pnpm dev` on a distinct port (3000–3002), and any of them can grab the tunnel on demand.
- Workflow is documented in `CLAUDE.md` so it's discoverable by future agents and devs.
- No regressions to production auth or local-only dev (devs who don't use mobile testing should be unaffected).

## Non-goals

- Replacing ngrok with a different tunnel provider.
- Multiple simultaneous tunnels (free ngrok plan allows only one; upgrading is out of scope).
- Per-PR Vercel preview tooling beyond a documentation pointer.
- Automatic ngrok session recovery (listed as a "nice-to-have" in the issue; defer).

## Constraints

- **Free ngrok plan**, single static domain (`destined-emu-bold.ngrok-free.app`), one active tunnel at a time. Switching the tunnel between worktrees is a manual "kill the old one, start the new one" operation.
- **`.env` is symlinked across all worktrees**, so per-worktree config (e.g., port) cannot live there. We use Next.js's standard `.env.local` for per-worktree overrides.

## Design

### Part 1 — `roots.ts` refactor (the foundation)

`src/shared/config/roots.ts` currently does two jobs: path generation (used correctly across the app, ~95% of calls) and "absolute URL" generation (broken in three places). We sharpen the API into two clear modes and centralize the host registry.

#### Audit findings

`devBaseUrl` and `prodBaseUrl` are **never consumed externally** — only by `generateUrl` internally. We can refactor freely.

The current `absolute: true` semantics mask three real bugs:

1. **`logout-button.tsx:18`** — `router.push(${ROOTS.generateUrl('/', { absolute: true })})`. Pushes `http://localhost:3000/` in dev, breaking from a phone over the tunnel. Should be `router.push('/')`.
2. **`account-button.tsx:17`** — same antipattern, plus a literal `}` typo: `${ROOTS.generateUrl('/', { absolute })}/profile}`.
3. **`proposal-email.tsx:123`** — `const base = ROOTS.generateUrl('', { absolute: true })` at module scope. Without `isProduction: true`, dev-rendered emails embed `http://localhost:3000` for the hero/logo image fallbacks. Sister file `email.service.ts:19` correctly uses `isProduction: true` — they disagree.

The pattern: `absolute: true` without `isProduction: true` has no legitimate caller. Every legitimate consumer (emails, GCal events, sitemap, image fallbacks) wants the **canonical production URL** because the URL outlives the request.

#### New `roots.ts` shape

```ts
// src/shared/config/roots.ts

// Single source of truth for "where does this app live"
export const APP_HOSTS = {
  prod:   ['triprosremodeling.com', 'www.triprosremodeling.com'],
  dev:    ['localhost:3000', 'localhost:3001', 'localhost:3002'],
  tunnel: ['destined-emu-bold.ngrok-free.app'],
} as const

const PROD_BASE_URL = `https://${APP_HOSTS.prod[0]}`

interface UrlOptions {
  absolute?: boolean
}

function generateUrl(path: string, options?: UrlOptions): string {
  return options?.absolute ? `${PROD_BASE_URL}${path}` : path
}

const APP_ROOTS = {
  authFlow: (options?: UrlOptions) => generateUrl('/auth-flow', options),
  landing: { /* unchanged tree, signatures use UrlOptions */ },
  dashboard: { /* ... */ },
  public: { /* ... */ },
} as const

export const ROOTS = { ...APP_ROOTS, generateUrl }
```

**Two clear intents:**

| Intent | API | Output | Use case |
|---|---|---|---|
| Path | `ROOTS.dashboard.proposals.byId(id)` | `/dashboard/proposals/abc` | Links, navigation, router.push (~95% of calls) |
| Canonical absolute URL | `ROOTS.dashboard.proposals.byId(id, { absolute: true })` | `https://triprosremodeling.com/dashboard/proposals/abc` | Emails, GCal events, sitemap, image fallbacks |

**Removed:**
- `devBaseUrl` and `prodBaseUrl` exposed on ROOTS (only used internally; now collapsed into one `PROD_BASE_URL` constant).
- `isProduction` option — now redundant because `absolute: true` always means prod.

**Out of scope:** "Current-context absolute URL" (e.g., `intake-url-card.tsx`) keeps using `window.location.origin`. That's the right tool for that job; no need to bake it into `roots.ts`.

#### Caller cleanups (Part 1.5)

Adopting the new API surfaces three bugs and one ergonomics win:

| File | Change | Reason |
|---|---|---|
| `email.service.ts:19` | Drop `isProduction: true` | Now redundant — `absolute: true` means prod |
| `proposal-viewed-email.tsx:97` | Drop `isProduction: true` | Same |
| `map-to-gcal.ts:85` | Drop `isProduction: true` | Same |
| `proposal-email.tsx:123` | No code change — bug **silently fixes itself** because `absolute: true` now means prod | Side effect of new semantics |
| `logout-button.tsx:18` | `router.push('/')` | Drop bogus absolute URL; relative is correct |
| `account-button.tsx:17` | `router.push('/profile')` | Drop bogus absolute URL + fix typo |
| `billing-button.tsx:17` | `router.push('/')` | Drop bogus absolute URL |
| `marketplace-button.tsx:18` | `router.push('/')` | Drop bogus absolute URL |

**Out of scope (deliberate):** `sitemap.ts` and `trpc/helpers.tsx` use `process.env.NEXT_PUBLIC_BASE_URL` directly. That's a *different* concern (runtime SSR fetch URL, not canonical URL). Leave for follow-up.

### Part 1b — Better-auth dynamic baseURL

Better-auth supports per-request base URL derivation. Two flavors:

- **≥1.5:** `baseURL: { allowedHosts: [...], fallback }` — strict allowlist validation.
- **1.4.x (our installed version, 1.4.18):** `advanced.trustedProxyHeaders: true` + omit `baseURL`. Better-auth derives the URL from `x-forwarded-host` / `x-forwarded-proto` (proxy headers, used by ngrok and Vercel) or falls back to `request.url` (used by direct localhost requests). OAuth callbacks then derive from that base URL automatically.

We use the 1.4-compatible form now. When better-auth gets upgraded to ≥1.5, we can switch to the explicit `allowedHosts` form for stricter validation.

#### Changes in `src/shared/domains/auth/server.ts`

```ts
import { APP_HOSTS } from '@/shared/config/roots'

// baseURL intentionally omitted — derived per-request from proxy headers
// (ngrok/Vercel) or request.url (localhost). See advanced.trustedProxyHeaders below.
trustedOrigins: [
  ...APP_HOSTS.dev.map(h => `http://${h}`),
  ...APP_HOSTS.tunnel.map(h => `https://${h}`),
  ...APP_HOSTS.prod.map(h => `https://${h}`),
],
socialProviders: {
  google: {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    // redirectURI omitted — derived from per-request baseURL
    accessType: 'offline',
    prompt: 'select_account consent',
    scope: [...], // preserved from current config
  },
},
advanced: {
  crossSubDomainCookies: { enabled: true },
  trustedProxyHeaders: true,  // NEW — enables x-forwarded-host derivation
},
```

**Removed:**
- Hardcoded `redirectURI` on the Google provider.
- Static `baseURL: env.NEXT_PUBLIC_BASE_URL` (was forcing localhost in dev).
- `BETTER_AUTH_URL` and `NEXT_PUBLIC_BASE_URL` from `trustedOrigins` (subsumed by `APP_HOSTS`-derived list; `BETTER_AUTH_URL` env stays optional for future override).

**Added:**
- `advanced.trustedProxyHeaders: true` — required for per-request URL derivation through ngrok and Vercel.

**Server-side `auth.api.*` calls:** All in-tree callers pass `headers` explicitly, and `auth.api.getSession` doesn't require a base URL — it reads the session cookie from headers. No regressions.

**Why this works:** All three callback URLs (`localhost`, ngrok, prod) are already registered in the Google Cloud OAuth Client (confirmed by the user). Better-auth picks the right one per request.

**Cookie domain consideration:** `crossSubDomainCookies` stays enabled. Each host gets its own cookie scope; this is fine because we're not trying to share sessions across environments — each environment is independent.

### Part 2 — Port-aware dev + tunnel scripts

#### Per-worktree port via `.env.local`

Next.js automatically loads `.env.local` after `.env` and `.env.local` is git-ignored by default. Each worktree puts its own `PORT` there:

```
# .env.local (in each worktree)
PORT=3001
```

`next dev` reads `PORT` from env natively — no flag needed. We drop the legacy `--hostname 0.0.0.0` flag from the `dev` script (it was a workaround before the ngrok tunnel existed; ngrok handles external access now).

#### Updated scripts in `package.json`

```json
"dev": "next dev",
"tunnel": "ngrok http --url=destined-emu-bold.ngrok-free.app ${PORT:-3000}",
"dev:mobile": "concurrently -k -n next,tunnel,qr -c blue,magenta,green \"pnpm dev\" \"pnpm tunnel\" \"node scripts/print-tunnel-qr.mjs\""
```

Both `dev` and `tunnel` honor `PORT` from env (Next.js reads it for dev; the shell-expanded `${PORT:-3000}` reads it for ngrok). `dev:mobile` ties them together with `concurrently` so Ctrl-C kills both child processes.

**New devDependencies:**
- `concurrently` — runs dev + tunnel in parallel with shared lifecycle.
- `qrcode-terminal` — tiny dep, prints ASCII QR to terminal.

**New file `scripts/print-tunnel-qr.mjs`:** Reads `NGROK_URL` from `.env`, waits ~3s for the tunnel to come up, prints the URL + a QR code, and exits. (It does not poll or restart — keeps the process tree simple.)

**Why not detect the live ngrok URL via the local API?** Because we use a **static** ngrok domain. The URL is known ahead of time and lives in `.env` as `NGROK_URL`. No discovery needed.

**Behavior when another worktree already holds the tunnel:** ngrok prints a clear error ("tunnel session already exists" or similar). The dev process keeps running locally. The user kills the other worktree's tunnel and re-runs `dev:mobile`. We do not try to be clever about reclaiming the tunnel.

### Part 3 — Documentation

Add a "Mobile testing" section to `CLAUDE.md` covering:
- `pnpm dev:mobile` workflow.
- Per-worktree `.env.local` with `PORT=3001` (or 3002, etc.) for parallel worktree dev.
- The single-tunnel constraint (free ngrok plan): only one worktree can hold the tunnel at a time.
- Required env: `NGROK_URL` set to the static ngrok domain (lives in shared `.env`).
- Note that Google OAuth Client must have all redirect URIs registered (one-time setup, already done).
- Note that `APP_HOSTS` in `src/shared/config/roots.ts` is the single source of truth for allowed hosts; adding a worktree port or subdomain means editing that file (and registering the callback URL in Google Cloud Console).
- DevTools shortcut for toggling the device-emulator viewport (Chrome: Cmd-Shift-M after opening DevTools; Safari: Develop menu → Enter Responsive Design Mode).
- Pointer to Vercel Preview Deploys for cases where ngrok isn't enough.

`README.md` is currently brief — adding a one-paragraph "Mobile testing" pointer there is fine but optional; CLAUDE.md is the source of truth for this codebase.

## Out of scope (defer)

- Detecting stale ngrok session and auto-restarting.
- Adding `*.vercel.app` to better-auth `allowedHosts` for preview deploys (Vercel previews use unique URLs per deploy and aren't currently used for auth flows; we can add this when needed).
- Removing legacy `BETTER_AUTH_URL` env entirely (kept optional for future override).

## Risks

- **Header trust:** Better-auth's dynamic baseURL relies on `X-Forwarded-Host`/`Host`. Vercel sets these correctly. Local `next dev` sets `Host` directly. Ngrok forwards them. No proxy-spoofing risk in our deployment topology.
- **Allowlist drift:** If we add a new domain (e.g., a second tunnel, a new subdomain), we must remember to add it to `APP_HOSTS` in `roots.ts` AND register the callback URL in the Google OAuth Client. Documented in `CLAUDE.md`.
- **Existing sessions:** Switching `baseURL` from string to object form should not invalidate existing prod sessions because cookie domain logic is unchanged. Worth verifying in dev before merge.

## Success criteria

- ✅ `roots.ts` exports `APP_HOSTS` and a simplified `generateUrl` (path | absolute=prod). `devBaseUrl` and `isProduction` are gone.
- ✅ Three pre-existing bugs fixed: `proposal-email.tsx` module-level `base` no longer points to localhost; the four button `router.push` calls drop bogus absolute URLs.
- ✅ `pnpm dev:mobile` starts dev + tunnel and prints a QR pointing at the static tunnel URL.
- ✅ Multiple worktrees can run `pnpm dev` simultaneously on different ports (3000–3002) by setting `PORT` in each worktree's `.env.local`.
- ✅ Any worktree can grab the tunnel by running `pnpm dev:mobile`; ngrok will tunnel to that worktree's `PORT`.
- ✅ Sign-in with Google works through the tunnel from a mobile browser.
- ✅ Sign-in with Google still works from any localhost dev port on desktop, simultaneously with the tunnel, no restart needed.
- ✅ Production auth (triprosremodeling.com) unaffected.
- ✅ Workflow documented in `CLAUDE.md`.
