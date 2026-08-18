# Wave 3 Ceremony — Execution-Day Walkthrough (2026-08-11, v3 re-verified 2026-08-18)

> **What this is:** the paste-ready, top-to-bottom execution script for the Wave 3
> prod cutover, in the style of the W1/W2 runbooks. Every command is run **by
> Oliver, by hand**. Rationale and the parity-SQL appendix live in the canonical
> runbook (`docs/plans/2026-07-26-wave-3-cutover-runbook.md`).
>
> **v2 correction (2026-08-11):** v1 and the canonical runbook assumed prod was
> already deployed past the writer flip (`a9f5539b`). **Git ancestry proves it is
> not**: `origin/main` sits at `8c0ce467` — the entire Wave 3 (and the S6b tRPC
> commits) is unpushed. Prod runs pre-Wave-3 code; **the blobs are still the
> written source of truth on prod**. This *simplifies* the ceremony back to the
> classic W1/W2 shape — backfill → DDL → deploy, one sitting — and it flips the
> drift semantics: the backfill **must** be re-run live right before the DDL
> (blob→column sync), and only becomes forbidden *after* the deploy.

> **v3 re-verification (2026-08-18, read-only):** ceremony not yet run; prod
> gained **18 customers + 2 meetings, 0 proposals** since 8/11 (22 customers
> edited, 0 proposals edited). Findings, all SELECT-only against prod:
> - `backfill-wave3-scalars --dry-run`: **98 scanned, 0 drift** (no proposal
>   touched since the 8/11 backfill — every `updated_at` is the 8/11 run).
> - `recompute-final-tcp --dry-run`: zero drift.
> - Appendix A: all **0** except `unpromoted_profile_fields = 4` (exactly the 4
>   legacy-`householdType` rows of 3.3b — by design, PR #260) and the
>   annotated `blobs_with_enrichment = 28` sanity probe. **v2 said "every
>   count 0" — that was stale; 4/28 is the correct expected reading.**
> - W1/W2 blobs: **zero** new rows carry blob data (writers flipped in July;
>   counts unchanged at 62/48/48/418, 1, 3). Drops remain loss-free.
> - Schema: `git diff 187df9e2..HEAD -- src/shared/db/schema` empty and
>   `pnpm db:push:dev` → `No changes detected` ⇒ the DDL set is **still the
>   exact 7 statements** you saw on 8/11. Vercel build is plain `next build`
>   (no migration step). No new env vars since `origin/main`.
> - `pnpm tsc` 0 errors, `pnpm lint` exit 0 (warnings only) on the tree.
> - **Neon backstop:** PITR retention on this project is **6 h**
>   (`history_retention_seconds: 21600`) and the plan allows **1 manual
>   snapshot**. Stale `pre-wave3-backfill-2026-08-11` was replaced by
>   `pre-wave3-ceremony-2026-08-18` (`snap-orange-bonus-af2ytmho`). Re-take
>   it at ceremony time — Step 3.0.
> - ⚠️ **Live hazard, do this soon:** prod (`8c0ce467`) already *reads* money
>   from the scalar columns (`toFundingInputs` → PDF/heading/Zoho) but still
>   *writes* the blobs with no column sync. It is coherent today only because
>   nothing edited a proposal since 8/11. Any proposal create/edit before the
>   ceremony shows stale/zero money until 3.2 runs.

## Current state (verified 2026-08-11, re-verified 2026-08-18: read-only DB inspection + git ancestry)

| | Dev DB | Prod DB |
|---|---|---|
| 6 scalar columns present | ✅ | ✅ |
| Scalar backfill | ✅ complete | ✅ **zero drift as of 2026-08-18** — but pre-flip prod code still writes blobs, so re-run in 3.2 anyway (idempotent; catches any edit between now and then) |
| Blobs `funding_JSON`/`form_meta_JSON` nullable | ✅ | ✅ (§3a-fix, 2026-08-11) |
| Rename `signing_request_id` → `contract_envelope_id` | ✅ | ⬜ **this ceremony** |
| 6 W1/W2 blob columns dropped | ✅ | ⬜ **this ceremony** |
| Writer-flip + drop-ceremony code deployed | n/a | ⬜ **this ceremony** (`git push` deploys all of it at once) |

**The ceremony in one sentence:** re-take the Neon snapshot, re-run the
backfill (blob→column sync), `git push` and wait for the deploy to go live,
then immediately run `pnpm db:push:prod` (answering the rename prompt with
**renamed**) — one sitting.

**What the push deploys:** everything on local `main` past `8c0ce467` — as of
2026-08-18 that is **70 commits**: the Wave-3 chain, S6a/S6b/**S7** tRPC
standardization (createEntityRouter deleted), projects standardization
phase 1, CRUD-DAL sub-plan A (config-factory), data-table refresh/pull-to-
refresh, dialog fix, and runbook docs. Be deliberate: this deploy is not
Wave-3-only — Step 4.3 smokes the extra surface. Your uncommitted WIP stays
local. A Vercel **build failure** is data-safe (deploy-first: the DDL hasn't
run yet; prod stays on old code) — fix forward, don't touch the DB.

**Commit-pin check (already done via git, no dashboard needed):**
`a9f5539b` ∉ `origin/main`, `6d5b705c` ∉ `origin/main` → prod is pre-flip;
backfill-before-flip ordering is satisfied by construction, since the flip
deploys in this ceremony's own push.

---

## Step 0 — Shell + targeting sanity

Work from the **main checkout** (worktree `.env.local` files can hijack
`DATABASE_URL` resolution — canonical runbook §2).

- [ ] `cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website`
- [ ] `ls .env.local` → should not exist (or must not define `DATABASE_URL`)
- [ ] Every `DRIZZLE_TARGET=prod` command prints a `DB target:` / `DB host:`
      banner — **read it every time**. Prod host:
      `ep-flat-wind-afvc0zla-pooler.c-2.us-west-2.aws.neon.tech`.

## Step 1 — Pre-flight

- [ ] `pnpm tsc && pnpm lint` — expect: tsc 0 errors; lint no NEW errors
      (known baseline: `src/trpc/server.ts:6` trailing spaces).
- [ ] Confirm nothing unexpected rides the push: `git log --oneline
      origin/main..HEAD` — 70 commits as of 2026-08-18 (Wave-3 chain, S6/S7
      tRPC, projects phase 1, crud-dal sub-plan A, data-table, docs); nothing
      surprising. `git status` must show your WIP as unstaged/untracked only.
- [ ] Confirm the DDL set is unchanged: `git diff --stat 187df9e2..HEAD --
      src/shared/db/schema` → empty; `pnpm db:push:dev` → `No changes
      detected`. (Both true 2026-08-18.)
- [ ] Glance at Vercel: latest production deployment corresponds to
      `origin/main` (`8c0ce467`) and is healthy — i.e., pushing main is the
      only deploy lever in play.

## Step 2 — Neon rehearsal (optional as of 2026-08-18, ~15 min)

A disposable branch of real prod data proves the full sequence — including the
live backfill re-run, which is part of the real ceremony this time. You
already saw the real prod prompt on 8/11 (7 statements, rename rendered
correctly) and the DDL set is provably unchanged, so this is now optional;
still the cheapest way to warm up the keystrokes if you want it.

- [ ] 1. Neon console → create a branch off **production**, current state.
- [ ] 2. `export DATABASE_URL='<rehearsal branch connection string>'` —
      eyeball it: NOT the real prod URL.
- [ ] 3. Drift check (banner must show the **branch** host):

  ```bash
  DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run
  ```

  Expect: drift only on proposals edited since the 2026-08-11 backfill —
  fresh **blob**, stale **column** (prod writers are pre-flip). That drift is
  exactly what the next step erases.

- [ ] 4. Live backfill on the branch:

  ```bash
  DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts
  ```

  Then `--dry-run` again → expect **zero drift**.

- [ ] 5. Parity proof: paste **Appendix A** (canonical runbook) into the
      branch's SQL console → every count **0** except
      `unpromoted_profile_fields = 4` (the 3.3b legacy rows) and
      `blobs_with_enrichment = 28` (sanity probe).
- [ ] 6. The DDL via drizzle (dry-run of Step 3.5 — same command, branch
      target thanks to the exported `DATABASE_URL`):

  ```bash
  pnpm db:push:prod
  ```

  This is the rehearsal's most important moment — it shows you the EXACT
  interactive session prod will give you:
  - the **rename prompt**: "`contract_envelope_id` created or renamed from
    `signing_request_id`?" → select **renamed** (emits `RENAME COLUMN`,
    data-preserving). Selecting "created" here would DROP+ADD and destroy
    the column data — this is the one keystroke that matters.
  - the 6 blob `DROP COLUMN`s flagged as data-loss → expected, approve.
  - **read the full statement list** (config is `verbose: true`): any
    statement outside the ceremony set (rename + 6 drops + additive enum
    values) → **STOP**, abort at the strict-mode confirm, ping Claude.

  Then verify: `SELECT contract_envelope_id FROM proposals LIMIT 1` returns
  data (rename preserved values), and re-running `pnpm db:push:prod` says
  **`No changes detected`**.

- [ ] 7. `DRIZZLE_TARGET=prod pnpm tsx scripts/recompute-final-tcp.ts --dry-run`
      → expect zero drift.
- [ ] 8. Spot-check:

  ```sql
  SELECT contract_envelope_id FROM proposals LIMIT 1;  -- rename took
  SELECT table_name, column_name FROM information_schema.columns
  WHERE column_name IN ('customer_profile_json','property_profile_json',
    'financial_profile_json','lead_meta_json','agent_profile_json','voip_config_json');
  -- expect zero rows
  ```

- [ ] 9. Delete the rehearsal branch (Neon console).
- [ ] 10. **`unset DATABASE_URL`** — a lingering export silently redirects the
      next `DRIZZLE_TARGET=prod` command.

**If you rehearse, only a clean rehearsal authorizes Step 3.** If you skip
it, Step 1's two checks (tsc/lint green, DDL set unchanged) are the gate.

## Step 3 — Prod ceremony (one sitting, low-traffic window)

Sequence: Neon snapshot → backfill sync → parity proof → legacy snapshot →
**push → deploy live → DDL** (deploy-first, decided 2026-08-11: new code tolerates the old DB except
for the rename — extra blob columns are invisible to Drizzle — so pushing
first shrinks the broken window from "four tables for the whole Vercel
build" to "proposals reads only, for the seconds between deploy-live and the
DDL"). Run 3.2 → 3.5 back-to-back; a prod blob edit landing between the
backfill (3.2) and deploy-live (3.4) would leave that row's scalars stale —
at current volume near zero risk, and 4.1's dry-run detects it.

Between the deploy going live (3.4) and the DDL (3.5), reads on `proposals`
will 500 with Postgres `42703` (`contract_envelope_id` doesn't exist yet) —
**expected, closes the moment the DDL runs, not a rollback signal**. Sit
ready and keep that gap to seconds.

- [ ] **3.0 Neon snapshot — the real backstop** (PITR here is only 6 h and the
      plan holds ONE manual snapshot, so replace, don't add). From the repo
      root, `neon` CLI 3.x is installed and `NEON_API_KEY`/`NEON_PROJECT_ID`
      live in `.env`:

  ```bash
  export $(grep -E "^NEON_(API_KEY|PROJECT_ID)=" .env | xargs)
  neon snapshots list --project-id "$NEON_PROJECT_ID"                       # see the current one
  neon snapshots delete <old-snapshot-id> --project-id "$NEON_PROJECT_ID"   # e.g. snap-orange-bonus-af2ytmho
  neon snapshots create --project-id "$NEON_PROJECT_ID" --branch production \
    --name "pre-wave3-ceremony-$(date -u +%Y-%m-%dT%H%MZ)"
  neon snapshots list --project-id "$NEON_PROJECT_ID"                       # exactly one, Created At = now
  ```

  Restore path if it ever comes to that (creates a `production (old)` copy
  first, so it is itself reversible):
  `neon snapshots restore <id> --project-id "$NEON_PROJECT_ID" --target-branch production`
  → inspect → `neon snapshots finalize production`.

- [ ] **3.1 Drift preview** (banner must show real prod host):

  ```bash
  DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run
  ```

  Expect **0 drift** unless a proposal was created/edited since 2026-08-18
  (blob fresh, column stale — those rows are what 3.2 syncs). Note how many
  rows it reports — 3.2 writes exactly those, then re-reads and field-diffs
  each one (built-in parity; non-zero failures = STOP).

- [ ] **3.2 Live backfill re-run** — the blob→column sync. Correct and safe
      **because prod code is pre-flip** (blobs are still the written truth):

  ```bash
  DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts
  ```

  Then `--dry-run` once more → **zero drift**. ⚠️ This is the LAST legitimate
  live run ever. The moment 3.4's deploy is live, writers flip to the columns
  and a live re-run would overwrite fresh column data with stale blob data —
  from then on, `--dry-run` only, permanently.

- [ ] **3.3 Parity proof on real prod** — paste Appendix A (canonical runbook)
      into the Neon **prod** SQL console (or
      `APPENDIX_DB_URL=<prod url> APPENDIX_SQL_FILE=<appendix-a.sql> pnpm tsx
      scripts/tmp-run-appendix-a.ts`, SELECT-only). Expected, verified
      2026-08-18: every count **0** except `unpromoted_profile_fields = 4`
      (the four legacy-`householdType` rows captured in 3.3b — 'Senior(s)'
      ×3, 'Empty nester(s)' ×1) and `blobs_with_enrichment = 28`. Any other
      non-zero, or a 5th unpromoted row → **STOP**, ping Claude with the
      output.

- [ ] **3.3b Legacy-value snapshot** — the 2026-08-11 four-agent audit proved
      the drops lose exactly 7 values on 5 customers: legacy enum strings
      Wave 1 intentionally ruled unmappable (PR #260), whose last copy lives
      in the blobs. Save this query's output to a local file before the DDL
      (Neon prod SQL console):

  ```sql
  SELECT id, customer_profile_json FROM customers WHERE id IN (
    'd48451df-20f7-42bc-87c4-aaf9284b0052',  -- householdType 'Senior(s)'
    '542185cf-38c2-4a6b-87ee-5fb48d94bfb7',  -- householdType 'Senior(s)'
    '3e5aca0f-4fe5-4019-9585-3c4c721416a2',  -- 'Senior(s)' + familyStatus 'Single man'
    '3c47d209-3077-4abd-8212-ca6278353812',  -- 'Empty nester(s)' + 'Single man'
    'b51854c8-5645-486a-acaa-23c08493767a'   -- familyStatus 'Couple'
  );
  ```

- [ ] **3.4 Deploy first:**

  ```bash
  git push
  ```

  Watch the Vercel build. The moment the new deployment is **live**,
  proposals reads start failing with `42703` — go straight to 3.5.

- [ ] **3.5 The DDL — via drizzle**, exactly like the rehearsal
      (Step 0 sanity holds: no `.env.local`, no lingering `DATABASE_URL`
      export; banner/host printed by the tool must be prod):

  ```bash
  pnpm db:push:prod
  ```

  Same interactive session as rehearsed:
  1. Rename prompt → **renamed** from `signing_request_id` ("created" here
     destroys the column data — this is the keystroke that matters).
  2. Statement list (verbose) must match the rehearsal: the rename, the 6
     blob `DROP COLUMN`s, plus any additive enum values seen in rehearsal.
     Anything else → abort at the strict confirm, ping Claude.
  3. Approve the data-loss confirm (the 6 drops are the ceremony).

  Note the timestamp (Neon PITR restore-window bookkeeping — last-resort
  backstop). Fallback if the interactive prompts misbehave: run the
  equivalent SQL by hand in the Neon prod console —

  ```sql
  ALTER TABLE proposals RENAME COLUMN signing_request_id TO contract_envelope_id;
  ALTER TABLE customers DROP COLUMN customer_profile_json;
  ALTER TABLE customers DROP COLUMN property_profile_json;
  ALTER TABLE customers DROP COLUMN financial_profile_json;
  ALTER TABLE customers DROP COLUMN lead_meta_json;
  ALTER TABLE "user" DROP COLUMN agent_profile_json;
  ALTER TABLE lead_sources DROP COLUMN voip_config_json;
  ```

  The `42703` window closes the instant the DDL commits.

## Step 4 — Post-deploy verification

- [ ] **4.1** Drift + recompute checks:

  ```bash
  DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run
  DRIZZLE_TARGET=prod pnpm tsx scripts/recompute-final-tcp.ts --dry-run
  ```

  Recompute: zero drift. Backfill dry-run: zero drift on untouched rows;
  drift appearing on rows edited **after** the deploy is the new normal
  (column fresh, blob frozen) — proof the cutover works. Drift on a row NOT
  edited post-deploy = a write raced the 3.2→3.4 window → ping Claude with
  the row id for a targeted one-row fix (do NOT re-run the backfill live).

- [ ] **4.2 Smoke drive** in prod (real or disposable test data):
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

- [ ] **4.3** Also smoke the non-Wave-3 surface riding the same deploy: S6/S7
      tRPC (customers / meetings / applications list-and-open, one each),
      **projects** (list + open + one edit — phase 1 rewired its DAL), a
      **records data-table** (sort default + pull-to-refresh on mobile), and
      one **meetings** create/edit (crud-dal sub-plan A moved its hooks).
      One action per surface is enough to catch a wiring break.

- [ ] **4.4** Optional: `pnpm tsx scripts/tmp-db-state-compare.ts` — dev and
      prod should now be structurally identical on every watched column.
      `pnpm tsx scripts/tmp-audit-prod-since-0811.ts` re-prints the row
      counts / blob-state tables (SELECT-only) if you want a last look.

## Step 5 — Aftercare

- [ ] `git stash drop stash@{0}` (`task11-review-temp-stash`) once satisfied.
- [ ] T6 open item: `pnpm tsx scripts/verify-assemble-envelope.ts <email>` +
      delete the Zoho draft it creates.
- [ ] Delete the untracked read-only helpers whenever:
      `scripts/tmp-db-state-compare.ts`, `scripts/tmp-audit-*.ts`,
      `scripts/tmp-run-appendix-a.ts`.
- [ ] Neon: the ceremony snapshot can stay (it's the only one and costs
      ~$0.004/mo); replace it at the next ceremony the same way (3.0).
- [ ] Tell Claude to delete the SDD workspace
      (`.superpowers/sdd/2026-07-26-wave-3-scalar-decomposition/`).
- [ ] Completion comment on #279 / #256 (W1's comment on #256 is the format
      precedent).
- [ ] Stays alive on purpose: `scripts/backfill-wave3-scalars.ts` (drift-check
      tool, `--dry-run` only from now on) and the frozen
      `funding_JSON`/`form_meta_JSON` columns (Wave 4 drops them; kill
      triggers registered in the deprecation ledger).

---

*Canonical companion: `docs/plans/2026-07-26-wave-3-cutover-runbook.md`
(rationale, targeting mechanism, Appendix A parity SQL — note its "deployed
past the writer flip" claims are superseded by this file's v2 correction).
Prior-wave precedent: `docs/superpowers/plans/2026-07-13-wave-1-cutover-runbook.md`,
`docs/superpowers/plans/2026-07-15-wave-2-cutover-runbook.md`.*
