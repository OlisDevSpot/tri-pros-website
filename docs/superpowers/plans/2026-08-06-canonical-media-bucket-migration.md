# Canonical Media Bucket Migration (Sub-plan 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate portfolio/project media onto a new canonical public R2 bucket `tpr-media` (served at the existing `media.triprosremodeling.com`), with zero URL breakage; leave proposal media and call recordings untouched.

**Architecture:** Rename the `portfolioProjects` bucket constant to `media` (`tpr-media`) and sweep all references; ship a paginated R2 copy script (`tpr-portfolio-projects` → `tpr-media`, same keys) and a DB backfill (`media_files.bucket` → `'tpr-media'`); provide an operator runbook for the Cloudflare bucket creation, CORS, and the atomic custom-domain move. Because the CDN domain name never changes and `get-optimized-urls` falls back to the `tpr-media` domain, render URLs never break — the only true gap is a seconds-long domain rebind, done in an off-hours window.

**Tech stack:** TypeScript · `@aws-sdk/client-s3` (R2, S3-compatible) · Drizzle + `pg` (Postgres/Neon) · `tsx` scripts · Cloudflare R2 + Wrangler.

## Global Constraints

- **Work on `main`; stage by explicit path** — never `git add -A`. Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **No `pnpm build`.** This repo has **no unit-test runner** — each task is verified with `pnpm tsc` + `pnpm lint`, and scripts additionally with a `--dry-run` run. Those ARE the tests; do **not** add a test framework or write `*.test.ts`.
- **Scripts** load env via `import './lib/load-env'` (never `dotenv/config`). DB scripts target prod **only** via `DRIZZLE_TARGET=prod` (unset = dev); never key on `NODE_ENV`.
- **`src/shared/**` must never import `@/features/**`.**
- **Do NOT touch `ROOTS.landing.portfolioProjects()`** — it is an unrelated route helper, not the bucket constant. **Do NOT touch any `R2_BUCKETS.homeownerFiles` usage** — that bucket stays (call recordings + proposal media, which moves in Sub-plan 2).
- **The implementer does NOT run the live cutover.** Tasks 1–3 produce code + scripts verified by tsc/lint/dry-run; Task 4 produces the operator runbook. The real copy, Vercel deploy, prod DB backfill, and Cloudflare domain move are executed by the user from the runbook.
- Canonical spec: `docs/superpowers/specs/2026-08-06-media-foundation-epic-design.md` (Sub-plan 1).

---

## File Structure

- `src/shared/services/providers/r2/types.ts` — **Modify.** Rename `R2_BUCKETS.portfolioProjects` → `media` (`'tpr-media'`); rename `R2_PUBLIC_DOMAINS` key `'tpr-portfolio-projects'` → `'tpr-media'`. Keep `homeownerFiles`, `companyDocs`.
- `src/shared/services/providers/r2/client.ts` — **Modify.** Add a paginated `listAllKeys(bucket, prefix?)` method (needed by the migration + reconciliation).
- `src/shared/services/media/stores.ts` — **Modify.** `projectMediaStore.bucket` → `R2_BUCKETS.media`. (`proposalMediaStore` unchanged.)
- `src/shared/lib/get-optimized-urls.ts` — **Modify.** `DEFAULT_R2_DOMAIN` hardcoded `'tpr-portfolio-projects'` → `'tpr-media'`.
- `src/trpc/routers/projects.router/google-drive.router.ts` — **Modify.** `PORTFOLIO_BUCKET` constant.
- `src/features/proposal-flow/ui/components/proposal/related-projects.tsx` — **Modify.** `PORTFOLIO_BASE` constant.
- `scripts/add-during-media.ts`, `scripts/portfolio-scraper/import-project.ts`, `scripts/backfill-media-url-domain.ts` — **Modify.** `R2_BUCKETS.portfolioProjects` → `R2_BUCKETS.media`.
- `scripts/migrate-r2-bucket.ts` — **Create.** Paginated copy `tpr-portfolio-projects` → `tpr-media` (same keys), idempotent, `--dry-run`.
- `scripts/backfill-media-bucket.ts` — **Create.** `UPDATE media_files SET bucket='tpr-media' WHERE bucket='tpr-portfolio-projects'`, `DRIZZLE_TARGET`-guarded, `--dry-run`.
- `docs/superpowers/plans/2026-08-06-canonical-media-bucket-RUNBOOK.md` — **Create.** Operator cutover runbook (Cloudflare + deploy + backfill sequence).

