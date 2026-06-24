# Bathrooms Funnel — Image Generation Prompt Sheet (Task 14)

**Purpose:** Generate the 17 images the bathrooms funnel spec references. After
generating raw PNGs, drop them under `public/funnels/bathrooms/` (the temp
location/name doesn't matter — the `optimize-image-assets` skill will convert to
webp, crop, resize, and place them at the exact contract paths below) and tell
Claude to run the optimize pass + Task 16 verification.

## Global style (apply to EVERY image — keep the set consistent)

- **Look:** photorealistic, professional real-estate / interior-photography
  quality. Southern California residential bathrooms.
- **Lighting:** bright, soft natural daylight; airy; no harsh shadows.
- **Palette:** warm-neutral — sand, off-white, light stone/concrete, warm wood,
  matte black or brushed-nickel fixtures; occasional soft blue-teal accent
  (the Tri Pros brand blue `#03AFED`) in a towel/decor detail. No loud colors
  except where a tile's MEANING requires it (e.g. the "original" dated tile).
- **Camera:** eye-level, straight-on or gentle 3/4 angle; ~24–35mm equivalent
  (no fisheye, no extreme wide distortion); consistent framing across the set.
- **Staging:** clean, uncluttered, lightly styled (a plant, folded towel,
  minimal decor). No people. No pets.
- **Absolutely avoid (negative prompt):** text, captions, watermarks, logos,
  brand names, signage, people, hands, reflections of a camera/photographer,
  fisheye/barrel distortion, cluttered counters, dirty/grimy surfaces (except
  the intentional "dated/original" age tiles), HDR halos, oversaturation.
- **Output:** generate large (≥1024px on the short side), PNG. The optimize
  skill handles final sizing/format.
- **Aspect ratios:**
  - Option tiles (whichBathroom / age / scope): **1:1 square** (rendered in
    card grids). 1024×1024.
  - Before/after pairs (value block): **4:3 landscape**, ~1600×1200. **Each
    pair must be the SAME bathroom, SAME camera position and framing** in both
    states — only the renovation differs (so the drag-to-reveal comparison
    lines up). Generate the "after" first, then an image-to-image / identical-
    composition "before" of the same room.

---

## A. `whichBathroom/` — "Which bathroom are you remodeling?" (4 tiles, 1:1)

Distinguish the bathrooms by SIZE/TYPE, not finish quality (all four can look
nicely finished — the point is which room).

1. **`primary.webp` — Primary / ensuite**
   > Spacious primary ensuite bathroom in a modern Southern California home: a
   > long double-sink floating vanity, a large frameless glass walk-in shower,
   > and a freestanding soaking tub; warm neutral stone tile, soft daylight from
   > a window; a doorway hinting at the connected bedroom. Luxurious but
   > realistic, uncluttered. 1:1, photorealistic, no people, no text.

2. **`guest.webp` — Guest / hall bath**
   > A standard full guest/hall bathroom: single-sink vanity, a tub-and-shower
   > combo with a tiled surround, a mirror and sconce lighting; compact but
   > bright, warm-neutral palette. Reads as an everyday family bathroom off a
   > hallway. 1:1, photorealistic, no people, no text.

3. **`powder.webp` — Powder room**
   > A small half-bath / powder room: a single small vanity or pedestal sink and
   > a toilet only — NO shower, NO tub. Decorative mirror, a sconce, a small
   > piece of wall art, tasteful wallpaper or paint; intimate and stylish. 1:1,
   > photorealistic, no people, no text.

4. **`multiple.webp` — Multiple bathrooms**
   > A clean composition conveying MORE THAN ONE bathroom: a tasteful two-panel
   > split image, left half a primary ensuite vanity, right half a guest bath
   > vanity, divided by a thin neutral seam; consistent warm-neutral styling
   > across both halves so it reads as "several bathrooms." 1:1, photorealistic,
   > no people, no text, no numerals.

---

## B. `age/` — "How old is your bathroom?" (4 tiles, 1:1)

Here finish quality / era IS the message — make the dating obvious.

1. **`0-5.webp` — 0–5 years**
   > A clearly recently-renovated, current-style bathroom: large-format
   > porcelain tile, a sleek floating vanity, matte-black or brushed fixtures,
   > frameless glass shower; crisp, on-trend, like-new. 1:1, photorealistic, no
   > people, no text.

2. **`5-15.webp` — 5–15 years**
   > A well-kept but mid-2010s bathroom: granite or basic quartz vanity top,
   > raised-panel wood cabinets, a framed glass shower door, polished-chrome
   > fixtures, beige subway or travertine tile; clean but a half-generation
   > behind current trends. 1:1, photorealistic, no people, no text.

3. **`15-plus.webp` — 15+ years**
   > A dated early-2000s bathroom: oak or cherry vanity, cultured-marble
   > integrated sink top, oil-rubbed-bronze fixtures, a beige tub surround,
   > tan/almond tile; tidy but clearly aging. 1:1, photorealistic, no people,
   > no text.

