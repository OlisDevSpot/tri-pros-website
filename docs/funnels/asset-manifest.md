# Funnel AI Asset-Generation Manifest

> **Purpose**: Out-of-band worklist for generating every static image asset used in
> the interactive funnels. Run these prompts once per asset; drop the output in the
> path shown; done. No code changes required — `OptionAsset` refs only need a path swap.
>
> **Status**: `kitchens` fully specified. `bathrooms` and `complete-interior` are
> placeholder stubs to fill when those funnels ship.

---

## 1. Tooling Decisions

| Use case | Tool | Rationale |
|---|---|---|
| Photoreal example / marketing imagery | **FLUX.2 Pro** | Most photorealistic output at low per-image cost; Kontext-style editing enables consistent variant sets (e.g. same kitchen rendered in multiple layouts from a single seed). |
| Clean text baked into an image (badges, labels, callouts) | **Ideogram** | Best-in-class legibility for in-image text; use for any asset where a label must read clearly without post-processing. |
| Layout / floor-plan diagrams | **Authored SVG** | Already shipped in `src/shared/domains/funnels/constants/floor-plan-diagrams.tsx`. Vector-first; Recraft can trace a rough sketch into a head-start SVG if needed. |
| Video / cinematic motion (hero loops, ZIP map animation) | **Higgsfield** | Reserved for **future** video assets only — do NOT use for the stills below. |

---

## 2. Storage Convention

### Now (local public dir)

```
public/funnels/<funnel-slug>/<filename>.webp
```

Referenced in funnel metadata as:

```
/funnels/<funnel-slug>/<filename>.webp
```

The `OptionAsset` image ref shape (`{ kind: 'image', src, alt }`) keeps the later
migration to a one-line path swap.

### Later (R2 migration — Appendix A)

Bucket: **`tpr-funnel-assets`**
CDN prefix: `https://assets.triprosremodeling.com/funnels/<funnel-slug>/<filename>.webp`

Update the `src` field in each funnel's option metadata when migrating; no other
code changes needed.

---

## 3. Per-Funnel Asset Tables

### 3.1 `kitchens`

#### Option example images

Each layout option ships one photoreal example photo. The `not-sure` option uses a
copy-only card — no image needed.

| Option key | Output path | Dimensions | Aspect | Generation prompt note |
|---|---|---|---|---|
| `l-shape` | `public/funnels/kitchens/l-shape.webp` | 1200 × 900 px | 4:3 | Eye-level photoreal modern L-shaped kitchen; warm white shaker cabinets, brushed-brass hardware, quartz counters, daylight from a window over the sink; no people. |
| `u-shape` | `public/funnels/kitchens/u-shape.webp` | 1200 × 900 px | 4:3 | Eye-level photoreal U-shaped kitchen wrapping three walls; navy lower cabinets, white uppers, waterfall island end-cap, pendant lights; no people. |
| `galley` | `public/funnels/kitchens/galley.webp` | 1200 × 900 px | 4:3 | Eye-level photoreal galley kitchen, two parallel counters, narrow aisle; flat-front oak veneer cabinets, under-cabinet LED strip, polished concrete floor; no people. |
| `island` | `public/funnels/kitchens/island.webp` | 1200 × 900 px | 4:3 | Eye-level photoreal open-plan kitchen with large center island and seating; white Shaker cabinets, dark-veined marble island top, three rattan pendants, warm afternoon light; no people. |
| `open` | `public/funnels/kitchens/open.webp` | 1200 × 900 px | 4:3 | Eye-level photoreal open-concept kitchen flowing into dining/living; minimal slab-door cabinets, quartz waterfall peninsula, unobstructed sightlines to living area; no people. |
| `not-sure` | *(none)* | — | — | Card uses illustration/icon only; skip. |

**Generation settings (all kitchens images)**
- Tool: FLUX.2 Pro
- Format: WebP, quality 85
- Minimum source resolution: 1200 × 900 px (scale down from higher if needed)
- Style seed: reuse the same seed across all five for visual cohesion; vary the prompt noun phrases to differentiate layouts

#### Hero / funnel-level media

| Asset | Output path | Dimensions | Notes |
|---|---|---|---|
| Hero image (funnel card + OG) | `public/funnels/kitchens/hero.webp` | 1200 × 630 px (16:9-ish) | Wide-angle photoreal kitchen remodel showcase; mixed cabinet styles collage OR single aspirational hero; warm, bright, inviting. FLUX.2 Pro. |

---

### 3.2 `bathrooms` *(stub — fill when funnel ships)*

> **Status**: funnel not yet built. Add option keys, prompt notes, and paths here
> when the `bathrooms` funnel definition is authored.

| Option key | Output path | Dimensions | Aspect | Generation prompt note |
|---|---|---|---|---|
| *(TBD)* | `public/funnels/bathrooms/<option>.webp` | 1200 × 900 px | 4:3 | *(TBD)* |

Hero:

| Asset | Output path | Dimensions | Notes |
|---|---|---|---|
| Hero image | `public/funnels/bathrooms/hero.webp` | 1200 × 630 px | *(TBD)* |

---

### 3.3 `complete-interior` *(stub — fill when funnel ships)*

> **Status**: funnel not yet built. Add option keys, prompt notes, and paths here
> when the `complete-interior` funnel definition is authored.

| Option key | Output path | Dimensions | Aspect | Generation prompt note |
|---|---|---|---|---|
| *(TBD)* | `public/funnels/complete-interior/<option>.webp` | 1200 × 900 px | 4:3 | *(TBD)* |

Hero:

| Asset | Output path | Dimensions | Notes |
|---|---|---|---|
| Hero image | `public/funnels/complete-interior/hero.webp` | 1200 × 630 px | *(TBD)* |

---

## Appendix A — R2 Migration Checklist

When moving from `public/funnels/` to the `tpr-funnel-assets` R2 bucket:

1. Upload all `.webp` files to `tpr-funnel-assets/<funnel-slug>/` with public ACL.
2. Set CDN prefix: `https://assets.triprosremodeling.com/funnels/`.
3. Find every `OptionAsset` `src` field that starts with `/funnels/` and replace the
   prefix with the CDN URL. (One `sed` or find-replace in the funnel metadata files.)
4. Confirm `next.config` `images.remotePatterns` includes `assets.triprosremodeling.com`.
5. Remove the now-unused `public/funnels/` directory and commit.
