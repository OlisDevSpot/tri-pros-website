# R2 storage redesign: research (2026-10-20)

Scope: proven, citable patterns for a Next.js 15 / Vercel / Neon (dev branch reset from prod) / Drizzle app on Cloudflare R2 through the S3 API (`@aws-sdk/client-s3` v3.1000, presigned browser PUTs, a QStash job that writes webp variants).
Primary sources only, plus the source code of open-source apps. Every claim carries its URL. Where something could not be verified, it is marked **UNVERIFIED**.

---

## 1. Bucket topology: what R2 can and cannot do

**Public access is per bucket, never per prefix or per object.**
- "By default, buckets are never publicly accessible and will always require explicit user permission to enable." There are two separate ways in: a custom domain, or the managed `r2.dev` subdomain. https://developers.cloudflare.com/r2/buckets/public-buckets/
- R2 has no ACLs and no bucket policies. `PutBucketPolicy`, `PutBucketAcl`, `PutObjectAcl` and `PutPublicAccessBlock` are all listed as unimplemented. https://developers.cloudflare.com/r2/api/s3/api/
- Real projects take this as given. Mastodon says R2 "has no ACL support", so you set `S3_PERMISSION=""`. https://docs.joinmastodon.org/admin/optional/object-storage/ Discourse says "Cloudflare R2 uses bucket-level permissions; your uploads bucket should be public and the backup bucket should be private." https://meta.discourse.org/t/configure-an-s3-compatible-object-storage-provider-for-uploads/148916
- **So "one bucket, public and private prefixes" cannot be expressed natively on R2.** Once a bucket is public, every key in it can be read by anyone who knows or guesses the key.

**r2.dev is for development only.**
- It is "rate-limited and should only be used for development purposes". A CNAME pointed at r2.dev is "an unsupported access path". https://developers.cloudflare.com/r2/buckets/public-buckets/
- The rate limit varies ("hundreds of requests per second") and returns 429s, and bandwidth may also be throttled. The endpoint is "not intended for production usage". https://developers.cloudflare.com/r2/platform/limits/
- WAF custom rules, Cache, Access and Bot Management "are not available when using the r2.dev development url". https://developers.cloudflare.com/r2/buckets/public-buckets/
- **Implication:** the current "company docs" bucket on r2.dev is a production dependency on an endpoint Cloudflare says is unsupported for production.

**What a custom domain gives you**
- The domain must be a zone in the same account. You can attach up to 100 custom domains per bucket. https://developers.cloudflare.com/r2/platform/limits/
- You get Cloudflare Cache (Smart Tiered Cache is recommended). By default "only certain file types are cached"; to cache everything you need a Cache Rule. https://developers.cloudflare.com/r2/buckets/public-buckets/
- You get WAF custom rules on the hostname, Cloudflare Access (Zero Trust), and WAF HMAC token authentication.

**Per-prefix "public" is possible only at the edge, and only as a workaround:**
1. **WAF custom rule on the custom domain.** Block `http.request.uri.path starts_with "/private/"`. This works because WAF runs on custom domains, but the objects are still public through r2.dev if that is enabled, and through any other domain attached to the bucket. Cloudflare's own caution: "Disable public access to your r2.dev subdomain" when you use these protections. https://developers.cloudflare.com/r2/buckets/public-buckets/
2. **Cloudflare Access on a second hostname.** The tutorial attaches a custom domain and puts an Access self-hosted app in front of it. https://developers.cloudflare.com/r2/examples/cloudflare-access/ Access is per hostname, and a path-scoped Access app is possible (a third-party write-up of the tutorial describes restricting "specific sub-paths"). This suits staff-only content, not customers.
3. **A Worker with an R2 binding on a route.** You write the authorization in code. The bucket itself stays private (no public access at all). https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
4. **WAF `is_timed_hmac_valid_v0` token auth** on the public hostname, scoped to a path prefix with `substring()`. This needs a Pro plan or higher. https://developers.cloudflare.com/waf/custom-rules/use-cases/configure-token-authentication/

**Verdict:** a public/private bucket split is the pattern R2 is designed for, and the one Discourse, Dub and Supabase use (see section 9). A prefix-level split only works when an edge rule is configured perfectly and nothing else exposes the bucket. The privacy guarantee then rests on configuration, not on the bucket. For customer call recordings, that guarantee should come from the bucket being non-public.

---

## 2. Environment separation (dev vs prod)

**Primary-source guidance: one bucket per environment.**
- Rails Active Storage: "Because each environment will likely use a different service, it is recommended to do this on a per-environment basis", and use `Rails.env` in bucket names "to further reduce the risk of accidentally destroying production data." https://guides.rubyonrails.org/active_storage_overview.html
- Discourse: "Using the same bucket for production and staging is not recommended." https://meta.discourse.org/t/configure-an-s3-compatible-object-storage-provider-for-uploads/148916
- AWS multi-account whitepaper: "By using separate accounts for the non-production and production environments, by default, the resources and data that make up a workload environment are separated from other environments." It also covers limiting "scope of impact from adverse events". https://docs.aws.amazon.com/whitepapers/latest/organizing-your-aws-environment/benefits-of-using-multiple-aws-accounts.html
- R2 allows 1,000,000 buckets per account, so buckets are not scarce. https://developers.cloudflare.com/r2/platform/limits/

