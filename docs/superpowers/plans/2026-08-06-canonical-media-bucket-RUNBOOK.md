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