---

## Task 1: Rename the bucket constant to `media` (`tpr-media`) and sweep all references

**Files:**
- Modify: `src/shared/services/providers/r2/types.ts`
- Modify: `src/shared/services/media/stores.ts:22`
- Modify: `src/shared/lib/get-optimized-urls.ts:3`
- Modify: `src/trpc/routers/projects.router/google-drive.router.ts:14`
- Modify: `src/features/proposal-flow/ui/components/proposal/related-projects.tsx:13`
- Modify: `scripts/add-during-media.ts:23`
- Modify: `scripts/portfolio-scraper/import-project.ts:15`
- Modify: `scripts/backfill-media-url-domain.ts:39,42`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `R2_BUCKETS.media === 'tpr-media'`; `R2_PUBLIC_DOMAINS['tpr-media'] === 'https://media.triprosremodeling.com'`. `R2_BUCKETS.portfolioProjects` no longer exists. `R2_BUCKETS.homeownerFiles`/`companyDocs` unchanged. Tasks 2–3 rely on `R2_BUCKETS.media`.

- [ ] **Step 1: Rewrite `types.ts`**

Replace the constant + domain map (keep the file's top doc comment). New body:

```ts
export const R2_BUCKETS = {
  media: 'tpr-media',
  companyDocs: 'tpr-company-docs',
  homeownerFiles: 'tpr-homeowner-files',
} as const

export type R2BucketName = (typeof R2_BUCKETS)[keyof typeof R2_BUCKETS]

// Not all buckets have a public domain. `tpr-media` is the canonical PUBLIC
// media bucket (project + proposal assets) served via the production CDN.
// `homeownerFiles` stays PRIVATE (call recordings) → no public domain.
// pub-*.r2.dev is Cloudflare's rate-limited dev endpoint and must not carry
// production traffic (#160).
export const R2_PUBLIC_DOMAINS: Partial<Record<R2BucketName, string>> = {
  'tpr-media': 'https://media.triprosremodeling.com',
  'tpr-company-docs': 'https://pub-e9f58acecb564416a1d1880ba1a88a7f.r2.dev',
}
```

- [ ] **Step 2: Update `stores.ts:22`** — `projectMediaStore.bucket` only

```ts
  bucket: R2_BUCKETS.media,
```
(Leave `proposalMediaStore.bucket: R2_BUCKETS.homeownerFiles` at line 30 UNCHANGED — proposal media moves in Sub-plan 2.)

- [ ] **Step 3: Update `get-optimized-urls.ts:3`**

```ts
const DEFAULT_R2_DOMAIN = R2_PUBLIC_DOMAINS['tpr-media'] ?? ''
```

- [ ] **Step 4: Update `google-drive.router.ts:14`**

```ts
const PORTFOLIO_BUCKET = R2_BUCKETS.media
```

- [ ] **Step 5: Update `related-projects.tsx:13`**

```ts
const PORTFOLIO_BASE = R2_PUBLIC_DOMAINS[R2_BUCKETS.media] ?? ''
```

- [ ] **Step 6: Update the three scripts** — replace `R2_BUCKETS.portfolioProjects` with `R2_BUCKETS.media`

- `scripts/add-during-media.ts:23` → `const BUCKET = R2_BUCKETS.media`
- `scripts/portfolio-scraper/import-project.ts:15` → `const BUCKET = R2_BUCKETS.media`
- `scripts/backfill-media-url-domain.ts:39` → `const NEW_DOMAIN = R2_PUBLIC_DOMAINS[R2_BUCKETS.media]`
- `scripts/backfill-media-url-domain.ts:42` → the error string's `R2_BUCKETS.portfolioProjects` → `R2_BUCKETS.media`

- [ ] **Step 7: Verify the sweep is complete**

Run:
```bash
grep -rn --include='*.ts' --include='*.tsx' -e "R2_BUCKETS.portfolioProjects" -e "'tpr-portfolio-projects'" src scripts
```
Expected: **no output** (zero matches). `ROOTS.landing.portfolioProjects()` and `R2_BUCKETS.homeownerFiles` must still be present elsewhere — those are intentional and must NOT be changed.

- [ ] **Step 8: Typecheck + lint**

Run: `pnpm tsc && pnpm lint`
Expected: both clean. (A stale `portfolioProjects` key reference would fail tsc.)

- [ ] **Step 9: Commit**

```bash
git add src/shared/services/providers/r2/types.ts src/shared/services/media/stores.ts src/shared/lib/get-optimized-urls.ts src/trpc/routers/projects.router/google-drive.router.ts src/features/proposal-flow/ui/components/proposal/related-projects.tsx scripts/add-during-media.ts scripts/portfolio-scraper/import-project.ts scripts/backfill-media-url-domain.ts
git commit -m "$(cat <<'EOF'
refactor(r2): rename portfolioProjects bucket constant to canonical `media` (tpr-media)

Sub-plan 1 of the Media Foundation epic. projectMediaStore now targets
tpr-media; proposal media + call recordings (homeownerFiles) untouched.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add `r2Client.listAllKeys` + the R2 copy migration script

**Files:**
- Modify: `src/shared/services/providers/r2/client.ts`
- Create: `scripts/migrate-r2-bucket.ts`

**Interfaces:**
- Consumes: `R2_BUCKETS.media` (Task 1); `r2Client.copyObject({ sourceBucket, sourceKey, destBucket, destKey })` (existing).
- Produces: `r2Client.listAllKeys(bucket: R2BucketName, prefix?: string): Promise<string[]>` — every object key in a bucket, paginated. `scripts/migrate-r2-bucket.ts` (operator-run at cutover).

- [ ] **Step 1: Add `ListObjectsV2Command` to the import + the method in `client.ts`**

Add `ListObjectsV2Command` to the existing `@aws-sdk/client-s3` import (line 5). Add this method inside the `r2Client` object (e.g. after `getObject`):

```ts
  /** List every object key in a bucket (optionally under a prefix), paginated. */
  listAllKeys: async (bucket: R2BucketName, prefix?: string): Promise<string[]> => {
    const keys: string[] = []
    let continuationToken: string | undefined
    do {
      const res = await s3.send(new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }))
      for (const obj of res.Contents ?? []) {
        if (obj.Key) {
          keys.push(obj.Key)
        }
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (continuationToken)
    return keys
  },
```

- [ ] **Step 2: Create `scripts/migrate-r2-bucket.ts`**

```ts
/**
 * One-time R2 migration: copy every object from the legacy
 * `tpr-portfolio-projects` bucket into the canonical `tpr-media` bucket,
 * preserving keys (originals + -sm/-md/-lg.webp variants). Server-side
 * CopyObject, so bytes never transit this process. Idempotent — re-copying
 * overwrites, so it is safe to run repeatedly as a delta sync.
 *
 * Talks to R2 only (no DB), using the same R2_* env creds the app uses.
 *
 * Usage:
 *   pnpm tsx scripts/migrate-r2-bucket.ts --dry-run   # list source objects, copy nothing
 *   pnpm tsx scripts/migrate-r2-bucket.ts             # copy all objects
 */

import './lib/load-env'

import type { R2BucketName } from '../src/shared/services/providers/r2/types'

import { r2Client } from '../src/shared/services/providers/r2/client'
import { R2_BUCKETS } from '../src/shared/services/providers/r2/types'

// eslint-disable-next-line node/prefer-global/process
const DRY_RUN = process.argv.includes('--dry-run')

// The legacy bucket is no longer in the R2BucketName union (Task 1 renamed the
// constant). This is a one-time migration off a soon-decommissioned bucket, so
// the S3 API just needs the literal string — the double cast is intentional
// (a direct `as R2BucketName` fails tsc: the literal doesn't overlap the union).
const SOURCE = 'tpr-portfolio-projects' as unknown as R2BucketName
const DEST = R2_BUCKETS.media
const CONCURRENCY = 20

async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let cursor = 0
  async function worker(): Promise<void> {
    while (cursor < items.length) {
      const index = cursor++
      await fn(items[index])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

async function main(): Promise<void> {
  console.warn(`[migrate-r2-bucket] ${SOURCE} → ${DEST}${DRY_RUN ? ' (dry-run)' : ''}`)

  const keys = await r2Client.listAllKeys(SOURCE)
  console.warn(`[migrate-r2-bucket] source has ${keys.length} objects`)

  if (DRY_RUN) {
    for (const key of keys.slice(0, 5)) {
      console.warn(`  sample: ${key}`)
    }
    console.warn('[migrate-r2-bucket] dry-run — no objects copied')
    return
  }

  let copied = 0
  await mapLimit(keys, CONCURRENCY, async (key) => {
    await r2Client.copyObject({ sourceBucket: SOURCE, sourceKey: key, destBucket: DEST, destKey: key })
    copied++
    if (copied % 100 === 0) {
      console.warn(`[migrate-r2-bucket] copied ${copied}/${keys.length}`)
    }
  })

  const destKeys = await r2Client.listAllKeys(DEST)
  console.warn(`[migrate-r2-bucket] done — copied ${copied}; dest now has ${destKeys.length} objects (source had ${keys.length})`)
}

main().catch((err) => {
  console.error(err)
  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
})
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm tsc && pnpm lint`
Expected: both clean.

- [ ] **Step 4: Dry-run the migration (dev R2 creds)**

Run: `pnpm tsx scripts/migrate-r2-bucket.ts --dry-run`
Expected: prints `source has N objects` and up to 5 sample keys, copies nothing. (If it throws `NotConfiguredError`, the R2 creds are missing from `.env` — report that; do not proceed.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/services/providers/r2/client.ts scripts/migrate-r2-bucket.ts
git commit -m "$(cat <<'EOF'
feat(r2): listAllKeys + one-time bucket copy migration script

Copies tpr-portfolio-projects → tpr-media (same keys), idempotent, dry-run.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: DB backfill script for `media_files.bucket`

**Files:**
- Create: `scripts/backfill-media-bucket.ts`

**Interfaces:**
- Consumes: `R2_BUCKETS.media` (Task 1). Pattern mirror: `scripts/backfill-media-url-domain.ts`.
- Produces: `scripts/backfill-media-bucket.ts` (operator-run at cutover, dev then prod).

- [ ] **Step 1: Create `scripts/backfill-media-bucket.ts`**

```ts
/**
 * One-time backfill: repoint project media rows from the legacy bucket name to
 * the canonical `tpr-media`. Stored `media_files.url` values already use the
 * media.triprosremodeling.com CDN domain (unchanged by the bucket rename), so
 * only the `bucket` column moves. Render derivation (get-optimized-urls) reads
 * `bucket` to pick the CDN domain — this keeps it accurate.
 *
 * Only touches project media (`media_files`). Proposal media
 * (`proposal_media_files`) is migrated in Sub-plan 2.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-media-bucket.ts                     # dev DB (default)
 *   DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-media-bucket.ts # prod DB
 *   … --dry-run   # report affected rows, change nothing
 *
 * DB target follows the environment-axes convention (unset never means prod):
 * see docs/codebase-conventions/environment.md#environment-axes
 * Safe to re-run: the WHERE clause only matches rows still on the old bucket.
 */

import './lib/load-env'

import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

import { R2_BUCKETS } from '../src/shared/services/providers/r2/types'

// eslint-disable-next-line node/prefer-global/process
const DRY_RUN = process.argv.includes('--dry-run')

const OLD_BUCKET = 'tpr-portfolio-projects'
const NEW_BUCKET = R2_BUCKETS.media // 'tpr-media'

// eslint-disable-next-line node/prefer-global/process
const IS_PROD_TARGET = process.env.DRIZZLE_TARGET === 'prod'
// eslint-disable-next-line node/prefer-global/process
const DATABASE_URL = IS_PROD_TARGET ? process.env.DATABASE_URL : process.env.DATABASE_DEV_URL
if (!DATABASE_URL) {
  console.error(`No database URL for target "${IS_PROD_TARGET ? 'prod' : 'dev'}" — check .env`)
  // eslint-disable-next-line node/prefer-global/process
  process.exit(1)
}
console.warn(`[backfill-media-bucket] target=${IS_PROD_TARGET ? 'prod' : 'dev'} host=${new URL(DATABASE_URL).host}`)
console.warn(`[backfill-media-bucket] ${OLD_BUCKET} → ${NEW_BUCKET}${DRY_RUN ? ' (dry-run)' : ''}`)

const pool = new pg.Pool({ connectionString: DATABASE_URL })
const db = drizzle(pool)

async function main(): Promise<void> {
  const [counts] = (await db.execute(sql`
    SELECT count(*) AS n FROM media_files WHERE bucket = ${OLD_BUCKET}
  `)).rows
  console.warn(`[backfill-media-bucket] rows on old bucket: ${counts.n}`)

  if (DRY_RUN) {
    console.warn('[backfill-media-bucket] dry-run — no changes made')
    return
  }

  const result = await db.execute(sql`
    UPDATE media_files SET bucket = ${NEW_BUCKET} WHERE bucket = ${OLD_BUCKET}
  `)
  console.warn(`[backfill-media-bucket] updated ${result.rowCount} rows`)

  const [remaining] = (await db.execute(sql`
    SELECT count(*) AS n FROM media_files WHERE bucket = ${OLD_BUCKET}
  `)).rows
  console.warn(`[backfill-media-bucket] rows still on old bucket: ${remaining.n}`)
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error(err)
    return pool.end().then(() => {
      // eslint-disable-next-line node/prefer-global/process
      process.exit(1)
    })
  })
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm tsc && pnpm lint`
Expected: both clean.

- [ ] **Step 3: Dry-run on the dev DB**

Run: `pnpm tsx scripts/backfill-media-bucket.ts --dry-run`
Expected: prints `target=dev host=…`, then `rows on old bucket: N` (N ≥ 0), then `dry-run — no changes made`.

- [ ] **Step 4: Commit**

```bash
git add scripts/backfill-media-bucket.ts
git commit -m "$(cat <<'EOF'
feat(scripts): backfill media_files.bucket to canonical tpr-media

DRIZZLE_TARGET-guarded, dry-run; project media only (proposals in Sub-plan 2).

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Operator cutover runbook

**Files:**
- Create: `docs/superpowers/plans/2026-08-06-canonical-media-bucket-RUNBOOK.md`

**Interfaces:**
- Consumes: `scripts/migrate-r2-bucket.ts` (Task 2), `scripts/backfill-media-bucket.ts` (Task 3).
- Produces: the runbook the **user** executes to perform the live cutover. No app code.

- [ ] **Step 1: Write the runbook**

Create `docs/superpowers/plans/2026-08-06-canonical-media-bucket-RUNBOOK.md` with exactly this content:

````markdown
# Canonical Media Bucket Cutover — Operator Runbook

Executed by the user (needs the Cloudflare account + prod deploy). Do it in a
low-traffic window. **Pause media uploads for the ~5-minute window** (steps 5–7)
so no upload lands in a bucket the domain isn't serving yet.

Prereqs: `wrangler` authenticated to the Tri Pros Cloudflare account; the zone id
for `triprosremodeling.com`; R2 creds present in `.env`.

## 1. Create the canonical bucket
```bash
wrangler r2 bucket create tpr-media
```

## 2. Copy the existing CORS policy onto it
```bash
wrangler r2 bucket cors list tpr-portfolio-projects   # inspect current policy
```
Write the same policy to `cors.json` (browser PUT uploads), then apply:
```json
[
  {
    "AllowedOrigins": ["https://triprosremodeling.com", "https://www.triprosremodeling.com"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```
```bash
wrangler r2 bucket cors set tpr-media --file cors.json
```
(Match the real origins/headers from step 2's output if they differ.)

## 3. Copy-first (safe to run days ahead; re-runnable)
```bash
pnpm tsx scripts/migrate-r2-bucket.ts --dry-run    # sanity: object count
pnpm tsx scripts/migrate-r2-bucket.ts              # copy all objects
```
Confirm the final line shows `dest now has N objects (source had N)` with matching counts.

## 4. Attach the custom domain to tpr-media in the Cloudflare dashboard as a
**second** domain first is NOT possible (a hostname binds one bucket). Proceed to
the atomic swap below.

## 5. — WINDOW START (pause uploads) — final delta re-copy
```bash
pnpm tsx scripts/migrate-r2-bucket.ts              # catch anything uploaded since step 3
```

## 6. Deploy the code + backfill the DB
- Deploy `main` to Vercel (ships `projectMediaStore` → tpr-media).
- Backfill:
```bash
pnpm tsx scripts/backfill-media-bucket.ts --dry-run
pnpm tsx scripts/backfill-media-bucket.ts                       # dev
DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-media-bucket.ts   # prod
```

## 7. Move the custom domain (atomic; the only real gap)
```bash
wrangler r2 bucket domain remove tpr-portfolio-projects --domain media.triprosremodeling.com
wrangler r2 bucket domain add    tpr-media               --domain media.triprosremodeling.com --zone-id <ZONE_ID>
```
(Or dashboard: R2 → tpr-portfolio-projects → Settings → Custom Domains → remove;
then tpr-media → add `media.triprosremodeling.com`.) — WINDOW END (resume uploads) —

## 8. Verify
- A known portfolio image URL (`https://media.triprosremodeling.com/projects/…`) loads.
- A fresh project photo upload round-trips (uploads, optimizes, renders).
- `get-optimized-urls`-derived variant URLs (`…-sm.webp`) load.

## 9. Rollback (if verification fails)
```bash
wrangler r2 bucket domain remove tpr-media               --domain media.triprosremodeling.com
wrangler r2 bucket domain add    tpr-portfolio-projects  --domain media.triprosremodeling.com --zone-id <ZONE_ID>
```
Then revert the `media_files.bucket` backfill (re-run with OLD/NEW swapped or a manual `UPDATE`). All objects still exist in the old bucket.

## 10. Decommission (after a safety window, e.g. 1–2 weeks)
```bash
# delete objects then the bucket (Cloudflare dashboard, or wrangler)
wrangler r2 bucket delete tpr-portfolio-projects
```
Leave `tpr-homeowner-files` in place — it still holds call recordings (and, until
Sub-plan 2, proposal media).
````

- [ ] **Step 2: Lint sanity (no code change)**

Run: `pnpm lint`
Expected: clean (markdown is not linted; this just confirms nothing else regressed).

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-08-06-canonical-media-bucket-RUNBOOK.md
git commit -m "$(cat <<'EOF'
docs(runbook): canonical media bucket cutover operator runbook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Notes for the executor

- Tasks 1–4 are code/scripts/docs only, each gated by `pnpm tsc` + `pnpm lint` (+ script `--dry-run`). The **live cutover is not part of execution** — it is the user running the Task 4 runbook.
- Do not fold the DB backfill or copy into Task 1 — they are separately reviewable and separately run.
- After all four tasks, the branch compiles with `tpr-media` as the canonical project-media bucket; nothing about proposal media or call recordings has changed. Sub-plan 2 picks up proposal media.
