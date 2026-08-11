# Wave 3 Cutover Runbook (human-executed, per spec §4)

Epic #256 (JSONB decomposition), Wave 3 (scalar decomposition — funding/formMeta
scalars + the six W1/W2 frozen blob drops + the `signing_request_id` rename). This
runbook is **paste-ready and Oliver-executed** — every line that mutates a real
database or triggers a deploy is run by hand, by Oliver, watching the output. No
agent runs any command in the "Prod ceremony" section autonomously. Verification
throughout this program is `pnpm tsc` + `pnpm lint` only — no full production
build is run as part of this ceremony.

## Where things stand (2026-08-11)

- Tasks 1–11 of the implementation plan are complete on `main`. Scalars live
  (`starting_tcp_cents`, `deposit_amount_cents`, `cash_in_deal_cents`,
  `misc_price_cents`, `price_display_mode`, `envelope_document_ids`), the six
  frozen blob columns are TS-deprecated, and the drop-ceremony CODE commit
  (`6d5b705c`) has landed — the running prod code still expects the *old* schema
  shape (six extra columns, `signing_request_id`) until the DDL below runs.
- **Dev DB is fully cut over.** The dev-branch DDL (all 7 statements below) was
  applied on 2026-08-11 (Task 11, Step 3); `pnpm db:push:dev` confirmed **no
  changes** afterward — schema file and dev DB agree.
- **Prod is partially cut over.** The additive half of the prod ceremony already
  ran on 2026-08-11: `pnpm db:push:prod` (6 `ADD COLUMN` + 2 `DROP NOT NULL`,
  zero drops) and `scripts/backfill-wave3-scalars.ts` (dry-run → real → verified
  clean). **The manual drop/rename DDL has NOT run against prod, and prod has
  NOT been deployed past `6d5b705c`.** Sections 3–4 below are what's still live.

## 1. Pre-flight

Run on `main`, before touching anything prod-side:

```bash
pnpm tsc && pnpm lint
```

Expect: `pnpm tsc` clean (0 errors); `pnpm lint` exactly 1 pre-existing error at
`src/trpc/server.ts:6` (trailing space, not ours — anything else is a stop).

- **Tripwire log check**: grep recent dev/prod logs for `[scrub-blob-incentives]`.
  The scrub mechanism itself was deleted in Task 9 (dead code, zero callers as of
  `a9f5539b`), so this should be structurally impossible now — but if a stale log
  line turns up, treat it as a signal an unknown writer existed before the
  mechanism's removal and escalate before proceeding.
- **#256/#279 glance**: skim the epic (#256) and its Wave-3 sub-issue (#279) on
  the board for any open comment or blocking note that hasn't made it into this
  runbook or the deprecation ledger.

## 2. Neon rehearsal (branch from PROD)

Recommended before the prod ceremony, even though dev already rehearsed this
DDL shape — the dev branch and prod have diverged in row *content* (different
customers/proposals), and the rehearsal's job is to catch drift specific to
prod's actual data, not to re-prove the DDL syntax.

1. Create a Neon branch off **production** (Neon MCP `create_branch`, or the
   Neon console).
2. Point a `DRIZZLE_TARGET=prod`-style URL override at the branch (export
   `DATABASE_URL` for the branch in your shell — a shell-exported `DATABASE_URL`
   wins over `.env`/`.env.local` resolution; see `drizzle.config.ts`). **Never**
   run this against the real prod URL in this step.
3. `pnpm drizzle-kit push` against the branch — review the plan: 6 `ADD COLUMN`
   + 2 `DROP NOT NULL`, zero drops, zero `CREATE TYPE`. (This step mirrors what
   already ran for real against prod on 2026-08-11 — the rehearsal branch starts
   from a fresh prod snapshot, so it replays the same additive push.)
4. `pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run` → then live → then
   re-run `--dry-run` again (idempotence check — the second dry-run must report
   zero drift).
5. Run the DDL block from §3 below against the rehearsal branch.
6. `pnpm tsc` (schema types still resolve — sanity only, this doesn't touch the
   branch).
7. `pnpm tsx scripts/recompute-final-tcp.ts --dry-run` — expect **zero drift**.
8. Delete the rehearsal branch (ask Oliver first — never delete a Neon branch
   autonomously).

**Only a clean rehearsal authorizes proceeding to §3.**

## 3. Prod ceremony (in one sitting)

### 3a. Already done (2026-08-11) — recorded for the ledger, not re-run

```bash
pnpm db:push:prod                                   # additive: 6 ADD COLUMN + 2 DROP NOT NULL — ran clean, no drops
DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run
DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts
```

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

**Step 1 — fresh drift re-check.** Rows may have changed since 2026-08-11 (new
proposals created, existing ones edited). Re-run the dry-run immediately before
touching DDL:

```bash
DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-wave3-scalars.ts --dry-run
```

Expect zero or near-zero drift (only rows touched since the 2026-08-11 run, and
even those should already carry columns written by the live app code — Task 8
made `setCashInDeal` a plain column write, so post-cutover rows never depended
on this backfill in the first place). If drift shows on rows that predate
2026-08-11, investigate before proceeding — do not run the live backfill again
without understanding why.

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

---

*Companion doc: `docs/superpowers/plans/2026-07-26-wave-3-scalar-decomposition.md`
(Task 12 is the source of this runbook's required sections). Prior-wave
precedent: `docs/superpowers/plans/2026-07-13-wave-1-cutover-runbook.md`,
`docs/superpowers/plans/2026-07-15-wave-2-cutover-runbook.md`.*
