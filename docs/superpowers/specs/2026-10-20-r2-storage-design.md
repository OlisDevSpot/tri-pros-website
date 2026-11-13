# R2 storage — design

> **Epic:** R2 storage reform, tracker `docs/plans/2026-10-20-r2-storage-reform-epic.md` (this is its RF1 spec).
> **Research:** `docs/plans/2026-10-20-r2-storage-research.md`.
> **Status:** builder-checked, for owner approval, 2026-10-20. Rulings D1–D11 are the tracker's recommendations, accepted provisionally by the owner ("looks good for now"); any later answer replaces the matching line in §2. Q-A ruled (a) by the owner 2026-10-20.
> **Measured state** (bucket sizes, reference counts, code facts): tracker §1. Not repeated here.

## 1. Intent

Storage grew one bucket at a time with no model. Dev and prod share every bucket and one admin token, so a delete in dev removes the prod file. Public and private files are mixed. Half of the public bucket is referenced by nothing, and URLs are stored in two different ways. The fix is a model that makes the dangerous thing impossible rather than discouraged.

**Goals**
- Two **roles**, `public` and `private`, each backed by one bucket per environment.
- Every credential reaches one environment only. Dev can never write, delete or read in prod buckets.
- Every file is in the bucket and prefix its access level says; legacy buckets retired.
- The DB stores object keys, never URLs or physical bucket names; the bucket and origin come from env.
- Dev shows the real project and proposal photos.
- No file is lost, and the app keeps working after every step (tracker §2 contract).

**Non-goals**
- Re-keying existing objects (D9).
- Cloudflare Image Transformations (D8).
- Moving `olissolutions-com` out of the account (D10 covers only its token).
- Recording retention periods and bucket locks: the owner's legal call (D4); this design leaves room for them in RF9.

**Anti-goals** (failure even if it "works")
- Any object deleted that has neither a verified copy nor an owner ruling naming it.
- A dev process that can select a prod credential or a prod bucket, and any prod credential in Vercel Preview/Development (Q-A).
- A runtime fallback that makes dev read prod buckets: the boundary has to be structural.
- A compatibility shim that reads both the old and the new shape indefinitely. Expand/contract with a dated contract step is fine; a permanent dual path is not.

## 2. Rulings and design calls

| # | Ruling (provisional, owner 2026-10-20) |
|---|---|
| D1 | Dev shows prod public media. **Mechanism (design call, see §6):** a mirror copies the referenced public objects into the dev bucket during `db:refresh:dev`. There is no runtime fallback and no prod credential in dev. |
| D2 | `tpr-media` stays the prod public bucket. New buckets get new names. |
| D3 | Company docs (license, COI) are public: `company/…` in the public bucket. |
| D4 | The 85 unreferenced recordings are archived, never deleted without a ruling. Dev never reads prod recordings. Retention and lock: open, owner, before RF9. |
| D5 | Backups go to `tpr-archive` in this account, written by a credential the app does not hold. |
| D6 | Uploads go straight to the final key; the server HEADs the object before writing the row; the weekly sweep catches leftovers. No `tmp/` copy step. |
| D7 | Dev public origin: `media-dev.triprosremodeling.com`. |
| D8 | No Image Transformations now. |
| D9 | Existing keys keep their shape. New groups use the layout in §4. |
| D10 | `olissolutions-com` gets its own scoped token before `main-laptop` is revoked. |
| D11 | Unreferenced `tpr-media` originals (+ variants) and the 133 raw name-folder files: copied to `tpr-archive`, verified, then removed from `tpr-media`. They are kept in the archive. |

**Q-A: ruled (a) by the owner, 2026-10-20.** Local scripts that run with `DRIZZLE_TARGET=prod` write and delete prod media from the laptop: `add-during-media.ts` (the during-photos workflow), `portfolio-scraper/import-project.ts`, and any prod backfill whose delete hooks purge R2. They keep working this way:
- The laptop `.env` holds the dev pair and a separately named prod pair, and `isProductionData()` picks one. This mirrors how the laptop already holds the prod `DATABASE_URL` beside `DATABASE_DEV_URL`.
- Vercel Production holds only the prod pair; Vercel Preview and Development hold only the dev pair.
- Rejected: (b), injecting the prod pair from the password manager on every run.

