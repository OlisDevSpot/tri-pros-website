# Sub-plan 2 — Proposal Media Goes Public (Render Layer) — Design Spec

> **Position:** Sub-plan 2 of the **Media Foundation epic (Plan 1.5)** — see `docs/superpowers/specs/2026-08-06-media-foundation-epic-design.md`. Sub-plan 1 (canonical `tpr-media` bucket + portfolio migration) shipped and cut over in prod 2026-08-06. This sub-plan moves **proposal** media onto that same public bucket and render path.

**Goal:** Proposal media lives in `tpr-media` and renders exactly like portfolio — public, CDN-cached, responsive `srcSet`, no presigning. `tpr-homeowner-files` is left holding only call recordings (`recordings/*`).

**Architecture (one breath):** Flip `proposalMediaStore` to the public bucket and delete the presigner; proposal read projections derive `src`/`srcSet` just-in-time from `pathKey` + `bucket` + `optimizationVariants` (same path portfolio uses). Introduce a parameterized image optimizer whose variant set is chosen at the **owner seam**, making `xs` (~320w) a first-class variant that proposals opt into while portfolio's set is unchanged. Port the two proposal render surfaces to `OptimizedImage`. Migrate existing `proposals/*` blobs + the `bucket` column with zero URL breakage. Lightbox and multi-select are **later** sub-plans (3, 4) — not here.

**Tech stack:** Next.js 15 (App Router) on Vercel · Cloudflare R2 (`@aws-sdk/client-s3`) · sharp · tRPC + TanStack Query · Drizzle (Postgres/Neon) · Tailwind v4 · motion/react.

---

## Global Constraints

Inherited verbatim from the epic charter — every task below is bound by these:

- **Work on `main`; stage by explicit path** — never `git add -A`. Commit trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **No `pnpm build`** — verify with `pnpm tsc` + `pnpm lint` only. No unit-test runner; validation is type/lint + manual browser parity + dev-first migration dry-runs.
- **DB pushes:** `pnpm db:push:dev` only; prod is explicit `db:push:prod` (user-only). Migration scripts target prod **only** via `DRIZZLE_TARGET=prod` — never `NODE_ENV`. Scripts load env via `import './lib/load-env'`, never `dotenv/config`.
- **Import direction:** `src/shared/**` must never import `@/features/**`. Shared media UI stays owner-agnostic.
- **Uploads are always presigned PUT** to R2's S3 endpoint; only the *read* path is public. This sub-plan changes only reads + storage location.
- **`tpr-homeowner-files` stays a private bucket** — it also stores sales **call recordings** (`recordings/*`). Only *proposal media* (`proposals/*`) leaves it. Never copy, publicize, or touch `recordings/*`. `tpr-company-docs` is out of scope entirely.
- **Trust-but-verify:** before asserting a documented rule, confirm against code; ping on staleness. **Docs currently match code** (private/presigned) — so the DOCS edits in this plan *create* staleness if deferred and MUST ship in the same PR as the code (see §8).

### Hardened-rule compliance (audited pre-approval)

- **Dead-code deletion, not deprecation** (`docs/ubiquitous-language.md` — "Dual-shape tolerance not backwards compatibility"): `resolveProposalMediaUrl` and its file are **deleted outright** — no `@deprecated` shim, no dual-shape `url`.
- **Blast radius fully mapped** (`ubiquitous-language.md` — "every site inside it must end up rewritten or tallied"): the full importer/consumer set is enumerated in §7 and every site is rewritten atomically — nothing left to tally.
- **Derived-values JIT** (`docs/codebase-conventions/derived-values.md`): the public `url` is JIT-derived (`domain/pathKey`) in the mapper, **not** a new column. Proposal media keeps **no `url` column** — reframed in DOCS as "JIT-derived," never deleted as a decision (guards against a future cache-column regression).
- **No manual `updatedAt`** (`baseMediaColumns().$onUpdate()`): the bucket backfill sets `bucket` only.
- **DAL-first (Rule 19)** applies to runtime jobs/services; **one-off migration scripts are exempt** and may use raw `db.update`, matching precedent `scripts/backfill-media-bucket.ts`.

---

## Context & Current State (verified 2026-08-06)