**Separate Cloudflare account vs separate buckets.** R2 tokens can be scoped per bucket with the Object permissions (section 3), so per-env buckets plus per-env tokens in one account give credential isolation without a second account. A second account adds the AWS-style blast-radius boundary: billing, admin tokens, and zones, since custom domains must sit in the same account as the bucket. For a team of this size, separate buckets with scoped tokens is the proportionate choice; a separate account is optional hardening.

**The real problem: a dev DB copied from prod points at prod objects.** No primary source offers a turnkey fix. The documented experience is:
- Rails maintainers on restoring prod into staging: rows reference prod storage. If dev resolves them to its own service, "writes, replacements, or deletions in development could modify or destroy production files." A FallbackService was suggested, but no read-only replication shipped. https://discuss.rubyonrails.org/t/activestorage-and-database-cloning/73841
- Discourse restores into a new host or bucket hit URL-remap failures when rows store absolute URLs. https://meta.discourse.org/t/restore-to-new-host/219515 · https://meta.discourse.org/t/uploads-missing-after-restore/225121

Options, from strongest to weakest (my synthesis, built from the primitives above):
- **A. Read-only prod token in dev plus a read fallback.** Dev holds an **Object Read only** token scoped to the prod buckets, and a separate **Object Read & Write** token for the dev buckets. Reads of a key go to the dev bucket first and fall back to the prod bucket (private: presign a GET against prod; public: the prod public domain serves it anyway). Writes and deletes only ever reach dev buckets. **A dev delete physically cannot touch prod, because the token lacks the permission.** That is the guarantee the owner wants. Deleting a row that points at a prod-only key removes nothing (or 404s), which is harmless.
- **B. Copy on write / copy on read.** Sippy does copy-on-read, but R2 is **not** a listed Sippy source (sources: S3, GCS, Azure, S3-compatible). https://developers.cloudflare.com/r2/data-migration/sippy/ R2-as-source might work through the "S3-compatible" path, but this is **UNVERIFIED**, and it would also copy customer recordings into dev. Super Slurper does list R2 as a source and supports a sub-path and Skip/Overwrite, so you can snapshot prod into dev after each `db:refresh:dev`. https://developers.cloudflare.com/r2/data-migration/super-slurper/ Recordings are PII; they should be excluded from dev.
- **C. Scrub URLs and keys during the DB refresh.** Null private keys and keep public keys, which still resolve because the public bucket's domain is public. This fits the existing `db:refresh:dev` scrub step.
- **D. Prefix per env in a shared bucket** (`dev/…`). This is the weakest: one token can still delete prod keys, and Rails and Discourse advise against it.

**Rule that makes A and C cheap:** the DB stores `bucket-role + key`, never a full URL, and never the physical bucket name (section 4). Which physical bucket a role maps to is env config.

---

## 3. Credentials

- **Four permission levels:** Admin Read & Write (create, list and delete buckets, plus config), Admin Read only, Object Read & Write, Object Read only. Only the **Object** levels can be scoped to specific buckets, and "are only supported by the S3-compatible API". https://developers.cloudflare.com/r2/api/tokens/
- **How S3 keys derive from the token (confirmed):** "Access Key ID: The `id` of the API token. Secret Access Key: The SHA-256 hash of the API token `value`." https://developers.cloudflare.com/r2/api/tokens/ (API section). Revoking the token therefore kills the S3 key pair, and you rotate by creating a new token and revoking the old one.
- Account API tokens "remain valid until manually revoked or until they reach a preset expiration date". You can set an expiry and a client IP filter at creation. https://developers.cloudflare.com/r2/api/tokens/
- **Temporary credentials (new, docs updated 2026-10-16):** short-lived STS-style credentials derived from a parent token. Each is bound to **one bucket**, optionally to `prefixes`/`objects`, and (with local JWT signing) to specific S3 `actions` such as `["GetObject","HeadObject"]`. They "cannot exceed the permissions of its parent token." https://developers.cloudflare.com/r2/api/s3/temporary-credentials/ This is a possible way to give the QStash variant job a prefix-scoped credential. It is optional.
- Mastodon recommends a dedicated, app-specific credential rather than the admin one (its MinIO guidance: "not the admin account"). https://docs.joinmastodon.org/admin/optional/object-storage/

**Today's single admin token, shared by laptop and prod, is the root cause of "a dev delete removes prod objects".** Admin R&W can also delete buckets and change CORS and lifecycle settings.

