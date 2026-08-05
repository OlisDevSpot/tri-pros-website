# Playwright dev-session route — OAuth-bypass login for the automated browser

**Date:** 2026-08-05
**Status:** Approved design, pre-implementation
**Owner:** info@triprosremodeling.com

## Problem

The Playwright MCP browser repeatedly loses authentication to the app ("The
Playwright browser isn't authenticated (Google OAuth sign-in)"), blocking UI/UX
verification of authenticated dashboard pages. This has been hand-fixed once
before and keeps recurring.

### Root cause (verified in code, not assumed)

1. `.mcp.json` launches Playwright MCP with
   `--storage-state .playwright/auth.json`. `--storage-state` is a **read-only
   snapshot** loaded at browser launch — Playwright never writes refreshed
   cookies back. When the session decays, the next launch is signed out and
   nothing self-heals. The snapshot was frozen 2026-06-07 (33 cookies, 3 already
   expired at time of diagnosis).
2. The app (`src/shared/domains/auth/server.ts`) uses **better-auth with Google
   as the *only* login provider** — no email/password path. The only interactive
   way to sign in is "Sign in with Google."
3. **Google blocks OAuth sign-in inside automation-controlled browsers** ("this
   browser or app may not be secure"). So re-signing-in *inside* the Playwright
   browser is unreliable by design — which is why it only worked once, after a
   manual dance, and then decayed again.

### Key enabling fact

The only thing the Playwright browser needs to reach is **our own app**. Sessions
live in **our own Postgres**, signed with **our own `BETTER_AUTH_SECRET`**. We can
therefore mint a valid better-auth session directly and skip Google entirely — the
whole class of pain (automation detection, cookie decay, worktree-DB mismatch)
disappears.

## Solution overview

Add a **dev-only, hard-gated HTTP route** that mints a real better-auth session for
a chosen user and sets the session cookie using better-auth's own cookie machinery,
then redirects to the dashboard. The Playwright browser navigates to this route as
its **first action each session** and lands already authenticated. No storage-state
file, no Google, no expiry.

Self-healing property: the session is minted **inside the running dev server**, so
it always targets the exact DB that server uses (critical — worktrees each have
their own Neon branch; a standalone script could mint into the wrong branch).

## Route

**Path:** `/api/dev/playwright-session`
**Method:** `GET` (so it can be hit by a plain browser navigation / redirect)
**File:** `src/app/api/dev/playwright-session/route.ts`

The `dev/` segment signals dev-only at a glance; `playwright-session` names its one
job. A top-of-file banner comment restates purpose + guards so it can never be
misread as a general auth route.

### Guards — ALL must pass, else respond `404`

`404` (not `403`) so the route's existence is never revealed in an environment
where it shouldn't run.

1. `env.VERCEL_ENV !== 'production'`
2. Request host is localhost / ngrok tunnel — reuse the existing
   `is-production-host` logic (`src/shared/config/is-production-host.ts`); a
   production host ⇒ 404.
3. `?secret=` query param equals a new `DEV_LOGIN_SECRET` env var. Missing or
   mismatched ⇒ 404.

All three are required together (belt-and-suspenders: even on a preview deploy that
somehow set the secret, the host/VERCEL_ENV gates still refuse).

### Query parameters

| Param      | Required | Purpose |
|------------|----------|---------|
| `secret`   | yes      | Must equal `DEV_LOGIN_SECRET` (guard). |
| `as`       | no       | Email of an **existing** user to log in as. Highest fidelity — real role AND real data scoping. `404` if no such user. |
| `role`     | no       | One of `userRoles` (`user \| homeowner \| agent \| super-admin \| dispatcher`). Logs in as a synthetic per-role fixture. Invalid value ⇒ `400`. |
| `redirect` | no       | Post-login redirect path. Default `/dashboard`. Must be a relative path (leading `/`, no protocol/host) to prevent open-redirect. |

### Session-target resolution (precedence: `as` > `role` > default)

- **`as=<email>`** → look up the existing user; `404` if absent. Do **not**
  fabricate arbitrary emails.
- **`role=<role>`** → upsert a synthetic fixture user
  `dev+<role>@triprosremodeling.com` with exactly that role; log in as it. Fast
  role-gating / RBAC-UI checks.
- **default (neither)** → upsert `info@triprosremodeling.com` with role
  `super-admin`; log in as it. The everyday case.

"Upsert" (create-if-missing) rather than relying on a seed makes the route
self-healing on any fresh worktree Neon branch.

> Note on `role` fixtures: a synthetic `dev+agent@` user exercises role-based UI
> gating but has no associated data (assigned leads, scoped records). For checks
> that depend on real data scoping, use `as=<real user email>` instead. This
> tradeoff is documented on the route and in the convention doc.

### Behaviour

1. Run guards → 404 on any failure.
2. Resolve target user per precedence (upsert for default/`role`; lookup for `as`).
3. Mint a session for that user via better-auth's server context
   (`auth.$context` → internal adapter `createSession`), and set the session
   cookie via better-auth's own cookie helper (e.g. `setSessionCookie`). We do
   **not** hand-sign cookies — using better-auth's helper keeps signing/format
   correct across better-auth version bumps (currently 1.6.9).
4. `302` redirect to the validated `redirect` (default `/dashboard`) with the
   `Set-Cookie` header attached, so the browser lands authenticated.

## `.mcp.json` change

Remove `--storage-state .playwright/auth.json` from the `playwright` server args:

```jsonc
"playwright": {
  "command": "npx",
  "args": ["@playwright/mcp@latest", "--browser", "chromium"]
}
```

The decaying snapshot is no longer the auth mechanism. The stale
`.playwright/auth.json` file may be deleted (it is gitignored; leaving it is
harmless once the flag is gone).

## The ritual (how Playwright gets authenticated)

**First Playwright action in any session:** navigate to

```
http://localhost:<port>/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>
```

(add `&as=<email>` or `&role=<role>` when checking a specific user type). The
browser is then authenticated for the rest of the session. This is documented in
the convention doc and in memory so future sessions do it automatically.

## Configuration

- New env var **`DEV_LOGIN_SECRET`** — added to `.env.example` (and each local
  `.env`/`.env.local`). Any non-trivial random string; it only gates a dev-only
  route. **Optional** in the server-env schema (so production builds don't require
  it). The secret guard must require a **non-empty** `DEV_LOGIN_SECRET` AND an
  exact match — i.e. if the var is unset/empty the guard can never pass (guard
  against `undefined === undefined`), so an unconfigured environment 404s rather
  than accepting an empty `?secret=`.

## Documentation (part of the deliverable)

1. **`docs/codebase-conventions/dev-auth-route.md`** — new short convention doc:
   what the route is, its guards, the `DEV_LOGIN_SECRET` env var, the
   parameter table, and the "navigate here first" ritual. Cross-linked from
   `environment.md` (env var + dev tooling) and `webhook-routes.md` (sibling
   "non-page API route" reference).
2. **Top-of-file banner comment** in `route.ts` restating purpose + guards +
   the production-safety rationale.
3. **`.env.example`** entry for `DEV_LOGIN_SECRET` with an inline comment.

## Memory (part of the deliverable)

- New `reference-playwright-auth.md` in the project memory dir + a one-line
  pointer in `MEMORY.md`, recording: the route path, its purpose, the
  first-navigate ritual, and the `as`/`role` params. Link to
  `[[feedback-meta-pixel-verify-real-browser]]` (the other "use a real browser"
  note) and the UI-work methodology note.

## Testing

- **Guard unit tests:** production `VERCEL_ENV` ⇒ 404; non-localhost host ⇒ 404;
  missing/wrong `secret` ⇒ 404. Invalid `role` ⇒ 400. `as` unknown email ⇒ 404.
  `redirect` with an absolute URL ⇒ rejected/normalized (no open redirect).
- **Integration check:** a valid default call returns a `Set-Cookie` session
  cookie and a `302` to `/dashboard`; following it renders an authenticated
  dashboard (verified via the Playwright MCP browser itself once implemented).

## Out of scope

- Third-party / Google-authed tools in the Playwright browser (Google Ads, Meta
  Ads Manager, etc.). Confirmed not needed — only our own app.
- Any production auth change. This route never runs in production.
- Replacing Google as the app's login provider.

## Security notes

- Triple-gated (VERCEL_ENV + host + secret), all required.
- Responds `404` rather than `403` to avoid disclosing existence.
- `redirect` restricted to relative paths (open-redirect prevention).
- `as` never fabricates users — only logs into existing ones.
- The route grants a full session for any role, including `super-admin`; this is
  acceptable *only* because it cannot run in production. The guards are the entire
  security boundary and must be reviewed as such.