**Design calls made in this spec** (owner, please check):
- **C1. The role belongs to the store, not the row.** Project media and proposal media are always public, recordings always private. Each store config declares its role, and the `bucket` column is dropped along with `media_files.url`. This makes "bucket columns hold the role" (tracker RF6) unnecessary.
- **C2. Headshots store a key.** `users.headshot_url` becomes `users.headshot_key`. No user has a headshot today, so nothing is backfilled.
- **C3. D1 is implemented as a mirror** (§6), so the tracker's optional `tpr-r2-dev-prod-ro` token and `R2_PROD_MEDIA_ORIGIN` variable are dropped.
- **C4. Recordings keep their keys exactly** (`<uuid>/recordings/<ts>-<uuid>.mp3`) when they move to `tpr-private`, because `customer_lead_attribution.capture_json` is an immutable snapshot that holds them. New recordings use `recordings/<uploadId>.mp3`, where `uploadId` is a uuid the server mints at presign time.
  - The intake presign runs before the customer exists, so the key cannot carry a customer id.
  - Today's intake writes `recordings/<slug>-<uuid>.mp3`, which puts the customer's name in the key. That shape is retired.
  - Prod check, 2026-10-20: all 43 referenced keys use the legacy shape, and the bucket holds no `recordings/` object.
  - Reads accept exactly two shapes: legacy and `recordings/<uuid>.mp3`.
- **C5. One migration credential.** R2 tokens apply one permission level to their bucket list, so "read everything, write only the archive" cannot be a single token. `tpr-r2-migrate` gets Object Read & Write on all `tpr-*` buckets. Copies use server-side `CopyObject`, and nothing is downloaded. It lives only in the owner's password manager. It goes into the shell for a step, is created at RF2 and is revoked when RF7 closes.
- **C6. Thumbnails are keys too.** `media_files.thumbnail_url` is empty in prod (2026-10-20) and is dropped in the contract step. If video posters return, they get a `thumbnail_path_key`, as `proposal_media_files` already has. Every `*_path_key` column counts as a reference for the D11 recompute and for the mirror.
- **C7. Edge cache.** Both media domains get edge TTL 7 days and browser TTL 1 day. Keys are immutable, so normal reads never need a purge. A removed object can stay on the edge for up to 7 days. For an urgent removal (a customer asks for a photo to come down), the owner purges the URL in the dashboard. The D11 orphans are unreferenced and unlinked, so no purge is needed.
- **C9. Bucket names follow the data target in code; only credentials and the browser origin are env.**
  - Because of Q-A (a), one process may legitimately hold both credential sets, so the buckets must come from the same switch as the credentials.
  - A small code table maps `prod` and `dev` to bucket names and public origin. It replaces the tracker's proposed `R2_PUBLIC_BUCKET` and `R2_PRIVATE_BUCKET` env vars.
  - Physical bucket names are not secrets and never differ within an environment. Keeping them in code makes a dev process pointed at prod buckets unrepresentable, instead of something a startup check has to catch.
- **C8. "Unreferenced" means referenced by neither the prod DB nor the `development` branch** at run time. Worktree branches (`wt/issue-N`) are not scanned. Their test uploads were made in shared `tpr-media` before RF5, and they go to the archive like any other orphan, so nothing is lost.

## 3. Topology

### Buckets

| Role | Prod | Dev (laptop, worktrees, Vercel Preview + Development) |
|---|---|---|
| public | `tpr-media` → `https://media.triprosremodeling.com` (exists) | `tpr-media-dev` → `https://media-dev.triprosremodeling.com` |
| private | `tpr-private` (no public access, no r2.dev) | `tpr-private-dev` |
| archive | `tpr-archive` (private; never referenced by the app) | none |

"Dev" here means `isProductionData()` is false (`src/shared/config/data-target.ts`). That covers local runs and Vercel Preview. Buckets follow the data, as calendar policy does.

**Precondition:** `isProductionData()` false must mean the process talks to the dev DB, because `src/shared/db/index.ts` falls back to `DATABASE_URL` when `DATABASE_DEV_URL` is unset.
- Vercel Preview: confirmed by the owner 2026-10-20. Its `DATABASE_URL` is the dev branch string.
- Vercel Development: RF3 confirms it is set up the same way.
- No storage-side DB check is added, since a check on `DATABASE_DEV_URL` would break Preview.

Both custom domains get a Cloudflare cache rule (C7).

### Tokens (Account API tokens, Object Read & Write scope, specific buckets)

