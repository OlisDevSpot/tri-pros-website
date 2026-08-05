# Proposal Capabilities: Media Attachments, Portfolio-by-Trade & Finance Quick-Send

**Status**: Design approved — ready for implementation planning
**Date**: 2026-08-05
**Epic**: Proposal capabilities expansion (three related features on one proposal)

## Summary

Expand what a proposal can hold and show, in three independent-but-related features:

1. **Proposal media attachments** — a per-proposal file store (photos, videos, PDFs) where the
   authoring agent marks each file `internal` (agent-only) or `homeowner` (shown on the proposal).
   Homeowner-visible photos/videos render in a gallery above the first Scope-of-Work section; public
   PDFs render as downloadable documents. On approval, homeowner-visible photos seed the newly-minted
   Project's portfolio gallery.
2. **Portfolio-by-trade** — replace the legacy before/after slider ("Past Results") with real portfolio
   projects matched to the proposal's selected trades, reusing the meetings-flow pattern. Cap 7, fall
   back to latest projects, "View our other projects" links to the portfolio site.
3. **Finance quick-send** — a one-click "Send Finance Application" in the agreement section that fires
   the pre-filled Zoho Sign template `563034000000106203` (`tpr-fin-doc-single`) to the homeowner,
   independent of the contract signing envelope. Sent-only status tracking.

These decompose into **three implementation plans**, sequenced: (1) media subsystem + optimizer
generalization [foundational], (2) portfolio-by-trade [small, independent], (3) finance quick-send
[small, independent].

## Context & existing code (verified during brainstorm)

- **Proposals** store their SOW — including selected trades/scopes — inside `projectJSON.data.sow[]`,
  where each section has `trade: {id,label}` and `scopes: {id,label}[]` (Notion string ids). The three
  JSONB columns (`formMetaJSON`, `projectJSON`, `fundingJSON`) are whole-document writers, plain-replaced
  on update. See `src/shared/entities/proposals/DOCS.md`.
- **Media today** (`media_files` table) is hardwired to `projectId` (NOT NULL FK), the public portfolio
  bucket, and an `image/*`-only picker. Optimization is image-only (`optimize-image.ts`, dispatched from
  `media.router.ts:49` behind a `mimeType.startsWith('image/')` guard). Reusable uploader:
  `src/shared/components/portfolio/sortable-media-manager.tsx`.
- **Portfolio↔trade** association is indirect: `project → x_project_scopes.scopeId (Notion string) →
  scope → trade`. Matching is scope-id intersection done client-side against the Notion catalog. The
  meetings flow already implements exactly this in
  `src/features/meeting-flow/ui/components/steps/portfolio-step.tsx` (+ `trade-project-grid.tsx`).
- **Zoho Sign** has an unused `zohoSignClient.createFromTemplate(templateId, body, quickSend)` primitive
  (`src/shared/services/providers/zoho-sign/client.ts:106`) — the natural primitive for a standalone
  quick-send. Field-source resolvers live in
  `src/shared/services/providers/zoho-sign/lib/documents/registry.ts`.
- **The agreement section** UI is `src/shared/components/contract-status-panel/ui/agent-contract-view.tsx`,
  composing `ProposalCard` + `EnvelopeCard`.
- **The homeowner proposal** renders unauthenticated via share token; `getFullView`
  (`src/shared/entities/proposals/dal/server/queries.ts`) is the shareable read choke point and runs
  server-side per request.
- **Zoho finance template `563034000000106203`** (verified via `scripts/zoho-template-fields.ts` /
  `scripts/zoho-template-actions.ts`): 7 distinct fields — `ho-name`, `ho-email`, `ho-phone`,
  `ho-address`, `ho-city`, `CA` (state), `ho-zip` — all mapping to existing `customers` columns; single
  signer role **Homeowner**, `action_id 563034000000106215`.

---

## Feature 1 — Proposal media attachments

### 1.1 Data model — new table `proposal_media_files`

A dedicated proposal-owned table (NOT an overload of `media_files`, which is deeply portfolio-coupled:
phase enum, `isHeroImage`, project relations). Rationale: keep portfolio media pure, give proposal media
its own lifecycle + bucket, and match the codebase's Wave-3 "decompose toward child tables" direction.
Column shape parallels `media_files` so the generalized optimizer core (1.3) applies to both.

