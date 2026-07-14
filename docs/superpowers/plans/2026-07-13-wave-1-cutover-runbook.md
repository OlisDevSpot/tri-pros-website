# Wave 1 Cutover Runbook (human-executed, per spec §4)

## Pre-flight (local main, after PR merge, BEFORE deploy)

**Step 0: Verify drizzle target resolution**
- Confirm that `drizzle.config.ts` contains exactly one instance of `override: true`:
  ```bash
  grep -c 'override: true' drizzle.config.ts
  ```
  should output `2` (one comment mention + the config call). This branch fixed drizzle-kit to preload `.env` (Neon uses `DATABASE_URL` from `.env`), but `.env.local` overrides only work in worktrees with `override: true`. The prod cutover push runs from the MAIN checkout (no `.env.local`), so `pnpm db:push` resolves `DATABASE_URL` from `.env` as always. Confirm this configuration before proceeding.

**Step 1: Pre-drop Notion ID snapshot**
- `pnpm tsx scripts/snapshot-notion-contact-ids.ts` — run from the repo root on `main`, AFTER merging, reading PROD `DATABASE_URL`. Fresh pre-drop export of `customers.notion_contact_id` (Wave-1 prod push drops it — Notion retirement rider, commit 14dbd44b). Writes the JSON file next to cwd — move it somewhere safe immediately. (A 2026-07-13 snapshot, 83 rows, also exists locally as backup.)

**Step 2: Rehearsal** — create a Neon branch off PRODUCTION (`mcp Neon create_branch` or console), point `DATABASE_URL_OVERRIDE` at it, then:

   a. `pnpm drizzle-kit push` against the REHEARSAL branch only
      (verify the plan: adds 16 enums + 38 columns, DROPS `notion_contact_id` + its unique constraint, NOTHING else)

   b. `pnpm tsx scripts/backfill-wave1-columns.ts --dry-run` then live run then re-run (idempotency) — require `mismatches=0` `errors=0` all runs
      
      **Rehearsal rehearsal notes:**
      - The backfill will log `↷` legacy-enum mappings on customers (see `LEGACY_ENUM_MAP` in `scripts/backfill-wave1-columns.ts` — mapping decisions recorded in the Wave-1 PR). Expect ↷ lines covering exactly **7 distinct customer rows** (≈10 lines — several rows map two fields). Review each ↷ against the mapping decisions recorded in the Wave-1 PR; any ↷ value NOT in `LEGACY_ENUM_MAP`'s documented set, or an 8th distinct row, means new legacy data appeared since the 2026-07-13 audit — **stop and extend the map**.
      - The dev snapshot skips `agentProfileJSON`, so the users backfill path first touches real data HERE. Prod has exactly 1 of 8 users with a profile (2026-07-13 audit). After rehearsal backfill completes, manually:
        ```sql
        SELECT id, name, quote, bio, headshot_url, headshot_crop_data 
          FROM "user" WHERE agent_profile_json IS NOT NULL LIMIT 1;
        ```
        Eyeball that user's `quote`, `bio`, `headshot_url`, and `headshot_crop_data` values against the original blob to confirm the decomposition preserved all data.

   c. Delete the rehearsal branch (ASK FIRST — never autonomous)

**Step 3: Prod cutover** (only after clean rehearsal)

   - `pnpm db:push` (THE deliberate prod push)
   - Then `pnpm tsx scripts/backfill-wave1-columns.ts` with `NODE_ENV=production` wiring per `memory/feedback-runtime-db-env`
   - Then deploy
   
   **Prod-cutover rider:** The drizzle-kit push plan will show DROP COLUMN `notion_contact_id` + its unique constraint — this is EXPECTED and correct (commit 14dbd44b, Notion retirement rider). **Any OTHER drop in the plan = abort immediately.**
   
   Order matters: push + backfill BEFORE the deploy that flips reads/writes — old code ignores new columns; new code must never see empty columns.

**Step 4: Post-deploy** — re-run backfill once more (catches writes that raced the deploy window — blob writers existed until this deploy), require `mismatches=0`. Then drive:
   - funnel intake
   - meeting-flow profile edit
   - customer edit form
   - agent settings (brand + headshot)
   - campaigns admin source-policy card

**Step 5: Next release** — drop the three frozen blob columns + `agent_profile_json` + `voip_config_json` from schema (their own mini-push).
