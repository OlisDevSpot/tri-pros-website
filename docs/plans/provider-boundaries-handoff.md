# Handoff — Provider & Service Single-Entrypoint Boundary Refactor (Epic #248)

**Status as of 2026-06-17:** Phases 1 + 2 **committed** to `main` (`6b7a27a`, after sitting uncommitted in the working tree) + **#251 r2 done** (`14a92b5`). Remaining: #249, #250, #252, #253, #254, #255.
**Working mode for this epic:** work **directly on `main`** — no worktree, no feature branch, no PR. Owner-authorized. Commit per provider/area in small verifiable units.

---

## The mission (one sentence)

Make every **provider** expose ONE runtime entrypoint (`client.ts`) and every **service** expose ONE entrypoint (`xxxService`); every external consumer imports the client/service and **never** reaches into `lib/`, `dal/`, `schemas/`, `constants/`, `api/`, `webhooks/`, `jobs/`, or loose files.

Source of truth = **GitHub epic [#248](https://github.com/OlisDevSpot/tri-pros-website/issues/248)** (full scorecard + checklist). Read it first. This file is just the working brief.

## The rule (what "clean" means)

- Provider public surface = `client.ts` (e.g. `cloudtalkClient`, `twilioClient` — the reference-clean providers). Mirror their shape: ONE factory → ONE singleton → ALL methods.
- Service public surface = the exported `xxxService` object.
- **Codified exceptions (NOT violations):**
  1. `providers/*/lib/config.ts` env accessors imported by `src/shared/config/server-env.ts` (boot aggregator).
  2. Type-only imports (low severity — re-export from client/types as a nicety, don't block on them).
  3. Client-side React hooks are a **separate** entrypoint from the `server-only` `client.ts` — you cannot merge `server-only` + `'use client'`. A provider may legitimately have both a server `client.ts` and a client-side hook entrypoint.

## What's already done (don't redo)

- **Phase 1** — deleted inert config-factory exports: `buildResendConfig`, `isResendConfigured`, `buildQuickbooksConfig`, `isQuickbooksConfigured`, `QB_AUTH_URL`, `buildPipedriveConfig`.
- **Phase 2** — added `client.ts` to `ai`, `google-maps`, `web-push`, `google-drive` (server side); redirected all consumers; deleted loose/dead files. `cloudtalk` + `twilio` were already clean.

## Remaining work — recommended order

Do the mechanical redirects first to build rhythm, hard cases next, **enforcement LAST** (it will flag any not-yet-fixed violation).

1. ~~**#251 r2**~~ — ✅ DONE (`14a92b5`): `r2Client` is now a facade (all object-ops + presigned URLs as methods over a private lazy S3Client); bucket registry + `R2BucketName` → isomorphic `types.ts`; `process-image-variants` relocated to `entities/media-files/lib/`; 14 consumers redirected; loose files deleted.
2. **#253 redirect remaining** — pipedrive (tiny: one `putLead` method) → resend → gohighlevel → quickbooks → google-calendar → google-drive picker. Dead-code review per provider. ⚠️ **twilio `fetchCall`/`hangupCall`/`fetchMessage` are pending VoIP-Phase-1 scaffolding — KEEP them.**
3. **#249 notion** — biggest. Server adapters/queries → `notionClient` facade; **relocate** the client-side React Query hooks (`use-get-scopes`, `use-get-trades`) OUT of the provider into the entity/feature DAL (they're misfiled, not wrappable).
4. **#250 upstash** — job-registry entrypoint (stop deep-importing `jobs/<name>`); consolidate `realtime.ts` vs `realtime-client.ts`. Coordinate with the Ably Realtime Kernel project so realtime isn't churned twice.
5. **#252 zoho-sign** — move envelope/document orchestration (`lib/documents/*`) behind `zohoSignClient`/`contractService`; expose webhook verify+schema as client methods.
6. **#254 service boundaries** — `voip/campaigns/lib/*` reached by routes + webhook + an upstash job → expose via `campaignEnrollmentService`/`complianceService`; `contracts.router` → `contractService`.
7. **#255 enforcement (LAST)** — ESLint `no-restricted-imports` banning deep imports into provider/service internals (carve-outs for config + type-only) + write `docs/codebase-conventions/provider-boundaries.md` (canonical doc; then the memory entry becomes reflect-and-link).

## How to find violations for any given provider/service

```bash
# consumer FILES reaching into a provider's internals (filter by file path, NOT line content —
# the import path itself contains the provider name, which breaks naive `grep -v`):
grep -rln "providers/<name>/" src scripts --include=*.ts --include=*.tsx \
  | grep -v "^src/shared/services/providers/<name>/"
# then inspect each file's import lines and classify: client entrypoint = OK; lib/dal/schemas/etc = redirect.
```

## Per-change verification loop (run before each commit)

```bash
pnpm tsc          # must be clean
pnpm lint         # clean (pre-existing warnings unrelated to providers are OK)
# smoke a route that loads the touched provider, e.g.:
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/dashboard/campaigns?tab=leads"   # 200
```

Also re-grep for stale imports to any file you delete/move across **both `src` and `scripts`** (a CLI script bit us once: `scripts/send-push.ts`).

## Gotchas / judgment notes carried forward

- **`ai/client.ts` still does a `db.update`** — a provider should be a leaf (return output; persistence in service/DAL per the "services orchestrate, DAL implements" convention). Deferred deliberately; fix during a deeper pass, noted in #248.
- "No consumers yet" ≠ dead in this actively-developed codebase. Confirm with the owner before deleting feature-shaped code (that's why twilio's REST methods stay).
- Trust-but-verify the audit: it had false positives (claimed `cloudtalk/types.ts` dead, but `client.ts` imports it internally). Always grep before deleting.
- Commit messages end with the `Co-Authored-By: Claude ...` trailer. Small commits, one provider/area each, on `main`.

## Pointers

- Memory: `memory/project-provider-boundaries.md` (auto-loaded via MEMORY.md).
- Reference-clean examples to copy: `src/shared/services/providers/{cloudtalk,twilio}/client.ts`.
- New clients from Phase 2 (also good references): `providers/{ai,google-maps,web-push,google-drive}/client.ts`.