Proposal media was built in Plan 1 on the **private `tpr-homeowner-files` bucket with per-render presigned URLs**. The data layer is sound; the render layer was never ported, causing jank (a 1920px `lg` file decoded into a 150px tile) and un-`srcSet`-able rotating URLs. The epic charter's research concluded that homeowner property photos behind unguessable UUID keys are a defensible public/capability-URL model; this sub-plan executes that decision.

Verified facts the design relies on:
- `resolveProposalMediaUrl` (`src/shared/entities/proposal-media-files/lib/resolve-media-url.ts`) presigns from `R2_BUCKETS.homeownerFiles`. **3 importers** (§7).
- `toProposalMediaView` (`.../dal/server/queries.ts:23`) is `async` only because it presigns; `ProposalMediaView.url` is the presigned string. **4 consumers** (§7).
- `proposal_media_files` has **no `url` column** and already has a `bucket` column (`R2_BUCKETS.homeownerFiles` today).
- `R2_PUBLIC_DOMAINS` (`providers/r2/types.ts`) has **no `tpr-homeowner-files` entry** → `getOptimizedSrc` derivation falls back to the `tpr-media` domain for any not-yet-backfilled row. **This is the zero-breakage guarantee.**
- `importFromProposal` (`projects.router/media.router.ts:190`) already reads `src.bucket` dynamically → becomes a same-bucket copy after backfill, **no code change**. Its picker sibling `listImportableProposalMedia` presigns and **does** need the swap.
- The optimizer chain is `optimizeMediaFile({ownerKind, mediaId})` → `optimizeFile(buffer, mime)` → `processImageVariants(buffer)`; the owner seam is `getOptimizationTarget(ownerKind)` (`optimization-target.ts`), parallel to `stores.ts`.

---

## Design

### §1. The atomic core change (three coupled edits, one deploy)

These three cannot be split — splitting strands an upload or breaks reads:

1. `proposalMediaStore.bucket` (`src/shared/services/media/stores.ts:30`) → `R2_BUCKETS.media`. New proposal uploads now presign PUT to `tpr-media`.
2. Delete `resolveProposalMediaUrl` + its file; all proposal reads become public-derived.
3. DB backfill `proposal_media_files.bucket` → `'tpr-media'`.

Reads work the instant objects exist in `tpr-media` (the domain-fallback guarantee above), even before the bucket-column backfill lands — the backfill is for correctness/honesty, not to keep reads alive.

### §2. Parameterized optimizer + `xs` as a first-class variant

The **write side** gains an explicit variant-selection API so the choice is declarative and lives in one place, not sprinkled across constants.

- **Canonical catalog** in `process-image-variants.ts` — `xs` is a normal member, no special-casing:
  | suffix | width | size budget |
  |---|---|---|
  | `xs` | 320 | ~40 KB |
  | `sm` | 640 | 80 KB |
  | `md` | 1280 | 200 KB |
  | `lg` | 1920 | 350 KB |
- `processImageVariants(buffer, selectedSuffixes)` accepts **which** variants to generate (iterates only the selected catalog entries; existing `TINY_IMAGE_THRESHOLD` / `MIN_DOWNSCALE_FACTOR` / size-budget logic unchanged). This is the new optimizer API surface.
- Thread the selection: `optimizeFile(buffer, mimeType, { variants })` → `processImageVariants(buffer, variants)`.
- **Owner seam owns the default.** `OptimizationTarget` (`optimization-target.ts`) gains a `variants: VariantSuffix[]` field, exactly parallel to how `table`/`getFile` live there:
  - `project` → `['sm','md','lg']` (**unchanged** — portfolio bytes are identical to today)
  - `proposal` → `['xs','sm','md','lg']`
  `optimizeMediaFile` passes `target.variants` into `optimizeFile`.
- **Scripts choose their own set** by calling `optimizeFile(buffer, mime, { variants: [...] })` directly — this is the flexibility that enables a future proposals-scoped re-optimize without touching the portfolio path.

