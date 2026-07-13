# Portfolio "During" Photos — AI-Generated Progress Shots (Design)

**Date:** 2026-07-13
**Status:** Approved (Oliver, 2026-07-13)
**Owner:** Oliver

## Problem

Tri Pros didn't take during-construction photos on several portfolio projects. The
public portfolio gallery (`progress-gallery.tsx`) tells a before → during → after
story; projects without during coverage have a hole in the narrative. We fill the
gap with AI-generated progress photos that reconstruct how the job site actually
looked mid-project — anchored to each project's real before/after photos so they
sit credibly in the same gallery.

## Decisions (locked)

| Decision | Value |
|---|---|
| Destination | Website portfolio gallery only (no ads for now — no Meta AI-disclosure surface) |
| Aspect / format | 3:2 landscape, generated at 2k, delivered as optimized webp |
| Save location | `public/portfolio-photos/projects/<Title>/during-N.webp` via optimize-image-assets pipeline |
| Projects (round 1) | Atlas (exterior), Monique (kitchen), Riviera (pool) |
| Batch size | 2 images per project (after a single Atlas test image proves the prompt) |
| Worker rule | Two workers max, faces away from camera, navy shirts `rgb(34,48,74)` with white `logo-dark-bottom` lockup large on shirt backs |
| HITL gate | All candidates delivered to Windows Downloads as contact sheet; Oliver picks winners before finalization (mirrors the morph base-pair gate) |

## ⚠️ REVISION 2026-07-13 (v2) — real-base pipeline. Supersedes scene generation below.

Oliver's ruling after reviewing the first batch: **generated scenes drift in site
dimensions/proportions. The scene must BE the real photo.** Never regenerate the
scene from references; edit a real photo and ONLY add workers.

**v2 pipeline (canonical):**
1. **Base = a real photo**, EXIF-rotated via sharp `.rotate()`, kept at its
   NATIVE aspect ratio (portrait phone shots stay portrait — pass the matching
   `--aspect_ratio` to nano_banana_pro or it recomposes to 1:1).
   - Project has real during photos (Altura 25, Olympia 14, Riviera 2) → use them.
   - Only afters → crew does finish/punch-list work consistent with the visible
     state (sweeping, joint top-up, grill install, door adjustment).
   - Only befores → crew does day-one prep (measuring, masking, floor protection).
   - NEVER show a phase that contradicts the base's visible state.
2. **Single edit pass**: `nano_banana_pro --image-references <base> --image-references <swatch> --aspect_ratio <native>`
   + prompt: "REAL photo from our job site. Keep EXACTLY — same angle, framing,
   lighting, proportions, every object unchanged. Do not rebuild/redraw/restyle
   ANY part. ONLY change: add two workers [task matching visible state] at
   realistic scale, shadows matching the photo's light, faces away, navy shirts
   with the exact logo from the second reference on shirt BACKS, letter-perfect.
   Same grain/exposure/color temperature. Nothing else changes." Cap added props
   to what the task strictly needs (one broom, one bucket).
3. Logo/face touch-up re-roll if needed (same pass, ~2cr).

Validated 2026-07-13: Altura during-5 (grading crew), Riviera during-2 (gunite
inspection — dog preserved), Atlas garage-driveway (finish detail). All
pixel-true to the base sites.

The v1 scene-generation approach below is retained for reference and for AD
stills where no real base exists (framed crew card) — do NOT use it for
portfolio gallery photos.

## Approach (v1 — superseded for portfolio use)

Extend the proven showcase-ads two-step recipe (`.claude/skills/showcase-ads/SKILL.md`,
"During/crew still") with per-project anchoring:

1. **Anchor pair** — real before + after photos of the same area (geometry reference).
2. **Style ref** — one REAL during photo from Altura or Olympia (photographic-texture
   reference: handheld phone look, natural light, grain).
3. **Logo swatch** — pixel-exact shirt print: rasterize
   `video/public/brand/logo-dark-bottom.svg` (white art — naming trap: `logo-dark-*`
   = light-colored art FOR dark grounds) onto navy `{r:34,g:48,b:74}` with sharp.
4. **Scene pass** — `nano_banana_2 --aspect_ratio 3:2 --resolution 2k` with refs
   (before, after, style, swatch) + master prompt below.
5. **Logo pass** — `nano_banana_pro` with (scene, swatch): keep scene exactly,
   replace both shirt-back prints letter-perfect; re-roll until "TRI PROS" +
   "REMODELING" reads at 100% zoom.
