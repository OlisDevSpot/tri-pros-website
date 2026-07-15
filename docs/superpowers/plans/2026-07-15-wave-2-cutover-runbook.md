# Wave 2 Cutover Runbook (human-executed, per spec §4)

Child tables `customer_lead_attribution`, `customer_enrichment`, `proposal_incentives` +
2 new `proposals` columns + the Closed Vocabulary conversion of the last 4 legacy
Postgres enums to `text`. Prod still runs Wave-1's shape (child tables from that epic,
`customer_profiles` etc.) — this push is additive on top of it, not a rebuild.

## What the prod push actually contains

Confirmed via `git diff origin/main..HEAD -- src/shared/db/schema/`
(re-run this before executing if more schema commits have landed since).

**Expect in the `drizzle-kit push` plan:**

- **`CREATE TABLE customer_lead_attribution`** — 1:1 child on `customer_id`, capture
  metadata (`capture_json` etc.) for the funnel intake payload.
- **`CREATE TABLE customer_enrichment`** — 1:many child on `customer_id`, progressive
  funnel-enrichment rows.
- **`CREATE TABLE proposal_incentives`** — 1:many child on `proposal_id`, plus **2 CHECK
  constraints** (amount sign / scope shape — verify against
  `src/shared/db/schema/proposal-incentives.ts` at execution time).
- **`ALTER TABLE proposals ADD COLUMN final_tcp_cents`** (bigint, nullable —
  backfill-populated) and **`ADD COLUMN calc_version`** (integer, `NOT NULL DEFAULT 1`).
- **4× enum→text `ALTER COLUMN`** (Closed Vocabulary Standard, spec Addendum C):
  `proposals.status`, `proposals.kind`, `customers.pipeline`, `customers.lead_type`.
- **4× `DROP TYPE`**: `proposal_status`, `proposal_kind`, `customer_pipeline`,
  `lead_type`. Prod enum count: **23 → 19**.
- **ZERO `CREATE TYPE` statements** — any `CREATE TYPE` in the plan = abort (stale
  schema code).

**Any OTHER drop in the plan = abort immediately**, EXCEPT the 5 Wave-1 frozen blob
columns IF (and only if) the decision gate below has been explicitly resolved to "yes,
include them" before this push. See gate below.

### Decision gate — Wave-1 frozen-column drops

Wave 1 froze 5 blob columns for a one-release rollback window:
`customer_profile_json`, `property_profile_json`, `financial_profile_json`,
`agent_profile_json`, `voip_config_json`. IF, by the time this cutover executes, the
three outstanding Wave-1 smoke flows have been verified in prod —

- funnel intake
- agent settings (brand + headshot)
- campaigns admin source-policy card

— THEN these 5 columns may ride this push (delete the 5 `*Deprecated` properties from
schema first, so the push plan shows them as drops). Otherwise they wait for the Wave 3
push. **Ask Oliver at cutover time** — do not decide this unilaterally either way.

### Enum-conversion fallback (rehearsal-proven — expect to need this)

The 4 enum→text `ALTER COLUMN`s are **blocked by a partial unique index**:
`proposals_one_approved_initial_sale_per_meeting_idx` bakes an enum cast into its
stored predicate, and Postgres refuses to alter a column an index depends on. Dev
rehearsal hit this; `pnpm db:push:prod` (and the rehearsal-branch push) will very
likely fail on the cast step. If it does, run this exact sequence by hand (dev-proven,
verbatim — do not improvise the DROP TYPE order or the index rebuild):

