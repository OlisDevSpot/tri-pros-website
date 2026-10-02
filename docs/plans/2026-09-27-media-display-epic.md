# Media display epic

Goal: every surface that shows project media fetches and displays it one way, and the meeting flow's Specialties and Portfolio steps swap photos without a glitch. Owner request 2026-09-27: record the findings, then address them one by one.

Status legend: ⬜ open · 🟦 in design · 🟩 done

## Evidence (measured 2026-09-27, dev, headless Chromium 1440×900)

Frame-by-frame opacity traces of the photo layers on each photo change; request log from the Chrome DevTools protocol.

- **Portfolio, Space (next photo already in the browser cache):** old photo → the new photo's blur placeholder for ~40 ms → the old photo again at ~80 % → a near-black frame at ~190 ms (~20 % of the frame visible) → the new photo fully shown at ~400 ms. The new `<img>` was already `complete` when it mounted.
- **Portfolio, jump to a photo not yet loaded:** blur placeholder for ~330 ms while the old photo fades out, then blur removed with the photo still at 0 % (dark frame), then a 300 ms fade in.
- **Specialties, project photo from the proof strip:** the photo is fetched on click (480 KB `md` variant, ~230 ms), with the same blur → dark frame → fade sequence.
- **HTTP caching is not a cause.** R2 via Cloudflare sends `cache-control: max-age=14400` plus an ETag. Every photo shown after a Space press came from cache; the one request per press is the preload of the photo after it.
- **Bytes:** the Portfolio step's first load made 28 media requests (4.1 MB). Opening a 20-photo story phase made 13 requests (~1.4 MB), mostly 640 px `sm` variants for 80 px thumbnails. The `lg` variants sampled were 515–944 KB against a 350 KB budget.

## Findings

| # | Finding | Where | Status |
|---|---|---|---|
| F1 | **Two fades on one photo.** The photo layer crossfades (`AnimatePresence`, 400 ms), and inside it `OptimizedImage` runs its own load fade: on every mount it starts at opacity 0 behind the blur placeholder, removes the placeholder instantly on load, and fades the `<img>` from 0 over 300 ms — even when the image is cached. The two fades are out of step, so the old photo shows again and the frame dips to near-black. | [project-photo.tsx](../../src/features/meeting-flow/ui/components/steps/portfolio/project-photo.tsx), [showcase-media.tsx](../../src/features/meeting-flow/ui/components/steps/specialties/showcase-media.tsx), [optimized-image.tsx](../../src/shared/components/optimized-image.tsx). Same composition, not yet measured: [photo-lightbox.tsx](../../src/features/project-management/ui/components/photo-lightbox.tsx), [story-before-after.tsx](../../src/features/project-management/ui/components/story-before-after.tsx) | 🟦 |
| F2 | **Preloading is thin and never decodes.** Portfolio downloads only the one photo Space shows next and never decodes it; Specialties preloads nothing. Jumps (story phase, thumbnail, list card, proof strip) hit the network on the click. At the last photo, Portfolio preloads the next project's hero image, not the first photo of its first story phase. | [use-preload-photo.ts](../../src/features/meeting-flow/hooks/use-preload-photo.ts), [portfolio/index.tsx](../../src/features/meeting-flow/ui/components/steps/portfolio/index.tsx) (`upcoming`) | ⬜ |
| F3 | **A project jump changes the photo twice.** While a project's detail loads, Portfolio shows its hero image. When the detail arrives it switches to the first photo of the first story phase (usually Before): two crossfades, each hitting F1. Detail is fetched ahead for only the next 2 matches (`PREFETCH_AHEAD`). | [use-portfolio-navigation.ts](../../src/features/meeting-flow/hooks/use-portfolio-navigation.ts), [use-portfolio-project-detail.ts](../../src/features/meeting-flow/hooks/use-portfolio-project-detail.ts), [build-project-story-phases.ts](../../src/shared/modules/projects/core/lib/build-project-story-phases.ts) | ⬜ |
| F4 | **Variants too heavy for their use.** The variant budget is soft: an over-budget encode is retried once at quality 55 and kept even if still over. None of the 899 dev project photos has an `xs` variant (672 have only `sm` or no variants at all), so 48–80 px thumbnails download 640 px images. | [process-image-variants.ts](../../src/shared/modules/media/core/lib/process-image-variants.ts), [image-variants.ts](../../src/shared/modules/media/core/lib/image-variants.ts) | ⬜ |
| N1 | **Naming drift: "stage" in Specialties.** CONTEXT.md defines Stage as a pipeline stage and lists "stage" under _Avoid_ for slide content. Specialties uses it ~180 times (`useTradeStage`, `stageMediaKey`, `selectStageMedia`, `StageFrame`, …). New media code must not add to it; renaming the existing code is a separate owner call. | `src/features/meeting-flow` (specialties), [CONTEXT.md](../../CONTEXT.md) | ⬜ owner call |
| N2 | **No media-display glossary.** Hero image, variant, blur placeholder, crossfade and preload appear in code and comments but not in CONTEXT.md. The terms this epic introduces need owner agreement before any code uses them. | [CONTEXT.md](../../CONTEXT.md) | 🟩 |