| Token | Buckets | Held in |
|---|---|---|
| `tpr-r2-prod-rw` | `tpr-media`, `tpr-private` | Vercel Production only |
| `tpr-r2-dev-rw` | `tpr-media-dev`, `tpr-private-dev` | `.env`, Vercel Preview + Development |
| `tpr-r2-migrate` (C5) | Object Read & Write on all `tpr-*` buckets | owner's password manager, put into the shell per step; RF2 → revoked when RF7 closes |
| `tpr-r2-admin` | Admin | owner's password manager; dashboard and CLI only |
| `olis-solutions-rw` (D10) | `olissolutions-com` | that app's env |

`main-laptop` is revoked in RF8. Each S3 pair is (token id, sha256(token value)); the app reads only the pair, never the raw token.

### CORS

| Bucket | Allowed origins | Methods | Headers |
|---|---|---|---|
| `tpr-media`, `tpr-private` | `https://triprosremodeling.com`, `https://www.triprosremodeling.com`, plus any other prod host in `APP_HOSTS` (`src/shared/config/roots.ts`) | GET, PUT, HEAD | `content-type` |
| `tpr-media-dev`, `tpr-private-dev` | `http://localhost:3000` … `:3005` (each listed; ports can't be wildcards), `https://destined-emu-bold.ngrok-free.app`, the Vercel preview host pattern (one `*` allowed) | GET, PUT, HEAD | `content-type` |
| `tpr-archive` | none | | |

Max age 3600. R2 error responses carry no CORS headers, so a credential or policy failure shows up in the browser as a CORS error. That is how RF0 was found, and §5's server HEAD gives a clearer signal.

### Lifecycle

- All four app buckets: abort incomplete multipart uploads after 1 day.
- Private buckets: `trash/` expires after 30 days.
- `tmp/` (both roles): expires after 1 day. It is reserved; nothing writes there yet (D6).
- `tpr-archive`: no expiry.

## 4. Key layout

| Group | Role | Key | Status |
|---|---|---|---|
| Project media | public | `projects/<projectId>/<…existing shape…>` + variant suffixes | exists, unchanged |
| Proposal media | public | `proposals/<proposalId>/<…existing shape…>` + variant suffixes | exists, unchanged |
| Company docs | public | `company/<file>` (license, COI) | new; moved from `tpr-company-docs` |
| Headshots | public | `team/<userId>/<uuid>.<ext>` | new; replaces `agent-headshots/<userId>/<ts>-<filename>` in `tpr-company-docs` |
| Site assets | public | `site/…` | reserved; nothing moves now |
| Call recordings (legacy) | private | `<uuid>/recordings/<ts>-<uuid>.mp3` | moved unchanged from `tpr-homeowner-files` (C4) |
| Call recordings (new) | private | `recordings/<uploadId>.mp3` (C4) | new writes |
| Customer files, contracts | private | `customers/<customerId>/…`, `contracts/…` | reserved |
| Trash | private | `trash/<original key>` | reserved for RF9 soft deletes |

**Key rules** (enforced by one validator in the r2 provider): the server builds every key. No user-supplied filename is ever part of a key; only the extension is kept, from an allowlist. Keys have no leading `/`, no `..`, no empty segment, and only ASCII. Every key is unique per upload: a uuid is in it, so a key never needs overwriting.

**Archive layout:** `backup-<YYYY-MM-DD>/<source-bucket>/<key>` (RF2 snapshot), `orphans/<source-bucket>/<key>` (RF7, D11, D4), `legacy/tpr-portfolio-projects/<key>` (the 29 unique files).

## 5. Code shape

**Storage targets** (code, in the r2 provider; C9). `isProductionData()` picks one row:

| Target | Public bucket | Private bucket | Public origin | Credential vars |
|---|---|---|---|---|
| `prod` | `tpr-media` | `tpr-private` | `https://media.triprosremodeling.com` | `R2_PROD_ACCESS_KEY_ID`, `R2_PROD_SECRET_ACCESS_KEY` |
| `dev` | `tpr-media-dev` | `tpr-private-dev` | `https://media-dev.triprosremodeling.com` | `R2_DEV_ACCESS_KEY_ID`, `R2_DEV_SECRET_ACCESS_KEY` |

**Env contract** (r2 fragment in `src/shared/services/providers/r2/lib/config.ts`, wired through `server-env.ts`):

| Variable | Vercel Production | Vercel Preview + Development | Laptop `.env` |
|---|---|---|---|
| `R2_ACCOUNT_ID` | account id | account id | account id |
| `R2_PROD_ACCESS_KEY_ID` / `R2_PROD_SECRET_ACCESS_KEY` | `tpr-r2-prod-rw` pair | **absent** | `tpr-r2-prod-rw` pair (Q-A) |
| `R2_DEV_ACCESS_KEY_ID` / `R2_DEV_SECRET_ACCESS_KEY` | **absent** | `tpr-r2-dev-rw` pair | `tpr-r2-dev-rw` pair |
| `NEXT_PUBLIC_MEDIA_ORIGIN` | prod origin | dev origin | dev origin |

- **Deleted from every env** (RF8, once nothing reads them): `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_TOKEN`, `R2_JURISDICTION`.
- **Fail fast:** the provider fails at first use when the selected target's pair is missing. It never falls back to the other target's pair.
- **Browser origin:** the browser can't call `isProductionData()`, so it gets the origin from `NEXT_PUBLIC_MEDIA_ORIGIN`. Inside the Next app, the provider asserts at startup that this equals the selected target's origin. Standalone scripts build URLs from the target table and skip the assertion.
- **Rollout:** the new names are set in Vercel in RF3, alongside the old ones. RF4's code reads only the new names. RF8 deletes the old ones.

**Provider surface** (`src/shared/services/providers/r2/`): the S3 client keeps its methods but takes a role instead of a bucket name. `R2_BUCKETS`, `R2_PUBLIC_DOMAINS` and `R2BucketName` are deleted.
- The client sets `requestChecksumCalculation: 'WHEN_REQUIRED'` and `responseChecksumValidation: 'WHEN_REQUIRED'`. Test: a presigned PUT URL contains no `x-amz-checksum-`.
- `publicObjectUrl(key)` builds `${NEXT_PUBLIC_MEDIA_ORIGIN}/${key}`. It is the only place a public URL is built, and it is importable on the client.
- `signedReadUrl(key, { expiresIn })` signs a GET on the private bucket. Default 300 s.
- `headObject(role, key)` returns size and content type, or not-found.
- Presign takes role, key, content type and max size. Content type must be on the store's allowlist and size under its cap.

**Stores** declare `role`, `pathKeyPrefix`, the content-type allowlist and the max size. `PROJECT_MEDIA`, `PROPOSAL_MEDIA`, plus new recording, headshot and company-doc descriptors. `isOwnedObject` checks the key prefix only, since the bucket column is gone (C1).

**Upload flow (every uploader):**
1. The server presigns a server-built key.
2. The browser PUTs and checks `res.ok`. On failure it shows an error and writes nothing.
3. The client calls the create mutation with the key.
4. The server HEADs the key, rejects it when it is missing or when the size or type is off, then inserts the row.
5. The variant job runs as today.

The fix applies to `use-media-upload.ts`, `headshot-upload.tsx` and `mp3-upload-field.tsx`. Intake recordings: `intakeRouter.getRecordingUploadUrl` stays unauthenticated (public intake), but the key is server-minted under `recordings/`, the size is capped, and the presign is rate-limited as today.

**Private reads:** one app route authorizes the caller for the owning entity, validates the key shape (C4), then redirects (302) to `signedReadUrl`. It returns 404 when the object is missing, which is the normal case in dev for recordings inherited from prod. The existing recording procedure in `customer-pipelines.router.ts` becomes this route or calls the same helper; the builder chooses.

**Deletes:** `purgeMediaObject` takes the store's role. It needs no environment gate, because a dev process resolves only dev buckets and the dev credential (C9).

**DB changes (expand → contract):**
1. *Expand* (RF6): `users.headshot_key` added. Nothing else is added: the store carries the role (C1).
2. *Switch:* deploy code that reads keys only. The readers are `get-optimized-urls.ts`, `photo-detail-dialog.tsx`, `get-trade-images.ts`, `google-drive.router.ts`, `projects/media/service.ts`, `projects.router/media.router.ts`, `company-documents.ts`, the headshot consumers, and seeds. It writes no `url` or `bucket`.
3. *Contract*, after one prod release with no readers: drop `media_files.url`, `media_files.thumbnail_url` (C6), `media_files.bucket`, `proposal_media_files.bucket` and `users.headshot_url` with `db:push:dev`, then prod on the owner's go. Before dropping, check `bucket` is `tpr-media` on every row (RF2 has confirmed this so far) so no row loses information.

## 6. Dev data: the media mirror (D1, C3)

`db:refresh:dev` resets the dev DB from prod and scrubs it. A new final step, `mirror-public-media`, then:
- Reads, from the **dev** DB, every public key that rows reference: each media and proposal-media original plus its variant keys, and each company doc and headshot key.
- For each key missing in `tpr-media-dev` (HEAD), downloads it from the **prod public origin** over HTTPS (public data, no credential) and PUTs it with `tpr-r2-dev-rw`.
- Is idempotent and resumable, runs a few requests in parallel, and prints counts: referenced, already present, copied, failed. It exits non-zero on any failure.
- Refuses to run unless the selected storage target is `dev`.

Recordings are never mirrored (D4). Dev rows inherited from prod still hold their keys; playing one returns 404, and the UI shows "Recording not available". Also runnable alone (`pnpm r2:mirror:dev`). The first run moves about 2.5 GB; later runs copy only new keys.

## 7. Migration mapping (old → new, every object group)

All moves follow the tracker §2 contract. "Verify" means the size matches and the content hash (sha256 of the bytes, not the ETag, because multipart ETags differ) equals the RF2 manifest's.

| Group | From | To | DB change | Delta handling |
|---|---|---|---|---|
| Project + proposal media (referenced) | `tpr-media` | stays | contract step drops `url` and `bucket` | none |
| Unreferenced `tpr-media` originals + variants (1,104 at last count) and the 133 raw files | `tpr-media` | `tpr-archive/orphans/tpr-media/…`, then removed from `tpr-media` (D11) | none | recompute "unreferenced" at run time per C8, never from the manifest alone |
| Company docs (4) | `tpr-company-docs` | `tpr-media/company/<file>` (and mirrored to dev) | `company-documents.ts` builds URLs with `publicObjectUrl` | static; none |
| Headshots | `tpr-company-docs/agent-headshots/…` (none exist) | `team/<userId>/…` | C2 | none |
| Recordings (128) | `tpr-homeowner-files/<uuid>/recordings/…` | `tpr-private/` same keys (C4) | none | copy, deploy the switch, then copy the keys written to the old bucket since the first copy, verify, quarantine |
| 85 unreferenced recordings | as above | also copied to `tpr-archive/orphans/tpr-homeowner-files/…` | none | they stay in `tpr-private` too until D4 rules |
| 3 leftover proposal files | `tpr-homeowner-files/proposals/…` | already in `tpr-media`; verify the hash, then delete | none | none |
| `tpr-portfolio-projects` (3,415) | itself | 29 unique → `tpr-archive/legacy/…`; 3,386 verified identical to `tpr-media` | none | r2.dev off in RF3; quarantined 2 weeks; then emptied and deleted |
| RF2 snapshot | `tpr-media`, `tpr-homeowner-files`, `tpr-company-docs` | `tpr-archive/backup-<date>/…` | none | one-time; kept until the epic closes, then owner rules |

**Quarantine** means the old bucket is left untouched, no code reads it, and r2.dev and any custom domain are off. After two weeks with no access in the bucket metrics it is emptied and deleted, with the owner's go.

## 8. Checks

**Prod check** (after every step that touches prod config, code or objects):
1. Project page photos and variants load.
2. Upload one project photo and one proposal photo: the row exists, the object exists, and variants appear.
3. Delete that test media: the row and object are gone.
4. A recording plays from the customer pipeline.
5. The company license and COI links open.
6. Headshot upload works (from RF6).

Test uploads are created and deleted by the owner, consistent with "no DB writes for testing".

**Isolation proof** (RF5): in dev, delete media inherited from prod. HEAD the prod object before and after: it is still there. HEAD the dev copy: it is gone.

**Counts:** every RF6/RF7 step records the objects per bucket and prefix before and after, alongside the manifest. Each difference must be explained by that step's mapping row.

## 9. Left to the builder

- Names and file split inside the r2 provider, and whether the private-read route is a Next route handler or a tRPC procedure plus a redirect.
- Concurrency and retry policy for the copy and mirror scripts.
- Whether the manifest is JSONL or SQLite, as long as it lives outside the repo and its path is recorded in the tracker.
- How the RF2 snapshot is copied (Super Slurper with R2 as source, or a script), as long as it is verified against the manifest.
- The exact Vercel preview host pattern for dev CORS.
- Content-type allowlists and size caps per store. Start from what each uploader accepts today.
