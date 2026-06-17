# HANDOFF — Campaigns / VoIP work (2026-06-11)

Session handoff before context compaction. Read this first to resume.

---

## ⚠️ TOP PRIORITY: unpushed prod-bound code + a migration ordering trap

**6 commits are committed on local `main` but NOT pushed to `origin/main`** (the canonical-status refactor). `origin/main` (= what's deployed to prod) is at `4e5f664b`.

Unpushed range `54d803dc..859ae61e`:
```
859ae61e docs(voip): update DOCS for per-customer membership; drop dead getEnrollmentCounts
5d2c8d6d refactor(voip): remove source_slug from voip_campaigns schema (column drop deferred)
cf4b5112 refactor(voip): remove campaign→source ownership binding (UI + mutation + dead query)
856e3c51 refactor(voip): re-anchor enrolled-by-source reads to the customer's lead source
2aab25a7 refactor(voip): one per-source per-status counts query; fixes eligible over-count
54d803dc refactor(voip): collapse leads query onto canonical status predicates
```
Status: **awaiting the user's "push" go-ahead.** They verified item-2 is a non-issue and ran `pnpm db:push:dev` successfully, but have NOT said "push" yet. `pnpm tsc` + `pnpm lint` clean; holistic opus review returned **SHIP** (partition proven sound, eligible-bug fix confirmed in prod data).

**🚨 MIGRATION ORDERING TRAP — do NOT drop the prod `source_slug` column before deploying these commits.**
- Current **prod code** (`4e5f664b`) STILL reads `voip_campaigns.source_slug` (the old by-source readers). Prod DB still has the column → consistent, fine.
- **Dev DB** already had `source_slug` DROPPED (user ran `pnpm db:push:dev`). Local code (`859ae61e`) doesn't read it → consistent, fine.
- Safe order to finish: **(1) push `859ae61e` to prod (deploy), (2) THEN** drop the prod column. Deploying the new code while the prod column still exists is 100% safe (Drizzle ignores unknown columns). Dropping the prod column while old code is live = breakage.
- Deferred prod DDL (run only after deploy, with user approval):
  ```sql
  DROP INDEX IF EXISTS voip_campaigns_source_slug_idx;
  ALTER TABLE voip_campaigns DROP COLUMN IF EXISTS source_slug;
  ```

---

## What already shipped to prod (pushed) this session

1. **CloudTalk resync zod fix** (`6ebb076f`) — `schedule_start_date/time` come back `null`; schema made `.nullish()`.
2. **Enroll → CloudTalk Notes** (`fd983e15`) — enrollment writes the lead summary to the contact's **Notes** (was Activities); inline `·` formatting; junk `Appointment:  •` suppressed via a digit-guard in `buildLeadNote`.
3. **Resync skip transparency** (`f00d0ab2`) — resync names campaigns skipped for no membership tag.
4. **Per-customer membership Phase 1** (`6ebb076f..4e5f664b`, Tasks 1–10 of [2026-06-09 plan](2026-06-09-campaigns-per-customer-membership.md)) — gates relaxed (campaign dialable = CT-active only; source-enabled gate dropped; single enroll bypasses is-a-lead; bulk pre-validates campaign); Leads list defaults to derived-status `'all'`; enriched table (Phone/Source/Attempts/Age + inline campaign switcher); bulk "Enroll selected → campaign".

These are LIVE. The user confirmed bulk-enroll works (prod was at 75 enrolled at last check).

---

## The canonical-status refactor (unpushed — see top section) — what it does

Full plan: [2026-06-11-canonical-lead-status.md](2026-06-11-canonical-lead-status.md). Built subagent-driven on `main`.

- **NEW** `src/shared/entities/voip-campaign-contacts/lib/lead-campaign-status.ts` — the SINGLE source of truth for campaign-lead status as SQL fragments: `isEnrolledSql / isDncSql / isRemovedSql / isEligibleSql / isCampaignLeadSql / leadStatusCaseSql`. Priority `enrolled > dnc > removed > eligible`; the four PARTITION the set (proven: union == sum of slices; eligible∩enrolled = 0).
- **Bug fixed:** the rollup **Eligible** badge used to NOT subtract enrolled (over-counted). Now `isEligibleSql()` excludes enrolled+removed+dnc. Confirmed in prod: a source showed 60 eligible + 72 enrolled where old code reported 132.
- `listLeadsPaginated` collapsed 5 branches → 1 canonical query (−270 lines). `FROM customers` is UNALIASED on purpose (derivedPipelineWhere emits literal `"customers".` refs an alias would hide).
- 3 count fns → 1 `countLeadsByStatusPerSource()` (keyed by lead_source_id). Deleted `countActiveEnrollmentsBySource`, `countEligibleLeadsBySource`, `countDncBySource`.
- All "by source" reads re-anchored from the campaign's `source_slug` to the **customer's lead source** (`lead_sources.slug`). The catch-all no longer vanishes from source rollups.
- Removed campaign→source ownership: `source_slug` (schema), `bindCampaignToSource` (router+hook), the Setup "bind to source" control, dead `listVoipCampaignsBySource`.

**Known minor (non-blocking, user said leave it):** Leads tab `status=eligible` + a campaign filter returns empty (eligible leads have no campaign). Defensible.

---

## NEXT WORK (in progress — investigation done, NO code written yet)

User asked to verify two business-logic points (and wants them built, but as a fresh design — "grill, don't do blindly"):

### 1. Setup tab is oriented backwards (confirmed)
- Current ([cloudtalk-sync-card.tsx](../../src/features/campaigns-admin/ui/components/setup/cloudtalk-sync-card.tsx) + [campaign-binding-row.tsx](../../src/features/campaigns-admin/ui/components/setup/campaign-binding-row.tsx)) is **campaign-anchored**: one row per campaign, pick a source inside it.
- Should be **source-anchored**: one row per lead source with a `[Default campaign ▼]` picker. Pure UI flip — `setVoipDefaultCampaign(sourceSlug, campaignId)` already exists. No data-model change.

### 2. Auto-enroll is completely unwired (confirmed)
- `autoEnroll` (`lead_sources.voipConfigJSON.campaigns.autoEnroll`) is **stored/preserved but never READ**. `customerIntakeService.ingestLead` (called by the bina webhook `src/app/api/webhooks/bina/route.ts`) does NOT enroll.
- Bina live config: `enabled:true, autoEnroll:false, defaultCampaignId:56180409-… (=Converting Meta Ads)`. So bina has a default but auto-enroll is OFF and unwired → no meta lead is auto-enrolled.
- To deliver: (a) **wire** auto-enroll into the ingest path (after ingest, if source has autoEnroll + defaultCampaignId → enroll into default; gate chain already handles eligibility); (b) **expose** a per-source auto-enroll toggle + a mutation to set it (today only defaultCampaignId is settable via `setVoipDefaultCampaign`).

### Both converge: redesign Setup to **source-anchored rows** = `[source name] [Default campaign ▼] [Auto-enroll ☑]`, plus wire auto-enroll-on-ingest.

### 4 open design questions to grill BEFORE building:
1. **Scope** — auto-enroll only for bina/meta (the one webhook ingest path), or any source that ingests a new lead? (Other sources have `voip=null`.)
2. **Gate** — require `enabled` AND `autoEnroll`, or `autoEnroll` alone?
3. **Execution** — inline in webhook (adds CloudTalk latency/failure to ingest) vs. background job (non-blocking, non-fatal). Lean background.
4. **Retroactive** — flipping auto-enroll on enrolls only NEW leads going forward (existing eligible stay manual via "Enroll all"), or also sweep the current eligible pool? Lean new-only.

Recommended next step: run the `grill-me` skill on these 4, then `superpowers:writing-plans`, then execute subagent-driven on `main` (same as Task 11).

---

## How this was executed (repeat the pattern)

- **Mode:** `superpowers:subagent-driven-development` on `main` (user explicitly consented to no branch/PR; ship to prod after they verify, on their "push").
- **Per task:** dispatch a general-purpose subagent (sonnet for mechanical, opus for risky SQL) with the FULL task text pasted in + this critical context: **"NO test framework in this repo — verify via `pnpm tsc` + `pnpm lint` + a standalone read-only DB probe; NEVER `pnpm build`."** Then verify the diff / run a holistic opus review at the end.
- **Design first:** the user wants `grill-me` (one question at a time, with a recommendation) before any plan. They are decisive and momentum-oriented; don't over-ask.

## Gotchas / environment facts
- **`DATABASE_URL` in this checkout points at PROD.** `DATABASE_DEV_URL` = dev. Probe scripts using `process.env.DATABASE_URL` hit prod — keep them READ-ONLY (SELECT/COUNT). Runtime app picks DB by `NODE_ENV`.
- **tsx `__name is not a function`:** any script that imports the provider-config barrel (e.g. importing `cloudtalkClient` or the queries module transitively) throws under tsx/node v24. Workaround: probe with raw `drizzle+pg` + `sql` directly (import only pure helpers like `derivedPipelineWhere` / the status predicates), never the app service modules.
- **No automated tests** — `pnpm tsc` + `pnpm lint` + live probes are the verification discipline (CLAUDE.md). `pnpm db:push:dev` only (never `pnpm db:push` without explicit prod approval).
- **Conventions:** ONE component per file; named exports only; imports perfectionist-sorted; `if` bodies braced+newlined; business rules → central helpers (the new status lib is the canonical example).
- Stray working-tree noise (pre-existing, leave alone): `super-admin-auth-test.png`, `CLAUDE.local.md` (shows deleted), `docs/proposal/*.md`, `docs/voip-campaigns/*` untracked.

## Reference docs
- Plans: [2026-06-09-campaigns-per-customer-membership.md](2026-06-09-campaigns-per-customer-membership.md) (Tasks 1–10, shipped), [2026-06-11-canonical-lead-status.md](2026-06-11-canonical-lead-status.md) (committed, unpushed).
- Domain DOCS (updated this session): `src/shared/entities/voip-campaigns/DOCS.md` (#admin-binding now says "campaigns are pools").
- EPICs: `docs/plans/voip-campaigns/EPIC.md`, `docs/plans/voip/INTEGRATION-SEAM.md`.