6. **HITL review** → approved images through optimize-image-assets →
   `public/portfolio-photos/projects/<Title>/during-N.webp`.

Rejected alternatives: one-step generation with logo described in words (mangles
the lockup — the reason the two-step exists); empty-scene generation + worker
compositing (more work, worse blending).

If the style ref causes content bleed (Altura hardscape elements leaking into a
kitchen scene), drop it to 3 refs and carry the photographic style in prompt words.

## Master prompt template

> Candid contractor progress photo taken on a phone at an active residential
> remodel job site — `{PROJECT_CONTEXT}`. Scene phase: `{PHASE}` — every visible
> detail belongs to this phase only; no finished surfaces from later phases, no
> leftovers from earlier ones. The space matches the geometry of the first two
> reference photos (before, after) exactly — same `{ANCHORS}` — shown at a
> believable midpoint between them. Two workers, both facing away from camera,
> faces not visible, wearing matching deep-navy t-shirts with the company logo
> from the last reference printed large on the shirt backs, warped naturally to
> the fabric; work pants, real work boots, safety glasses and gloves only — no
> hard hats. `{POSE — task-specific biomechanics}`. Tool staging is functional,
> not decorative: `{PHASE_TOOLS}` placed near the work they serve; extension cord
> running out of frame; a cooler and shop vac at the frame edge. Shot handheld,
> slightly casual framing, natural SoCal daylight `{or: window light + harsh LED
> work light}`, mild grain, no cinematic bokeh, no HDR glow — match the
> photographic texture of the third reference image.

### Realism rules encoded in the slots

- **Phase consistency is the #1 tell.** Each image is assigned ONE construction
  phase and only that phase's vocabulary appears: demo (debris, contractor bags,
  pry bars, capped stubs, Ram Board), rough-in (open studs, Romex, blue boxes,
  PEX), drywall (stacked sheets, mud buckets, sanding pole, white dust, plastic
  over doorways), finish (flat-pack cabinets, laser level line, tile spacers,
  wet saw, drop cloths), exterior (forms + rebar, plate compactor, string lines,
  CMU, pebble/plaster trowel work).
- **Biomechanics**: poses match the task (kneeling on knee pad to tile, one knee
  down steadying a cabinet, two hands on a trowel float).
- **PPE calibration**: safety glasses/gloves where the task warrants; NO hard hats
  indoors on residential — over-PPE reads as stock photo.
- **Site logic**: tools near the work they serve; materials stacked as delivered;
  cords running somewhere plausible; small crew artifacts (cooler, shop vac).
- **Camera logic**: contractor progress photo, not marketing — handheld, casual
  framing, mixed natural/work light, mild grain, no HDR/bokeh.
- **Crew consistency**: same two crew builds recur across a project's set.

## Scene specs (round 1)

**Atlas** (Beverly Hills — outdoor kitchen, driveway, pool deck, turf):
1. *Flatwork prep* — driveway formed and staked, rebar grid on chairs, one worker
   kneeling tying rebar, one walking a wheelbarrow on a plywood path.
2. *Outdoor kitchen build* — CMU block island half-laid, mortar board and trowel,
   level on the course, paver pallets staged on the future pool deck.

**Monique** (Arcadia kitchen):
1. *Demo/rough* — cabinets gone, capped plumbing stubs, exposed subfloor, debris
   in contractor bags, Ram Board path to the door.
2. *Cabinet install* — uppers going in against a laser-level line, one worker
   steadying the box, one driving screws, flat-packs staged in adjacent room.

**Riviera** (Indio pool):
1. *Pebble application* — crew in the drained shell troweling wet mini-pebble,
   hose and pump lines over the coping.
2. *Baja shelf tile/coping* — worker setting waterline tile with spacers, wet saw
   and thinset bucket on the deck.
   Prep: convert needed `.HEIC` anchors to web format first.

## Cost

~6cr per nano pass; two passes + re-rolls ≈ 15–25cr per finished image;
6 images ≈ 100–150cr worst case. Not a constraint.

## Follow-ups (out of scope for round 1)

- **Monique has no DB seed row** (`src/shared/db/seeds/data/projects.ts` defines
  7 projects; Monique exists on disk only). Its during photos won't surface on
  the site until seeded. Separate small task.
- Prod delivery: seed loader maps folders → R2 (`portfolio-photos` bucket);
  uploading approved webps to R2 + re-seed is part of shipping, handled when
  round-1 winners are picked.
