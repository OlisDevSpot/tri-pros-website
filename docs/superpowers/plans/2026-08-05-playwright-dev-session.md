# Playwright dev-session route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dev-only, hard-gated HTTP route that logs the Playwright MCP browser into the app by minting a real better-auth session — no Google OAuth, no decaying cookie snapshot.

**Architecture:** A `GET /api/dev/playwright-session` route runs three guards (non-production `VERCEL_ENV`, non-production host, matching `DEV_LOGIN_SECRET`), resolves a target user (default `info@` super-admin; `?as=` real user; `?role=` synthetic fixture), mints a session via `auth.$context`'s internal adapter, signs the session cookie with better-call's `serializeSignedCookie` (the same call better-auth's own `setSessionCookie` makes), and 302-redirects to the dashboard with the `Set-Cookie` attached. `.mcp.json` drops the read-only `--storage-state` snapshot; the canonical ritual becomes "navigate to the route first."

**Tech Stack:** Next.js 15 App Router route handler, better-auth 1.6.9 (`auth.$context`, `internalAdapter`), better-call 1.3.5 (`serializeSignedCookie`), Drizzle/Postgres, Zod server-env.

## Global Constraints

- **No unit-test framework exists in this repo.** Verification is `pnpm tsc` + `pnpm lint` + live checks (curl against the running dev server, Playwright MCP for the authenticated happy path) — never `pnpm build` (see memory `feedback-no-build`). This plan's "test" steps are those commands with exact expected output, not a vitest/jest suite. Do not introduce a test runner.
- **Route must be un-reachable in production.** All three guards are required together; any failure returns `404` (never `403` — do not disclose existence).
- **Use better-auth's own machinery for sessions/cookies.** Never hand-roll HMAC/JWT signing. Mint via `internalAdapter.createSession`; sign via `serializeSignedCookie` with `ctx.authCookies.sessionToken` name/attributes and `ctx.secret`.
- **Corporate-domain hook gotcha:** `auth/server.ts` `databaseHooks.user.create.before` forces `role: 'agent'` for any `@triprosremodeling.com` email on create. To get any other role (incl. `super-admin`), you MUST `updateUser({ role })` *after* create — the create call cannot set it.
- **Roles are** `['user', 'homeowner', 'agent', 'super-admin', 'dispatcher']` from `src/shared/constants/enums/user.ts`.
- **Env loading:** `env` is the default export of `src/shared/config/server-env.ts`; `VERCEL_ENV` is optional (undefined on a laptop, `'production'` only on the prod deploy).
- Follow repo conventions: named exports, absolute `@/` imports, no `git add -A` (stage by path), commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## File Structure

- **Create** `src/app/api/dev/playwright-session/route.ts` — the entire route: guards, user resolution, session mint, cookie signing, redirect. Single focused file.
- **Modify** `src/shared/config/server-env.ts` — add optional `DEV_LOGIN_SECRET` to the Zod schema.
- **Modify** `.env.example` and local `.env`/`.env.local` — add `DEV_LOGIN_SECRET`.
- **Modify** `package.json` — add `better-call` as an explicit `devDependency` (currently transitive via better-auth) with justification.
- **Modify** `.mcp.json` — drop `--storage-state .playwright/auth.json` from the `playwright` server args.
- **Create** `docs/codebase-conventions/dev-auth-route.md` — convention doc.
- **Modify** `docs/codebase-conventions/environment.md` and `docs/codebase-conventions/webhook-routes.md` — cross-links.
- **Create** `<memory>/reference-playwright-auth.md` and **modify** `<memory>/MEMORY.md` — where `<memory>` = `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory`.

---

## Task 1: Add `DEV_LOGIN_SECRET` env var

**Files:**
- Modify: `src/shared/config/server-env.ts` (schema object, near `VERCEL_ENV`)
- Modify: `.env.example`
- Modify: `.env` (or `.env.local`) — local secret so the route works this session

**Interfaces:**
- Produces: `env.DEV_LOGIN_SECRET: string | undefined` consumed by Task 2.

- [ ] **Step 1: Add the schema field**

In `src/shared/config/server-env.ts`, inside the `z.object({ ... })`, add after the `VERCEL_ENV` line:

```ts
  // Dev-only: gates /api/dev/playwright-session (OAuth-bypass login for the
  // Playwright MCP browser). Optional so production builds never require it;
  // the route refuses unless this is set AND matches. see
  // docs/codebase-conventions/dev-auth-route.md
  DEV_LOGIN_SECRET: z.string().min(1).optional(),
```

- [ ] **Step 2: Add to `.env.example`**

Append:

```bash
# Dev-only: secret for /api/dev/playwright-session (Playwright MCP login).
# Any non-trivial random string; only gates a dev-only, non-production route.
DEV_LOGIN_SECRET=
```

- [ ] **Step 3: Set a local value**

Add to `.env.local` (gitignored) a real value, e.g.:

```bash
DEV_LOGIN_SECRET=pw-local-dev-8f2a7c9e
```

- [ ] **Step 4: Type-check**

Run: `pnpm tsc`
Expected: PASS (no errors introduced).

- [ ] **Step 5: Commit**

```bash
git add src/shared/config/server-env.ts .env.example
git commit -m "feat(dev): add DEV_LOGIN_SECRET env var for playwright-session route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(`.env.local` is gitignored — not staged.)

---

## Task 2: The `/api/dev/playwright-session` route handler

**Files:**
- Create: `src/app/api/dev/playwright-session/route.ts`
- Modify: `package.json` (add `better-call` devDependency)

**Interfaces:**
- Consumes: `env.DEV_LOGIN_SECRET` (Task 1); `auth` from `@/shared/domains/auth/server`; `isProductionHost` from `@/shared/config/is-production-host`; `userRoles` from `@/shared/constants/enums/user`.
- Produces: `GET /api/dev/playwright-session` — the login endpoint the Playwright ritual (Task 3) and docs/memory (Tasks 4–5) reference.

- [ ] **Step 1: Add `better-call` as an explicit devDependency**

It is currently transitive (via better-auth, resolved at 1.3.5). We import `serializeSignedCookie` from it, so declare it explicitly.

Run: `pnpm add -D better-call`
Expected: `package.json` gains `"better-call"` under `devDependencies`; lockfile updates.

- [ ] **Step 2: Write the route handler**

Create `src/app/api/dev/playwright-session/route.ts`:

```ts
/**
 * ⚠️ DEV-ONLY OAuth-bypass login for the Playwright MCP browser. ⚠️
 *
 * The app's only interactive login is "Sign in with Google" (better-auth,
 * google-only). Google blocks OAuth inside automation-controlled browsers, so
 * the Playwright MCP browser cannot sign in the normal way. This route mints a
 * real better-auth session directly (our DB, our secret) and sets the session
 * cookie, letting the automated browser reach authenticated pages.
 *
 * It is the ENTIRE security boundary that keeps this out of production:
 *   1. env.VERCEL_ENV !== 'production'
 *   2. request host is not a production host (is-production-host)
 *   3. ?secret= matches env.DEV_LOGIN_SECRET (must be set + non-empty)
 * Any failure returns 404 (not 403) so the route's existence is never disclosed.
 *
 * Ritual: the Playwright browser navigates here FIRST each session, then works
 * authenticated. see docs/codebase-conventions/dev-auth-route.md
 */
import { serializeSignedCookie } from 'better-call'
import { NextResponse, type NextRequest } from 'next/server'
import env from '@/shared/config/server-env'
import { isProductionHost } from '@/shared/config/is-production-host'
import { userRoles, type UserRole } from '@/shared/constants/enums/user'
import { auth } from '@/shared/domains/auth/server'

const notFound = () => new NextResponse('Not found', { status: 404 })

function sanitizeRedirect(raw: string | null): string {
  // relative paths only — reject absolute/protocol-relative to prevent open redirect
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw
  }
  return '/dashboard'
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const host = request.headers.get('host')

  // --- Guards (all required) ---
  if (env.VERCEL_ENV === 'production') return notFound()
  if (isProductionHost(host)) return notFound()
  const secret = url.searchParams.get('secret')
  if (!env.DEV_LOGIN_SECRET || secret !== env.DEV_LOGIN_SECRET) return notFound()

  const ctx = await auth.$context
  const adapter = ctx.internalAdapter

  // --- Resolve target user: as > role > default ---
  const asEmail = url.searchParams.get('as')
  const roleParam = url.searchParams.get('role')

  if (roleParam && !userRoles.includes(roleParam as UserRole)) {
    return new NextResponse(`Invalid role. One of: ${userRoles.join(', ')}`, {
      status: 400,
    })
  }

  let user: { id: string, role?: string | null } | null = null

  if (asEmail) {
    const found = await adapter.findUserByEmail(asEmail)
    if (!found?.user) return notFound()
    user = found.user // keep their real role + data scope
  } else {
    const desiredRole: UserRole = (roleParam as UserRole) ?? 'super-admin'
    const email = roleParam
      ? `dev+${roleParam}@triprosremodeling.com`
      : 'info@triprosremodeling.com'
    const name = roleParam ? `Dev ${roleParam}` : 'Oliver (dev)'

    const existing = await adapter.findUserByEmail(email)
    user = existing?.user
      ?? (await adapter.createUser({ email, name, emailVerified: true }))

    // Corporate-domain create hook forces role 'agent'; force desired role now.
    if (user && user.role !== desiredRole) {
      user = await adapter.updateUser(user.id, { role: desiredRole })
    }
  }

  if (!user) return notFound()

  // --- Mint session + set signed cookie (same as better-auth setSessionCookie) ---
  const session = await adapter.createSession(user.id)
  const cookie = ctx.authCookies.sessionToken
  const setCookie = await serializeSignedCookie(
    cookie.name,
    session.token,
    ctx.secret,
    { ...cookie.attributes, maxAge: ctx.sessionConfig.expiresIn },
  )

  const redirectPath = sanitizeRedirect(url.searchParams.get('redirect'))
  const response = NextResponse.redirect(new URL(redirectPath, url.origin))
  response.headers.append('set-cookie', setCookie)
  return response
}
```

> If `ctx.sessionConfig.expiresIn` or `ctx.authCookies.sessionToken` are named differently at runtime in 1.6.9, confirm against `node_modules/better-auth/dist/cookies/index.mjs` (the `setSessionCookie` body uses `ctx.context.authCookies.sessionToken.name` and `ctx.context.sessionConfig.expiresIn`; `auth.$context` resolves to that same `context` object). Adjust accessors to match; the signing call shape stays identical.

- [ ] **Step 3: Type-check + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. (If `createUser`/`updateUser`/`findUserByEmail` return types need narrowing, adjust the local `user` type to match the adapter's return — do not `any`-cast.)

- [ ] **Step 4: Verify the guards reject (dev server running on :3000)**

Run each and check status:

```bash
# missing secret -> 404
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/dev/playwright-session"
# wrong secret -> 404
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/dev/playwright-session?secret=nope"
# invalid role -> 400
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/dev/playwright-session?secret=pw-local-dev-8f2a7c9e&role=wizard"
```

Expected: `404`, `404`, `400`.

- [ ] **Step 5: Verify the happy path mints a session cookie**

```bash
curl -s -o /dev/null -D - "http://localhost:3000/api/dev/playwright-session?secret=pw-local-dev-8f2a7c9e" | grep -i "^set-cookie\|^location"
```

Expected: a `set-cookie:` header named `better-auth.session_token` (or `__Secure-…` variant) **and** `location: /dashboard`.

- [ ] **Step 6: Verify authenticated page via Playwright MCP**

Using the Playwright MCP browser: navigate to `http://localhost:3000/api/dev/playwright-session?secret=pw-local-dev-8f2a7c9e`, then to `http://localhost:3000/dashboard`. Take a snapshot.
Expected: the dashboard renders **authenticated** (no redirect to a sign-in screen). This is the real correctness gate for the cookie format.

