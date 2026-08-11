# Wave 3 Ceremony — Execution-Day Walkthrough (2026-08-11)

> **What this is:** the paste-ready, top-to-bottom execution script for the Wave 3
> prod cutover, in the style of the W1/W2 runbooks. It distills the canonical
> runbook (`docs/plans/2026-07-26-wave-3-cutover-runbook.md`) down to what is
> **still live as of 2026-08-11, post-§3a-fix**. Rationale, hazard analysis, and
> the full parity-SQL appendix live in the canonical doc — this file is the one
> you scroll while executing. Every command is run **by Oliver, by hand**.

## Current state (verified by read-only inspection, 2026-08-11)

| | Dev DB | Prod DB |
|---|---|---|
| 6 scalar columns (`*_cents`, `price_display_mode`, `envelope_document_ids`) | ✅ | ✅ |
| Backfill (0 NULLs in money columns) | ✅ 60/60 | ✅ 100/100 |
| Blobs `funding_JSON`/`form_meta_JSON` nullable | ✅ | ✅ (§3a-fix, 2026-08-11) |
| Rename `signing_request_id` → `contract_envelope_id` | ✅ | ⬜ **this ceremony** |
| 6 W1/W2 blob columns dropped | ✅ | ⬜ **this ceremony** |
| App deployed past drop-ceremony commit `6d5b705c` | n/a | ⬜ **this ceremony** |

**What this ceremony is, in one sentence:** 7 DDL statements in the Neon prod
SQL console, followed immediately by `git push` (which deploys `main`). No
backfills, no data movement — all data migration is complete and verified.

**Code preconditions (already true, re-confirm in Step 1):** prod's deployed
commit is ≥ `a9f5539b` (writer flip live) and < `6d5b705c` (drop-ceremony code
not yet deployed). `main` is unpushed and holds everything through the runbook
corrections.

---

## Step 0 — Shell + targeting sanity

