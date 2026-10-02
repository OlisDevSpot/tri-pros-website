# F1 — `CrossfadeImage`: one crossfade per photo change

Media display epic, finding F1 (`docs/plans/2026-09-27-media-display-epic.md`). Terms: CONTEXT.md "Media display terms".

## 1. Problem

Every photo change in the meeting flow's Portfolio and Specialties steps shows the old photo again and dips to near-black before the new photo appears (frame traces in the epic's Evidence section). Two fades are stacked:

- The photo layer crossfades: `AnimatePresence` keyed on the photo, 400 ms.
- Inside it, `OptimizedImage` runs its own load fade on every mount, even for a cached image. It starts the `<img>` at opacity 0 behind the blur placeholder, checks `img.complete` only after the first paint, unmounts the blur placeholder the instant the image has loaded, and fades the `<img>` from 0 over 300 ms.

With nothing underneath the new layer for those frames, the fading-out old photo shows through; then both are nearly transparent.

## 2. Owner decisions (2026-09-27)

| # | Decision |
|---|---|
| O1 | Names: `CrossfadeImage` and `usePreloadImages` (F2). "Image" names generic shared UI; "photo" stays the word in project-domain UI and copy. |
| O2 | When the next image isn't ready: **hold the current image up to `CROSSFADE_HOLD_MS` (300 ms)**. Ready in time → one crossfade. Not ready → crossfade to the next image's blur placeholder, which sharpens when the image loads. Never old → blur → old → dark → new. |
| O3 | All four surfaces that crossfade media move to `CrossfadeImage` in F1: Portfolio `ProjectPhoto`, Specialties `ShowcaseMedia`, `StoryBeforeAfter`, `PhotoLightbox`. The lightbox's zoom-in (scale 0.97 → 1) goes. |
| O4 | Approach A: `CrossfadeImage` holds the image on screen in its own state until the next is decoded off-screen, then swaps on the existing `AnimatePresence` pattern. |
| O5 | Feature-layering D1 = (b): display code lives in a new `modules/media/display/` unit; the management UI moves into `modules/media/core/`. |
| O6 | Feature-layering D2 stays open: `CrossfadeImage` takes `{ file } \| { src }`; `OptimizedImage` keeps its `file` prop. |

## 3. Step 0 — move media UI into `modules/media` (no behaviour change)

One commit that only moves files and rewrites imports. No re-export shims; every importer is updated in the same commit.

| From | To |
|---|---|
| `src/shared/components/optimized-image.tsx` | `src/shared/modules/media/display/components/optimized-image.tsx` |
| `src/shared/lib/get-optimized-urls.ts` | `src/shared/modules/media/display/lib/get-optimized-urls.ts` |
| `src/shared/components/media/media-manager.tsx`, `media-card.tsx`, `media-reorder-grid.tsx`, `media-sortable-item.tsx`, `media-upload-button.tsx`, `photo-detail-dialog.tsx` | `src/shared/modules/media/core/components/` (same file names) |
| `src/shared/components/media/types.ts` (`MediaItem`, `MediaGroup`) | appended to `src/shared/modules/media/core/types.ts` (type-only; the file already holds the `MediaStore` contract) |
| `src/shared/components/media/use-media-upload.ts` | `src/shared/modules/media/core/hooks/use-media-upload.ts` |

- Imports: 24 `OptimizedImage` importers, 6 `get-optimized-urls`, 2 each for the manager, types and upload hook: 39 files touched, including the moved ones.
- The moved management components switch their relative `./` imports to `@/shared/modules/media/core/...` only where they cross folders (`types.ts`); siblings stay relative.
- `src/shared/modules/media/DOCS.md:140-143` cites the old paths; update the citations only.
- `image-variants.ts` stays in `core/lib`: the server's encoder and the display side both read it.
- Not moved: `src/shared/components/image-slider.tsx` (generic compare slider) and `PhotoLightbox` (project-page feature UI).

Gate: `pnpm tsc` 0 errors, `pnpm lint` no new errors, no remaining import of the old paths (`grep`).

## 4. `OptimizedImage` changes

1. **Already-loaded images show at once.** The `img.complete` check moves from `useEffect` to `useLayoutEffect`, so an image that is complete when it mounts sets `loaded` before the first paint: no blur placeholder, no fade. React 19 no longer warns about `useLayoutEffect` during SSR.
2. **The blur placeholder stays until the image has faded in.** It is no longer unmounted on load. It stays mounted under the `<img>` and fades to opacity 0 (or 0.4 with `persistBlur`) on its existing 500 ms transition, while the `<img>` fades in over it on its 300 ms transition. No frame shows the empty container.
3. **Reduced motion.** Both the blur placeholder and the `<img>` get `motion-reduce:transition-none`.

The prop interface is unchanged apart from exporting its file type as `OptimizedImageFile` (today an inline type), which `CrossfadeImage` reuses. These changes apply to every surface that uses `OptimizedImage`; all of them get the same fix.

## 5. `CrossfadeImage`

`src/shared/modules/media/display/components/crossfade-image.tsx`

```ts
export type CrossfadeImageSource = { file: OptimizedImageFile } | { src: string }

interface CrossfadeImageProps {
  image: CrossfadeImageSource
  alt: string
  sizes: string
  /** Applied to the <img>: `object-cover` / `object-contain`. */
  className?: string
  /** Passed through to OptimizedImage. */
  persistBlur?: boolean
  priority?: boolean
}
```

Renders absolutely positioned layers that fill the parent, so the parent must be positioned (all four callers already are).

