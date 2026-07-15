# Handoff: R2 dev/prod blob consistency — audit + fixes

**Date:** 2026-07-15
**Author:** prior Claude session (during-photos pipeline work)
**Mission for this session:** fix everything related to R2/Cloudflare blob storage consistency between dev and prod. Nothing else — do not touch the during-photos generation pipeline itself.

---

## The one-paragraph problem

Dev and prod share a **single Cloudflare R2 account and the same hardcoded buckets** — there is no environment dimension anywhere in the storage layer — while each environment has its **own Postgres database** referencing blobs by `mediaFiles.pathKey`/`url`. The dev DB is a snapshot of prod (🧪-prefixed rows, `pnpm db:snapshot`), so dev rows point at the **exact same pathKeys** prod serves. This creates three concrete failure modes, one of which can silently break images on the live site.

## Architecture facts (verified 2026-07-15 — re-verify before changing anything)

- **Bucket registry:** `src/shared/services/providers/r2/types.ts` — hardcoded constants `tpr-portfolio-projects`, `tpr-company-docs`, `tpr-homeowner-files`; public domains hardcoded per bucket (`pub-06be62a0….r2.dev` for portfolio, `pub-e9f58ac….r2.dev` for company docs; homeownerFiles is private).
- **Client:** `src/shared/services/providers/r2/client.ts` — single S3-compatible client; credentials from `.env` (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — one account, no per-env split); endpoint derived from account id in `src/shared/services/providers/r2/lib/config.ts`. Provider is a leaf (no DB writes, no domain types) — keep it that way per `docs/codebase-conventions/service-architecture.md`.
- **Variant suffixes:** the media-optimization pipeline writes `-sm/-md/-lg.webp` siblings next to originals; `r2Client.deleteMediaWithVariants` knows about them. Any sweeper/audit must account for variants.
- **DB rows:** `mediaFiles` table (`src/shared/db/schema/media-files.ts`) stores `bucket`, `pathKey`, `url`, `phase`, `projectId` (FK cascade from projects).
- **Env→DB selection:** runtime db client picks its URL via `NODE_ENV` (scripts run against dev by default). Never `pnpm db:push` (prod); dev is `pnpm db:push:dev`. Dev DB is routinely reset/re-snapshotted from prod.

## All blob WRITERS (create objects in the shared buckets)

| Path | Context |
|---|---|
| `scripts/portfolio-scraper/import-project.ts` | creates projects + uploads gallery images (`projects/<projectId>/<phase>/<uuid>.<ext>`) |
| `scripts/add-during-media.ts` | adds AI during photos to an EXISTING project's during bucket (webp) |
| `src/trpc/routers/projects.router/media.router.ts` | app media upload |
| `src/trpc/routers/intake.router.ts` | intake uploads |
| `src/trpc/routers/projects.router/google-drive.router.ts` | Drive import |
| `src/trpc/routers/agent-settings.router.ts` | agent settings assets |
| `src/shared/services/media.service.ts` | shared media service (incl. presigned browser uploads) |

Any of these running in dev writes into the same bucket prod reads.

## All blob DELETERS

| Path | Behavior |
|---|---|
| `src/trpc/routers/projects.router/media.router.ts` (delete + bulk-delete + likely elsewhere) | `r2Client.deleteMediaWithVariants(...)` **then** deletes the row |
| `src/features/project-management/dal/server/manage-project.ts` (project delete) | deletes ALL the project's blobs via `deleteMediaWithVariants`, then the project row |

## The three failure modes (ranked)

1. **CRITICAL — dev deletes destroy prod images.** Because dev rows are snapshot copies with prod's pathKeys, deleting a media file or an entire project in the **dev** app deletes the **shared blob**. Prod rows survive but their URLs 404 → broken images on the live site, unrecoverable without re-upload. This is live today; nothing prevents it.
2. **Phantom-blob bloat (the original concern).** Dev-run writers create blobs referenced only by dev rows. Every dev DB reset/re-snapshot orphans them silently. Costs pennies now but grows unbounded and makes the bucket un-auditable.
3. **Promotion-by-re-upload duplicates + orphans.** The intended dev→prod promotion for curated media (e.g., AI during photos) must be a **row copy** (insert the same `pathKey`/`url` rows into prod — the blob is already shared). Re-running an upload script against prod would mint new UUIDs, duplicate the blob, and permanently orphan the dev one. This convention exists only in prose right now — nothing enforces or assists it.

