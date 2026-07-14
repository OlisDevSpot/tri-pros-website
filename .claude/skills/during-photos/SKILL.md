---
name: during-photos
description: Use when a portfolio project needs "during construction" photos, when inserting branded Tri Pros crew into job-site imagery, when filling a project's before→during→after gallery story, or before ANY Higgsfield edit that adds workers to a real photo.
---

# During Photos — branded crew inserted into REAL job-site photos

## Iron rule (Oliver's ruling, 2026-07-13)

**The scene must BE a real photo. Never generate the scene.** Generated scenes
drift in site dimensions and proportions and are BANNED for portfolio use. The
model gets exactly one job: insert workers into an unmodified real photo.
If you catch yourself passing a before+after pair to nano_banana_2 to "create
a mid-construction scene" — stop; that is the superseded v1 approach
(history: `docs/superpowers/specs/2026-07-13-portfolio-during-photos-design.md`).

## API surface (the contract every run fulfills)

| | |
|---|---|
| **Input** | project title (folder under `public/portfolio-photos/projects/<Title>/`), optional base-photo pick, optional crew task, count N (default 1) |
| **Output (candidate)** | edited PNG(s) → `/mnt/c/Users/porat/Downloads/tri-pros-during-REALBASE-<project>-<task>.png` for Oliver's HITL pick — MANDATORY gate, never skip |
| **Output (approved)** | optimize-image-assets skill → `public/portfolio-photos/projects/<Title>/during-<next-free-N>.webp`; prod needs R2 upload to `portfolio-photos` bucket + re-seed (see `src/shared/db/seeds/data/media-files.ts`) |
| **Cost** | ~2 cr per edit pass; re-rolls cheap — iterate freely |

## Preflight (self-healing — run each check, repair before proceeding)

1. `higgsfield account status` — expect account + credits. If "No workspace
   selected": `higgsfield workspace list` + `workspace set <id>`. If auth
   expired: tell Oliver to run `higgsfield auth login` (browser OAuth).
2. Shirt swatch exists? Session-scoped — REBUILD each session into the scratchpad:
   ```js
   const sharp = require('<repo>/node_modules/sharp');
   const logo = await sharp('<repo>/video/public/brand/logo-dark-bottom.svg', {density:300}).resize(900).png().toBuffer();
   await sharp({create:{width:1200,height:1200,channels:3,background:{r:34,g:48,b:74}}})
     .composite([{input:logo,gravity:'center'}]).jpeg({quality:95}).toFile('<scratch>/shirt-print-swatch.jpg');
   ```
   ⚠️ Naming trap: `logo-dark-*` files are the WHITE-letter art FOR dark grounds — always this file on navy, never `logo-light-*`.
3. Base photo prep — ALWAYS `sharp(base).rotate().resize(2400 max)` first:
   phone photos carry EXIF rotation the CLI ignores; verify true W×H from
   sharp's output, then map to the CLOSEST nano_banana_pro aspect
   (1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 21:9). Keep the base's
   NATIVE orientation — portrait stays portrait.

## Base selection (decides the crew's task — never contradict the visible state)

| Base available | Crew task vocabulary |
|---|---|
| Real `during-*` photo (best) | Work matching the visible phase: grading → rake/wheelbarrow/compactor; gunite shell → trowel check, tape-measure layout; framing → level, nail gun; drywall → mud, sanding pole |
| Only `after-*`/`hero-after` | Finish/punch-list only: sweeping, joint top-up, appliance install, door adjustment, final wipe-down. NEVER un-build the scene |
| Only `before-*`/`hero-before` | Day-one prep only: measuring, marking, masking, laying floor protection, walking the site with a clipboard |
| Empty folder (Verona, Oasis) | STOP — nothing to anchor; report to Oliver |
| Base has a visible real person | Skip that base (unbranded worker next to branded inserts reads wrong) or crop them out first |
| Base has third-party watermark (all Monique photos: "Concierge Home Remodeling") | STOP and flag — editing around it fabricates; Oliver must supply cleaned originals first |

Pick bases that are sharp, well-exposed, and have open ground/floor where
workers plausibly stand. 2400px+ preferred; below ~1000px expect the model to
invent detail when upscaling — acceptable, but check landmarks after.

## THE TEMPLATE (single nano_banana_pro edit pass)

