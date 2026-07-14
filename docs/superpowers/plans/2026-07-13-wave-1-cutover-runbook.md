# Wave 1 Cutover Runbook (human-executed, per spec §4)

Rewritten 2026-07-14 for the child-table shape (Addendum B, epic #259). PR #260 (the
original wide-column Wave-1 build) was never cut over to prod — prod still has none of
this epic's schema. The branch was reworked in place, so prod goes **blobs → child
tables** in a single push, not blobs → wide columns → child tables. There is no
pre-drop Notion snapshot step: Oliver ruled `customers.notion_contact_id`'s data pure
legacy (Notion retired as CRM system of record) — the prod push simply drops the
column, no export required.

## What the prod push actually contains

Every commit in this epic (#256/#259) is unmerged to `origin/main` as of this rewrite
— the push described below is the FULL cumulative diff, not an incremental follow-up
to an earlier Wave-1 push. Confirmed via `git diff origin/main..HEAD -- src/shared/db/schema/`
(re-run this before executing if more schema commits have landed since).

**Expect in the `drizzle-kit push` plan:**

- **`CREATE TABLE customer_profiles`** — 1:1 child table, PK-as-FK on `customer_id`,
  26 columns total (`customer_id`, the 23 moved discovery/property/financial fields,
  `created_at`, `updated_at`).
- **`ADD COLUMN` on `user`** (8 new columns): `quote`, `bio`, `years_of_experience`,
  `trade_specialties`, `languages_spoken`, `certifications`, `headshot_url`,
  `headshot_crop_data`. (`agent_profile_json` is unchanged physically — only its
  Drizzle type annotation changed to mark it deprecated.)
- **`ADD COLUMN` on `customers`** (1 new column): `age`. (The three profile blobs —
  `customer_profile_json` / `property_profile_json` / `financial_profile_json` — are
  unchanged physically, only re-typed `*Deprecated` in code. The 23 moved fields never
  land on `customers` at all in this rework — they go straight to `customer_profiles`.)
- **`ADD COLUMN` on `lead_sources`** (6 new columns): `voip_campaigns_enabled`,
  `voip_auto_enroll`, `default_campaign_id` (real FK → `voip_campaigns.id`),
  `daily_dial_volume_cap`, `message_template_overrides_json`,
  `voip_inhouse_config_json`. (`voip_config_json` unchanged physically, re-typed
  deprecated.)
- **`CREATE TYPE`** for 16 new pgEnums: `trigger_event`, `outcome_priority`,
  `years_in_home`, `household_type`, `prior_contractor_experience`, `sell_plan`,
  `decision_timeline`, `customer_age_group`, `year_built_range`,
  `credit_score_range`, `roof_type`, `foundation_type`, `hvac_type`,
  `hvac_component`, `windows_type`, `insulation_level`.
- **`DROP COLUMN customers.notion_contact_id` + its unique constraint** — pre-existing
  pending drop (code already dropped it in commit `14dbd44b`, merged to `origin/main`
  well before this epic; prod's live schema just hasn't caught up yet). Bundled into
  this push because it's the same `db:push`, not because this epic depends on it.
  **No snapshot step precedes this** — the data is legacy and Oliver ruled it doesn't
  need preserving.

**Any OTHER drop in the plan = abort immediately** and investigate before proceeding.

Frozen for one release (zero writers, read only by the backfill script, dropped in a
follow-up mini-push — see Step 5): `customer_profile_json`, `property_profile_json`,
`financial_profile_json`, `agent_profile_json`, `voip_config_json` — 5 blob columns.

## Pre-flight (local main, after PR merge, BEFORE deploy)

**Step 0: Verify drizzle target resolution**
- Confirm that `drizzle.config.ts` contains exactly one instance of `override: true`:
  ```bash
  grep -c 'override: true' drizzle.config.ts
  ```
  should output `2` (one comment mention + the config call). This branch fixed
  drizzle-kit to preload `.env` (Neon uses `DATABASE_URL` from `.env`), but
  `.env.local` overrides only work in worktrees with `override: true`. The prod
  cutover push runs from the MAIN checkout (no `.env.local`), so `pnpm db:push`
  resolves `DATABASE_URL` from `.env` as always. Confirm this configuration before
  proceeding.

**Step 1: Rehearsal** — create a Neon branch off PRODUCTION (`mcp Neon create_branch`
or console), then export `DATABASE_URL` pointing at it in the shell (a shell-exported
`DATABASE_URL` wins: `drizzle.config.ts` only overrides from `.env.local` — which
doesn't define `DATABASE_URL` — and the plain `.env` load never overwrites an
already-set var). Then:

   a. `pnpm drizzle-kit push` against the REHEARSAL branch only. Verify the plan
      matches "What the prod push actually contains" above exactly: `CREATE TABLE
      customer_profiles`, the three `ADD COLUMN` batches (user/customers/lead_sources),
      16 `CREATE TYPE` statements, and the single `notion_contact_id` drop + its
      unique constraint. **Any other drop = stop, do not proceed to (b).**

   b. `pnpm tsx scripts/backfill-wave1-columns.ts --dry-run` then live run then
      re-run (idempotency) — require `mismatches=0` `errors=0` on every table, every
      run.

      **Rehearsal notes (dev-verified figures below — PROD numbers may differ; treat
      these as the shape to expect, not exact counts):**

      - **Legacy-enum + legacy-key mapping**: the backfill logs `↷` lines for
        customers whose blob data uses a retired enum label (`LEGACY_ENUM_MAP`)
        or a dead pre-Zod blob KEY (`normalizeLegacyKeys` — `decisionUrgencyRating`
        salvaged into `decisionTimeline`, `familyStatus` dropped; rulings 2026-07-14
        in PR #260). The 2026-07-14 rehearsal (exact dev clone) showed **7 distinct
        customer rows, 15 log lines**. Review every `↷` against the documented
        sets; any value NOT in a map, or an 8th distinct row, means new legacy
        data appeared since the last audit — **stop and extend the map**.
      - **`customers → customer_profiles` child-row split**: the backfill prints a
        dedicated line, `customers → customer_profiles: written=<n> skipped=<n>
        wouldWrite=<n>`. Dev showed `written=23 skipped=10` — 23 of the 33 customers
        with blob data got a `customer_profiles` child row; the other 10 had data
        only in `age` (no row created — row-exists on `customer_profiles` is a real
        signal, not every customer gets one). Gate: `mismatches=0 errors=0` on the
        `customers` line covers both the `age` write and the child-row write; a
        parity mismatch on either half fails the run.
      - **`user` / `agentProfileJSON`**: the dev snapshot skips `agentProfileJSON`,
        so the users backfill path first touches real data on the rehearsal branch.
        Prod has exactly 1 of 8 users with a profile (2026-07-13 audit). After
        rehearsal backfill completes, manually:
        ```sql
        SELECT id, name, quote, bio, headshot_url, headshot_crop_data
          FROM "user" WHERE agent_profile_json IS NOT NULL LIMIT 1;
        ```
        Eyeball that user's `quote`, `bio`, `headshot_url`, and `headshot_crop_data`
        values against the original blob to confirm the decomposition preserved all
        data.

   c. Delete the rehearsal branch (ASK FIRST — never autonomous)

**Step 2: Prod cutover** (only after clean rehearsal)

   - `pnpm db:push` (THE deliberate prod push) — verify the plan one more time
     against "What the prod push actually contains" above before confirming.
   - Then `pnpm tsx scripts/backfill-wave1-columns.ts` with `NODE_ENV=production`
     wiring per `memory/feedback-runtime-db-env`
   - Then deploy

   Order matters: push + backfill BEFORE the deploy that flips reads/writes — old
   code ignores the new columns/table; new code must never see an empty
   `customer_profiles` table for a customer that actually has discovery data.

**Step 3: Post-deploy** — re-run the backfill once more (catches writes that raced
the deploy window — blob writers existed until this deploy), require `mismatches=0
errors=0`. Then drive:
   - funnel intake
   - meeting-flow profile edit (writes to `customer_profiles` via
     `customersRouter.profile.upsert`)
   - customer edit form (both the age field on `Customer` and the profile fields on
     `CustomerProfile` — two separate CASL-gated mutations firing together)
   - agent settings (brand + headshot)
   - campaigns admin source-policy card

**Step 4: Next release** — drop the 5 frozen `*_deprecated` blob columns
(`customer_profile_json`, `property_profile_json`, `financial_profile_json`,
`agent_profile_json`, `voip_config_json`) from schema (their own mini-push).
