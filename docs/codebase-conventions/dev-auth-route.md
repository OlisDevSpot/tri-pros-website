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
