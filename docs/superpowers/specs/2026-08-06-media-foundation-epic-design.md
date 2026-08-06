# Media Foundation Epic (Plan 1.5) — Design Spec

> **Position:** After **Plan 1** (Proposal Media Subsystem — shipped on `main`, 2026-08-05) and before **Plan 1B** (video via Cloudflare Stream + PDF raster). This epic hardens the media *foundation* — storage topology, public serving, and shared media UX — so Plan 1B builds on solid ground.

> **For agentic workers:** this is an **epic charter**, not a single implementation plan. It decomposes into four sub-plans, each of which gets its own `writing-plans` implementation plan and its own `subagent-driven-development` execution run, in the sequence defined under **Decomposition**.

**Goal:** Move proposal media off the private/presigned model onto a public, CDN-cached, responsive-`srcSet` render path identical to portfolio; consolidate all media into one canonical public bucket `tpr-media`; and lift the lightbox + multi-select/bulk ergonomics into shared, reusable primitives — migrating existing data with zero URL breakage.

**Architecture (in one breath):** A single canonical public R2 bucket (`tpr-media`) behind the existing `media.triprosremodeling.com` CDN, path-namespaced (`projects/*`, `proposals/*`). Object keys carry ~122 bits of UUID entropy (unguessable capability URLs). Render URLs are **derived just-in-time** from `pathKey` + `bucket` (no presigning, no stored `url` for proposals, no `width`/`height` columns). One shared YARL lightbox and one shared selection/bulk layer serve both proposals and portfolio.

**Tech stack:** Next.js 15 (App Router) on Vercel · Cloudflare R2 (S3-compatible, `@aws-sdk/client-s3`) · sharp (image variants) · tRPC + TanStack Query · Drizzle (Postgres/Neon) · Tailwind v4 · motion/react · dnd-kit · yet-another-react-lightbox (new dep).

---

## Global Constraints

- **Work on `main`; stage by explicit path** — never `git add -A`. Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **No `pnpm build`** — verify with `pnpm tsc` + `pnpm lint` only. There is no unit-test runner; validation is type/lint + manual browser parity + dev-first migration dry-runs.
- **DB pushes:** `pnpm db:push:dev` only; prod is explicit `db:push:prod` (user-only). Migration scripts target prod DB **only** via `DRIZZLE_TARGET=prod` — never `NODE_ENV`.
- **Import direction:** `src/shared/**` must never import `@/features/**`. Shared media UI stays owner-agnostic (DI'd slots/actions).
- **Company data** comes from `src/shared/constants/company/` — never hardcode.
- **Uploads are always presigned PUT** to R2's S3 endpoint (never public writes); only the *read* path is public.
- **`tpr-company-docs` is out of scope** — it is a distinct asset class (contractor/finance docs, own lifecycle) and stays its own bucket. `tpr-media` is the canonical **media** bucket (project + proposal images/video/PDF) only.
- **Trust-but-verify:** before asserting any documented business rule, confirm against code; ping on staleness.

---

## Context & Motivation

Plan 1 generalized project-only media into a reusable owner-parameterized `mediaService` + `MediaStore` and built proposal media on a **private `tpr-homeowner-files` bucket with per-render presigned URLs**. That data layer is sound; the **render layer was never ported**, which produced two user-visible defects and a structural mismatch:

1. **Jank / oversized images.** The homeowner gallery and proposal manager render a bare `<img src={presignedUrl}>` of a single `lg`-or-original variant — a 1920px+ file downloaded into a 150px tile, decoding to a ~48MB bitmap regardless of CSS box size. Portfolio avoids this with a responsive `srcSet` that fetches the `sm` variant for a small slot.
2. **No lightbox.** Proposal images aren't clickable; portfolio has a (hand-rolled) lightbox.
3. **Structural mismatch.** The portfolio render stack (`getOptimizedSrcSet` → `OptimizedImage`) requires **stable, client-derivable, cacheable** URLs. Presigned URLs are the opposite: a rotating query-string signature per render, un-cacheable, un-`srcSet`-able. You cannot "just duplicate" portfolio's approach onto presigned URLs.

**Root cause:** the private/presigned model is fundamentally incompatible with the public-CDN + client-derived-`srcSet` render path that makes portfolio fast.

### Decision: serve proposal media public (researched, not assumed)

Homeowner proposal photos are pictures of people's properties — **not** PHI/PCI/financial/credential data — already visible to both the homeowner and the agent. Object keys are `proposals/<proposalId-uuid>/<fileId-uuid>.ext`: two independent `crypto.randomUUID()` v4 values (~122 bits in the filename alone). Research (W3C TAG "Capability URLs", OWASP, Schneier; and the real-world defaults of Google Photos link-sharing, Drive/Dropbox, Cloudinary/imgix) concludes an **unguessable public URL is a mainstream, defensible access model for this sensitivity tier**, and that streaming bytes through a Vercel Function proxy is a cost/perf anti-pattern (it discards R2's free egress and CDN caching). The only real trade-offs vs presigning — weaker revocation and an unbounded leak window — are low-impact here and mitigated with cheap guardrails + an optional re-key hatch.