---

## 4. Object key design and DB storage

**What real code does**
- **Documenso:** `${alphaid(12)}/${slugify(name)}${ext}`, optionally prefixed with `${userId}/`, with a random fallback when the slug is empty or longer than 100 characters. The DB stores the key; a GET is presigned at read time. https://github.com/documenso/documenso/blob/main/packages/lib/universal/upload/providers/s3-provider.ts
- **Medusa:** `${prefix}${dir}/${name}-${ulid()}${ext}`. The original filename goes into metadata (`original-filename`), not into the identity of the key. It returns `{ url: fileUrl + encodedKey, key }`. https://github.com/medusajs/medusa/blob/develop/packages/modules/providers/file-s3/src/services/s3-file.ts
- **Dub:** keys are validated by `assertSafeStorageKey`, which rejects a leading `/`, `//`, `..`, encoded dots, control characters, `?`/`#`, and anything over 1024 bytes, because the signer "would resolve to a different path". https://github.com/dubinc/dub/blob/main/apps/web/lib/storage/assert-safe-storage-key.ts
- **Twenty:** the DB stores a file id, and the URL is minted per request as `${SERVER_URL}/file/${folder}/${fileId}?token=<JWT>` (FILE_TOKEN_EXPIRES_IN). https://github.com/twentyhq/twenty/blob/main/packages/twenty-server/src/engine/core-modules/file/file-url/file-url.service.ts
- **Payload:** a `prefix` per collection, plus a single `generateFileURL` hook to override URL building. https://payloadcms.com/docs/upload/storage-adapters
- **Mastodon:** `S3_ALIAS_HOST` hides the storage provider so that "you can switch providers without changing media URLs". https://docs.joinmastodon.org/admin/optional/object-storage/

**R2 constraints that matter:** keys are at most 1,024 bytes, and concurrent writes to the same key are limited to 1/sec (429 above that). https://developers.cloudflare.com/r2/platform/limits/ `PutObject` supports `If-None-Match` evaluated "atomically", so a create-only write can never overwrite. https://developers.cloudflare.com/r2/api/s3/api/