| Column | Type | Purpose |
|---|---|---|
| `id` | pk | |
| `proposalId` | uuid FK → proposals (cascade delete) | proposal-owned |
| `name` | varchar | display name |
| `pathKey` | text, unique | R2 object key |
| `bucket` | text | R2 bucket (see 1.4) |
| `mimeType` | text | drives optimizer strategy + gallery rendering |
| `fileExtension` | text | |
| `url` | varchar | stored object url (private; homeowner access via presigned — see 1.4) |
| `visibility` | enum `internal \| homeowner`, default `internal` | **the per-file toggle** |
| `sortOrder` | int | agent-controlled gallery order |
| `optimizationStatus` | enum, default `pending` | reuses media optimization status vocabulary |
| `optimizationVariants` | jsonb (`string[]`) | webp variants (images) |
| `blurDataUrl` | text | image placeholder |
| `thumbnailUrl` | text | video poster / pdf preview |
| `duration` | int | video length (seconds) |
| `pageCount` | int | pdf page count |
| `createdAt`, `updatedAt` | timestamptz | `updatedAt` via `.$onUpdate()` |

Documented with column comments explaining the visibility model and the private-bucket/presigned
serving contract.

### 1.2 Editor UX — attaching files

- New **"Files"** tab in `ProposalForm` (alongside general / sow / funding).
- Reuses an adapted `sortable-media-manager`:
  - picker widened to `image/*, video/*, application/pdf`
  - per-file **"Viewable by homeowner"** toggle (writes `visibility`)
  - drag-reorder + delete + rename
  - internal vs. homeowner files visually grouped so the agent sees what the customer will receive
- Backed by a new **agent-only** `proposalMedia` tRPC router mirroring `media.router.ts`:
  `getUploadUrl` (presigned PUT), `create` (insert row + dispatch optimize), `setVisibility`, `reorder`,
  `rename`, `delete`. Scoped by proposal visibility (meeting participation), same as other proposal
  procedures. The homeowner never uploads.