**Read side** (`get-optimized-urls.ts`):
- Add `xs: 320` to `VARIANT_WIDTHS` (a pure width lookup — always safe).
- **Rename `ALL_VARIANTS` → `LEGACY_UNTRACKED_VARIANTS`** (value unchanged `['sm','md','lg']`) with a comment: *"the variant set that rows optimized before `optimizationVariants` tracking are known to have — NOT the catalog; new rows drive rendering off their own recorded list."* This eliminates the "why is `xs` missing here?" footgun by naming, not omission. `xs` is deliberately absent because those historical rows genuinely have no `xs` object on R2.

**Decision — capability only, no re-run (user-approved):** new proposal uploads get `xs`; existing proposal images fall back to `sm` (640w into a small tile — a minor perf delta, not a bug). We do **not** build or run a standalone re-optimize script in this sub-plan (YAGNI — it is trivially addable later on the new `optimizeFile({variants})` surface). If a re-optimize is ever wanted, it scopes by the `proposals/` key **prefix** within `tpr-media` and never touches `projects/*`.

**Blast-radius note:** `process-image-variants.ts` + `get-optimized-urls.ts` are **shared** by project media. The catalog/`VARIANT_WIDTHS` edits are additive; the `project` owner keeps `['sm','md','lg']`, so newly-optimized project images are unchanged. The parity gate (§9) includes a portfolio regression check regardless.

### §3. Read-path flip (derive, don't presign)

