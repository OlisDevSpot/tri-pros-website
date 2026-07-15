# Environment Axes: VERCEL_ENV gates + DRIZZLE_TARGET data selection

**Date:** 2026-07-15
**Status:** Approved (brainstormed with Oliver; supersedes the `scripts/lib/script-db.ts` pattern from `810281bd`)

## Problem

`NODE_ENV` is overloaded to answer three unrelated questions:

1. **Build mode** — "optimized build or dev build?" (its only legitimate meaning; Next.js forces it)
2. **Deployment environment** — "am I the deployed prod site?" (what the `server-env.ts` safety gates care about)
3. **Data target** — "which DB should this process touch?" (what CLI scripts care about)

Consequence: a local script that needs prod data must run `NODE_ENV=production tsx …`, which falsely claims "I am the production runtime" and trips the boot-time safety gates (`META_TEST_EVENT_CODE` / `VOIP_DEV_OVERRIDE_NUMBER` must-not-be-set-in-production throws) — even though **no script can reach the features those gates protect** (the Meta CAPI client and the VoIP dial path; zero imports from `scripts/`). Blanking the vars on the command line does not work either: server-env loads `.env` through dotenv-expand, which treats `""` as unset and re-injects the file value.

Industry position (Next.js docs, Node.js docs, 12-factor): hand-setting `NODE_ENV` is an antipattern; deployment environment and data target each deserve their own lever.

## Design — two existing levers, zero new variables

### Axis 1: "Am I the deployed production site?" → `VERCEL_ENV`

`VERCEL_ENV` is a **Vercel system env var**, injected automatically into every build and serverless invocation (`production` | `preview` | `development`). It does not exist on a local machine, so a local shell can never satisfy it by accident. No dashboard configuration needed.

- Add `VERCEL_ENV` to the server-env schema (optional enum).
- Re-key both production safety gates from `NODE_ENV === 'production'` to `VERCEL_ENV === 'production'`.
- Effect: gates protect exactly the production **deployment** (including failing the prod build/deploy if a forbidden var is ever set in the Vercel prod env config). Local scripts can never trip them. Preview is out of scope for now (mocked with worktrees).

### Axis 2: "Which DB do I want?" → `DRIZZLE_TARGET`

`DRIZZLE_TARGET` already exists and already means exactly this (`db:push:dev`, `db:reset:dev`, `db:seed:dev`, `drizzle.config.ts`, `seed-lead-sources.ts`).

- `src/shared/db/index.ts` URL selection becomes:
  1. `DRIZZLE_TARGET=prod` → `DATABASE_URL`
  2. `DRIZZLE_TARGET=dev` → `DATABASE_DEV_URL`
  3. unset → `VERCEL_ENV === 'production'` ? `DATABASE_URL` : (`DATABASE_DEV_URL ?? DATABASE_URL`)
- **Unset never silently means prod anywhere.** `drizzle.config.ts` flips its default accordingly: unset/`dev` → `DATABASE_DEV_URL`, only explicit `DRIZZLE_TARGET=prod` → `DATABASE_URL`. (Bare `pnpm db:push` therefore now targets dev — a safety improvement consistent with the existing "never `pnpm db:push`" rule; a `db:push:prod` alias with explicit target replaces the old implicit-prod path.)
- Scripts keep importing the normal `@/shared/db` singleton. Prod runs become: `DRIZZLE_TARGET=prod pnpm tsx scripts/<script>.ts`.

### Axis 3: `NODE_ENV` is never hand-set again

- The six `NODE_ENV=production tsx` package.json entries become `DRIZZLE_TARGET=prod tsx`.
- Script bodies that branch on `NODE_ENV === 'production'` for DB reporting/selection switch to the `DRIZZLE_TARGET` lever.
- `scripts/lib/script-db.ts` is retired; `backfill-wave1-columns.ts` returns to the `@/shared/db` singleton (its `--target=prod` flag is replaced by `DRIZZLE_TARGET=prod`).
- `scripts/migrate-optimize-images.ts` aligns with the same semantics (currently prod-by-default — flipped to explicit-target).

## Out of scope (follow-ups)

- **Preview deploys**: currently mocked via worktrees. Under the new fallback, a preview (`VERCEL_ENV=preview`) resolves to `DATABASE_DEV_URL ?? DATABASE_URL` — i.e. it still reaches the prod DB unless `DATABASE_DEV_URL` is defined in the Vercel Preview scope. Decide deliberately when previews become real.
- **Point-of-use gates + CI deploy check** (full 12-factor): move the test-var invariants into the Meta client / VoIP dial path and a CI check on the Vercel prod env listing. Filed as a follow-up; the boot gates remain (re-keyed) as defense in depth.
- Migrating the remaining runtime `NODE_ENV` checks with environment semantics (QuickBooks sandbox endpoint, Twilio identity prefix, GCal calendar name, webhook strictness) to `VERCEL_ENV` — same seam, separate pass.

## Invariants after this change

1. No file in the repo sets `NODE_ENV` by hand.
2. An unset `DRIZZLE_TARGET` never resolves to the prod DB in any CLI/tooling context.
3. The safety gates fire only where `VERCEL_ENV === 'production'` — i.e. only the deployed production site/build.
4. Any script reaching prod does so via the explicit, greppable token `DRIZZLE_TARGET=prod`.

## Documentation updates

- `docs/codebase-conventions/environment.md` — new "Environment axes" section (canonical home of this rule).
- `memory/feedback-runtime-db-env.md` + MEMORY.md line — rewritten (the "runtime picks via NODE_ENV" note becomes stale with this change).
- Wave-1 cutover runbook command updated (`--target=prod` → `DRIZZLE_TARGET=prod`).
