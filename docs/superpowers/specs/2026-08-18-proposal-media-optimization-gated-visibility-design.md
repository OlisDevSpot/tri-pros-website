# Proposal Media — Optimization-Gated Homeowner Visibility (Design)

> Media Foundation epic (Plan 1.5), **Sub-plan 2.3**. Lands before Sub-plan 3 (shared lightbox), which consumes the delivery guarantee this sub-plan establishes.
> Canonical epic spec: `docs/superpowers/specs/2026-08-06-media-foundation-epic-design.md`.
> Related: `docs/superpowers/specs/2026-08-06-proposal-media-optimization-parity-design.md` (2.1 — the facade + backfill this builds on).

**Date:** 2026-08-18
**Status:** Design — approved in principle, pending spec review before `writing-plans`.

---

## Problem

A homeowner-facing proposal can currently be served **full-size original images**, making the proposal laggy and, at scale, unusable. Two facts combine to cause it:

1. **The unoptimized fallback is structural.** `getOptimizedSrc` (`src/shared/lib/get-optimized-urls.ts`) returns the raw `file.url` (the full original object) and `getOptimizedSrcSet` returns `undefined` whenever `optimizationStatus !== 'optimized'`. There is no small variant to fall back to when a row isn't optimized — the variants don't exist on R2 yet. `next.config.ts` sets `images: { unoptimized: true }`, so there is no on-the-fly resizer either. Serving "a smaller version" of an unoptimized image is therefore impossible by construction.
2. **Optimization can legitimately not have run.** Optimization is dispatched asynchronously via QStash after upload. In plain `pnpm dev` (no tunnel) the QStash callback can't reach `localhost`, so rows sit at `optimizationStatus: 'pending'` indefinitely (the `optimizeNow` backfill is the dev escape hatch — see 2.1). A failed optimization job leaves a row at `'failed'`. In both states the row still carries `visibility: 'homeowner'` today and would be served to the customer as a full original.

We cannot conjure a small variant that was never generated. The resolution is to **make "optimized" a precondition of homeowner visibility for images** — enforced when the visibility is set, and again when the homeowner read happens — so a heavy original never reaches the customer gallery or the PDF.

## Goal

An **image** proposal-media file cannot be shown to a homeowner until its `optimizationStatus === 'optimized'`. Enforced at two layers (the visibility toggle and the homeowner read) so neither a new toggle nor a legacy/failed row can leak a full-size original. Uploads remain fully asynchronous — no synchronous optimization, no upload-time timeout risk. **Proposals only** for now.

## The image-only nuance (load-bearing)

The gate and guard apply to **images only** (`mimeType.startsWith('image/')`). This is not a simplification — it is a correctness requirement:

- `mediaService.isOptimizable` (`media.service.ts`) dispatches optimization **only** for `image/*` and `application/pdf`. **Videos are never dispatched**, so a video's `optimizationStatus` stays at its `'pending'` default forever. A naive "must be optimized" rule would make videos **permanently un-shareable** with homeowners — a regression.
- PDFs are dispatched, but they render as **download tiles**, not inline `<img>` — they are not the lag vector, and their "optimization" (first-page raster) is Plan 1b work that hasn't shipped. Gating them buys nothing and risks blocking legitimate PDF sharing.

Therefore: **only `image/*` rows are gated/guarded.** Video and PDF rows pass through unchanged — their homeowner toggle is always enabled, and they are never filtered out of the homeowner read.

## Scope

**In scope (proposals only):**
- Server gate on the visibility mutation.
- UI gate on the homeowner toggle + hint.
- Server-side guard on the homeowner read (authoritative).
- Live status polling in the manager.
- Removal of the "drop into homeowner group auto-sets homeowner" upload behavior.

**Out of scope:**
- Project media (`media_files`) — unchanged. This is a proposals-only rule.
- Any change to the optimization pipeline, variant registry, `OptimizedImage`'s 20s client timeout, or the async upload flow.
- The shared lightbox (Sub-plan 3) and multi-select (Sub-plan 4).
- Backfilling stuck rows — that is the already-planned 2.1 operator backfill; this sub-plan's guard simply hides not-yet-optimized homeowner images until that backfill (or a retry) completes them.