```
higgsfield generate create nano_banana_pro \
  --image-references <base.jpg> --image-references <shirt-print-swatch.jpg> \
  --aspect_ratio <NATIVE> --resolution 2k --wait --wait-timeout 10m \
  --prompt "<TEMPLATE below with slots filled>"
```

> The first reference is a REAL photo from our {PROJECT_CONTEXT — one clause:
> what the photo shows}. Keep this photo EXACTLY as it is: same camera angle,
> same framing, same lighting, same proportions, and every existing surface,
> object, and shadow unchanged{ — including <notable element: pet, vehicle,
> material pile> if present}. Do not rebuild, redraw, restyle, or move ANY part
> of the existing scene. The ONLY change: add two construction workers
> {WHERE — into the graded dirt / inside the empty shell / on the driveway} at
> realistic scale for their distance from the camera, with shadows and lighting
> that match the photo's light. Both workers face away from the camera, faces
> not visible. They wear matching deep-navy t-shirts with the company logo from
> the second reference image printed large and centered on their shirt BACKS —
> the house-shaped mark in white and light blue, TRI PROS, and REMODELING below
> it, letter-perfect — plus work pants and work boots. {POSE — one clause per
> worker, task-correct biomechanics: kneeling on knee pad to tile, leaning into
> a rake stroke, two hands on a trowel}. {PROPS — cap at what the task strictly
> needs, e.g. "A single push broom and one bucket are the only objects added."}
> Their integration must look like they were in the original photo: same grain,
> same exposure, same color temperature. Nothing else changes. No watermarks or
> text overlays anywhere.

Slot rules: ONE construction phase's vocabulary only; task-appropriate PPE only
(no hard hats in residential interiors — reads as stock photo); two workers max.

## QA gate (check at 100% zoom before delivering to Downloads)

- [ ] Logo letter-perfect on BOTH shirt backs: mark + "TRI PROS" + "REMODELING",
      white/light-blue ONLY (v1 once rendered it rainbow) — re-roll if not
- [ ] No face visible (a down-turned profile sliver is borderline — prefer re-roll
      with "only the top and back of his head")
- [ ] Landmarks unchanged vs base (walls, windows, piles, pets, horizon) — diff
      them side by side; drift = re-roll with stronger "keep EXACTLY" anchors
- [ ] Worker scale & shadow direction match the photo
- [ ] No watermark/text anywhere; no invented signage
- [ ] Aspect matches base (nano_banana_pro DEFAULTS TO 1:1 — if output came back
      square you forgot `--aspect_ratio`)

## Learnings ledger (self-improving — REQUIRED maintenance)

When a run hits a NEW failure mode: fix it, then in the SAME commit (a) append a
dated one-liner here, (b) amend the TEMPLATE/QA/preflight section it belongs to.
When a run contradicts a rule here (model behavior changed), update the rule —
this file is canonical over memory.

- 2026-07-13 — v1 scene-generation produced dimensional drift → Iron rule; real-base only.
- 2026-07-13 — nano_banana_pro defaults 1:1, silently recomposes → always pass --aspect_ratio.
- 2026-07-13 — phone bases are EXIF-rotated (Altura/Olympia/Riviera all) → sharp .rotate() before upload.
- 2026-07-13 — scene pass rendered logo in rainbow colors once → template pins "white and light blue" + QA check.
- 2026-07-13 — "faces away" ignored ~50% for kneeling/leaning poses → explicit "only the top and back of his head" phrasing works; edit pass can fix without disturbing scene (once added a ball cap — acceptable).
- 2026-07-13 — all Monique originals carry a Concierge Home Remodeling watermark → project blocked for during-photos until cleaned originals exist.
- 2026-07-13 — real cost ~2cr/edit pass (skill table's 6cr figure is for 2k nano_banana_2 stills), monthly credits refill; iterate freely.
- 2026-07-14 — top-down drone base (Bliss): model kept every element but ROTATED the composition 90° → for unusual angles or <1200px bases, spell out the frame layout in the prompt ("walkway runs HORIZONTALLY, street along the LEFT, mailbox bottom center") and forbid rotate/mirror/recompose; one re-roll fixed it.
- 2026-07-14 — drone/top-down IS viable: kneeling, bent-forward workers show shirt-back logos legibly from directly above.
- 2026-07-14 — skill validated 5/5 projects (Altura, Olympia, Riviera, Atlas, Bliss); Altura during-20 correctly rejected for visible real person; Monique correctly blocked on watermark rule.