**Recommended conventions (synthesis)**
- Layout: `<group>/<entityId>/<uuidv7>/original.<ext>`, with variants as siblings: `…/<uuid>/w640.webp`, `…/<uuid>/w1280.webp`. A per-asset folder lets you delete the original and its variants with one prefix delete, and a sweep can tell which variants belong to which original.
- Never put the user's filename in the key. Keep it in a DB column, or in `Content-Disposition` for downloads. All five codebases above either slugify the name or move it out of the key entirely.
- Keys are immutable: a replaced image gets a new uuid. Then `Cache-Control: public, max-age=31536000, immutable` is safe (Medusa's default is `public, max-age=31536000`), and the CDN never serves a stale overwrite.
- Content-hash keys (sha256) give dedupe and idempotency, but the hash must be known before upload (computed in the browser) and deletes then need reference counting. For this app, uuid keys plus a DB row are simpler.
- **The DB stores `{ bucket role ('public'|'private'), key }`, never a full URL and never the physical bucket name.** One helper, `publicUrl(key)` = `${PUBLIC_MEDIA_ORIGIN}/${encodeKey(key)}`, and one for private, `signedGetUrl(key, ttl)`. A domain change then becomes a one-line env change instead of a backfill. Discourse's restore-remap failures above show the cost of the alternative. Migrating rows that store full URLs means parsing the key out of the URL, writing the key column, then dropping the URL column.

---

## 5. Upload robustness

**Checksum trap (AWS SDK v3 ≥ 3.729.0)**
- Since Dec 2024 the SDKs compute a CRC by default. In JS the default is CRC32. `request_checksum_calculation` / `response_checksum_validation` both default to `WHEN_SUPPORTED`. `WHEN_REQUIRED` = "performed only when required by the API operation". Both settings are also available as the env vars `AWS_REQUEST_CHECKSUM_CALCULATION` and `AWS_RESPONSE_CHECKSUM_VALIDATION`. https://docs.aws.amazon.com/sdkref/latest/guide/feature-dataintegrity.html
- Cloudflare's aws-sdk-js-v3 page *used to* say "Client version 3.729.0 introduced a modification to the default checksum behavior from the client that is currently incompatible with R2 APIs", with `requestChecksumCalculation/responseChecksumValidation: "WHEN_REQUIRED"` as the fix. This is quoted in https://roboin.io/article/2025/06/05/how-to-fix-cloudflare-r2-internal-error . **The current page no longer carries that note** (checked 2026-10-20: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/ ). R2's compatibility table now lists CRC-32/CRC-32C as "COMPOSITE only" and CRC-64/NVME as "FULL_OBJECT", and the changelog records CRC-64/NVME support on 2025-07-03. https://developers.cloudflare.com/r2/api/s3/api/ · https://developers.cloudflare.com/r2/reference/changelog/
- **The presigned-PUT problem is client-side and remains regardless.** With the default setting, `getSignedUrl(PutObjectCommand)` signs `x-amz-checksum-crc32=AAAAAA==` (the CRC of an empty body) and `x-amz-sdk-checksum-algorithm=CRC32` into the URL, so the browser's real body fails. Reports: https://git.deuxfleurs.fr/Deuxfleurs/garage/issues/1236 · https://station.railway.com/questions/internal-server-error-uploading-to-a-buc-1560e040 . For presigned GETs, see aws-sdk-js-v3 #6994; the maintainer points to `responseChecksumValidation: 'WHEN_REQUIRED'`. https://github.com/aws/aws-sdk-js-v3/issues/6994
- **Production code that does exactly this:** Documenso's S3Client sets both to `'WHEN_REQUIRED'`, with a comment saying S3-compatible providers reject the default. https://github.com/documenso/documenso/blob/main/packages/lib/universal/upload/providers/s3-provider.ts
- **Do:** set both on the single shared S3Client, and add a test asserting the presigned URL contains no `x-amz-checksum-` parameter.

**Presigned PUT constraints**
- Expiry ranges from 1 s to 7 days. GET, HEAD, PUT and DELETE are supported; **POST (form uploads with `content-length-range`) is not supported**. Presigned URLs **cannot be used with custom domains**, only with the `<account>.r2.cloudflarestorage.com` S3 domain. If you sign `ContentType`, a mismatched header gives a 403 `SignatureDoesNotMatch`. Treat the URLs as bearer tokens. https://developers.cloudflare.com/r2/api/s3/presigned-urls/
- **Size limits:** without POST policies, sign `Content-Length` into the PUT. Dub's `getSignedUploadUrl` adds both `Content-Length` and `Content-Type` to the signed headers, so the browser must send exactly those values. https://github.com/dubinc/dub/blob/main/apps/web/lib/storage.ts With `@aws-sdk/s3-request-presigner`, the equivalent is passing `ContentLength` in the command; check that it lands in `X-Amz-SignedHeaders` (**verify in a test**, since the presigner hoists some headers into the query string). The single-PUT maximum is 5 GiB. https://developers.cloudflare.com/r2/platform/limits/
- **Create-only:** Payload's client uploads need the CORS rule to allow the `If-None-Match` header (https://payloadcms.com/docs/upload/storage-adapters). R2 evaluates `If-None-Match: *` atomically (https://developers.cloudflare.com/r2/api/s3/api/). Signing `If-None-Match: *` means a leaked URL cannot overwrite an existing key.
- **Verify before writing the DB row.** The client tells the server "done", the server runs `HeadObject(key)` and checks `ContentLength` ≤ limit and `ContentType` is in the allowlist (and, optionally, sniffs the magic bytes), and only then inserts the row and enqueues the variant job. R2 reads are strongly, globally consistent, so a HEAD right after the PUT sees the object. https://developers.cloudflare.com/r2/reference/consistency/ Dub's client exposes `head()` for this purpose. Alternatively, R2 event notifications (`object-create` → Queue, with prefix/suffix filters, consumed by a Worker or by HTTP pull) can confirm uploads server-side without trusting the client. https://developers.cloudflare.com/r2/buckets/event-notifications/

**CORS (verified against the docs' markdown source)**
- `AllowedOrigins` is either `*` or an origin pattern. "An origin pattern can contain at most one `*` wildcard. The wildcard can span periods." `https://*.example.com` matches subdomains but not the apex. "**Ports cannot contain wildcards** … list each origin separately, such as `http://localhost:3000` and `http://localhost:5173`." No path component is allowed. https://developers.cloudflare.com/r2/buckets/cors/
- Presigned URLs still need CORS. An expired URL returns a 403 with no CORS headers, so the browser cannot read the error. Changes take about 30 s to propagate. Cached objects on a custom domain keep their old CORS headers until the cache is purged. CORS headers are only sent when the request has an `Origin` header. https://developers.cloudflare.com/r2/buckets/cors/
- **CORS is per bucket, which is another reason to keep buckets per environment.** Prod buckets allow only the prod origins. Dev buckets allow `http://localhost:3000`, `:3001`, … (one entry per worktree port), the static ngrok host `https://destined-emu-bold.ngrok-free.app`, and Vercel previews through one wildcard such as `https://tri-pros-website-*.vercel.app` (one `*` is allowed). Check the exact preview hostname shape for this team before relying on it.
- The only methods browsers need on the S3 endpoint are `PUT` (upload) and `GET`/`HEAD` (presigned reads). Allowed headers: `Content-Type`, `Content-Length` if signed, and `If-None-Match` if used. Expose `ETag`.

---

## 6. Lifecycle, orphans, deletion safety

- **Lifecycle rules:** filter by prefix; expire after N days or on a date; abort incomplete multipart uploads after N days; transition to Infrequent Access. The default rule aborts multipart uploads after 7 days. The maximum is 1,000 rules. Deletion happens "typically … within 24 hours". https://developers.cloudflare.com/r2/buckets/object-lifecycles/ Lifecycle deletes emit `object-delete` events (`LifecycleDeletion`). https://developers.cloudflare.com/r2/buckets/event-notifications/
- **Pending-upload prefix:** browsers upload to `tmp/<uuid>/…` (expires after 1 day). On confirmation, the server `CopyObject`s the object to its final key and deletes the tmp copy, or the variant job writes the final keys. Abandoned uploads clean themselves up. Trade-off: one extra CopyObject (a Class A operation) per upload. The cheaper alternative is to upload straight to the final key and rely on the orphan sweep.
- **Orphan sweep (DB↔bucket reconciliation):** Rails documents why it is needed: "There are cases where a file is uploaded but never attached to a record", cleaned up with `purge_later`, and the unattached query "can be slow" on large DBs. https://guides.rubyonrails.org/active_storage_overview.html The pattern is a scheduled job that runs `ListObjectsV2` per prefix and finds keys with no DB row older than N days. It moves them to a `trash/` prefix (expires after 30 days via lifecycle) or deletes them. It also lists DB keys with no object (broken references) for a report.
- **Soft delete with delayed purge:** a parent delete marks rows and enqueues an object delete after a grace period, or moves the objects to `trash/` (lifecycle expiry). This substitutes for versioning, which R2 does not have.
- **Versioning / Object Lock:** `PutBucketVersioning` is unimplemented, and object lock is unsupported. `GetBucketVersioning` exists only as a "dummy". https://developers.cloudflare.com/r2/api/s3/api/ · https://developers.cloudflare.com/r2/reference/changelog/
- **Bucket locks (R2-native WORM-ish):** prefix-scoped retention by age, date or indefinite, enforced on existing and new objects. "Bucket lock rules take precedence over lifecycle rules." A bucket cannot be emptied while locks exist. https://developers.cloudflare.com/r2/buckets/bucket-locks/ **Use:** a lock on `recordings/` (e.g. 30–90 days) makes accidental deletion of call recordings impossible during that window. Trade-off: data-subject or customer deletion requests must wait for the lock to expire. That is a legal/business decision for the owner.
- **Backups:** without versioning, the only real backup is a second bucket, e.g. Super Slurper or rclone from prod-private into a `-backup` bucket (ideally a different account, written with a token that the app does not hold). Discourse keeps a separate private backups bucket. https://meta.discourse.org/t/configure-an-s3-compatible-object-storage-provider-for-uploads/148916

---

## 7. Private files

- **Presigned GET:** 1 s to 7 days, S3 domain only (not custom domains), bearer-token semantics. Cloudflare recommends short expiry for sensitive operations. https://developers.cloudflare.com/r2/api/s3/presigned-urls/ Common TTLs in real code: Documenso 1 h, Dub 600 s (`getSignedDownloadUrl` defaults to the **private** bucket), Medusa `download_file_duration` 1 h.
- **App route (proxy or redirect):** the Rails pattern is either "redirecting" (to a signed URL) or "proxying" (the app streams the bytes). https://guides.rubyonrails.org/active_storage_overview.html Twenty uses an app route plus a short JWT `?token=`. Payload's default routes every file through `/collection/file/filename` so its access control applies. https://payloadcms.com/docs/upload/storage-adapters
  - **Redirect** (`GET /api/files/:id` → authorize → 302 to a 5-minute presigned URL): no bandwidth through Vercel, permissions are checked on every click, and the URL never sits in HTML long enough to leak. **This is the recommended default for this app.**
  - **Proxy** through a Vercel function: you pay function duration and bandwidth, and response-size limits apply. Only worth it when you need byte-range control or watermarking.
- **Edge options:** Cloudflare Access (staff-only hostname), a Worker with an R2 binding (custom auth, can use `Range`, can cache), or WAF HMAC tokens (Pro plan and up). https://developers.cloudflare.com/r2/examples/cloudflare-access/ · https://developers.cloudflare.com/waf/custom-rules/use-cases/configure-token-authentication/
- **Caching:** presigned S3-endpoint responses are not CDN-cached, because the S3 domain is not a zone you control. That is fine for recordings, which are viewed rarely. Do not put private objects behind a custom domain with Cache Everything: a cached object stays reachable at that URL until it is purged.
- **Audio playback:** the `<audio>` element sends `Range` requests, and presigned GETs support them. If JS reads `Content-Length`, expose it in CORS (the CORS docs mention this exact video-player case). https://developers.cloudflare.com/r2/buckets/cors/

---

## 8. Image delivery

- **Cloudflare Image Transformations on the zone:** `https://<zone>/cdn-cgi/image/width=640,format=auto/<source>`. Transformations must be enabled per zone, and by default only same-zone sources are allowed. https://developers.cloudflare.com/images/transform-images/ · https://developers.cloudflare.com/images/transform-images/transform-via-url/
- **Pricing:** the Free plan includes 5,000 unique transformations/month; above that, new transformations fail with a `9422` error and nothing is charged. Paid is $0.50 per 1,000 unique transformations/month. A unique transformation is billed once per calendar month regardless of cache. https://developers.cloudflare.com/images/pricing/
- Input-size and megapixel limits were not found on the pages fetched (**UNVERIFIED**).
- **Versus the pre-generated variants you already have:** pre-generated webp gives deterministic cost (storage plus one Class A write per variant), no vendor lock-in, and it works with `next/image unoptimized` or a custom loader. Transformations add `format=auto` (AVIF), arbitrary widths, and no job to keep running. A middle path is to keep the QStash variants as the canonical set and optionally add a `next/image` loader pointing at `/cdn-cgi/image/` for the public domain later. Ghost hits the same issue: it only resizes when requests go through Ghost, so a CDN-direct setup "needs a resizing layer". https://docs.ghost.org/config#storage-adapters
- **Cache:** immutable keys plus `Cache-Control: public, max-age=31536000, immutable` plus a Cache Rule to cache all extensions on the media hostname. https://developers.cloudflare.com/r2/buckets/public-buckets/

---

## 9. How open-source apps split public/private and environments

| Project | Public vs private | Environments / credentials | Keys / URLs | Source |
|---|---|---|---|---|
| **Dub** (on R2) | **Two buckets**: `STORAGE_PUBLIC_BUCKET` and `STORAGE_PRIVATE_BUCKET`. `bucket: "public"\|"private"` on every call. Public URLs come from `STORAGE_BASE_URL` (`R2_URL`, prod `https://dubassets.com`); private reads use `getSignedDownloadUrl` (600 s). | One key pair from env. | `assertSafeStorageKey`. Signed PUT includes `Content-Length` and `Content-Type`. | https://github.com/dubinc/dub/blob/main/apps/web/lib/storage.ts · https://github.com/dubinc/dub/blob/main/apps/web/.env.example |
| **Documenso** | One private bucket. Every read is a presigned GET (1 h), or CloudFront-signed when a distribution is configured. | `NEXT_PRIVATE_UPLOAD_*` env. **WHEN_REQUIRED checksums.** | `alphaid(12)/slug.ext`, DB stores the key. | https://github.com/documenso/documenso/blob/main/packages/lib/universal/upload/providers/s3-provider.ts · https://github.com/documenso/documenso/blob/main/.env.example |
| **Supabase Storage** | Bucket-level `public` flag. A public bucket "bypasses access controls for both retrieving and serving files", but uploads, deletes, moves and copies are still controlled. Private is the default, accessed with a JWT or `createSignedUrl`. Public is for avatars and blog assets; private for personal documents. | One project per env (platform convention). | n/a | https://supabase.com/docs/guides/storage/buckets/fundamentals |
| **Discourse** | Uploads bucket **public**, backups bucket **private** (R2 guidance). "Secure uploads" (private) are AWS-only. A CDN is required (`DISCOURSE_S3_CDN_URL`). | "Using the same bucket for production and staging is not recommended." One Object R&W token covers both buckets. | Absolute URLs in posts lead to remap pain on restore. | https://meta.discourse.org/t/configure-an-s3-compatible-object-storage-provider-for-uploads/148916 |
| **Mastodon** | A single public-read media bucket. Must be "publicly readable but not writable or listable". On R2, `S3_PERMISSION=""` (no ACLs). | Dedicated, non-admin credential. | `S3_ALIAS_HOST` decouples URLs from the provider. | https://docs.joinmastodon.org/admin/optional/object-storage/ |
| **Payload CMS** | Default: files go through Payload routes (access control). `disablePayloadAccessControl: true` means direct bucket URLs, so the bucket must be public. `signedDownloads` for presigned. | Per-collection `prefix`. | `generateFileURL` is the single URL hook. `clientUploads` needs CORS `PUT` + `If-None-Match`. | https://payloadcms.com/docs/upload/storage-adapters |
| **Medusa** | One bucket with ACL `public-read`/`private` per file (does not work on R2). Code comment: "We probably also want to support a separate bucket altogether for private files". | `prefix` option. | `name-ulid.ext`, original filename in metadata. Returns `{url,key}`. Cache-Control 1 year by default. | https://github.com/medusajs/medusa/blob/develop/packages/modules/providers/file-s3/src/services/s3-file.ts |
| **Twenty** | Files private behind the app: `/file/<folder>/<id>?token=<JWT>`. | S3 or local driver via `STORAGE_*` env. | DB stores the id, URL is minted per request. | https://github.com/twentyhq/twenty/blob/main/packages/twenty-server/src/engine/core-modules/file/file-url/file-url.service.ts |
| **Ghost** | Built-in `S3Storage` adapter; images, media and files can each have their own adapter. Switching does not migrate existing files. | n/a | n/a | https://docs.ghost.org/config#storage-adapters |
| **Immich** | No official S3 backend found; local storage templates only (community forks exist). | n/a | n/a | https://docs.immich.app/administration/storage-template/ |
| **Cal.com** | Not checked in depth; no meaningful S3 storage layer found in a code search. | n/a | n/a | n/a |

**Pattern:** projects that run on R2 or care about privacy (Dub, Discourse on R2) use **two buckets selected by a role enum**. Projects with a single bucket either rely on per-object ACLs, which R2 lacks (Medusa, Mastodon on AWS), or keep everything private behind the app (Documenso, Twenty).

---

## 10. Retiring the legacy duplicate bucket

1. **Inventory.** `ListObjectsV2` both buckets into key, size and ETag lists. ETags are not reliable across Super Slurper or multipart copies ("ETags are not guaranteed to be equal"), so compare size plus a content hash for mismatches. https://developers.cloudflare.com/r2/data-migration/super-slurper/
2. **Reference check.** Grep every URL and key column in the prod DB (and any hardcoded URLs in code and env) for the legacy bucket's hostname and name. Every hit is migrated (copied, with the DB rewritten to `{role,key}`) or confirmed dead.
3. **Copy what remains needed** with Super Slurper (R2 is a supported source; it has a sub-path filter and Skip/Overwrite) or rclone. https://developers.cloudflare.com/r2/data-migration/super-slurper/
4. **Quarantine before deleting.** Disable public access (r2.dev and custom domain) on the legacy bucket and **revoke its tokens' access**, then watch for 404s or errors for 1–2 weeks. Disabling a domain only stops access through that domain. https://developers.cloudflare.com/r2/buckets/public-buckets/
5. **Empty, then delete.** "To delete an R2 bucket, you must first remove all objects from it." Use the dashboard's Empty Bucket, or a lifecycle rule with no prefix and a 1-day expiry, removing the rule afterwards. Bucket locks must be removed first. https://developers.cloudflare.com/r2/buckets/delete-buckets/ (Unlike AWS, R2 bucket names are scoped to the account, so AWS's advice against deleting buckets to stop name squatting does not carry over. AWS context: https://docs.aws.amazon.com/AmazonS3/latest/userguide/security-best-practices.html )

---

## Recommended shape for this app

### Buckets (4, plus an optional backup bucket)

| Role | Prod | Dev (laptop, worktrees, Vercel preview) | Public? |
|---|---|---|---|
| public | `tpr-public-prod` → `media.<domain>` custom domain (Cache Rule: cache all, Smart Tiered Cache) | `tpr-public-dev` → `media-dev.<domain>` custom domain (avoid r2.dev, even for dev) | Yes |
| private | `tpr-private-prod` (no r2.dev, no custom domain) | `tpr-private-dev` | **Never** |
| backup (optional) | `tpr-private-backup`, ideally in a 2nd Cloudflare account, filled by a scheduled Super Slurper/rclone run | none | No |

The legacy duplicate bucket, the r2.dev "company docs" bucket and the leftovers in the recordings bucket all migrate into these and are then deleted using section 10.

### Prefixes (asset group, then entity, then asset)
- Public: `site/…` (marketing and portfolio), `projects/<projectId>/<uuid>/…`, `proposals/<proposalId>/<uuid>/…`, `docs/<slug>/<uuid>/…` (company docs that are genuinely public), `tmp/<uuid>/…`
- Private: `recordings/<callId>/<uuid>.<ext>`, `customers/<customerId>/<uuid>/…`, `contracts/<proposalId>/<uuid>.pdf`, `tmp/<uuid>/…`, `trash/…`
- Each asset: `…/<uuidv7>/original.<ext>` plus siblings `w640.webp`, `w1280.webp`, … No user filenames in keys; keys are immutable and validated with a Dub-style `isSafeStorageKey`.

### Environment rule
- Env config maps `role → physical bucket + public origin`. The DB stores **`storage_role` + `storage_key`** only. That gives one module with `publicUrl(key)`, `signedGetUrl(key, ttl)`, `signedPutUrl({role,key,contentType,contentLength})`, `head`, `delete`, and the single S3Client (with `requestChecksumCalculation` and `responseChecksumValidation` set to `'WHEN_REQUIRED'`).
- Dev reads fall back to prod. **Public:** the row carries an `env` origin flag (or keys created in dev get a `dev/` marker), so `publicUrl()` in dev serves dev-made keys from `media-dev.<domain>` and inherited keys from `media.<domain>`. It is a read only; the prod public domain is public anyway. **Private:** dev holds a prod **Object Read only** token, or nothing at all if the owner prefers that dev never sees recordings (decision 3). Writes and deletes in dev only ever reach dev buckets.
- `db:refresh:dev` scrubs: optionally null private keys (recordings, customer documents) so prod PII never renders in dev.

### Tokens (Account API tokens, named `tpr-r2-<env>-<scope>`, with an expiry date, rotated by create-new-then-revoke)
- `tpr-r2-prod-rw`: Object Read & Write on `tpr-public-prod` and `tpr-private-prod`. Vercel **Production** env only.
- `tpr-r2-dev-rw`: Object Read & Write on `tpr-public-dev` and `tpr-private-dev`. `.env.local` and Vercel Preview/Development.
- `tpr-r2-dev-prod-ro` (optional): Object Read only on the prod buckets, for dev fallback reads.
- `tpr-r2-admin`: Admin R&W, **not in any app env**. Kept in a password manager for wrangler bucket, CORS and lifecycle work.
- The current admin token is revoked once these are live. Revoking it also kills its derived S3 key pair (key id = token id).

### CORS (per bucket)
- Prod buckets: `https://<prod domain>`, `https://www.<prod domain>`. Methods `PUT, GET, HEAD`. Headers `Content-Type, Content-Length, If-None-Match`. Expose `ETag, Content-Length`. MaxAge 3600.
- Dev buckets: `http://localhost:3000` … `:3005` (listed one by one, since ports cannot be wildcards), `https://destined-emu-bold.ngrok-free.app`, `https://tri-pros-website-*.vercel.app` (one wildcard; confirm the preview hostname pattern).

### Lifecycle rules
- Both roles and envs: `tmp/` expires after 1 day; abort multipart uploads after 1 day (the default is 7); `trash/` expires after 30 days.
- Dev buckets: optionally expire everything after 90 days, which keeps dev cheap and makes clear that dev data is disposable.
- Prod private: a **bucket lock** on `recordings/` for N days (decision 4).

### Upload flow
1. The client asks the server for an upload with `{group, entityId, contentType, size}`. The server authorizes, checks type and size against an allowlist, and mints the key (`tmp/<uuid>/original.<ext>`, or directly the final key; decision 6).
2. The server returns a presigned PUT (TTL 5–10 minutes) signed with `Content-Type`, `Content-Length` and `If-None-Match: *`. A unit test asserts there is no `x-amz-checksum-` parameter in the URL.
3. The browser PUTs, then calls `confirm(uploadId)`.
4. The server runs `HeadObject`: size matches, type matches, optionally a magic-byte sniff with a ranged GET of the first bytes. If it fails, delete the object and return an error.
5. In a transaction: insert the DB row `{role,key,…}` and enqueue the QStash variant job, which writes the sibling `wNNN.webp` keys. (If using `tmp/`, the job also copies to the final key and deletes the tmp object.)
6. Parent delete: soft-delete the rows, then a job deletes the object prefix (`…/<uuid>/`) after a grace period, or moves it to `trash/`.
7. A weekly reconciliation job lists each prefix and compares it with the DB. It reports and trashes orphans older than 7 days and reports dangling DB references.

### Private reads
- `GET /api/files/:id` → authorize the actor → 302 to a presigned GET (300 s). Recordings and contracts are never stored or rendered as long-lived URLs.

### Trade-offs
- Four buckets plus per-env tokens add a little configuration, in exchange for a guarantee: a dev mistake cannot reach prod data, because credentials and CORS physically separate the environments.
- Redirect-to-presigned keeps Vercel bandwidth at zero, but every view of a private file costs one server hop, and the S3 endpoint is not CDN-cached. That is acceptable at this volume.
- The `tmp/` and copy step costs one extra Class A operation per upload, in exchange for zero orphans from abandoned uploads. Uploading straight to the final key plus the sweep is cheaper and nearly as clean.
- Bucket locks protect recordings, but deletion requests cannot be honored before the lock expires.

### Decisions only the owner can make
1. **Is any "company docs" content actually private?** If it is, it goes to the private bucket behind `/api/files`; today it is public on r2.dev.
2. **Dev and prod media:** fallback reads (dev shows prod images, needs a read-only token) vs Super Slurper snapshots into dev after each DB refresh vs dev shows nothing that it did not upload itself.
3. **Should dev ever be able to read prod customer recordings?** Recommendation: no. Scrub the private keys in `db:refresh:dev` and give dev no prod private token.
4. **Retention for recordings:** how long they are kept (CA two-party-consent recordings, customer deletion requests) and whether to bucket-lock them for N days.
5. **Second Cloudflare account** for prod and/or backups: worth the extra blast-radius isolation, or are scoped tokens enough?
6. **`tmp/` + copy vs direct-to-final + sweep.**
7. **Public media domain name**, and whether the custom domains need to change at all (they must sit in a zone in the same account as the buckets).
8. **Pre-generated variants only, or also enable Image Transformations** (5k unique/month free, then $0.50/1k) for AVIF and arbitrary widths.