## Architecture

Four enforcement/UX pieces plus one cleanup, layered so the **read guard is authoritative** and the write gate + UI are fast-feedback in front of it.

```
Upload (async, unchanged)
  └─ create → mediaService.createRecord → QStash optimize (fire-and-forget)

Set visibility = 'homeowner'                        [WRITE GATE]
  proposalMediaRouter.setVisibility
    ├─ assertCanUpdate
    ├─ if visibility === 'homeowner' AND row is image AND status !== 'optimized'
    │     → throw PRECONDITION_FAILED
    └─ proposalMediaCrud.update(...)                (scope enforced here)

Manager UI                                          [UI GATE + POLL]
  Homeowner <Switch> disabled when image && !optimized && !alreadyHomeowner
  list query refetchInterval: 3s while any image row pending/processing, else off

Homeowner read (gallery + PDF)                      [READ GUARD — authoritative]
  listHomeownerProposalMedia
    WHERE visibility='homeowner'
      AND (mimeType NOT LIKE 'image/%' OR optimizationStatus = 'optimized')
```

## Components

### 1. Server write gate — `setVisibility`

**File:** `src/trpc/routers/proposals.router/media.router.ts` (the `setVisibility` procedure, currently lines 70-76).

Current body calls `proposalMediaCrud.update(ctx, { id, data: { visibility } })` directly. Add a precondition on the homeowner path only. Reuse the existing `isVisible(proposalMediaServerSpec, ctx, id)` scope probe (the same pattern `retryOptimization` already uses at lines 104-106) so the gate reads the row only after confirming the caller may see it — avoiding a `PRECONDITION_FAILED`-vs-`NOT_FOUND` existence oracle on guessable serial-int ids. Then load the row via the existing `getProposalMediaFileById(id)` (`proposal-media-files/dal/server/queries.ts`) to read `mimeType` + `optimizationStatus`.

Shape (illustrative — exact code lands in the plan):

```ts
setVisibility: proposalMediaProcedure
  .input(z.object({ id: z.number(), visibility: z.enum(proposalMediaVisibilities) }))
  .mutation(async ({ ctx, input }) => {
    assertCanUpdate(ctx)
    if (input.visibility === 'homeowner') {
      if (!(await isVisible(proposalMediaServerSpec, ctx, input.id))) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Proposal media file not found' })
      }
      const row = await getProposalMediaFileById(input.id)
      if (row && row.mimeType.startsWith('image/') && row.optimizationStatus !== 'optimized') {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message: 'This image is still being optimized and can’t be shown to the homeowner yet.',
        })
      }
    }
    dalToTrpc(await proposalMediaCrud.update(ctx, { id: input.id, data: { visibility: input.visibility } }))
  }),
```

- Setting `visibility: 'internal'` is **always** allowed (no probe, no gate) — including turning a legacy/failed homeowner image back to internal.
- Non-image rows (video/pdf) skip the status check entirely.
- **Placement rationale:** the gate lives in the procedure, not as a `createCrudDal` before-update hook. `setVisibility` is the only entrypoint that sets `visibility` (`rename` also routes through `update` but never touches visibility), the procedure already holds `ctx` and the scope-probe pattern, and the check needs the row's `mimeType`/`optimizationStatus` which aren't in the update patch. A hook would spread visibility-transition logic into the generic CRUD layer for no locality gain. (Revisit if a second visibility-writing path ever appears.)

### 2. UI gate — homeowner toggle

**File:** `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx` (`renderControls`, currently lines 108-116).

The row is already available via `viewById.get(item.id)` (a `ProposalMediaView` carrying `mimeType`, `visibility`, `optimizationStatus`). Disable the Switch when the gate would reject:

```ts
renderControls={(item) => {
  const row = viewById.get(item.id)
  const isImage = item.mimeType.startsWith('image/')
  const isHomeowner = row?.visibility === 'homeowner'
  const isOptimized = row?.optimizationStatus === 'optimized'
  const locked = isImage && !isOptimized && !isHomeowner   // can always turn OFF
  return (
    <div className="flex items-center gap-1.5 rounded bg-background/70 px-1.5 py-0.5">
      <span className="text-[10px]">Homeowner</span>
      <Switch
        checked={isHomeowner}
        disabled={locked}
        onCheckedChange={checked => media.setVisibility.mutate({ id: item.id, visibility: checked ? 'homeowner' : 'internal' })}
      />
      {locked && <span className="text-[10px] text-muted-foreground">Available once optimized</span>}
    </div>
  )
}}
```

- `locked` never disables the switch for a row that is *already* homeowner (so a legacy homeowner image can still be flipped off), nor for videos/PDFs.
- The server gate remains the real enforcement; the disabled state is fast feedback, not the security boundary.

### 3. Homeowner read guard (authoritative)

**File:** `src/shared/entities/proposal-media-files/dal/server/queries.ts` — `listHomeownerProposalMedia` (currently lines 56-62).

This function has exactly one caller — `getFullView` (`proposals/dal/server/queries.ts:150`) — which in turn backs **every** homeowner surface: the customer gallery (via `views.router` `getFullView`), the PDF route (`/api/proposals/[proposalId]/pdf/route.ts:18`), and `pdf.service.ts`. It is the one server-side choke point for everything a homeowner sees, so the guard here covers all of them with no per-surface change. Add the image-only optimized condition:

```ts
import { and, asc, eq, notLike, or } from 'drizzle-orm'

export async function listHomeownerProposalMedia(proposalId: string): Promise<ProposalMediaFile[]> {
  return db
    .select()
    .from(proposalMediaFiles)
    .where(and(
      eq(proposalMediaFiles.proposalId, proposalId),
      eq(proposalMediaFiles.visibility, 'homeowner'),
      // Images must be optimized; non-image rows (video/pdf) always pass.
      or(
        notLike(proposalMediaFiles.mimeType, 'image/%'),
        eq(proposalMediaFiles.optimizationStatus, 'optimized'),
      ),
    ))
    .orderBy(asc(proposalMediaFiles.sortOrder))
}
```

- A not-yet-optimized or failed homeowner **image** silently drops from the customer gallery and the PDF — the "fallback that doesn't crash/lag the proposal." When the 2.1 backfill or a Retry completes the row, it reappears automatically.
- The **manager** (agent-facing) does **not** use this function — it lists via `mediaService.list` and still shows all homeowner rows, so an agent can see and retry a stuck image.
- This guard is why the design is safe even for rows that predate the write gate: it needs no data migration to be correct on day one.

### 4. Status polling in the manager

**File:** `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx` (the `list` query, currently line 38).

Add a `refetchInterval` so the toggle unlocks within a few seconds of the optimize job finishing, without hammering the server once everything is settled:

```ts
const { data: rows = [] } = useQuery(
  trpc.proposalsRouter.media.list.queryOptions(
    { proposalId },
    {
      refetchInterval: (query) => {
        const data = query.state.data ?? []
        const anyImagePending = data.some(r =>
          r.mimeType.startsWith('image/')
          && (r.optimizationStatus === 'pending' || r.optimizationStatus === 'processing'))
        return anyImagePending ? 3000 : false
      },
    },
  ),
)
```

- Polls only while an **image** row is `pending`/`processing`; stops (`false`) when none remain.
- **Dev caveat (documented, not a bug):** with no tunnel the QStash callback never fires, so rows never leave `pending` and the manager polls until the operator runs the `optimizeNow` backfill (`pnpm backfill:proposal-media:dev`). This is the known dev-localhost limitation from 2.1, not new behavior.

### 5. Upload cleanup — new uploads land Internal

**File:** `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx` (`onUpload`, currently lines 69-77).

Today, dropping files into the "Shown to homeowner" group calls `media.setVisibility.mutateAsync({ id, visibility: 'homeowner' })` immediately after upload. Under the new gate that call would be **rejected** (a fresh upload is never `optimized` yet). Remove the auto-set: every new upload stays `internal` (the create default), regardless of which group it was dropped into. Surface a toast so the operator understands why and what to do:

```ts
onUpload={async (groupKey, files) => {
  await Promise.allSettled(files.map(file => upload(file)))
  media.invalidate()
  if (groupKey === 'homeowner') {
    toast.info('Uploaded to Internal. You can show each image to the homeowner once it finishes optimizing.')
  }
}}
```

- `import { toast } from 'sonner'` — the toast helper already used across `features/proposal-flow`.
- The operator flips each image to homeowner via the Switch once it optimizes (the Switch unlocks automatically via the poll).

## Data flow

**Happy path (image):** upload → row `internal`, `pending` → QStash optimize → `optimized` → poll refetch unlocks the Switch → operator toggles homeowner → server gate passes → row `homeowner` → homeowner read guard admits it → customer sees the optimized responsive image.

**Dev / no-tunnel (image):** upload → `pending` forever → Switch stays disabled, manager polls → operator runs backfill → `optimized` → same as happy path.

**Failed optimization (image):** row `failed` → Switch disabled (image + not optimized) → operator hits Retry (2.1 `retryOptimization`) → `pending` → `optimized` → unlocks. If somehow a `failed` image is already `homeowner` (legacy), the read guard hides it from the customer until retried.

**Video / PDF:** upload → Switch enabled immediately (not gated) → operator toggles homeowner → gate skips the status check → read guard admits it unconditionally.

## Error handling

- **Server gate rejection:** `TRPCError PRECONDITION_FAILED` with a human message. The UI gate makes this path rare (the Switch is disabled), but a race (optimize regresses, stale client) surfaces the toast/error rather than silently persisting a heavy homeowner image. The client `setVisibility` mutation's `onError` should `toast.error(err.message)` for the race case.
- **Scope violations:** unchanged — `isVisible` probe → `NOT_FOUND`; `proposalMediaCrud.update` still enforces scope on the write.
- **Read guard:** never errors — it simply returns fewer rows. A proposal whose only homeowner images are unoptimized renders a gallery without them (plus any video/PDF), never a broken/heavy image.

## Testing

No unit-test runner in this repo; the gate is `pnpm tsc` + `pnpm lint`, plus manual browser verification:

1. **UI gate:** upload an image to a proposal → Switch disabled with "Available once optimized"; run the dev backfill → within ~3s the Switch enables (poll) → toggle homeowner succeeds.
2. **Server gate:** with an image still `pending`, call `setVisibility({ id, visibility: 'homeowner' })` directly (or force the Switch) → `PRECONDITION_FAILED`. Set `internal` on any row → always succeeds.
3. **Read guard:** manually set an unoptimized image row to `homeowner` in the DB (simulating legacy) → confirm it is absent from the customer gallery **and** the generated PDF, while an optimized homeowner image on the same proposal still shows.
4. **Video/PDF exemption:** upload a video → Switch enabled immediately → toggle homeowner → appears in the customer gallery despite `optimizationStatus !== 'optimized'`.
5. **Polling stops:** once all image rows are `optimized`/`failed`, confirm the network tab shows the list query stops refetching.

## Files touched

- `src/trpc/routers/proposals.router/media.router.ts` — write gate in `setVisibility` (imports `getProposalMediaFileById`).
- `src/shared/entities/proposal-media-files/dal/server/queries.ts` — read guard in `listHomeownerProposalMedia` (imports `notLike`, `or`).
- `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx` — Switch disable + hint, poll `refetchInterval`, `onUpload` cleanup + toast, `toast` import.
- Possibly `src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts` — `setVisibility` mutation `onError` toast for the race case (confirm during planning).

No schema change, no migration, no change to project media.

## Decisions locked (from brainstorming)

- **Async upload unchanged** — no synchronous optimize, no rollback, no timeout exposure.
- **Gate keyed on `optimizationStatus === 'optimized'`, image-only** — videos/PDFs exempt.
- **Gate + guard both** — write gate for fast feedback, read guard as the authoritative net (also covers legacy rows with no migration).
- **Block-and-re-toggle UX** — new homeowner-group uploads are blocked to Internal, re-toggled after optimize; not queued or auto-promoted.
- **Poll while any image pending** — 3s interval, stops when settled.
- **Proposals only** — projects unchanged.
- **Sub-plan 2.3, lands before the lightbox (Sub-plan 3).**