- [ ] **Step 7: Verify role impersonation**

Navigate to `…/playwright-session?secret=…&role=agent`, then to `/dashboard`, snapshot.
Expected: authenticated as an agent (role-gated UI reflects `agent`, not `super-admin`).

- [ ] **Step 8: Commit**

```bash
git add src/app/api/dev/playwright-session/route.ts package.json pnpm-lock.yaml
git commit -m "feat(dev): add /api/dev/playwright-session OAuth-bypass login route

Mints a real better-auth session for the Playwright MCP browser, hard-gated
to non-production (VERCEL_ENV + host + DEV_LOGIN_SECRET). Default info@
super-admin; ?as= any existing user; ?role= synthetic role fixture.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Point Playwright MCP at the route (drop the stale snapshot)

**Files:**
- Modify: `.mcp.json` (the `playwright` server args)

**Interfaces:**
- Consumes: the route from Task 2.

- [ ] **Step 1: Remove `--storage-state` from the playwright args**

In `.mcp.json`, change the `playwright` server to:

```jsonc
"playwright": {
  "command": "npx",
  "args": ["@playwright/mcp@latest", "--browser", "chromium"]
}
```

- [ ] **Step 2: Retire the stale snapshot (optional, gitignored)**

Run: `rm -f .playwright/auth.json`
Expected: file gone; no git change (it was gitignored).

- [ ] **Step 3: Reconnect the Playwright MCP server**

This is a manual/session action — the MCP server must be restarted/reconnected for the arg change to apply (Claude Code: reconnect MCP, or restart the session). Flag to the user; do not assume it auto-reloads.

- [ ] **Step 4: Verify end-to-end after reconnect**

In a fresh Playwright MCP browser (no storage state), navigate to `…/playwright-session?secret=…` then `/dashboard`.
Expected: authenticated dashboard, proving the storage-state file is no longer needed.

- [ ] **Step 5: Commit**

```bash
git add .mcp.json
git commit -m "chore(dev): drop playwright --storage-state; use dev-session route instead

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Convention documentation