Work from the **main checkout** (not a worktree — worktree `.env.local` files
can hijack `DATABASE_URL` resolution; see canonical runbook §2 "Targeting
mechanism").

- [ ] `cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website`
- [ ] `ls .env.local` → should not exist (or must not define `DATABASE_URL`)
- [ ] Every `DRIZZLE_TARGET=prod` command below prints a `DB target:` /
      `DB host:` banner — **read it every time before trusting output**.
      Prod host: `ep-flat-wind-afvc0zla-pooler.c-2.us-west-2.aws.neon.tech`.

## Step 1 — Pre-flight

- [ ] Verification gate (already run clean 2026-08-11; cheap to re-run):

  ```bash
  pnpm tsc && pnpm lint
  ```

  Expect: `tsc` 0 errors; `lint` no NEW errors vs baseline (known pre-existing:
  `src/trpc/server.ts:6` trailing spaces).

- [ ] **Vercel commit pin** (dashboard → deployments): the LIVE deployment's
      commit must be ≥ `a9f5539b` and < `6d5b705c`. If it's earlier than
      `a9f5539b` → **STOP**, the §3a ordering assumption is broken; ping Claude.

- [ ] **Tripwire log grep** (Vercel logs): search recent prod logs for
      `scrub-blob-incentives` → expect zero hits. While there, also search
      `23502` / `violates not-null constraint` → any hit = a proposal-create
      that failed during the pre-§3a-fix window (failed loudly, no corruption —
      just know who to follow up with).

## Step 2 — Neon rehearsal (recommended, ~15 min)

A disposable branch of real prod data proves the exact DDL + aftermath. The
additive push and backfill are NOT rehearsed — they already ran for real.

- [ ] 1. Neon console → create a branch off **production**, current state.
- [ ] 2. `export DATABASE_URL='<rehearsal branch connection string>'` — eyeball
      it: it must NOT be the real prod URL.
- [ ] 3. Drift check against the branch:

  ```bash
  DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run
  ```

  Read the `DB host:` banner — must be the **branch** host. Expect: zero drift
  on rows untouched since 2026-08-11; drift ONLY on rows edited since (that's
  the live writer-flip code working — expected, not a problem).

- [ ] 4. Parity proof against the branch: paste **Appendix A** from the
      canonical runbook (all 4 blocks) into the branch's SQL console. Every
      count must be **0** (the enrichment sanity probe may be > 0 — that one is
      annotated).
- [ ] 5. Paste the DDL block (Step 3.3 below, all 7 statements) into the
      branch's SQL console. All must succeed.
- [ ] 6. Push-parity proof:

  ```bash
  DRIZZLE_TARGET=prod pnpm drizzle-kit push
  ```

  Against the branch, post-DDL. Expect: **`No changes detected`**. Anything
  else = the manual DDL and the Drizzle schema disagree → **STOP**, investigate
  before the real ceremony.

- [ ] 7. Recompute sanity:

  ```bash
  DRIZZLE_TARGET=prod pnpm tsx scripts/recompute-final-tcp.ts --dry-run
  ```

  Expect: zero drift.

- [ ] 8. Spot-check in the branch SQL console:

  ```sql
  SELECT contract_envelope_id FROM proposals LIMIT 1;  -- rename took
  SELECT table_name, column_name FROM information_schema.columns
  WHERE column_name IN ('customer_profile_json','property_profile_json',
    'financial_profile_json','lead_meta_json','agent_profile_json','voip_config_json');
  -- expect zero rows
  ```

- [ ] 9. Delete the rehearsal branch (Neon console).
- [ ] 10. **`unset DATABASE_URL`** — critical; a lingering export silently
      redirects the next `DRIZZLE_TARGET=prod` command.

**Only a clean rehearsal authorizes Step 3.**

## Step 3 — Prod ceremony (one sitting, low-traffic window)

Everything below happens back-to-back. Between 3.3 (DDL) and 3.4 (deploy
live), full-row reads on `proposals`, `customers`, `"user"`, and `lead_sources`
will 500 with Postgres `42703` — **expected, self-resolves when the deploy is
live, not a rollback signal**. Keep the gap as short as physically possible.

- [ ] **3.1 Parity proof on real prod** — paste Appendix A (canonical runbook)
      into the Neon **prod** SQL console. Every count **0**. Any non-zero →
      **STOP**, ping Claude with the output.

- [ ] **3.2 Final drift dry-run:**

  ```bash
  DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run
  ```

  Banner must show the real prod host. Same reading as the rehearsal: drift
  only on since-edited rows = healthy. Drift on untouched rows = **STOP**.
  ⚠️ Never run this script live (non-`--dry-run`) against prod again — ever.
  It would overwrite fresh column data with stale frozen-blob data.

- [ ] **3.3 The DDL** — Neon **prod** SQL console. Never via `drizzle-kit push`
      (the rename would render as DROP+ADD and destroy the column's data):

  ```sql
  ALTER TABLE proposals RENAME COLUMN signing_request_id TO contract_envelope_id;
  ALTER TABLE customers DROP COLUMN customer_profile_json;
  ALTER TABLE customers DROP COLUMN property_profile_json;
  ALTER TABLE customers DROP COLUMN financial_profile_json;
  ALTER TABLE customers DROP COLUMN lead_meta_json;
  ALTER TABLE "user" DROP COLUMN agent_profile_json;
  ALTER TABLE lead_sources DROP COLUMN voip_config_json;
  ```

  Note the moment you run it (PITR restore-window bookkeeping — Neon
  point-in-time recovery is the last-resort backstop).

- [ ] **3.4 Deploy — immediately:**

  ```bash
  git push
  ```

  `main` is the deploy trigger. Watch the Vercel build; the `42703` window
  closes the instant the new deployment is live.

## Step 4 — Post-deploy verification

- [ ] Drift + recompute checks (both `--dry-run`, both expect the same healthy
      signatures as before):

  ```bash
  DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run
  DRIZZLE_TARGET=prod pnpm tsx scripts/recompute-final-tcp.ts --dry-run
  ```

- [ ] **Smoke drive** in prod (real or disposable test data):
  1. Create a proposal from a meeting.
  2. Edit + save in both price-display modes (total / breakdown).
  3. Generate the PDF.
  4. Generate the AI summary.
  5. Assemble a Zoho envelope.
  6. View through a share-token link.
  7. `setCashInDeal` on a draft proposal.
  8. Lock a proposal (send to sign) → editing any frozen money field must be
     rejected with the `proposal_frozen` precondition-failed error.

  Any failure = live-prod incident: stop, escalate, don't continue the list.

- [ ] Optional final belt-and-suspenders: re-run the untracked comparison
      script — dev and prod should now be structurally identical on every
      watched column:

  ```bash
  pnpm tsx scripts/tmp-db-state-compare.ts
  ```

## Step 5 — Aftercare

- [ ] `git stash drop stash@{0}` (`task11-review-temp-stash`) once satisfied
      your editor state is intact.
- [ ] Human-run T6 open item: `pnpm tsx scripts/verify-assemble-envelope.ts
      <email>` + delete the Zoho draft it creates.
- [ ] Delete `scripts/tmp-db-state-compare.ts` (untracked, read-only) whenever.
- [ ] Tell Claude to delete the SDD workspace
      (`.superpowers/sdd/2026-07-26-wave-3-scalar-decomposition/`).
- [ ] Comment on #279 / #256 that the Wave-3 prod cutover is complete (the W1
      precedent comment format on #256 works well).
- [ ] `scripts/backfill-wave3-scalars.ts` stays (drift-check tool, `--dry-run`
      only). `fundingJSONDeprecated` / `formMetaJSONDeprecated` and their
      frozen columns stay — Wave 4 (SOW normalization) drops them; kill
      triggers are registered in the deprecation ledger.

---

*Canonical companion: `docs/plans/2026-07-26-wave-3-cutover-runbook.md`
(rationale, targeting mechanism, Appendix A parity SQL). Prior-wave precedent:
`docs/superpowers/plans/2026-07-13-wave-1-cutover-runbook.md`,
`docs/superpowers/plans/2026-07-15-wave-2-cutover-runbook.md`.*