- **`toProposalMediaView` becomes synchronous.** Drop the presign. `ProposalMediaView` exposes `pathKey`, `bucket`, `optimizationVariants`, and a **JIT-derived** `url = ${R2_PUBLIC_DOMAINS[bucket] ?? DEFAULT_R2_DOMAIN}/${pathKey}` (derived from the **row's own bucket**, not a hardcoded default — safer during the mixed-state window). These four fields are exactly the `MediaFileInput` shape `getOptimizedSrc`/`getOptimizedSrcSet` consume, and exactly the `OptimizedImage.file` contract. Every consumer drops its `await`/`Promise.all` (§7).
- **`listImportableProposalMedia`** (`projects.router/media.router.ts`): add `bucket` to its select, synthesize the same per-row `url`, and replace the `resolveProposalMediaUrl` presign with `getOptimizedSrc`. (Without the synthesized `url`, non-optimized / `sm`-only rows would hand `getOptimizedSrc` a null fallback → broken picker thumbnails.)
- **`importFromProposal` copy block: unchanged** (already reads `src.bucket`; post-backfill it's a same-bucket, different-key copy `proposals/… → projects/…/uncategorized/…`).
- Delete `resolve-media-url.ts` (its module-local `DEFAULT_VARIANTS` dies with it — no external refs).

### §4. Render surface port

Port to the portfolio render primitive (`OptimizedImage` + `srcSet` + `sizes` + aspect-ratio box + lazy + blur), mirroring `features/project-management/.../project-media-manager.tsx`:

- `features/proposal-flow/ui/components/form/proposal-media-manager.tsx` (agent) — build each thumbnail's `OptimizedImage` from the reshaped view row (`viewById.get(item.id)`), mirroring `project-media-manager`'s `fileById.get(id)!`.
- `features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx` (homeowner) — images → `OptimizedImage`; **video + pdf still use the plain derived `url`** (unchanged behavior; only images get `srcSet`).
- Grid tiles get a `sizes` hint (~`(max-width: 768px) 45vw, 220px`) so small tiles fetch `xs`/`sm`, never `lg`.

**Explicitly NOT in this sub-plan:** click-to-open / lightbox (Sub-plan 3) and multi-select/bulk (Sub-plan 4). Interim state — proposal images are fast + responsive but not yet clickable — is acceptable.

### §5. Storage migration (copy-first + delta — user-approved)

Two scripts mirroring Sub-plan 1's (`import './lib/load-env'`, `--dry-run`, idempotent, `DRIZZLE_TARGET`-guarded where DB-touching):

- **Blob copy** `scripts/migrate-proposal-media-r2.ts`: paginated `ListObjectsV2` over the **`proposals/` prefix only** of `tpr-homeowner-files`, server-side `CopyObject` each key (+ variant siblings, same keys) → `tpr-media`. Never enumerates `recordings/*`. Logs progress; safe to re-run as a delta sync.
- **DB backfill** `scripts/backfill-proposal-media-bucket.ts`: `UPDATE proposal_media_files SET bucket='tpr-media' WHERE bucket='tpr-homeowner-files'`. Sets `bucket` only — no `updatedAt`. Dev first, prod via explicit `DRIZZLE_TARGET=prod`.

**Ordering gate (mandatory):** blob-copy MUST complete before the DB backfill, or backfilled rows point at absent objects. The R2 precondition (`tpr-media` bucket + CORS + the `media.` custom domain) is **already satisfied** from Sub-plan 1's cutover — no new Cloudflare work.

**Cutover sequence:**
1. Blob-copy `proposals/*` → `tpr-media` (early; re-runnable).
2. Reconcile object counts (`proposals/` prefix: source vs dest).
3. Deploy the atomic code change (§1 store flip + presigner delete + §3 read flip + §4 render port) → dev DB backfill → verify dev → prod DB backfill.
4. **Delta re-copy** (`scripts/migrate-proposal-media-r2.ts` again) to catch any proposal photo uploaded to the old bucket during the window.
5. Verify a fresh proposal upload round-trips to `tpr-media`.
6. Safety window, then delete `proposals/*` from `tpr-homeowner-files` (recordings + bucket stay).

### §6. Guardrails

- `X-Robots-Tag: noindex` + `Referrer-Policy: strict-origin-when-cross-origin` on the **token-gated homeowner proposal route** (confirm the exact path pattern during planning) via a source-matched block in `next.config.ts` `headers()`, alongside the existing `/sw.js` block. Not applied blanket to all app pages.
- No full media-URL logging in any analytics/error path touching proposal media.
- **Designed-in, deferred:** CDN-level `noindex` on media responses (CF-level) and the optional re-key path segment — keys are already unguessable; build only if a concrete revocation need appears.

### §7. Blast radius (every site the deletion/reshape touches — all rewritten this PR)

**`resolveProposalMediaUrl` — 3 importers:**
1. `src/trpc/routers/projects.router/media.router.ts` (import + call in `listImportableProposalMedia`) → `getOptimizedSrc` + synthesized `url` (§3).
2. `src/shared/entities/proposal-media-files/dal/server/queries.ts` (import + call in `toProposalMediaView`) → inlined JIT derivation (§3).
3. `src/shared/entities/proposal-media-files/lib/resolve-media-url.ts` — the file, deleted.

**`ProposalMediaView` / `toProposalMediaView` — 4 consumers (drop `await`):**
1. `features/proposal-flow/ui/components/proposal/proposal-media-gallery.tsx` — images → `OptimizedImage`; video/pdf keep derived `url`; fix stale doc-comment.
2. `features/proposal-flow/ui/components/form/proposal-media-manager.tsx` — thumbnail → `OptimizedImage` from `viewById`.
3. `src/shared/entities/proposals/dal/server/queries.ts:156` — `getFullView` chokepoint: `await Promise.all(mediaRows.map(toProposalMediaView))` → `mediaRows.map(toProposalMediaView)`.
4. `src/trpc/routers/proposals.router/media.router.ts:60` — `return Promise.all(rows.map(...))` → `return rows.map(...)`.

**Verified no orphans:** no `url` column to drop (never existed); `bucket` column already present; `MediaItem` shared type (`shared/components/media/types.ts`) needs no field change (the manager routes the full row via its own map).

### §8. Docs + memory (blocking — same PR)

- `src/shared/entities/proposals/DOCS.md#proposal-media` — full rewrite of the private/presigned framing: the "Private + presigned-only" bullet, the getFullView "presigned per-row" line (`:365`), the now-inverted **Why** (`:368`, → unguessable-public-URL rationale), the Reference-impl `resolve-media-url.ts` entry (`:369`), the anti-patterns block (`:386-387`, currently forbids exactly what we now do), and the timestamp (`:406`). **Keep** the "no `url` column" decision, reframed as "JIT-derived (`domain/pathKey`)."
- `src/shared/db/schema/proposal-media-files.ts:13` — doc-comment "private bucket, presigned-only access" → public bucket / JIT-derived.
- `src/shared/components/media/types.ts:31,35` — `MediaItem` comments describing the proposal renderer as "presigned img/video/pdf" → `OptimizedImage`/public.
- `src/shared/services/media/DOCS.md` — stores-table row for `proposalMediaStore` bucket → `tpr-media (public)`; sweep `:158` and any residual "proposal = presigned" phrasing.
- Memory `project-proposal-media-subsystem.md` — record the public cutover.

### §9. Testing & validation

- `pnpm tsc` + `pnpm lint` clean per task (no unit runner).
- Migration: `--dry-run` first; `proposals/` prefix object-count reconciliation before backfill; dev DB before prod.
- **Browser parity (real browser Network panel):**
  - Proposal grid tile pulls `xs`/`sm`, **not** `lg` (the core defect fix).
  - Homeowner gallery renders images (public URLs) + video/pdf still work.
  - Import picker thumbnails render (including a non-optimized row).
  - Fresh proposal upload round-trips to `tpr-media` (PUT + optimize job) and gains `xs`.
  - **Portfolio regression:** project galleries still render correctly with the shared-optimizer edits (project set unchanged).

---

## Task Decomposition (for the implementation plan)

Independently testable, roughly in dependency order:

- **T1 — Parameterized optimizer + `xs` catalog (write side).** Catalog + `processImageVariants(buffer, selected)`; `optimizeFile(…, {variants})`; `OptimizationTarget.variants` (project `[sm,md,lg]`, proposal `[xs,sm,md,lg]`); `optimizeMediaFile` threads it. `tsc`/`lint`.
- **T2 — `xs` read side.** `VARIANT_WIDTHS += xs`; rename `ALL_VARIANTS → LEGACY_UNTRACKED_VARIANTS` + comment. `tsc`/`lint`.
- **T3 — Read-path flip.** Sync `toProposalMediaView` + reshaped `ProposalMediaView` (JIT `url`); `listImportableProposalMedia` swap; delete `resolve-media-url.ts`; drop all 4 `await`s. `tsc`/`lint`.
- **T4 — `proposalMediaStore.bucket` → `R2_BUCKETS.media`.** (Ships with T3/T5 as the atomic deploy.) `tsc`/`lint`.
- **T5 — Render surface port** (both surfaces → `OptimizedImage` + `sizes`). `tsc`/`lint`.
- **T6 — Migration scripts** (blob copy + DB backfill), dry-run-verified against dev.
- **T7 — Guardrails** (`next.config.ts` headers on the proposal route).
- **T8 — Docs + memory** (§8), same PR.

Live cutover (run the scripts, prod backfill, delta re-copy, decommission `proposals/*`) is **USER-run** from a short runbook produced with the plan, mirroring Sub-plan 1.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Backfill runs before blobs land → broken images | Hard ordering gate: blob-copy + count reconciliation before DB backfill (§5). |
| Upload during the window strands a blob in the old bucket | Copy-first + delta re-copy after deploy (§5). |
| Picker/mapper hands `getOptimizedSrc` a null `url` fallback | Synthesize per-row `url` from the row's bucket in **both** the mapper and the picker (§3, B1/B2). |
| `xs` leaks onto portfolio unexpectedly | `project` owner keeps `[sm,md,lg]`; portfolio regression check in the parity gate (§9). |
| `xs` advertised on legacy rows that lack it | `LEGACY_UNTRACKED_VARIANTS` deliberately excludes `xs`; per-row `optimizationVariants` drives all tracked rows (§2). |
| Public exposure of homeowner photos | Unguessable UUID keys + `noindex`/`Referrer-Policy` + no URL logging (§6). |
| Stale DOCS after the flip | All doc/comment sites in §8 edited **same PR** (they match code today; deferral creates staleness). |

## Non-goals

- Lightbox (Sub-plan 3) and multi-select/bulk (Sub-plan 4).
- Any change to upload auth (stays presigned PUT).
- Re-optimizing the portfolio/project back catalog for `xs`; building or running a proposal re-optimize script (deferred, capability-only).
- Publicizing/renaming `tpr-homeowner-files` (stays private for `recordings/*`); folding in `tpr-company-docs`.
- `width`/`height` columns; a stored `url` column for proposals; Plan 1B (video/PDF).