**Files:**
- Create: `docs/codebase-conventions/dev-auth-route.md`
- Modify: `docs/codebase-conventions/environment.md` (cross-link)
- Modify: `docs/codebase-conventions/webhook-routes.md` (cross-link)

**Interfaces:**
- Consumes: route + env var from Tasks 1–2.

- [ ] **Step 1: Write the convention doc**

Create `docs/codebase-conventions/dev-auth-route.md`:

```markdown
# Dev auth route — Playwright/browser login without Google OAuth

`GET /api/dev/playwright-session` logs an automated/dev browser into the app by
minting a real better-auth session, bypassing Google OAuth. It exists because
the app's only interactive login is Google, and Google blocks OAuth inside
automation-controlled browsers — so the Playwright MCP browser cannot otherwise
reach authenticated pages.

## Why (root cause it replaces)

The old approach passed `--storage-state .playwright/auth.json` to Playwright
MCP. `--storage-state` is a read-only snapshot loaded at launch; Playwright never
writes refreshed cookies back, so the session decayed and the browser silently
signed out. This route replaces that with a self-healing per-run login.

## Guards (all required; 404 on any failure)

1. `env.VERCEL_ENV !== 'production'`
2. request host is not a production host (`is-production-host.ts`)
3. `?secret=` equals `DEV_LOGIN_SECRET` (must be set and non-empty)

Failures return **404** (not 403) to avoid disclosing the route exists. This
route can never run in production; the guards are its entire security boundary.

## Parameters

| Param      | Purpose |
|------------|---------|
| `secret`   | Required. Must equal `DEV_LOGIN_SECRET`. |
| `as`       | Log in as an existing user by email (real role + data scope). 404 if unknown. |
| `role`     | Log in as a synthetic `dev+<role>@triprosremodeling.com` fixture. One of `user \| homeowner \| agent \| super-admin \| dispatcher`. 400 if invalid. |
| `redirect` | Post-login relative path. Default `/dashboard`. Absolute/`//` rejected. |