**Behaviour.**
- **Identity.** An image is identified by its resolved `src` URL: `getOptimizedSrc(file)` for a file, `src` for a static photo. The same identity never restarts a crossfade.
- **First render.** It shows the image at once, with no hold.
- **On change.** It keeps rendering the shown image and starts `decodeImage` for the next one. Whichever comes first:
  - The decode settles (resolved or rejected): it swaps to the next image.
  - `CROSSFADE_HOLD_MS` passes: it swaps anyway. The new layer's `OptimizedImage` shows the blur placeholder, then sharpens when the image loads (section 4, item 2).
- **Newest wins.** Each change takes a sequence number; a decode or timer from an older change is ignored. The timer is cleared on change and on unmount.
- **Swap.** `AnimatePresence initial={false}` keyed on the identity. The incoming `motion.div` fades 0 → 1 with `CROSSFADE_TRANSITION`, on top. The outgoing one stays at opacity 1 underneath and is removed only once the incoming one is fully in (exit: `{ opacity: 0 }` with `duration: 0`, `delay` = the crossfade's duration). Fading both at once would let the background through, down to 75 % visible at the midpoint, which fails §7's ≥ 0.95. Under `useReducedMotion()` the transition is `{ duration: 0 }` and the exit is immediate. *(Amended 2026-10-02 while planning.)*
- **Rendering.** A file renders through `OptimizedImage fill`. A static photo renders through `next/image fill` (the app sets `images.unoptimized: true`, so it emits the plain path, the same URL `decodeImage` fetched).

**`decodeImage`**, in `src/shared/modules/media/display/lib/decode-image.ts`:

```ts
export function decodeImage(source: { src: string, srcSet?: string, sizes?: string }): Promise<void>
```

It creates an off-screen `Image`, sets `sizes` then `srcset` then `src` in that order, and returns `image.decode()`. `sizes` is a viewport-based media condition, so the off-screen image picks the same variant the page's `<img>` will pick, and the browser's image cache serves it. F2's `usePreloadImages` reuses this.

**Constants**, in `src/shared/constants/motion.ts`:

```ts
/** The photo crossfade: opacity only, the brand curve, 400 ms. */
export const CROSSFADE_TRANSITION = { duration: 0.4, ease: BRAND_EASE } as const
/** How long a photo change waits for the next image to decode before showing its blur placeholder. */
export const CROSSFADE_HOLD_MS = 300
```

`SHOWCASE_CROSSFADE` (`src/features/meeting-flow/constants/showcase.ts`) is deleted.

## 6. Migrations

| Surface | Today | After |
|---|---|---|
| Portfolio: `features/meeting-flow/ui/components/steps/portfolio/project-photo.tsx` | `AnimatePresence` + `motion.div` + `OptimizedImage`, own `useReducedMotion` | `<CrossfadeImage image={{ file }} alt={alt} sizes="100vw" className="object-cover" priority />`. The "Next photo" overlay button stays. `usePreloadPhoto` stays until F2 (its import of `get-optimized-urls` moves in step 0). |
| Specialties: `features/meeting-flow/ui/components/steps/specialties/showcase-media.tsx` | `AnimatePresence` + a `kind === 'project' ? OptimizedImage : Image` branch | `<CrossfadeImage image={media.kind === 'project' ? { file: media.file } : { src: media.photo.src }} alt={media.caption} sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" priority />`. Scrim and caption unchanged. |
| Project page: `features/project-management/ui/components/story-before-after.tsx` | Two `AnimatePresence mode="popLayout"` + `OptimizedImage`, 300 ms | One `CrossfadeImage` per slider side, same `sizes`, `priority={activePairIndex === 0}`. |
| Project page: `features/project-management/ui/components/photo-lightbox.tsx` | `motion.div` keyed on the photo, opacity + scale entrance, no exit | `CrossfadeImage` with `persistBlur`, `className="object-contain"`, same `sizes`, `priority`, inside the existing positioned frame. |

Afterwards no file pairs `AnimatePresence` with `OptimizedImage` for a photo swap. The two cards that animate only an overlay (`portfolio-project-card.tsx`, landing `project-card.tsx`) are not swaps and stay as they are.

## 7. Verification

Re-run the epic's frame trace (headless Chromium via the repo's `playwright`, reading the dev login secret inside the script and never printing a URL that contains it) on the Portfolio and Specialties steps at 1440×900.

- **Cached swap (Space in Portfolio):** once a change starts, the old image's visible share never rises again, and total visible opacity stays ≥ 0.95 on every frame.
- **Uncached swap (a far thumbnail in Portfolio, a proof-strip photo in Specialties):** the old image holds for up to ~300 ms, then blur placeholder, then sharp. No frame below 0.95 total visible.
- **Rapid presses:** five Space presses 80 ms apart end on the fifth photo, with no swap back.
- **Reduced motion** (`prefers-reduced-motion: reduce`): swaps are instant, with no blur/load fade on cached images.
- **Browser check** of the project page's before/after slider and lightbox: swaps crossfade, the blur placeholder persists behind `object-contain` in the lightbox, no zoom.
- `pnpm tsc` 0 errors; `pnpm lint` no new errors. No committed tests, as for the Portfolio step.

## 8. Out of scope

- F2: preloading more than the one next photo (`usePreloadImages`).
- F3: Portfolio's project jump.
- F4: variant budget, thumbnail variant.
- D2: a shared display shape for `OptimizedImage`.
- N1: renaming Specialties' "stage" vocabulary.
- The `kind === 'project' ? OptimizedImage : Image` branch in `work-card.tsx` and `trade-thumb.tsx` (not swaps; retired by D2 if at all).