4. **`original.webp` — Original / never renovated**
   > An original, never-renovated vintage bathroom from the 1960s–70s: colored
   > ceramic tile (soft pink or mint-green) with a contrasting border, a
   > built-in alcove tub, an old single-handle fixture, a small framed mirror;
   > clean but unmistakably original and decades old. 1:1, photorealistic, no
   > people, no text.

---

## C. `scope/` — "What are you picturing?" (5 tiles, 1:1)

Each tile should depict the END STATE of that scope (aspirational), except where
the scope is inherently a conversion.

1. **`full-gut.webp` — Full gut remodel**
   > A completely transformed, top-to-bottom modern bathroom: new large-format
   > tile floor and walls, a freestanding tub, a frameless walk-in shower, a new
   > double vanity, recessed and accent lighting — everything new and cohesive.
   > Reads as "the whole room redone." 1:1, photorealistic, no people, no text.

2. **`tub-to-shower.webp` — Tub → shower conversion**
   > A low-curb / curbless walk-in shower installed where a bathtub used to be:
   > a long rectangular tiled shower with a linear drain and a frameless glass
   > panel, occupying a former tub alcove footprint; safe, modern, accessible.
   > 1:1, photorealistic, no people, no text.

3. **`walk-in-shower.webp` — New walk-in shower**
   > A large new frameless-glass walk-in shower as the focal point: floor-to-
   > ceiling tile, a built-in niche, a rainfall head and handheld, a teak bench;
   > spa-like and bright. 1:1, photorealistic, no people, no text.

4. **`vanity-fixtures.webp` — Vanity + fixtures**
   > Tight focus on a NEW vanity and fixtures: a stylish floating or shaker
   > vanity with a quartz top and undermount sink(s), a modern faucet, a framed
   > mirror, and vanity lighting; the rest of the room understated so the
   > vanity/fixtures are the subject. 1:1, photorealistic, no people, no text.

5. **`cosmetic.webp` — Cosmetic refresh**
   > A light, fresh cosmetic update of an existing bathroom: same basic layout,
   > but new paint, a new mirror, updated light fixture, new faucet and hardware,
   > fresh towels — bright and renewed without structural change. 1:1,
   > photorealistic, no people, no text.

---

## D. Value-block before/after pairs (4 images, 4:3 landscape, MATCHED pairs)

Each pair is the SAME room, SAME camera, SAME framing — only the renovation
state changes. Generate the "after" first, then a composition-locked "before."

**Pair 1 — tub-to-spa-shower transformation**
- **`after-1.webp`**
  > 4:3 landscape, eye-level: a beautifully remodeled primary bathroom — a large
  > frameless walk-in shower with floor-to-ceiling stone-look tile, a floating
  > double vanity, warm neutral palette, bright daylight, lightly styled. Spa-
  > like. Photorealistic, no people, no text.
- **`before-1.webp`** (IDENTICAL composition/camera to after-1)
  > Same bathroom, same camera position and framing as the "after," but in its
  > dated original state: an old alcove tub with a sliding glass door, dated
  > almond tile, an oak vanity with a cultured-marble top, chrome fixtures, worn
  > and tired. Photorealistic, no people, no text.

**Pair 2 — dated vanity wall → modern spa vanity**
- **`after-2.webp`**
  > 4:3 landscape, eye-level on the vanity wall of a remodeled bathroom: a sleek
  > floating double vanity with a quartz top, twin modern faucets, a large
  > frameless mirror with linear lighting, large-format tile, warm-neutral and
  > bright. Photorealistic, no people, no text.
- **`before-2.webp`** (IDENTICAL composition/camera to after-2)
  > Same vanity wall, same camera position and framing as the "after," but
  > dated: a bulky builder-grade oak vanity, a cultured-marble integrated sink,
  > a frameless builder mirror, brass/chrome fixtures, beige tile, tired and
  > old. Photorealistic, no people, no text.

---

## Contract paths (where files must end up after optimization)

```
public/funnels/bathrooms/
  whichBathroom/  primary.webp  guest.webp  powder.webp  multiple.webp
  age/            0-5.webp  5-15.webp  15-plus.webp  original.webp
  scope/          full-gut.webp  tub-to-shower.webp  walk-in-shower.webp  vanity-fixtures.webp  cosmetic.webp
  before-1.webp  after-1.webp  before-2.webp  after-2.webp
```

The funnel hero, callout image, problem-block reasons, and process images
already point at existing files — no generation needed for those.

## After you have the images

Drop the raw PNGs anywhere under `public/funnels/bathrooms/` and tell Claude to
"run optimize-image-assets on the bathrooms funnel art and finish Task 14 + 16."
Claude will convert→webp, crop/resize to the option-tile (1:1) and before/after
(4:3) specs, place them at the contract paths, then run the Task 16 end-to-end
verification (event sequence, drop-off persistence into the Funnel Intake panel,
variant fallback, kitchens regression).
```