## Order

1. **N2 terms** — agree the words before naming anything.
2. **F1** — one shared primitive owns the photo swap: hold the current photo until the next is decoded, then one crossfade; `OptimizedImage` skips its load fade when the image is already decoded. Adopt in Portfolio and Specialties, then the lightbox and before/after.
3. **F2** — one shared preload hook that downloads and decodes a small set of likely-next photos; replaces `usePreloadPhoto`.
4. **F3** — Portfolio keeps the current project on screen until the next project's detail is ready; revisit how far ahead detail is fetched.
5. **F4** — enforce the variant budget and give project media a thumbnail-sized variant (needs an R2 backfill: owner action on prod).
6. **N1** — owner decides whether Specialties' "stage" vocabulary is renamed, and to what.

Each of F1–F4 gets its own design (spec where it changes a shared interface), plan and review.

## Folded in from the Portfolio step's deferred list

From the Portfolio step's deferred follow-ups (session memory `project-portfolio-step-warmup.md`): `OptimizedImage`'s own fade under reduced motion (F1); `upcoming` preload vs the next project's first story-phase photo (F2); prefetch after the current detail settles, and `skipToken` for the detail query (F3).

## Log

- 2026-09-27 — findings measured and recorded.
- 2026-09-27 — N2: owner chose `CrossfadeImage` + `usePreloadImages` ("image" for generic shared UI, "photo" for project-domain UI); CONTEXT.md gained "Media display terms".
- 2026-09-27 — F1 in design. Owner rulings: when the next image isn't ready, **hold the current one up to ~300 ms, then crossfade to its blur placeholder and sharpen** (not "always hold", not "blur immediately"); **all four surfaces** adopt `CrossfadeImage` in F1 and the lightbox's zoom-in goes; build approach A (hold the shown image in `CrossfadeImage` state until the next is decoded off-screen, on the existing `AnimatePresence` pattern, plus `OptimizedImage` showing an already-loaded image before first paint).
- 2026-09-27 — Location: feature-layering **D1 decided (b)** — display code in a new `modules/media/display/` unit, management UI from `shared/components/media/` into `modules/media/core/`. This move is **F1 step 0** (pure move, no behaviour change, no shims). **D2 stays open**: `CrossfadeImage` takes `{ file } | { src }`, `OptimizedImage` keeps `file`.
- 2026-10-02 — Location revised by the owner: no separate `display` unit — display components in `modules/media/core/components/display/`, helpers in `core/lib/`, management UI in `core/components/`. Plan `docs/superpowers/plans/2026-10-02-crossfade-image.md`; executing via SDD in a worktree.
