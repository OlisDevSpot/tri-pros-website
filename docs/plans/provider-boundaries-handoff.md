# Handoff — Provider & Service Single-Entrypoint Boundary Refactor (Epic #248)

**Status as of 2026-08-20 (re-audited, 6 agents):** Done — Phases 1+2 (`6b7a27a`), #251 r2 (`14a92b5`), pipedrive **removed** (`25a2651a`), #253·google-drive, #253·twilio-types, #254·contract-lifecycle + gDrive-token-refresh. Remaining — #249 notion (~⅓), #250 upstash (not started), #252 zoho-sign (barely started), #253 (google-calendar/gohighlevel/twilio = SMALL; resend/quickbooks = MEDIUM), #254 campaigns-service reach-ins, #255 enforcement (LAST).
**Roster changes:** `cloudtalk` **ELIMINATED** → replaced by JustCall drop-in; NOT to be standardized. `justcall` **DEFERRED** (out of scope for now). `meta` = new, untracked (#253 extension later). `twilio` is the sole clean template.
**Working mode for this epic:** work **directly on `main`** — no worktree, no feature branch, no PR. Owner-authorized. Commit per provider/area in small verifiable units.

---

## The mission (one sentence)

Make every **provider** expose ONE runtime entrypoint (`client.ts`) and every **service** expose ONE entrypoint (`xxxService`); every external consumer imports the client/service and **never** reaches into `lib/`, `dal/`, `schemas/`, `constants/`, `api/`, `webhooks/`, `jobs/`, or loose files.

Source of truth = **GitHub epic [#248](https://github.com/OlisDevSpot/tri-pros-website/issues/248)** (full scorecard + checklist). Read it first. This file is just the working brief.

## The rule (what "clean" means)

- Provider public surface = `client.ts` (e.g. `twilioClient` — the reference-clean provider). Mirror its shape: ONE factory → ONE singleton → ALL methods.
- Service public surface = the exported `xxxService` object.
- **Codified exceptions (NOT violations):**
  1. `providers/*/lib/config.ts` env accessors imported by `src/shared/config/server-env.ts` (boot aggregator).
  2. Type-only imports (low severity — re-export from client/types as a nicety, don't block on them).
  3. Client-side React hooks are a **separate** entrypoint from the `server-only` `client.ts` — you cannot merge `server-only` + `'use client'`. A provider may legitimately have both a server `client.ts` and a client-side hook entrypoint.

## What's already done (don't redo)

- **Phase 1** — deleted inert config-factory exports: `buildResendConfig`, `isResendConfigured`, `buildQuickbooksConfig`, `isQuickbooksConfigured`, `QB_AUTH_URL`, `buildPipedriveConfig`.
- **Phase 2** — added `client.ts` to `ai`, `google-maps`, `web-push`, `google-drive` (server side); redirected all consumers; deleted loose/dead files. `twilio` was already clean (`cloudtalk` was too, but is now removed → JustCall).

## Remaining work — recommended order (revised 2026-08-20)

Do the **SMALL** redirects first to rebuild rhythm, then MEDIUM, then the big client-facade builds, **enforcement LAST** (it will flag any not-yet-fixed violation).

1. **#253 SMALL redirects** (current focus, grill design first):
   - **google-calendar** — move `lib/{conflict,map-from-gcal,map-to-gcal}` behind `googleCalendarClient` methods (or into `scheduling.service`); re-home `MeetingForGCal` type to `types.ts`.
   - **gohighlevel** — expose `normalizeBinaLead` via `gohighlevelClient` (bina route stops deep-importing `lib/`); delete dead event-type constants + the `Ghl*Payload` type/schema family (zero consumers).
   - **twilio** — promote `validatePhoneLine` (×3 routers) to a `twilioClient` method; surface voip `constants/` (`VOIP_DEV_OVERRIDE_NUMBER`, `getVetting`, ×3 services). ⚠️ `fetchCall`/`hangupCall`/`fetchMessage` are pending VoIP scaffolding — KEEP.
2. **#253 MEDIUM redirects**:
   - **resend** — give `resendClient` domain send-methods; move `formatProjectType` to a **client-safe shared util** (one consumer is `'use client'`); delete dead `renderProposalViewedEmail` + template.
   - **quickbooks** — build `quickbooksClient` (wrap `qbRequest` in domain methods; fold OAuth-exchange + webhook-verify).
3. **#254 service boundaries** — promote `isStopKeyword`/`resolveCustomer*`/`isCampaignDialable` to public `complianceService`/`campaignEnrollmentService` methods; move zoho agreement-context eval behind `contractService`.
4. **#249 notion** — build the `notionClient` server facade (`getScopes`/`getTrades`/`getSOWs`/`getPainPoints`); **relocate** the client React Query hooks (`use-get-scopes`, `use-get-trades`) OUT of the provider into the entity/feature DAL.
5. **#252 zoho-sign** — move envelope/document orchestration (`lib/documents/*`) behind `zohoSignClient`/`contractService`; expose webhook verify+schema as client methods; delete dead `pack-sow-text.ts`.
6. **#250 upstash** — build the missing `client.ts`/job-registry entrypoint (stop deep-importing `jobs/<name>`); consolidate `realtime.ts` vs `realtime-client.ts`. Coordinate with the Ably Realtime Kernel project so realtime isn't churned twice.
7. **#255 enforcement (LAST)** — ESLint `no-restricted-imports` banning deep imports into provider/service internals (carve-outs for config + type-only) + write `docs/codebase-conventions/provider-boundaries.md` (canonical doc; then the memory entry becomes reflect-and-link).

**Deferred / out of scope:** `justcall` (drop-in replacement for the removed `cloudtalk`; do NOT standardize yet), `meta` (new provider, small leaks — fold into #253 later).

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
