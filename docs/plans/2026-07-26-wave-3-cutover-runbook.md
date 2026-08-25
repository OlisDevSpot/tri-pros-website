# Wave 3 Cutover Runbook (human-executed, per spec §4)

Epic #256 (JSONB decomposition), Wave 3 (scalar decomposition — funding/formMeta
scalars + the six W1/W2 frozen blob drops + the `signing_request_id` rename). This
runbook is **paste-ready and Oliver-executed** — every line that mutates a real
database or triggers a deploy is run by hand, by Oliver, watching the output. No
agent runs any command in the "Prod ceremony" section autonomously. Verification
throughout this program is `pnpm tsc` + `pnpm lint` only — no full production
build is run as part of this ceremony.

> ✅ **CEREMONY COMPLETE 2026-08-24/25.** `origin/main` = `2e3e84ac`; §3b DDL (rename +
> 6 drops) applied to prod via `pnpm db:push:prod`; deploy-first ordering; all
> post-checks green. Everything below is historical rationale + Appendix A.
> Execution record: `docs/plans/2026-08-11-wave-3-ceremony-walkthrough.md` addendum.

> ⚠️ **SUPERSEDED IN PART (2026-08-11, git-ancestry check):** this section's
> claim that prod is "already past the writer flip" is **false** — `a9f5539b`
> was never pushed; `origin/main` = `8c0ce467` (pre-Wave-3). Prod still writes
> the blobs. Consequences: the backfill must be RE-RUN live immediately before
> the DDL (not "never again" — that rule only activates after the deploy), and
> the deploy ships the writer flip and drop ceremony together. Execution order
> is now owned by `docs/plans/2026-08-11-wave-3-ceremony-walkthrough.md` (v2);
> this doc remains canonical for rationale, targeting, and Appendix A.

## Where things stand (2026-08-11 — historical; see banner above)

- Tasks 1–11 of the implementation plan are complete on `main`. Scalars live
  (`starting_tcp_cents`, `deposit_amount_cents`, `cash_in_deal_cents`,
  `misc_price_cents`, `price_display_mode`, `envelope_document_ids`), the six
  frozen blob columns are TS-deprecated, and the drop-ceremony CODE commit
  (`6d5b705c`) has landed on `main` (not yet deployed — see below).
- **Prod's deployed application code is already past the writer flip** — this
  is the important, easy-to-misread fact for §3b. Confirm the exact deployed
  commit via the Vercel dashboard before starting the ceremony; it must be
  **≥ `a9f5539b`** (Task 8 — `setCashInDeal` became a plain `cash_in_deal_cents`
  write, the last functional blob writer) and **< `6d5b705c`** (Task 11's
  drop-ceremony commit ships together with the DDL, in §3b Step 3, not before).
  With ≥ `a9f5539b` live, prod's read/write path already treats the six scalar
  columns as truth — it does **not** "expect the old schema" in any functional
  sense. The one place the old shape still matters: the *currently-deployed*
  Drizzle schema object still also declares the six frozen blob columns (as
  `*Deprecated` properties, present on any full-row `SELECT`) and still reads
  `signing_request_id` by that name. That narrow surface — not the write
  path — is what the DDL→deploy gap in §3b Step 3 is about.
- **Dev DB is fully cut over.** The dev-branch DDL (all 7 statements below) was
  applied on 2026-08-11 (Task 11, Step 3); `pnpm db:push:dev` confirmed **no
  changes** afterward — schema file and dev DB agree.
- **Prod is partially cut over.** The additive half of the prod ceremony already
  ran on 2026-08-11: `pnpm db:push:prod` (6 `ADD COLUMN` + 2 `DROP NOT NULL`,
  zero drops) and `scripts/backfill-wave3-scalars.ts` (dry-run → real → verified
  clean). **The manual drop/rename DDL has NOT run against prod, and prod has
  NOT been deployed past `6d5b705c`.** *(As of 2026-08-24/25: both done — see banner.)*

## 1. Pre-flight

Run on `main`, before touching anything prod-side:

```bash
pnpm tsc && pnpm lint
```