- **Not gated by the proposal lock ladder.** Proposal media is web-presentation, not part of the signed
  Zoho envelope, so it stays editable even when a contract is out for signature. (Documented as an
  explicit exception in DOCS.md so future sessions don't "fix" it by adding a freeze gate.)

### 1.3 Generalized file optimization

Replace the image-only `optimize-image.ts` job with a generalized **file optimizer** whose API surface
accepts any file type and knows what to do with it. A strategy registry keyed by file-kind returns one
normalized result shape, so every caller handles all types uniformly:

```
optimizeFile({ bucket, pathKey, mimeType, name })
   → FileOptimizationResult {
       variants: string[]         // webp variants (images)
       blurDataUrl?: string
       thumbnailUrl?: string      // video poster / pdf preview
       duration?: number          // video seconds
       pageCount?: number         // pdf pages
       status: 'complete' | 'skipped' | 'failed'
     }

strategy dispatch by mime-kind:
  image →  full optimization exactly as today (webp variants + blurDataUrl)      status: complete
  video →  record duration; store client-captured poster frame as thumbnailUrl;  status: complete
           NO transcode (flagged follow-up)
  pdf   →  record pageCount + byte size; first-page thumbnail where a lightweight status: complete
           path exists, else a typed placeholder (first-page raster = follow-up)
  other →  passthrough                                                           status: skipped
```

- **Images are byte-for-byte identical to today** — the existing image pipeline becomes the `image`
  strategy, unchanged in behavior.
- **Video/PDF** get metadata + thumbnail hooks now; heavy server-side transcode (video) and PDF
  first-page rasterization are explicitly out-of-scope follow-ups, clearly marked in code + docs.
- **Extraction, not duplication:** the processing core is shared; two thin job wrappers persist results
  to their respective tables (`media_files`, `proposal_media_files`). Adding a future file type = adding
  one strategy, not a new job.
- Dispatch still guards trivially: non-optimizable kinds resolve to `status: 'skipped'` immediately.

### 1.4 Storage & serving

- **Bucket:** reuse the existing private **`tpr-homeowner-files`** bucket (already houses call recordings
  under their own prefix). Proposal files use a parallel prefix: **`proposals/{proposalId}/{uuid}{ext}`**.
  No new bucket.
- **Serving:** `getFullView` (shareable read choke point, server-side per request) mints **fresh,
  short-TTL presigned GET URLs** at query time:
  - **homeowner / token path → only `visibility='homeowner'` files** are included, each with a presigned url
  - **agent / session path → all files** included, each with a presigned url
  - URLs refresh on every page load, so TTL expiry never strands a viewer.
- **Visibility is a pure DB flag** — toggling `internal ↔ homeowner` never moves bytes. Internal files
  are never emitted on the homeowner path, so they stay genuinely private.
- The PDF export route mints presigned URLs the same way at render time for any embedded homeowner media.

### 1.5 Homeowner-facing gallery

At the top of the Scope-of-Work section content (`scope-of-work.tsx`, above the first accordion item),
render a new `ProposalMediaGallery` — only when the proposal has homeowner-visible files:

- **Photos + videos** inline (grid/lightbox; videos show poster + play).
- **Public PDFs** as a compact "Documents" list with download links (presigned urls).
- Renders nothing when there are no homeowner-visible files (no empty section).

### 1.6 Approval → seed the project gallery

On the existing conversion-trigger (proposal `status → approved` mints a Project), dispatch a QStash job
`seedProjectMediaFromProposal({ proposalId, projectId })`:

- For each `homeowner`-visibility proposal photo, **R2 server-side copy** the object from the private
  `tpr-homeowner-files` bucket into the public portfolio bucket, and insert a `media_files` row on the
  new project (phase `uncategorized`; the agent re-organizes later).
- **Async** (never blocks approval) and **idempotent** by source pathKey (re-running converges, so
  retries don't duplicate).
- Scope note: seeds photos (the portfolio-relevant type). Videos/PDFs are not seeded into the portfolio
  gallery in v1 (documented; can extend later).

---

## Feature 2 — Portfolio-by-trade (replaces the before/after slider)

Rewrite `RelatedProjects` (`src/features/proposal-flow/ui/components/proposal/related-projects.tsx`) to
reuse the meetings-flow pattern instead of static seed data + `CustomImageSlider`:

- Fetch `projectsRouter.showroomDisplay.getAll` (all public projects with `scopeIds`) + Notion
  trades/scopes catalogs.
- Intersect each project's `scopeIds` against the proposal's `sow[].scopes[].id`.
- Dedupe across trades; **cap at 7** projects total.
- **Fallback:** if no trade matches (or the selected trades have no projects), show the **latest 7 public
  projects**.
- Reuse `PortfolioGrid` / `TradeProjectGrid` for consistent cards.
- **"View our other projects"** button → links to `/portfolio/projects` (pre-filtered to the proposal's
  trades where possible) in a **new tab**.
- `CustomImageSlider` remains in the repo but is no longer used by this section.

---

## Feature 3 — Finance application quick-send

### 3.1 Send flow

- New **agent-only** procedure `sendFinanceApplication({ id })` (on the contracts/finance router):
  - builds `field_text_data` from the proposal's customer,
  - calls `zohoSignClient.createFromTemplate('563034000000106203', body, quickSend=true)` with the single
    Homeowner signer (`action_id 563034000000106215`, recipient = customer name/email),
  - persists `financeRequestId` + `financeSentAt` on the proposal.
- **Independent of the contract signing envelope** and its lock ladder — can be sent anytime.

### 3.2 Field mapping (all from `customers` columns)

| Zoho field | Source |
|---|---|
| `ho-name` | `customer.name` |
| `ho-email` | `customer.email` |
| `ho-phone` | `customer.phone` |
| `ho-address` | `customer.address` |
| `ho-city` | `customer.city` |
| `CA` (state) | `customer.state ?? 'CA'` |
| `ho-zip` | `customer.zip` |

Add granular city / state / zip `FieldSource`s to the registry (today it only has a combined
`customerCityStateZipSrc`).

### 3.3 Tracking & UI

- **Sent-only tracking:** new `proposals.financeRequestId` (text, nullable) + `financeSentAt`
  (timestamptz, nullable). These are **lifecycle columns, NOT in `frozenProposalLockedFields`** — sending
  works regardless of proposal lock state. No viewed/signed lifecycle in v1 (upgradeable to full webhook
  tracking later).
- **UI:** a new **"Finance Application"** card in `AgentContractView` (sibling to `ProposalCard` /
  `EnvelopeCard`) with a Send button (`ActionButtonWithImpact`), a "Sent {date}" state, and Resend.

---

## Cross-cutting: documentation (first-class deliverable)

Lean but proper docs so future sessions understand the *why*:

- Extend `src/shared/entities/proposals/DOCS.md` with rules for: the proposal-media visibility model, the
  private-bucket + presigned-URL serving contract, the lock-ladder exception for media, the
  approval→project media seeding, and the finance quick-send independence.
- A short DOCS section for the generalized file-optimizer API (the `FileOptimizationResult` contract +
  strategy registry).
- Table/column comments on `proposal_media_files` and the new `proposals` finance columns.
- Purpose comments on new functions (optimizer strategies, seeding job, presigned-URL enrichment).

---

## Requirements checklist

Living check-off list. Grouped by feature + cross-cutting.

### Feature 1 — Proposal media attachments
- [ ] `proposal_media_files` table created (schema + migration via `db:push:dev`) with documented columns
- [ ] `visibility` enum (`internal | homeowner`) with default `internal`
- [ ] Agent-only `proposalMedia` router: `getUploadUrl`, `create`, `setVisibility`, `reorder`, `rename`, `delete`
- [ ] Presigned PUT upload to `tpr-homeowner-files` under `proposals/{proposalId}/{uuid}{ext}`
- [ ] "Files" tab in `ProposalForm` reusing an adapted `sortable-media-manager`
- [ ] Picker accepts `image/*, video/*, application/pdf`
- [ ] Per-file "Viewable by homeowner" toggle wired to `visibility`
- [ ] Internal vs homeowner files visually grouped in the editor
- [ ] Media edits NOT gated by the proposal lock ladder (documented exception)
- [ ] `getFullView` enriches files with fresh presigned GET URLs; homeowner path emits only `homeowner` files
- [ ] `ProposalMediaGallery` renders above the first SOW section (photos/videos inline, public PDFs as downloads)
- [ ] Gallery renders nothing when no homeowner-visible files

### Cross-cutting — generalized file optimization
- [ ] `optimizeFile` API with normalized `FileOptimizationResult` + strategy registry
- [ ] Image strategy = current behavior, byte-for-byte unchanged
- [ ] Video strategy records duration + client-captured poster thumbnail (no transcode)
- [ ] PDF strategy records pageCount + size + thumbnail-where-possible (else typed placeholder)
- [ ] `other` strategy passthrough → `status: skipped`
- [ ] Shared processing core; thin job wrappers persist to `media_files` and `proposal_media_files`
- [ ] Follow-ups (video transcode, PDF first-page raster) clearly marked in code + docs

### Feature 1 — approval seeding
- [ ] `seedProjectMediaFromProposal` QStash job dispatched on approval/conversion
- [ ] Homeowner-visible photos R2 server-side copied into portfolio bucket + `media_files` rows inserted
- [ ] Job is async and idempotent by source pathKey

### Feature 2 — Portfolio-by-trade
- [ ] `RelatedProjects` rewritten to use `showroomDisplay.getAll` + Notion catalogs + scope-id intersection
- [ ] Cap 7; dedupe across trades
- [ ] Fallback to latest 7 public projects when no trade matches
- [ ] Reuses `PortfolioGrid` / `TradeProjectGrid`
- [ ] "View our other projects" → `/portfolio/projects` (pre-filtered) in a new tab
- [ ] Legacy static seed + `CustomImageSlider` no longer used in this section

### Feature 3 — Finance quick-send
- [ ] `sendFinanceApplication({ id })` agent-only procedure using `createFromTemplate(..., quickSend=true)`
- [ ] All 7 template fields pre-filled from customer columns; granular city/state/zip `FieldSource`s added
- [ ] Single Homeowner signer wired (`action_id 563034000000106215`)
- [ ] `proposals.financeRequestId` + `financeSentAt` columns (lifecycle, NOT lock-gated)
- [ ] "Finance Application" card in `AgentContractView` with Send / Sent-state / Resend
- [ ] `docs/zoho-sign/template-inventory.md` updated with the finance template entry

### Cross-cutting — documentation
- [ ] `proposals/DOCS.md` extended (media visibility, presigned serving, lock exception, seeding, finance independence)
- [ ] File-optimizer API documented
- [ ] Table/column + function purpose comments added

---

## Out of scope (v1)

- Video transcoding and PDF first-page rasterization (metadata + thumbnail hooks only for now)
- Full viewed/signed webhook lifecycle for the finance application (sent-only in v1)
- Seeding videos/PDFs (not just photos) into the project portfolio on approval
- Homeowner-side uploads (agent-only throughout)

## Open questions / decisions deferred to implementation

- Exact presigned-URL TTL (candidate: 24h; refreshed per page load regardless).
- Whether the "Files" tab should show optimization status inline (nice-to-have).
- PDF first-page thumbnail: whether a lightweight server path exists in this stack, or it ships as a
  typed placeholder in v1.