### Decision: one canonical bucket `tpr-media`

Naming `tpr-portfolio-projects` as the home for proposal media would be dishonest. We consolidate portfolio **and** proposal media into a single canonical public bucket **`tpr-media`**, path-namespaced. R2 cannot rename a bucket in place, so this is a create-new + migrate + domain-move operation — accepted, and designed below for zero URL breakage.

---

## Architecture Decisions & Rationale

| Decision | Rationale |
|---|---|
| **Public bucket + unguessable UUID keys** for all media | Capability-URL model; validated for this data sensitivity. Enables CDN caching + client-derived `srcSet`. |
| **Single canonical bucket `tpr-media`**, path-namespaced (`projects/*`, `proposals/*`) | Honest naming; one CDN; one CORS/lifecycle to reason about; simplest topology satisfying "one `media.` subdomain." (Worker/multi-bucket routing explicitly declined for its cutover + maintenance cost.) |
| **Derive read URLs JIT** from `pathKey` + `bucket` (`getOptimizedSrc`/`getOptimizedSrcSet`) | No presigning; no stored `url` column for proposals; consistent with our derived-values pattern (JIT default). Proposal media inherits portfolio's exact render path. |
| **No `width`/`height` columns** | Only YARL's *native* image-slide API demands them; we render lightbox slides via our existing `OptimizedImage`-style string `srcSet` (custom slide), exactly as portfolio's current lightbox already does dimension-free. Avoids a schema migration. |
| **Add `xs` (~320w) variant** | Tiny grid tiles (e.g. 150–220px) should fetch ~320w, not 640w. Additive: legacy rows without `xs` fall back to `sm` via the `optimizationVariants` list. Benefits portfolio too. |
| **Shared YARL `MediaLightbox` + `buildLightboxSlides`** (full YARL package, plugin system) | Battle-tested, robust, plugin-extensible (Thumbnails/Zoom/Video/Captions). Reused by proposals + portfolio; retires the hand-rolled `PhotoLightbox`. |
| **Generalized `MediaManager` selection/bulk layer** | Multi-drag already lives in the shared `MediaReorderGrid`; only the orchestrator is selection-blind. Lift the toolbar (owner-agnostic, DI'd actions) so proposals gain multi-select/bulk. |

### Guardrails (because homeowner photos now share a public bucket)

- `Referrer-Policy: strict-origin-when-cross-origin` and `X-Robots-Tag: noindex` on proposal pages/media responses.
- Never log full media URLs (scrub in analytics/error paths).
- **Optional re-key hatch** (design-in, don't necessarily build): a rotating path segment `proposals/<proposalId>/<rotationId>/<fileId>.ext` allows bulk revocation by re-keying. Deferred unless a concrete revocation need appears; keys are already unguessable.

---

## Decomposition (the mini epic)

Four sub-plans. Each is a self-contained, independently testable deliverable with its own implementation plan and execution run.

```
Sub-plan 1: Canonical bucket + migration  ── foundation ──┐
                                                          ├─► Sub-plan 2: Proposal media public render
                                                          │        └─► Sub-plan 3: Shared YARL lightbox (proposals)
Sub-plan 4: Shared multi-select/bulk UX ──(independent)───┘   Sub-plan 3 also serves portfolio independently
```

**Ordering:** 1 → 2 → 3, with 4 runnable in parallel or interleaved (it only touches the shared media UI + proposal router, not storage). Do **1 first, alone** — everything reads from `tpr-media` afterward.

### Sub-plan 1 — Canonical bucket consolidation + migration (FOUNDATION)

**Outcome:** All media served from `tpr-media`; old buckets decommissioned; zero URL breakage.

Scope:
- **Constants sweep.** `R2_BUCKETS` → `{ media: 'tpr-media', companyDocs: 'tpr-company-docs' }` (remove `portfolioProjects`, `homeownerFiles`). `R2_PUBLIC_DOMAINS` → `{ 'tpr-media': 'https://media.triprosremodeling.com', 'tpr-company-docs': '…r2.dev' }`. Project-wide discovery + replace every reference to the old constants/bucket strings (stores, E2 import `copyObject`, `deleteMediaWithVariants`, `resolve-media-url`, `get-optimized-urls`, tests, scripts). Verify with a post-change grep for all four names.
- **Stores.** `projectMediaStore.bucket` and `proposalMediaStore.bucket` → `R2_BUCKETS.media`. `buildPathKey` unchanged.
- **Migration script** (`scripts/…`, uses `./lib/load-env`, dev-first, resumable/idempotent, `--dry-run`): server-side `CopyObject` every object (originals **and** existing variant siblings, **same keys**) from `tpr-portfolio-projects/*` and `tpr-homeowner-files/proposals/*` → `tpr-media/*`. Batched, logs progress, safe to re-run as a delta sync.
- **DB backfill script:** set `media_files.bucket` and `proposal_media_files.bucket` to `'tpr-media'`. Stored `media_files.url` values already point at `media.triprosremodeling.com/<key>` and stay valid (domain unchanged). Dev first; prod via explicit `DRIZZLE_TARGET=prod`.
- **Cloudflare (user-run, we provide exact steps + scripts):** create `tpr-media`; copy the portfolio bucket's CORS policy onto it; after copy + code deploy + DB backfill, **move the `media.triprosremodeling.com` custom domain** from `tpr-portfolio-projects` → `tpr-media`.
- **Decommission (after safety window):** delete old objects; remove `tpr-portfolio-projects` + `tpr-homeowner-files`.

**Cutover sequence (near-seamless — both buckets hold objects during transition; only true gap is a seconds-long domain rebind):**
1. Create `tpr-media` + CORS.
2. Copy-first: full `CopyObject` migration (re-runnable delta sync). `tpr-media` becomes a superset.
3. **Short off-hours window:** final delta re-copy → deploy code (constants/stores) + DB backfill (dev then prod) → move custom domain to `tpr-media` → verify portfolio + proposal images load and a fresh upload round-trips.
4. Safety window, then decommission old buckets.

**Gates / risks:**
- Domain can bind only one bucket → the rebind is atomic; keep code-deploy → domain-move back-to-back inside the window to avoid a "new upload lands in `tpr-media` but domain still serves old bucket" gap.
- **Rollback:** old buckets retain all objects until decommission; revert the domain to `tpr-portfolio-projects` + revert the `bucket` backfill to restore the prior state.
- Verify migration completeness (object counts per prefix match) before backfill; verify grep-clean rename before deploy.

### Sub-plan 2 — Proposal media goes public (render layer)

**Outcome:** Proposal media renders exactly like portfolio — fast, responsive, cacheable.

Scope:
- **Delete presigned reads.** Remove `resolveProposalMediaUrl` presigning; proposal reads (`list`, `getFullView.media`, `listImportableProposalMedia`, `toProposalMediaView`) return `pathKey` + `bucket` + `optimizationVariants` so the client derives `src`/`srcSet` via `getOptimizedSrc`/`getOptimizedSrcSet`. Confirm during planning whether `proposal_media_files` needs any read-shape change (it has no `url` column by design — derive).
- **`xs` variant.** Add `xs: 320` to `VARIANT_WIDTHS` and the sharp variant set in the optimize pipeline. Ensure `OptimizedImage`/`getOptimizedSrcSet` include `xs` when present and fall back gracefully when absent.
- **Port render surfaces:** `proposal-media-manager.tsx` and `proposal-media-gallery.tsx` (homeowner) → `OptimizedImage` + `srcSet` + `sizes` + aspect-ratio boxes + lazy + blur placeholder (mirroring `project-media-manager`).
- **Guardrails:** `Referrer-Policy` + `X-Robots-Tag: noindex` on proposal routes; no URL logging.
- **DOCS staleness fix (confirmed):** rewrite `src/shared/entities/proposals/DOCS.md#proposal-media` (currently "Private + presigned-only … no `url` column") to the public canonical-bucket reality; update `src/shared/services/media/DOCS.md` if it asserts private/presigned; update the memory note `project-proposal-media-subsystem.md`.

### Sub-plan 3 — Shared YARL lightbox

**Outcome:** One robust lightbox for proposals + portfolio.

Scope:
- Add `yet-another-react-lightbox` (full). Build `src/shared/components/media/media-lightbox.tsx` (`<MediaLightbox>`, controlled open/index/close, plugins: Thumbnails, Zoom, Video, Captions; slides rendered via a custom slide using our `OptimizedImage`-style string `srcSet` so no `width`/`height` needed) and `build-lightbox-slides.ts` (pure `buildLightboxSlides<T>(items, toSlide)` adapter).
- Wire into proposal manager + homeowner gallery (click-to-open) and into the portfolio surfaces (`project` photo lightbox, `progress-gallery`); **retire `PhotoLightbox`** after portfolio parity.
- Owner-agnostic (DI'd slide mapping); no `@/features/**` imports in shared.

### Sub-plan 4 — Shared multi-select / bulk media UX

**Outcome:** Proposals gain multi-select + bulk actions; the selection/bulk layer is shared and DRY.

Scope:
- Generalize `MediaManager`: add `selectionEnabled` + internal selection state (or a `useMediaSelection` hook: `selectedIds`, `toggle`, `selectAll(scope)`, `clear`, `selectionActive`) + a lifted owner-agnostic floating **`MediaBulkToolbar`** taking DI'd `bulkActions: { label, icon, run(ids) }[]`. Thread `selectedIds` into its `MediaReorderGrid`/`MediaCard` (multi-drag already implemented there).
- **New proposal procedures:** `bulkDelete` and `bulkSetVisibility` (the proposal analog of project "bulk move phase") on `proposals.router/media.router.ts`.
- Wire proposals onto the shared selection/bulk layer (actions: bulk delete, bulk set visibility homeowner↔internal).
- **Optional (own gated task):** migrate `project-media-manager`'s inlined toolbar onto the shared `MediaBulkToolbar` for DRY — gated behind a parity check so the working project manager isn't destabilized.
- Keep everything owner-agnostic; no hard-coded `mediaPhases`, router, or `OptimizedImage` in shared (DI'd).

---

## Cross-cutting: Data Model & Code Change Summary

- **No new tables/columns.** No `url` column for proposals (derive), no `width`/`height`. Only value changes: `media_files.bucket` / `proposal_media_files.bucket` → `'tpr-media'` (backfill).
- **Constants:** `R2_BUCKETS`, `R2_PUBLIC_DOMAINS` (Sub-plan 1).
- **Optimize:** `VARIANT_WIDTHS` gains `xs` (Sub-plan 2).
- **Read path:** `resolveProposalMediaUrl` removed; derivation via `get-optimized-urls` (Sub-plan 2).
- **Shared UI:** `media-lightbox.tsx`, `build-lightbox-slides.ts`, generalized `media-manager.tsx`, `media-bulk-toolbar.tsx` (Sub-plans 3–4).
- **Docs:** `proposals/DOCS.md`, `services/media/DOCS.md`, memory (Sub-plan 2).

## Testing & Validation Strategy

- `pnpm tsc` + `pnpm lint` clean per task (no unit runner).
- **Migration:** dry-run first; per-prefix object-count reconciliation between old buckets and `tpr-media` before DB backfill; dev DB before prod.
- **Manual browser parity:** portfolio unchanged post-cutover (a Plan 1 gate too); proposal grid fetches small variants (verify in Network devtools — small tile pulls `xs`/`sm`, not `lg`); lightbox opens with keyboard/thumbnails/zoom; multi-select + bulk delete/visibility work; fresh upload round-trips to `tpr-media`.
- **Meta/pixel-style caution N/A**; media is CDN-served — validate via real browser Network panel.

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Domain rebind gap breaks live portfolio | Copy-first (both buckets hold objects); back-to-back deploy→domain-move in an off-hours window; rollback = revert domain + `bucket` backfill. |
| Incomplete rename sweep leaves a dangling old bucket ref | Project-wide discovery + post-change grep for all four old names; `tsc`/`lint` gate. |
| Incomplete object migration | Idempotent, resumable copy; per-prefix count reconciliation before decommission. |
| Public exposure of homeowner photos | Unguessable UUID keys + `noindex`/`Referrer-Policy` + no URL logging; optional re-key hatch designed-in. |
| `xs` missing on legacy rows | Additive; `optimizationVariants` list drives fallback to `sm`. |

## Relationship to existing backlog

- **Plan 1 pending gates** (manual project-photos parity check; delete 5 deprecated `portfolio/*` files; prod `db:push:prod`; parked import-picker visibility) remain valid; the project-photos parity check overlaps Sub-plan 1's post-cutover verification and Sub-plan 4's optional project-manager migration — sequence accordingly.
- **Plan 1B** (Cloudflare Stream video + PDF raster via the `file-optimization` strategy registry) starts **after** this epic; it will store into `tpr-media` (video via the `stream` provider path) on the foundation this epic lays.

## Non-goals

- Plan 1B (video transcode / PDF raster).
- Folding `tpr-company-docs` into `tpr-media`.
- Cloudflare Worker / multi-bucket routing / multiple media subdomains.
- `width`/`height` columns; stored `url` for proposals.
- Any change to upload auth (stays presigned PUT).