Expect: `pnpm tsc` clean (0 errors); `pnpm lint` shows no NEW errors vs
`main`'s current baseline (as of this writing, that baseline is a single
pre-existing `src/trpc/server.ts:6` trailing-space error — but treat "no new
errors" as the actual gate, not a fixed count, since the baseline shifts as
other work lands on `main`).

- **Tripwire log check**: grep recent dev/prod logs for `[scrub-blob-incentives]`.
  The scrub mechanism itself was deleted in Task 9 (dead code, zero callers as of
  `a9f5539b`), so this should be structurally impossible now — but if a stale log
  line turns up, treat it as a signal an unknown writer existed before the
  mechanism's removal and escalate before proceeding.
- **#256/#279 glance**: skim the epic (#256) and its Wave-3 sub-issue (#279) on
  the board for any open comment or blocking note that hasn't made it into this
  runbook or the deprecation ledger.

## 2. Neon rehearsal (branch from PROD)

Recommended immediately before the prod ceremony. **This is not a rehearsal of
the additive push** — that already ran for real against prod on 2026-08-11
(§3a). A branch cut from *current* prod inherits the 6 scalar columns already
backfilled. Pushing the current (post-Task-11) Drizzle schema against such a
branch would diff the **destructive** set (6 `DROP COLUMN` + the rename
expressed as DROP+ADD) — exactly the hazard §3b's "never via `drizzle-kit
push`" rule exists to prevent, and it would destroy the branch's
`signing_request_id` data before you ever get to rehearse the rename. So: no
`drizzle-kit push` before the DDL in this rehearsal, ever. The rehearsal's only
job is the thing that hasn't run yet — the manual DDL and its aftermath —
against a disposable copy of real prod data.

**Targeting mechanism — read before running anything.** Every command below
resolves its DB connection through `DRIZZLE_TARGET`: `drizzle.config.ts` uses
`DATABASE_URL` only when `DRIZZLE_TARGET=prod` (`process.env.DATABASE_DEV_URL`
otherwise — `drizzle.config.ts:22`); the same selection logic lives in
`src/shared/db/index.ts` and every CLI script under `scripts/` (via
`@/shared/config/server-env`). There is no separate `DATABASE_PROD_URL`
variable to set — the only lever is overriding `DATABASE_URL` itself, and
`DRIZZLE_TARGET=prod` must be present on **every** command in this section. A
bare `pnpm drizzle-kit push` or `pnpm tsx scripts/backfill-wave3-scalars.ts`
run with `DRIZZLE_TARGET` unset silently resolves `DATABASE_DEV_URL` — the
real, shared dev database — with no error, only a `describeTargetDb()` banner
line (`DB target: (unset → dev)` / `DB host: ...`) as the sole tell. **Read
that banner on every command in this rehearsal before trusting the output** —
don't rely on the export alone.

Whether an exported `DATABASE_URL` actually reaches the branch instead of the
real prod URL in `.env` is not a config guarantee to assume — verify it live,
every time, via the banner / push preview:
- `drizzle.config.ts` loads `.env.local` with `override: true` first, then
  `.env` without override. `scripts/lib/load-env.ts` and
  `@/shared/config/server-env` both load `.env.local` then `.env` with **no**
  override on either call. dotenv never clobbers an already-set `process.env`
  var *unless* `override: true` is passed **and** the loaded file actually
  defines that key.
- Today, in the main checkout (no `.env.local` present at all —
  `ls .env.local` → not found), an exported `DATABASE_URL` survives every one
  of these loads, confirmed by direct test against this repo's `dotenv`
  version. But this is a property of *today's untracked `.env.local` state*,
  not of the config file — the moment anyone's `.env.local` (a worktree's,
  most likely) defines `DATABASE_URL`, `drizzle.config.ts`'s `override: true`
  load would silently win over your export. Run this rehearsal from the main
  checkout, and still check the banner — don't take the mechanism on faith.

Steps (branch already additive + backfilled — do not re-push or re-backfill):

1. Create a Neon branch off **production**, current state (Neon MCP
   `create_branch`, or the Neon console).
2. `export DATABASE_URL='<rehearsal branch connection string>'` in your shell
   for this session. Eyeball it — confirm it is NOT the real prod URL — before
   proceeding.
3. Confirm the branch's starting state is drift-free (it should be — it
   inherited the 2026-08-11 backfill):
   ```bash
   DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run
   ```
   Read the printed `DB host:` line and confirm it's the branch, not real prod
   or dev. Expect the same "drift only on rows edited since 2026-08-11"
   signature described in §3b Step 1 — not flat zero, since the branch carries
   real prod row history.
4. Run the DDL block from §3b Step 2 directly against the branch — via `psql`
   or the Neon SQL console, exactly as the real ceremony will (never via
   `drizzle-kit push`). If §3a-fix (the two `DROP NOT NULL`s) has not yet run
   against real prod, the branch inherits the `NOT NULL` — run the §3a-fix
   statements against the branch first, or step 5's `No changes detected`
   expectation will fail on the nullability diff.
5. `DRIZZLE_TARGET=prod pnpm drizzle-kit push` against the branch, **now that
   the DDL has already applied the schema by hand** — expect **`No changes
   detected`**. Anything else means the manual DDL and the current Drizzle
   schema have drifted from each other; investigate before trusting the real
   ceremony to behave the same way.
6. `pnpm tsc` (schema types resolve — sanity only, doesn't touch the branch).
7. `DRIZZLE_TARGET=prod pnpm tsx scripts/recompute-final-tcp.ts --dry-run` —
   expect **zero drift**.
8. Spot-check the branch directly:
   ```sql
   SELECT contract_envelope_id FROM proposals LIMIT 1;  -- rename took
   ```
   and confirm via `information_schema.columns` that the six dropped columns
   no longer appear on `customers`, `"user"`, `lead_sources`.
9. Delete the rehearsal branch (ask Oliver first — never delete a Neon branch
   autonomously).
10. `unset DATABASE_URL` before doing anything else in this shell — a
    lingering branch export would silently redirect the next
    `DRIZZLE_TARGET=prod` command away from real prod (or fail with a
    connection error once the branch is gone) instead of hitting the intended
    target.

**Only a clean rehearsal authorizes proceeding to §3.**

## 3. Prod ceremony (in one sitting)

### 3a. Already done (2026-08-11) — recorded for the ledger, not re-run

```bash
pnpm db:push:prod                                   # additive: 6 ADD COLUMN + 2 DROP NOT NULL — ran clean, no drops
DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run
DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts
```

> ⚠️ **CORRECTION (2026-08-11, read-only prod inspection):** the record above is
> wrong about the `2 DROP NOT NULL` — `information_schema` shows prod's
> `funding_JSON` and `form_meta_JSON` are **still `NOT NULL`** (no default),
> while dev is correctly nullable. The additive push evidently applied only the
> `ADD COLUMN`s. **This is a live hazard, not a ceremony detail**: any code at
> or past the writer flip (≥ `a9f5539b`) omits both blobs on INSERT — proposal
> *creation* hits a `23502` NOT-NULL violation the moment such code serves a
> create. Run §3a-fix below **immediately**, independent of the rest of the
> ceremony.

### 3a-fix. DROP NOT NULL completion — ✅ DONE 2026-08-11 (Oliver-authorized, applied + verified)

Applied against prod (`ep-flat-wind-...`) on 2026-08-11 with Oliver's explicit
authorization; `information_schema` verification confirmed both columns now
`is_nullable=YES`. The §2 rehearsal-branch caveat in step 4 above is moot for
branches cut after this point. Recorded statements:

```sql
ALTER TABLE proposals ALTER COLUMN "funding_JSON" DROP NOT NULL;
ALTER TABLE proposals ALTER COLUMN "form_meta_JSON" DROP NOT NULL;
```

Verify:

```sql
SELECT column_name, is_nullable FROM information_schema.columns
WHERE table_name = 'proposals' AND column_name IN ('funding_JSON', 'form_meta_JSON');
-- both must show YES
```

Then check Vercel logs for recent `23502` / `violates not-null constraint`
errors on proposal creation — if any user hit this window, their create failed
loudly (no silent corruption; the INSERT was rejected whole).

**Why this had to run before the code that serves prod traffic** (finding C
from the Task 7 review, carried forward): `applyEnvelopeContext` writes the new
`envelope_document_ids` column instead of the `formMetaJSON` blob. On a prod row
where the column is still `NULL` and the blob is still populated, that code path
recomputes the agent's envelope-document selection **from an empty column** and
persists it — silently destroying data that only existed in the blob, because
nothing left reads the blob to recover it. Running the backfill first, so every
row has the column populated before the writer-flip code goes live, is the hard
gate. This is why the backfill had to precede the deploy, not follow it, even
though the DDL/rename/drops (§3b) can still happen at deploy time. This gate is
now satisfied — verified clean on both dev and prod on 2026-08-11.

### 3b. Live — run in this order, back-to-back, in one sitting

**Step 1 — pin the deployed commit, then a fresh drift re-check.**

Before touching anything, confirm via the Vercel dashboard which commit prod
is actually running: it must be **≥ `a9f5539b`** (Task 8 — `setCashInDeal`
flipped to a plain `cash_in_deal_cents` write, the last functional blob
writer) and **< `6d5b705c`** (Task 11's drop-ceremony commit — it deploys in
Step 3 below, in this same sitting, not before). If prod is somehow still on
an earlier commit, **stop** — the backfill-before-writer-flip ordering
constraint from §3a isn't actually satisfied regardless of what the backfill
script reported, and the rest of this section assumes it is.

With that confirmed, run the pre-drop parity proof (Appendix A below — the
drop protocol's step 2, read-only SQL in the Neon console; expect every check
to return 0), then re-run the drift dry-run:

```bash
DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run
```

**How to read the result — this compares live columns against the FROZEN
blob, and with post-flip code confirmed live, drift is expected, not a
problem:**
- Rows **untouched since the 2026-08-11 backfill** must show zero drift
  (nothing has written either side since). Drift here is the anomaly —
  investigate before proceeding.
- Rows **edited since then**, through the live app, will show drift **by
  design**: the column has a fresh value from the deployed writer-flip code,
  the blob is stale and frozen (zero writers since that deploy). That drift
  is proof the cutover is working, not something to chase down or "fix."

**The live backfill must never be run again against prod, under any
circumstances, from this point forward.** It is cutover-window-only (see the
script's own header comment) — a real run now would silently overwrite fresh
column data with stale blob values on every row edited since 2026-08-11: wrong
prices, wrong envelope-document selections, no error to alert you. `--dry-run`
is the only safe mode here and in §4, permanently.

**Step 2 — manual DDL** (Neon SQL console — **never via `drizzle-kit push`**;
a `RENAME COLUMN` expressed as a Drizzle schema diff is a `DROP` + `ADD`, which
would silently destroy the column's data):

```sql
-- manual DDL (Neon SQL console) — NEVER via drizzle push (rename = DROP+ADD hazard)
ALTER TABLE proposals RENAME COLUMN signing_request_id TO contract_envelope_id;
ALTER TABLE customers DROP COLUMN customer_profile_json;
ALTER TABLE customers DROP COLUMN property_profile_json;
ALTER TABLE customers DROP COLUMN financial_profile_json;
ALTER TABLE customers DROP COLUMN lead_meta_json;
ALTER TABLE "user" DROP COLUMN agent_profile_json;
ALTER TABLE lead_sources DROP COLUMN voip_config_json;
```

**Step 3 — deploy `main` immediately after.** Trigger the deploy the moment the
DDL commits — do not leave a gap.

**Expected error window, and why it covers all 7 statements, not just the
rename**: the currently-deployed prod code's Drizzle schema still enumerates
the six dropped columns (as `*Deprecated` properties, selected on any full-row
read) and still reads `signing_request_id`. Between the DDL committing and the
new deploy finishing, **any full-row `SELECT` against `customers`, `"user"`,
`lead_sources`, or `proposals` will fail** with Postgres error `42703` (`column
"..." does not exist`), surfacing to the app as 500s / tRPC internal-server
errors on those four entities — not just on the renamed column. This is
expected and self-resolves the instant the new deploy is live; it is not a
signal to roll back mid-window. Keep the DDL-to-deploy gap as short as
physically possible and run it at a low-traffic time.

**PITR window**: per the drop protocol (`docs/plans/jsonb-decomposition-deprecation-ledger.md`
§"Column-drop protocol") — Neon Point-in-Time Recovery is the backstop for
anything not covered by the frozen-column safety net. The six columns dropped
here were already frozen for a full release cycle (zero writers, backfill-
verified clean) before this DDL runs, so PITR is a last-resort path, not the
primary safety mechanism — but note the window regardless in case a problem
surfaces after the drop commits.

## 4. Post-deploy verification

```bash
DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run   # drift report vs frozen blobs — expect zero on untouched rows
DRIZZLE_TARGET=prod pnpm tsx scripts/recompute-final-tcp.ts --dry-run      # expect zero drift
```

Then the smoke drive, in prod, against real (or a disposable test) data:

1. Create a proposal from a meeting.
2. Edit + save it in both price-display modes (total / breakdown).
3. Generate the PDF.
4. Generate the AI summary.
5. Assemble a Zoho envelope.
6. View it through a share-token link.
7. Call `setCashInDeal` on a draft proposal.
8. Lock a proposal (send it to sign, or whatever this account's lock trigger
   is) and confirm editing any of the six frozen-then-dropped fields' modern
   equivalents is rejected with the `proposal_frozen` precondition-failed error
   (`ThrowableDalError` in `entities/proposals/dal/server/mutations.ts`).

Any failure here is a live-prod incident, not a runbook checklist item — stop
and escalate per normal incident process rather than continuing down this list.

## 5. Aftercare

- Ledger check-offs: Task 13 in the implementation plan does the
  `docs/plans/jsonb-decomposition-deprecation-ledger.md` bookkeeping pass for
  everything this ceremony killed. Don't hand-edit the ledger from this
  runbook — that task owns it.
- `proposals.fundingJSON` / `proposals.formMetaJSON` **survive this ceremony.**
  They were frozen (TS-deprecated, zero writers) back in earlier Wave 3 tasks,
  but this drop ceremony's scope is the six Wave-1/Wave-2 columns
  (`customer_profile_json`, `property_profile_json`, `financial_profile_json`,
  `lead_meta_json`, `agent_profile_json`, `voip_config_json`) plus the
  `signing_request_id` → `contract_envelope_id` rename — **not** the
  funding/formMeta blobs. Those two columns are Wave 4 scope (SOW
  normalization); they now live on with their own W4 kill triggers registered
  in the ledger.
- `scripts/backfill-wave3-scalars.ts` is **retained**, not deleted — it's the
  drift-check tool going forward (its own header comment already documents
  this: post-deploy, only `--dry-run` is safe; a live re-run would overwrite
  column data with stale blob data).
- `scripts/tmp-check-funding-blob-keys.ts` is an untracked, read-only diagnostic
  script (used to answer a one-off business-rule question during Task 7 review
  — see `progress.md`, 2026-08-11 ruling entries). It may be deleted once this
  ceremony is confirmed clean; it has no ledger obligations and was never
  wired into any script/CI path.

## Appendix A — Pre-drop data-parity proof (drop-protocol step 2)

Read-only SQL, paste into the Neon SQL console against **prod** (and/or the §2
rehearsal branch) immediately before §3b Step 2. Every count must be **0**
unless annotated otherwise. Two caveats on how to read results:

- **Presence, not equality.** The W1 backfill normalized legacy enum values and
  legacy key names (`LEGACY_ENUM_MAP` / `normalizeLegacyKeys`) — value-equality
  diffs between blob and column can be benign normalization. The real loss
  signal is a **populated blob field whose promoted home is NULL**.
- These checks supplement (not replace) the primary guarantee: prod backfills
  ran + were re-run post-deploy at the W1 (2026-07-13) and W2 (2026-07-15)
  cutovers with built-in parity checks, and the blobs have had **zero writers
  since** — every write surface `.omit()`s them (seam-audit "CLEAN" section of
  the deprecation ledger), so parity as-of-verification cannot have decayed.

```sql
-- ── A1. customers: three profile blobs → customer_profiles child row ──
-- Populated blob (ignoring nulls; 'age' excluded — it lives on customers) with no child row:
SELECT count(*) AS missing_child_rows
FROM customers c
LEFT JOIN customer_profiles p ON p.customer_id = c.id
WHERE p.customer_id IS NULL
  AND (
    coalesce(jsonb_strip_nulls(c.customer_profile_json), '{}'::jsonb) - 'age' <> '{}'::jsonb
    OR coalesce(jsonb_strip_nulls(c.property_profile_json), '{}'::jsonb) <> '{}'::jsonb
    OR coalesce(jsonb_strip_nulls(c.financial_profile_json), '{}'::jsonb) <> '{}'::jsonb
  );