```sql
DROP INDEX proposals_one_approved_initial_sale_per_meeting_idx;
ALTER TABLE proposals ALTER COLUMN status DROP DEFAULT;
ALTER TABLE proposals ALTER COLUMN status TYPE text USING status::text;
ALTER TABLE proposals ALTER COLUMN status SET DEFAULT 'draft';
ALTER TABLE proposals ALTER COLUMN kind DROP DEFAULT;
ALTER TABLE proposals ALTER COLUMN kind TYPE text USING kind::text;
ALTER TABLE proposals ALTER COLUMN kind SET DEFAULT 'initial-sale';
ALTER TABLE customers ALTER COLUMN pipeline DROP DEFAULT;
ALTER TABLE customers ALTER COLUMN pipeline TYPE text USING pipeline::text;
ALTER TABLE customers ALTER COLUMN pipeline SET DEFAULT 'active';
ALTER TABLE customers ALTER COLUMN lead_type TYPE text USING lead_type::text;
DROP TYPE proposal_status; DROP TYPE proposal_kind; DROP TYPE customer_pipeline; DROP TYPE lead_type;
CREATE UNIQUE INDEX proposals_one_approved_initial_sale_per_meeting_idx
  ON proposals (meeting_id) WHERE kind = 'initial-sale' AND status = 'approved';
```

After running this by hand, **re-run `pnpm drizzle-kit push` (or `db:push:prod`) and
require it converge** — the remaining plan (the 3 `CREATE TABLE`s + the 2 `ADD COLUMN`s
+ any gated Wave-1 drops) should apply cleanly, and a final re-run must report **"No
changes detected"**. Do not consider the push done until that final no-op confirmation.

## Pre-flight (local main, after PR merge, BEFORE deploy)

**Step 0: Verify drizzle target resolution**
- Confirm that `drizzle.config.ts` contains exactly one instance of `override: true`:
  ```bash
  grep -c 'override: true' drizzle.config.ts
  ```
  should output `2` (one comment mention + the config call). Prod pushes run via
  `pnpm db:push:prod` (`DRIZZLE_TARGET=prod drizzle-kit push`) — the env-axes
  convention (spec: `docs/superpowers/specs/2026-07-15-env-axes-design.md`). **Never**
  `NODE_ENV=production` to select the database; that axis is orthogonal (it gates
  app-level safety checks, not DB target). The prod cutover push runs from the MAIN
  checkout (no `.env.local`), so target resolution is unambiguous. Confirm this
  configuration before proceeding.

**Step 1: Rehearsal** — create a Neon branch off PRODUCTION. Project
`polished-shape-00174668`, production branch `br-purple-field-afkq0ups` (via `mcp Neon
create_branch` or the console). Export `DATABASE_URL` pointing at the rehearsal branch
in the shell (a shell-exported `DATABASE_URL` wins over `.env`/`.env.local`
resolution). Then:

   a. `pnpm drizzle-kit push` against the REHEARSAL branch only. Verify the plan
      matches "What the prod push actually contains" above exactly: the 3
      `CREATE TABLE`s (+ 2 CHECKs on `proposal_incentives`), the `proposals` `ADD
      COLUMN` pair, the 4 enum→text conversions + 4 `DROP TYPE` (or the manual
      fallback sequence if the push fails on the cast — expect to need it), ZERO
      `CREATE TYPE` statements. **Any other drop, or any `CREATE TYPE` = stop, do not
      proceed to (b).** If the enum-conversion fallback was needed, confirm the
      re-run reaches "No changes detected" before moving on.

   b. `pnpm tsx scripts/backfill-wave2-children.ts --dry-run` then live run then
      re-run (idempotency) — require `mismatches=0` `errors=0` on every table, every
      run. `--skip-proposals` exists but is NOT used during rehearsal (rehearsal DB
      has no live writers yet — the hazard it guards against doesn't apply here); use
      it only at the post-deploy step.

      **Rehearsal notes (dev-verified figures below — PROD numbers may differ; treat
      these as the shape to expect, not exact counts):**

      - **`customers → customer_lead_attribution` / `customer_enrichment` split**: dev
        run showed `customers` line `written=137` (of which `customer_enrichment` rows
        = `50`) — most customers get an attribution row, a smaller subset also gets
        one-or-more enrichment rows depending on how many progressive-funnel steps they
        answered. A parity mismatch on either half fails the run.
      - **`proposals → proposal_incentives` + `final_tcp_cents`**: dev run showed
        `written=56`. Every proposal with `fundingJSON.data.incentives` entries gets
        corresponding `proposal_incentives` rows, and `final_tcp_cents` is recomputed
        and stored for every proposal touched (this is also the value the post-deploy
        SQL check verifies is non-null).
      - Overall dev sanity baseline: all backfill runs (dry-run, live, idempotent
        re-run) reported `mismatches=0 errors=0` across every table.

   c. Delete the rehearsal branch (ASK FIRST — never autonomous)

**Step 2: Prod cutover** (only after clean rehearsal)

   - `pnpm db:push:prod` — verify the plan one more time against "What the prod push
     actually contains" above before confirming. If it fails on the enum casts, run
     the manual fallback sequence above verbatim, then re-run `pnpm db:push:prod` and
     require it converge to "No changes detected".
   - Then `DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave2-children.ts`
     (dry-run first, then live). Do NOT pass `--skip-proposals` here — this is the
     pre-deploy backfill, writers haven't flipped yet, the full run (including
     proposals) is correct and required.
   - Then deploy

   Order matters: push + backfill BEFORE the deploy that flips reads/writes — old
   code ignores the new tables/columns; new code must never see empty attribution/
   enrichment/incentive tables for records that actually have the underlying data.