## Current known bucket state (as of 2026-07-15)

- **3 dev-only blobs, promotion-pending (do NOT sweep these):**
  - `projects/49a853a4-10b0-4cac-81ba-f15d4eca8d3e/during/3956b4eb-a233-493c-bd67-2bd917c5965e.webp`
  - `projects/49a853a4-10b0-4cac-81ba-f15d4eca8d3e/during/48c220cc-47a2-4728-8570-b9f70c65836f.webp`
  - `projects/49a853a4-10b0-4cac-81ba-f15d4eca8d3e/during/c6ceabe7-451c-48db-93e7-5a4a3298a4ba.webp`
  (Eclipse project, dev DB rows exist, prod rows intentionally absent pending Oliver's promotion decision.)
- A 2026-07-14 incident (18 wrongly-created projects, ~90 blobs) was fully rolled back — those objects were deleted; nothing lingers from it.
- **Unknown legacy residue:** the pre-scraper seed (`src/shared/db/seeds/data/media-files.ts`) referenced Title-based paths (`projects/<Title>/<file>`) and a bucket name string `portfolio-photos` that doesn't match today's registry. Whether historical orphans exist under any path scheme is unknown — a full bucket listing/audit has never been done.

## Recommended work (proposals from the prior session — validate, then design properly)

1. **Env-gate blob deletion (highest priority, closes the prod-breaking hole).** In non-prod, delete DB rows but skip R2 object deletion (log the skipped pathKeys instead). Only prod actually removes objects. Decide the mechanism deliberately (NODE_ENV check inside the two delete call-sites? a service-layer policy? — respect the provider-is-a-leaf rule: the gate belongs ABOVE `r2Client`, not inside it).
2. **Promotion-by-row-copy tooling.** Make `scripts/add-during-media.ts` (and anything similar) emit a manifest of inserted rows so promotion to prod is a replayed INSERT with identical pathKeys — never a re-upload. Define where manifests live and the exact promote command.
3. **Orphan audit + sweeper.** Script that lists all objects per bucket, diffs against the union of prod (+ dev) `mediaFiles.pathKey` (+ `-sm/-md/-lg` variants), reports orphans, and deletes only with an age threshold + dry-run default. First run is the audit that answers the legacy-residue question. Careful: the 3 Eclipse keys above are dev-referenced and promotion-pending — a prod-only diff would wrongly flag them.
4. **Optional hardening:** `dev/` pathKey prefix for genuinely throwaway dev uploads + an R2 lifecycle rule expiring `dev/*`; keeps intentional promotion-track uploads unprefixed. Alternative considered: fully separate dev buckets — rejected as default because prod URLs are baked into rows and the snapshot flow would need URL rewriting; revisit only if Oliver wants hard isolation.

## Constraints & conventions for this session

- Brainstorm/design first (superpowers flow), get Oliver's approval before implementing; he explicitly wants gameplans mapped before work.
- `pnpm lint` + `pnpm tsc` to verify; NEVER `pnpm build`. Scripts import `./lib/load-env`. Never `pnpm db:push`.
- Prod DB/credentials access is Oliver-gated — ask before any prod read or write.
- Note there is one PRE-EXISTING tsc error in `scripts/backfill-wave1-columns.ts` (Oliver's WIP, unrelated — don't fix, don't be confused by it).
- The during-photos pipeline docs live in `.claude/skills/during-photos/` (SKILL.md + variation-ledger.md) — update their Environment row if the promotion mechanism changes, but don't otherwise touch them.

## Open questions for Oliver (ask early)

1. Should the sweeper treat dev-DB references as "live" (safer) or prod-only (stricter)?
2. Promote the 3 pending Eclipse rows to prod as part of this work, or leave for later?
3. Is a `dev/` prefix + lifecycle rule wanted, or is the delete-gate + sweeper enough?