-- age promoted onto customers itself:
SELECT count(*) AS age_unpromoted
FROM customers
WHERE (customer_profile_json ->> 'age') IS NOT NULL AND age IS NULL;

-- Per-field presence sweep (blob field populated, promoted column NULL):
SELECT count(*) AS unpromoted_profile_fields
FROM customers c
JOIN customer_profiles p ON p.customer_id = c.id
WHERE (c.customer_profile_json ->> 'triggerEvent'                          IS NOT NULL AND p.trigger_event IS NULL)
   OR (c.customer_profile_json #>> '{mainPainPoint,accessor}'              IS NOT NULL AND p.main_pain_accessor IS NULL)
   OR (c.customer_profile_json #>> '{mainPainPoint,urgencyRating}'         IS NOT NULL AND p.main_pain_urgency IS NULL)
   OR (jsonb_array_length(coalesce(c.customer_profile_json -> 'additionalPainPoints', '[]'::jsonb)) > 0
                                                                            AND p.additional_pain_points IS NULL)
   OR (c.customer_profile_json ->> 'outcomePriority'                       IS NOT NULL AND p.outcome_priority IS NULL)
   OR (c.customer_profile_json ->> 'timeInHome'                            IS NOT NULL AND p.time_in_home IS NULL)
   OR (c.customer_profile_json ->> 'householdType'                         IS NOT NULL AND p.household_type IS NULL)
   OR (c.customer_profile_json ->> 'priorContractorExperience'             IS NOT NULL AND p.prior_contractor_experience IS NULL)
   OR (c.customer_profile_json ->> 'constructionOutlookFavorabilityRating' IS NOT NULL AND p.construction_outlook_favorability_rating IS NULL)
   OR (c.customer_profile_json ->> 'sellPlan'                              IS NOT NULL AND p.sell_plan IS NULL)
   OR (c.customer_profile_json ->> 'decisionTimeline'                      IS NOT NULL AND p.decision_timeline IS NULL)
   OR (c.customer_profile_json ->> 'projectNecessityRating'                IS NOT NULL AND p.project_necessity_rating IS NULL)
   OR (c.customer_profile_json ->> 'ageGroup'                              IS NOT NULL AND p.age_group IS NULL)
   OR (c.property_profile_json ->> 'hoa'                                   IS NOT NULL AND p.hoa IS NULL)
   OR (c.property_profile_json ->> 'yearBuilt'                             IS NOT NULL AND p.year_built IS NULL)
   OR (c.property_profile_json ->> 'roofType'                              IS NOT NULL AND p.roof_type IS NULL)
   OR (c.property_profile_json ->> 'foundationType'                       IS NOT NULL AND p.foundation_type IS NULL)
   OR (c.property_profile_json ->> 'hvacType'                              IS NOT NULL AND p.hvac_type IS NULL)
   OR (c.property_profile_json ->> 'hvacComponents'                        IS NOT NULL AND p.hvac_components IS NULL)
   OR (c.property_profile_json ->> 'windowsType'                           IS NOT NULL AND p.windows_type IS NULL)
   OR (c.property_profile_json ->> 'insulationLevel'                       IS NOT NULL AND p.insulation_level IS NULL)
   OR (c.financial_profile_json ->> 'numQuotesReceived'                    IS NOT NULL AND p.num_quotes_received IS NULL)
   OR (c.financial_profile_json ->> 'creditScore'                          IS NOT NULL AND p.credit_score IS NULL);
-- Caveat: legacy-KEYED blobs (pre-normalizeLegacyKeys key names) are invisible to
-- this sweep — they were handled and verified by the W1 backfill at cutover time.

-- ── A2. customers.lead_meta_json → customer_lead_attribution (+ customer_enrichment) ──
-- Populated blob with no attribution row (capture_json holds the FULL immutable
-- LeadMeta snapshot minus source.enrichment, so the blob survives verbatim there):
SELECT count(*) AS leadmeta_without_attribution
FROM customers c
LEFT JOIN customer_lead_attribution a ON a.customer_id = c.id
WHERE coalesce(jsonb_strip_nulls(c.lead_meta_json), '{}'::jsonb) <> '{}'::jsonb
  AND a.customer_id IS NULL;

-- Sanity probe FIRST (guards the next check against a silently-wrong JSON path):
-- expect > 0 if any pre-W2 funnel leads carried enrichment.
SELECT count(*) AS blobs_with_enrichment
FROM customers WHERE lead_meta_json #> '{source,enrichment}' IS NOT NULL;

-- Blob enrichment present but no enrichment rows:
SELECT count(*) AS enrichment_unmigrated
FROM customers c
WHERE c.lead_meta_json #> '{source,enrichment}' IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM customer_enrichment e WHERE e.customer_id = c.id);

-- ── A3. "user".agent_profile_json → flat user columns ──
SELECT count(*) AS unpromoted_agent_fields
FROM "user" u
WHERE (u.agent_profile_json ->> 'quote'             IS NOT NULL AND u.quote IS NULL)
   OR (u.agent_profile_json ->> 'bio'               IS NOT NULL AND u.bio IS NULL)
   OR (u.agent_profile_json ->> 'yearsOfExperience' IS NOT NULL AND u.years_of_experience IS NULL)
   OR (jsonb_array_length(coalesce(u.agent_profile_json -> 'tradeSpecialties', '[]'::jsonb)) > 0 AND u.trade_specialties IS NULL)
   OR (jsonb_array_length(coalesce(u.agent_profile_json -> 'languagesSpoken', '[]'::jsonb)) > 0 AND u.languages_spoken IS NULL)
   OR (jsonb_array_length(coalesce(u.agent_profile_json -> 'certifications', '[]'::jsonb)) > 0 AND u.certifications IS NULL)
   OR (u.agent_profile_json ->> 'headshotUrl'       IS NOT NULL AND u.headshot_url IS NULL)
   OR (u.agent_profile_json -> 'headshotCropData'   IS NOT NULL AND u.headshot_crop_data IS NULL);

-- ── A4. lead_sources.voip_config_json → flat columns + voip_inhouse_config_json ──
SELECT count(*) AS unmigrated_voip_fields
FROM lead_sources ls
WHERE ((ls.voip_config_json #>> '{campaigns,enabled}')::boolean IS DISTINCT FROM ls.voip_campaigns_enabled
       AND ls.voip_config_json #> '{campaigns,enabled}' IS NOT NULL)
   OR ((ls.voip_config_json #>> '{campaigns,autoEnroll}')::boolean IS DISTINCT FROM ls.voip_auto_enroll
       AND ls.voip_config_json #> '{campaigns,autoEnroll}' IS NOT NULL)
   OR (ls.voip_config_json #>> '{campaigns,defaultCampaignId}'    IS NOT NULL AND ls.default_campaign_id IS NULL)
   OR (ls.voip_config_json #>> '{campaigns,dailyDialVolumeCap}'   IS NOT NULL AND ls.daily_dial_volume_cap IS NULL)
   OR (ls.voip_config_json #> '{campaigns,messageTemplateOverrides}' IS NOT NULL AND ls.message_template_overrides_json IS NULL)
   OR (ls.voip_config_json #> '{inHouse}'                         IS NOT NULL AND ls.voip_inhouse_config_json IS NULL);
```

The rename (`signing_request_id` → `contract_envelope_id`) needs no parity
proof — `ALTER TABLE ... RENAME COLUMN` is metadata-only, zero data movement.

---

*Companion doc: `docs/superpowers/plans/2026-07-26-wave-3-scalar-decomposition.md`
(Task 12 is the source of this runbook's required sections). Prior-wave
precedent: `docs/superpowers/plans/2026-07-13-wave-1-cutover-runbook.md`,
`docs/superpowers/plans/2026-07-15-wave-2-cutover-runbook.md`.*
