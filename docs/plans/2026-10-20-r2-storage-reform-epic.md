# R2 storage reform — Epic Tracker

> **Status:** 📋 **RF1 IN REVIEW.** RF0 applied to `.env` 2026-10-20 (owner's upload check pending). D1–D11 accepted provisionally (owner: "looks good for now"). Q-A ruled (a). Spec builder-checked, awaiting owner approval: `docs/superpowers/specs/2026-10-20-r2-storage-design.md`. Nothing else built.
> **Started:** 2026-10-20, after local uploads failed with a 401 and the trace showed the whole R2 setup grew without a model (dev and prod share buckets and one admin token, public and private intent are mixed, half the public bucket is unreferenced).
> **This file is the live index of the order.** Update it as each step lands, and cite its IDs (RF0…) in specs, plans and commits. The design lives in the RF1 spec once written; until then §3 is the proposal under review.
> **Research:** `docs/plans/2026-10-20-r2-storage-research.md` (primary sources for every recommendation below). Delete it with this tracker when the epic ships.
> **Baseline:** local `main` at `74b158894` (2026-10-20).

**Goal in one line:** one public bucket and one private bucket per environment, each file in the place its access level says, every credential scoped to one environment, so a dev mistake can never touch prod and no file is ever lost.

**Owner's principles (2026-10-20):**
- Work from the big rethink down to the small fixes.
- A clear **public** bucket (sub-folders per kind of asset) and a **private** bucket (keys or signed links only).
- Clean up duplication (`tpr-media` vs `tpr-portfolio-projects`) as part of the move.
- **No data loss.** Every file is migrated to its correct place, and the app keeps working at every step.
- Follow proven patterns (research above), not ad-hoc fixes.

Legend: `[ ]` open · `[~]` in progress · `[x]` done · ⏸ waiting on another step.

---

## 1. Where we are (measured 2026-10-20, read-only)

**Account:** one Cloudflare account, one Account API token (`main-laptop`, Admin Read & Write, all buckets, issued 2025-11-27). Vercel prod almost certainly uses it (prod wrote a proposal file 2026-10-20 20:34 UTC; no other working credential exists). The local `.env` S3 pair (`R2_ACCESS_KEY_ID` `b8a229…`) belongs to no live token, which is why local uploads return 401. The live token's raw value sits in `R2_TOKEN`, which the code treats as dead.

**S3 credentials derive from a token:** access key id = the token's id, secret = sha256(token value). Revoking a token kills its pair.

| Bucket | Size | Holds | Public | CORS | Code status |
|---|---|---|---|---|---|
| `tpr-media` | 3,921 objects · 3.2 GB | `projects/…` (3,275), `proposals/…` (513), 133 raw files under name folders (`Altura/`, `Riviera/`… 912 MB: HEIC, MOV, MP4, JPG) | custom domain `media.triprosremodeling.com` | prod + localhost 3000–3002 | live (`R2_BUCKETS.media`) |
| `tpr-homeowner-files` | 131 objects · 145 MB | 128 call recordings at `{uuid}/recordings/{ts}-{uuid}.mp3`, 3 leftover `proposals/…` already copied to `tpr-media` | private | prod + localhost 3000–3003 | live (`R2_BUCKETS.homeownerFiles`) |
| `tpr-company-docs` | 4 objects · 3 MB | license + COI (jpg, pdf) | **r2.dev** (`pub-e9f58ace…`), which Cloudflare says is dev-only and rate-limited | **none** | live (`R2_BUCKETS.companyDocs`) |
| `tpr-portfolio-projects` | 3,415 objects · 2.2 GB | legacy copy of project media | **r2.dev on** | prod + localhost | scripts only |
| `olissolutions-com` | 19 objects · 3 MB | another business's files | off | localhost | not this app |

**Against prod's DB:**
- Every `media_files` (1,032) and `proposal_media_files` (88) row points at `tpr-media`, and every one of those objects exists.
- `tpr-media` holds 2,224 originals; **1,104 are referenced by no prod row**: 939 project files (25 of 68 project folders belong to deleted projects), 32 proposal files (4 deleted proposals), and the 133 raw name-folder files.
- `tpr-portfolio-projects`: 3,386 of 3,415 objects are byte-identical copies already in `tpr-media`. The other 29 (6 MB, one project folder `77d216e5…/after/`) exist only there. No DB row points at the bucket.
- Recordings: 43 customers reference a recording key; 128 files exist, so 85 recordings are unreferenced.
- No user has a headshot, so `tpr-company-docs` holds only the four license and COI files. Its missing CORS configuration is the root cause of the headshot upload failure in `docs/plans/2026-07-15-agent-headshot-upload-handoff.md`.
- Not yet scanned: every other text/jsonb column for stray R2 URLs (RF2 does this).

**In code** (full map in the research inventory; key facts):
- `src/shared/services/providers/r2/client.ts` is the single S3 client. It has no checksum setting, so presigned PUTs carry `x-amz-checksum-crc32=AAAAAA==` (SDK ≥ 3.729 default).
- Bucket names and public domains are constants in `src/shared/services/providers/r2/types.ts`. No env var picks a bucket or a domain, so dev and prod cannot differ.
- `media_files` stores a full `url` plus `bucket` + `pathKey`. `proposal_media_files` stores only `bucket` + `pathKey` and derives the URL. Two patterns for one bucket.
- `purgeMediaObject` (`src/shared/modules/media/core/lib/purge.ts`) deletes with no environment check. The dev DB is a copy of prod, so a dev delete removes the prod file. The gate planned in `docs/superpowers/plans/2026-09-17-dev-db-refresh-from-neon-parent.md` was never built.
- Three browser uploaders never check the PUT's `res.ok` (`use-media-upload.ts`, `headshot-upload.tsx`, `mp3-upload-field.tsx`).
- Orphans by design: proposal and customer deletes leave their files; replaced headshots and recordings are never deleted.
- `intakeRouter.getRecordingUploadUrl` is unauthenticated (IP rate limit only), and the recording GET presigns whatever key the row holds, with no prefix check.

---

## 2. Rules for every step ("no data loss" contract)

1. **Copy, verify, switch, quarantine, delete.** Never move in place. A source object is deleted only after its copy is verified (size + content hash) and nothing reads the source.
2. **Unreferenced is not deletable.** Anything no DB row references goes to an archive (private) until the owner rules on it. Hard deletes of non-duplicates need an explicit owner ruling naming the set.
3. **The manifest is the baseline.** RF2 writes a manifest of every object (bucket, key, size, hash) and every DB reference. Each later step diffs against it and records counts before and after.
4. **The app works after every step.** Each step lists its prod check (upload, view, delete for project and proposal media, recording playback, company docs links). A step is done only when that check passes on prod.
5. **DB rewrites run on dev first** with a dry run, then on prod via `DRIZZLE_TARGET=prod`, run or approved by the owner.
6. **Cloudflare dashboard changes are the owner's** (tokens, buckets, domains, CORS, lifecycle) unless the owner hands over an admin credential for a specific step.

---

## 3. Target shape (proposal; final in the RF1 spec)

**Buckets** (names pending D2):

| Role | Prod | Dev (laptop, worktrees, Vercel preview) |
|---|---|---|
| public | `tpr-media` kept (already holds the domain and all live media) → `media.triprosremodeling.com` | `tpr-media-dev` → `media-dev.triprosremodeling.com` |
| private | `tpr-private` (recordings, future contracts and customer documents) | `tpr-private-dev` |
| archive | `tpr-archive` (private; orphans and legacy leftovers awaiting a ruling; optional backups) | none |

**Prefixes:**
- Public: `projects/<projectId>/…`, `proposals/<proposalId>/…`, `company/…` (license, COI), `team/<userId>/…` (headshots), `site/…` (marketing), `tmp/…`.
- Private: `recordings/…`, later `customers/<customerId>/…` and `contracts/…`, `tmp/…`, `trash/…`.
- Existing keys keep their shape (pending D9).

**The DB stores a role and a key, never a full URL or a physical bucket name.** Env config maps role → bucket + public origin, and one helper builds URLs. A domain change becomes an env change, not a backfill.

**Tokens** (Account API tokens, Object scope, named per env):
- `tpr-r2-prod-rw`: Object Read & Write on the prod public and private buckets. Vercel **Production** only.
- `tpr-r2-dev-rw`: Object Read & Write on the dev buckets. `.env` / `.env.local`, Vercel **Preview** and **Development**.
- `tpr-r2-dev-prod-ro` (only if D1 says dev shows prod media): Object Read only on prod public.
- `tpr-r2-admin`: Admin, in no app env, kept in the password manager for dashboard and CLI work.
- `main-laptop` is revoked at the end (RF8).

**CORS per bucket:** prod buckets allow the prod origins only. Dev buckets allow `localhost:3000`–`3005` (ports cannot be wildcards), the ngrok host, and one Vercel preview wildcard.

**Lifecycle:** `tmp/` expires after 1 day, `trash/` after 30 days, incomplete multipart uploads after 1 day.

**Upload flow:** presign (type and size allowlist, checksum off) → browser PUT → server HEAD confirms the object → DB row → variant job. Private reads go through an app route that authorizes, then redirects to a 5-minute signed link.

### Env strings: superseded by the spec

> **Superseded 2026-10-20.** The final env contract is in spec §5. Per Q-A (a) and C9, there is a `R2_PROD_*` pair and a `R2_DEV_*` pair, `isProductionData()` picks one, and bucket names live in code. The table below is the original proposal, kept so the history is readable.

| Variable | Prod (Vercel Production) | Dev (`.env`, Vercel Preview/Development) | Today |
|---|---|---|---|
| `R2_ACCOUNT_ID` | account id | same | ✅ exists |
| `R2_ACCESS_KEY_ID` | `tpr-r2-prod-rw` id | `tpr-r2-dev-rw` id | exists, wrong locally |
| `R2_SECRET_ACCESS_KEY` | sha256(`tpr-r2-prod-rw` value) | sha256(`tpr-r2-dev-rw` value) | exists, wrong locally |
| `R2_PUBLIC_BUCKET` | `tpr-media` | `tpr-media-dev` | new (today a constant) |
| `R2_PRIVATE_BUCKET` | `tpr-private` | `tpr-private-dev` | new (today a constant) |
| `NEXT_PUBLIC_MEDIA_ORIGIN` | `https://media.triprosremodeling.com` | `https://media-dev.triprosremodeling.com` | new (today a constant) |
| `R2_PROD_MEDIA_ORIGIN` + read-only pair | not set | only if D1 = dev shows prod media | new, conditional |
| `R2_TOKEN`, `R2_JURISDICTION` | delete | delete | dead in code |

---

## 4. Order

Big decisions first, then a safety net, then infrastructure, code, migration, cleanup, hardening. One step at a time unless the step says otherwise.

| ID | Step | Requirements (done when…) | Status |
|---|---|---|---|
| **RF0** | **Unblock local uploads now.** Interim only; replaced in RF5. | The local `.env` pair is the `main-laptop` pair (id `5bf8036…`, sha256 of `R2_TOKEN`). `pnpm dev` restarted. One proposal file uploads and shows. **Caveat until RF5:** dev still shares prod buckets, so deleting media in dev deletes prod files. Don't delete media in dev. | [~] `.env` swapped 2026-10-20 (old file backed up outside the repo); the pair lists all three buckets and signs a GET (206). Owner: upload one proposal file on :3000. |
| **RF1** | **Owner rulings + architecture spec.** | §5 decisions D1–D11 answered. Spec `docs/superpowers/specs/2026-10-20-r2-storage-design.md` written from §3 + rulings (bucket table, prefixes, env strings, token matrix, CORS, lifecycle, upload and private-read flows, the role+key DB rule, migration mapping old → new for every object group). Builder check passed, owner approves. Storage terms (public/private role, archive) added to `CONTEXT.md`. | [ ] |
| **RF2** | **Safety net before anything moves.** | Script (read-only) writes the manifest: every object in all five buckets (bucket, key, size, hash) and every DB reference (all text/jsonb columns scanned for R2 hosts, bucket names and keys, prod and dev). Report counts match §1 or explain the difference. A full copy of prod `tpr-media` + `tpr-homeowner-files` + `tpr-company-docs` lands in `tpr-archive/backup-2026-xx/` (Super Slurper or script) and is verified against the manifest. Manifest stored outside the repo (contains customer keys); its path recorded here. | ⏸ RF1 |
| **RF3** | **Infrastructure, no app change.** | Dev buckets, private and archive buckets created. `media-dev` custom domain attached with a cache rule. CORS set on every bucket (incl. `tpr-company-docs` for the interim), lifecycle rules set. Scoped tokens created and stored. Vercel env vars split per environment (§3 table), values present but unused by code yet. `tpr-portfolio-projects` r2.dev turned off (no reader; see RF7). Prod check: site media and uploads unchanged. | ⏸ RF1 (RF2 in parallel) |
| **RF4** | **One storage module, env-driven, same behaviour.** | The r2 provider reads bucket + origin per role from env (fails fast when missing), sets checksum calculation and validation to `WHEN_REQUIRED` (test: presigned URL has no `x-amz-checksum-`), validates keys (no `..`, no leading `/`, no user filenames). One URL helper for public, one signed-GET helper for private. Uploaders check `res.ok`, and the server HEADs the object before writing the row. Prod points at the same buckets as today, so prod behaviour is unchanged. `pnpm tsc`, `pnpm lint`, tests green. Prod check passes. | ⏸ RF3 |
| **RF5** | **Dev gets its own buckets.** The step that ends "a dev delete removes prod files". | `.env` and Vercel Preview/Development use `tpr-r2-dev-rw` and the dev buckets. `db:refresh:dev` ends with the public-media mirror (spec §6) and never gives dev access to prod recordings (D4). Proven: a delete in dev of an inherited row leaves the prod object in place (HEAD before and after). Upload, view, delete work locally on 3000 and through ngrok. | ⏸ RF4 |
| **RF6** | **Move each file group to its place.** | Per group, following §2 rule 1: company docs → public `company/…`, constants updated, r2.dev no longer used by the app. Recordings → `tpr-private` with **identical keys** (no rewrite of `capture_json`, which is an immutable snapshot). `media_files.url` replaced by derived URLs (column dropped after a release with no readers, `get-trade-images.ts` included), and the `bucket` columns are dropped because the store declares the role (spec C1). Headshots → public `team/…` (uploads work now that CORS exists). Each group: counts before/after match the manifest, prod check passes. | ⏸ RF5 |
| **RF7** | **Cleanup.** | `tpr-portfolio-projects`: the 29 unique files copied to `tpr-archive`, the 3,386 duplicates verified identical, bucket quarantined 2 weeks, then emptied and deleted. `tpr-homeowner-files`: the 3 leftover proposal files verified in `tpr-media` and deleted; bucket quarantined, emptied, deleted after RF6. `tpr-media`: the 1,104 unreferenced originals (+ variants) and the 133 raw files copied to `tpr-archive`, verified, then removed from the public bucket per D11. `tpr-company-docs` retired after RF6. Bucket list = §3 table + `olissolutions-com` (D10). | ⏸ RF6 |
| **RF8** | **Credential cutover.** | Vercel Production on `tpr-r2-prod-rw`; prod check passes. `main-laptop` revoked only after checking that nothing else uses it (the `olissolutions-com` app, scripts, other machines). No admin credential in any app env. Old `.env` lines removed, `.env.ci` names updated. | ⏸ RF6 (prod swap may move earlier, into RF3) |
| **RF9** | **Keep it clean.** | Proposal and customer deletes remove (or trash) their files. Replaced headshots are deleted. Weekly reconciliation job lists each prefix vs the DB and reports orphans and dangling rows. Recording retention + optional bucket lock per D4. Scheduled backup of the private bucket per D5. Intake recording presign: server-minted key only, size limit, GET checks the `recordings/` prefix. | ⏸ RF7 |
| **RF10** | **Docs.** | ADR `docs/adr/0007-storage-topology.md` (why two roles, per-env buckets, role+key in the DB). Superseded docs deleted: `docs/plans/2026-07-15-r2-dev-prod-blob-consistency-handoff.md`, the headshot handoff, the purge-gate tasks in the 2026-09-17 plan, the research file, this tracker. `src/shared/modules/media/DOCS.md` stale `assertParentVisible` ref fixed or the file deleted. | ⏸ RF9 |

---

## 5. Owner decisions (RF1)

2026-10-20: the owner accepted these recommendations provisionally ("looks good for now"). They are the rulings until the owner changes one. D4's retention and lock part stays open, and needs an answer before RF9.

| # | Question | Ruling (provisional) |
|---|---|---|
| **D1** | On the laptop, does dev need to show the real project and proposal photos, or is dev with its own uploads fine? | Dev shows prod **public** media. Writes and deletes only ever reach dev buckets. Mechanism (spec C3): `db:refresh:dev` mirrors the referenced public objects into `tpr-media-dev` over the public domain. There is no runtime fallback and no prod credential in dev, so the `tpr-r2-dev-prod-ro` token and `R2_PROD_MEDIA_ORIGIN` are dropped. |
| **D2** | Bucket names: keep `tpr-media` as prod public, or create new names (`tpr-public-prod`…) and copy 2+ GB? | Keep `tpr-media` (it already holds the domain and every live file). New buckets get the new names. |
| **D3** | Is any company-docs content private? | No: license and COI are shown to customers, so public `company/…`. |
| **D4** | Recordings: how long to keep them, what happens to the 85 unreferenced ones, a bucket lock, and can dev ever play prod recordings? | Archive the 85, never delete without a ruling. Dev never reads prod recordings. Retention and lock: owner's legal call (CA two-party consent, deletion requests). |
| **D5** | Backups: an archive bucket in this account, or a second Cloudflare account? | Same account, separate bucket, written by a token the app doesn't hold. A second account is optional hardening. |
| **D6** | Uploads: to `tmp/` then copy on confirm, or straight to the final key plus the reconciliation sweep? | Straight to the final key + HEAD confirm + sweep (cheaper, nearly as clean). |
| **D7** | Dev media domain name. | `media-dev.triprosremodeling.com`. |
| **D8** | Cloudflare Image Transformations (AVIF, any width) as well as the pre-generated webp variants? | Not now; the variants work. Revisit with the media display epic. |
| **D9** | Re-key existing objects into a new layout (`…/<uuid>/original.ext`)? | No. Today's keys are already entity-grouped, uuid-based and immutable; re-keying 2,000+ objects adds risk for no gain. New groups use the new layout. |
| **D10** | `olissolutions-com` shares this account and token. Move it to its own token (or account)? | Own scoped token now; account move is the owner's call. Must happen before RF8 revokes `main-laptop`. |
| **D11** | The 1,104 unreferenced `tpr-media` originals and the 133 raw name-folder files: archive and keep, or archive then delete after N days? | Archive and keep (storage is cheap); remove from the public bucket so they stop being public. |