Precedence: `as` > `role` > default (`info@` as `super-admin`).

> `role` fixtures exercise RBAC-UI gating but have no associated data (assigned
> leads, scoped records). For data-scoped checks use `as=<real email>`.

## The ritual

First Playwright action each session:

    http://localhost:<port>/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>

Then work authenticated. Add `&as=` or `&role=` to check a specific user type.

## Config

`DEV_LOGIN_SECRET` in `.env.local` (see `.env.example`). Optional in the
server-env schema so production builds never require it.
```

- [ ] **Step 2: Cross-link from `environment.md`**

Add a bullet under the dev-tooling / env-var area of `docs/codebase-conventions/environment.md`:

```markdown
- **`DEV_LOGIN_SECRET`** — gates `/api/dev/playwright-session`, the dev-only
  OAuth-bypass login for the Playwright MCP browser. See
  [dev-auth-route.md](./dev-auth-route.md).
```

- [ ] **Step 3: Cross-link from `webhook-routes.md`**

Add a one-line "see also" near the top of `docs/codebase-conventions/webhook-routes.md`:

```markdown
> Related non-page API route: [dev-auth-route.md](./dev-auth-route.md) — the
> dev-only Playwright login route (not a webhook, but a sibling `app/api` route).
```

- [ ] **Step 4: Commit**

```bash
git add docs/codebase-conventions/dev-auth-route.md docs/codebase-conventions/environment.md docs/codebase-conventions/webhook-routes.md
git commit -m "docs(conventions): document dev-auth-route (playwright-session login)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Persist to session memory