**Step 3: Post-deploy** — re-run the backfill **with `--skip-proposals`**:

```bash
DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave2-children.ts --skip-proposals
```

⚠️ **Never run a full (non-`--skip-proposals`) backfill after the deploy.** Writers
have flipped by this point — the proposals section of the script reads
`fundingJSON.data.incentives` off the blob, and a full re-run would overwrite live
`proposal_incentives` rows (created by the new writers) with stale blob data. The
customers-side tables (`customer_lead_attribution` / `customer_enrichment`) are safe to
re-run — they only catch writes that raced the deploy window — but proposals must be
verified by SQL instead:

```sql
SELECT count(*) FROM proposals WHERE final_tcp_cents IS NULL;
```

Must return `0`. Require `mismatches=0 errors=0` on the customers-side tables from the
`--skip-proposals` run, plus this SQL check returning `0`, before calling Step 3 done.

Then drive:
   - funnel intake → attribution + enrichment rows created in prod
   - progressive enrichment (answer a later funnel step for an existing lead) → a new
     `customer_enrichment` row upserted
   - customer profile page → Funnel Intake panel renders from the new rows
   - proposal edit → incentives section writes `proposal_incentives` rows + recomputes
     `final_tcp_cents`
   - proposals list → price/TCP sort reflects `final_tcp_cents`
   - proposal PDF + AI summary → both show discounts sourced from the row data
   - Zoho envelope creation on a draft proposal → context TCP matches
     `final_tcp_cents`
   - frozen-check: editing a sent-to-sign proposal's incentives → surfaces the
     `proposal_financials_frozen` error (financial mutation gate still enforced)

**Step 4: Next release** — drop `customers.lead_meta_json` (frozen this wave) and, if
the Wave-1 decision gate above resolved to "wait", the 5 deferred Wave-1 blob columns
too. Don't re-derive the full kill list here — it's tracked in
`docs/plans/jsonb-decomposition-deprecation-ledger.md` ("Wave 2 — frozen/scaffolding"
section); work that ledger at release time instead of duplicating it in this runbook.

## Rollback story

- `customers.lead_meta_json` is frozen, not dropped, for one release — if the new
  attribution/enrichment path has a problem, the old blob data is still physically
  present and readable.
- `fundingJSON.data.incentives` values in *already-existing* proposal rows are
  untouched by this push; only NEW writes blank the blob array (writers move to
  `proposal_incentives` rows going forward, per the deprecation ledger's "bridges that
  die in W3" section — the blob isn't wiped retroactively).
- Neon PITR is the backstop for anything not covered by the above (enum→text
  conversions and the dropped types are the least reversible part of this push — PITR
  is the only path back if that goes wrong after the `DROP TYPE`s commit).