**Files:**
- Create: `<memory>/reference-playwright-auth.md`
- Modify: `<memory>/MEMORY.md`

where `<memory>` = `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory`

**Interfaces:**
- Consumes: route + doc from Tasks 2 & 4.

- [ ] **Step 1: Write the memory reference file**

Create `<memory>/reference-playwright-auth.md`:

```markdown
---
name: reference-playwright-auth
description: How the Playwright MCP browser authenticates into the app (dev-session route, not Google OAuth)
metadata:
  type: reference
---

The Playwright MCP browser CANNOT sign in via Google OAuth (Google blocks OAuth
in automation-controlled browsers; the app is google-only better-auth). Do NOT
try to click "Sign in with Google" in the Playwright browser, and do NOT rely on
`.playwright/auth.json` (that read-only `--storage-state` snapshot decayed and
was retired).

**Ritual — first Playwright action each session:** navigate to
`http://localhost:<port>/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>`
(secret is in `.env.local`). The browser is then authenticated. Add `&as=<email>`
to log in as a specific existing user, or `&role=<role>` to log in as a synthetic
role fixture (`user|homeowner|agent|super-admin|dispatcher`). Default is `info@`
as `super-admin`.

Route: `src/app/api/dev/playwright-session/route.ts`. Hard-gated to
non-production (VERCEL_ENV + host + secret → 404). Canonical:
`docs/codebase-conventions/dev-auth-route.md`.

Related: [[feedback-meta-pixel-verify-real-browser]], [[feedback-ui-work-methodology]].
```

- [ ] **Step 2: Add the `MEMORY.md` pointer**

In `<memory>/MEMORY.md`, under the **Development System** section, add:

```markdown
- [Playwright auth](reference-playwright-auth.md) — Playwright MCP logs in via `/api/dev/playwright-session` (NOT Google OAuth); navigate there first each session. Canonical: `docs/codebase-conventions/dev-auth-route.md`.
```

- [ ] **Step 3: Verify links resolve**

Confirm `reference-playwright-auth.md` exists and `MEMORY.md` contains the new pointer line.
Run: `ls "<memory>/reference-playwright-auth.md" && grep -n "Playwright auth" "<memory>/MEMORY.md"`
Expected: file listed + grep match. (Memory dir is outside the repo; no git commit.)

---

## Self-Review

**Spec coverage:**
- Route path/name → Task 2. Guards (VERCEL_ENV/host/secret → 404) → Task 2 Steps 2,4. `as`/`role`/default precedence + role validation → Task 2. `redirect` open-redirect guard → Task 2 `sanitizeRedirect`. better-auth-native session/cookie → Task 2 (`createSession` + `serializeSignedCookie`). `.mcp.json` change → Task 3. Ritual → Tasks 3–5. `DEV_LOGIN_SECRET` (optional, non-empty match) → Task 1 + Task 2 guard. Convention doc + cross-links → Task 4. Memory → Task 5. Testing (guards + integration via Playwright) → Task 2 Steps 4–7. All spec sections mapped.
- Corporate-domain hook (forces `agent`) — not in the spec but a verified code fact that would silently break the super-admin default; handled in Task 2 via post-create `updateUser`. Flagged in Global Constraints.

**Placeholder scan:** No TBD/TODO; every code step has real code; verification steps have exact commands + expected output. The one runtime-accessor caveat (Task 2 note) points to the exact file to confirm against, not a vague "handle it."

**Type consistency:** `serializeSignedCookie(name, value, secret, opts)`, `ctx.authCookies.sessionToken.{name,attributes}`, `ctx.secret`, `ctx.sessionConfig.expiresIn`, `ctx.internalAdapter.{findUserByEmail,createUser,updateUser,createSession}`, `session.token`, `env.DEV_LOGIN_SECRET`, `userRoles`/`UserRole`, `isProductionHost` — used consistently across tasks and matched to the verified better-auth/better-call internals.
