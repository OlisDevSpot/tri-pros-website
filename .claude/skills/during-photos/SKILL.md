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
2. Shirt swatch exists? Session-scoped — REBUILD each session into the scratchpad.
   ONE print art, TWO placements (Oliver 2026-07-14 correction): both the BACK
   (large, centered) and the FRONT (small, upper LEFT chest) carry the SAME
   `logo-dark-bottom.svg` white-letter lockup — a single swatch serves both;
   there is NO separate chest swatch and NO third reference.
   ```js
   const sharp = require('<repo>/node_modules/sharp');
   const navy = {create:{width:1200,height:1200,channels:3,background:{r:34,g:48,b:74}}};
   const back = await sharp('<repo>/video/public/brand/logo-dark-bottom.svg', {density:300}).resize(900).png().toBuffer();
   await sharp(navy).composite([{input:back,gravity:'center'}]).jpeg({quality:95}).toFile('<scratch>/shirt-print-swatch.jpg');
   ```
   ⚠️ Naming trap: `logo-dark-*` = WHITE-letter art FOR dark grounds (the navy
   shirt). Do NOT reach for `logo-light-*` (black-letter art) for any shirt
   print — a 2026-07-14 misunderstanding briefly used it for the chest; corrected
   same day: chest print is the white-letter lockup, small.
3. Base photo prep — ALWAYS `sharp(base).rotate().resize(2400 max)` first:
   phone photos carry EXIF rotation the CLI ignores; verify true W×H from
   sharp's output, then map to the CLOSEST nano_banana_pro aspect
   (1:1, 3:2, 2:3, 4:3, 3:4, 4:5, 5:4, 9:16, 16:9, 21:9). Keep the base's
   NATIVE orientation — portrait stays portrait.

## Base selection (decides the crew's task — never contradict the visible state)

| Base available | Crew task vocabulary |
|---|---|
| Real `during-*` photo (best) | Work matching the visible phase: grading → rake/wheelbarrow/compactor; gunite shell → trowel check, tape-measure layout; framing → level, nail gun; drywall → mud, sanding pole |
| `before-*`/`hero-before` | Day-one prep only: measuring, marking, masking, laying floor protection, walking the site with a clipboard |
| `after-*`/`hero-after` | ⛔ BANNED as base (Oliver 2026-07-14) — during photos come ONLY from before or during bases; a finished scene with workers reads as staged |
| Empty folder or only afters | Check the RAW MEDIA TROVE first: `/mnt/c/Users/porat/Downloads/Projects Photos-20251122T231352Z-1-001/Projects Photos/` (Drive export, per-trade + per-address folders, some with real `Before N.JPG` sets) — e.g. "Dry Landscaping/Ostella Dr, Los Angeles" = Oasis bases. Project↔folder mapping is by city/scope inference; confirm with Oliver before final publish. If the trove has nothing either: STOP — report to Oliver. (Blocked as of 2026-07-14: Atlas, Bliss, Verona — afters/night-only everywhere; Monique — afters only, though clean unwatermarked originals live in `Downloads/arcadia-kitchen-remodel/`) |
| Base has a visible real person | Skip that base (unbranded worker next to branded inserts reads wrong) or crop them out first |
| Base has third-party watermark (all Monique photos: "Concierge Home Remodeling") | STOP and flag — editing around it fabricates; Oliver must supply cleaned originals first |

Pick bases that are sharp, well-exposed, and have open ground/floor where
workers plausibly stand. 2400px+ preferred; below ~1000px expect the model to
invent detail when upscaling — acceptable, but check landmarks after.

## Crew variation axes (Oliver 2026-07-14 — vary these per generation)

Every generation picks a value on each axis so no two during photos feel like
the same crew stamped in. Within one image, workers must be visibly different
people; across a project's set, vary count and orientation too.

| Axis | Values | Rules |
|---|---|---|
| **Count** | 1, 2, or 3 | Match the task: solo detail work = 1; carrying/setting = 2; pour/paver/pebble crews = 3. Don't crowd small frames |
| **Orientation** | backs (logo visible — default), mixed (some back, some profile/front), front | Front-facing workers look AT THEIR WORK — absorbed, head angled down/aside, NEVER at the camera. Front view shows a SMALL version of the same white-letter lockup on the upper LEFT chest (wearer's left, over the heart) — the one swatch reference serves both prints |
| **Appearance** | per worker pick 2–3 differentiators: build (stocky/lean/tall/short), hair (buzzed/curly/graying/tied back) or ball cap/beanie, skin tone (vary naturally), pants (tan work pants/gray canvas/dark jeans), one accessory max (hi-viz vest, tool belt, knee pads, wrist brace, watch) | Differentiators must contrast BETWEEN workers in the same frame. Never stack >3 per worker — over-accessorized reads as costume |
| **Hands & tools (realism anchor)** | say what EACH hand is doing | "left hand steadies the paver, right hand taps it with the rubber mallet" beats "installing pavers". Tool must belong to the visible phase; grip must be biomechanically right |

Litmus test before generating: could this exact person, doing this exact
motion, with this exact tool, appear in a genuine phone photo taken at that
second of that phase? If any element is there "for looks", cut it.

## THE TEMPLATE (single nano_banana_pro edit pass)

```
higgsfield generate create nano_banana_pro \
  --image-references <base.jpg> --image-references <shirt-print-swatch.jpg> \
  --aspect_ratio <NATIVE> --resolution 2k --wait --wait-timeout 10m \
  --prompt "<TEMPLATE below with slots filled>"
```

> The first reference is a REAL photo from our {PROJECT_CONTEXT — one clause:
> what the photo shows}{ — for unusual angles or <1200px bases, add the FRAME
> LAYOUT: what runs where, left/right anchors}. Keep this photo EXACTLY as it
> is: same camera angle, same framing, same lighting, same proportions, and
> every existing surface, object, and shadow unchanged{ — including <notable
> element: pet, vehicle, material pile> if present}. Do not rebuild, redraw,
> restyle, rotate, or recompose ANY part of the existing scene. The ONLY
> change: add {COUNT: one/two/three} construction worker(s) {WHERE — into the
> graded dirt / inside the empty shell} at realistic scale for their distance
> from the camera, with shadows and lighting that match the photo's light.
> {CREW_BLOCK — one sentence per worker, see below}. All wear the same
> deep-navy t-shirt with the company logo from the second reference image
> printed large and centered on the shirt BACK — the house-shaped mark in
> white and light blue, TRI PROS, and REMODELING below it, letter-perfect —
> and on the FRONT the exact same logo printed small, palm-sized, on the
> upper LEFT chest (the wearer's left side, over the heart){for camera-facing
> workers ADD the camera-space anchor — "because he faces the camera, this
> small chest logo appears on the RIGHT half of his chest as seen in the
> image" — "wearer's left" alone flips ~50%}, same white and light-blue art
> at chest-pocket scale{omit this front clause when every worker is seen from
> behind}; plus work boots. {PROPS — cap at what the
> task strictly needs, e.g. "A single push broom and one bucket are the only
> objects added."} The workers are clearly different people. Their integration
> must look like they were in the original photo: same grain, same exposure,
> same color temperature. Nothing else changes. No watermarks or text overlays
> anywhere.

**CREW_BLOCK — one sentence per worker, four beats each:**
`{APPEARANCE: 2–3 differentiators} worker {ORIENTATION: seen from behind, shirt-back logo to camera / in profile / facing the camera but looking down at his work, never at the camera} {ACTION: task verb with phase-correct tool} — {HANDS: what left and right hand are each doing}.`

Example: "A stocky worker with a gray beanie and tan work pants, seen from
behind with the shirt-back logo to camera, kneels tying rebar — left hand
holding the bar crossing, right hand twisting the tie wire with pliers."

Slot rules: ONE construction phase's vocabulary only; task-appropriate PPE only
(no hard hats in residential interiors — reads as stock photo); 1–3 workers
per the Crew variation axes above.

## QA gate (check at 100% zoom before delivering to Downloads)

- [ ] Logo letter-perfect on every VISIBLE shirt back: mark + "TRI PROS" +
      "REMODELING", white/light-blue ONLY (v1 once rendered it rainbow)
- [ ] Front/profile workers show the SMALL white-letter chest lockup on the
      WEARER'S LEFT chest (over the heart) — re-roll if it renders large,
      centered, on the wearer's right, or in any color other than
      white/light-blue
- [ ] Orientation matches the crew spec; front/profile workers look at their
      WORK, never at the camera; faces natural, no uncanny AI stare — re-roll
- [ ] Workers read as different people (build/hair/skin/pants contrast); ≤3
      differentiators each, ≤1 accessory each
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
- 2026-07-14 — Oliver: after-photos BANNED as bases (before/during only — the Atlas/Bliss punch-list images are superseded); crew becomes a variation API: count 1–3, orientation backs/mixed/front, per-worker appearance differentiators, hands-level action detail. Template rewritten with CREW_BLOCK.
- 2026-07-14 — v3 validated 5/5 (Altura crew-3 mixed, Olympia tank crew-2 / wine-cellar solo / quartz-film solo-front, Riviera bond-beam crew-2). Front-quarter + hands-level specs land precisely ("left palm flat, right hand peeling film" rendered exactly).
- 2026-07-14 — model may CO-OPT an existing scene prop into the worker's hands (wine-cellar test bottle ended up being placed by the worker). Usually MORE realistic, but it moves a landmark — check it's narratively right during QA, re-roll only if it breaks the phase story.
- 2026-07-14 — mislabeled files exist: Riviera `hero-before.jpeg` is actually a DURING (fresh bond-beam pour, real workers at frame edges — cropped via sharp extract before use). Altura befores are all night shots (unusable). Verify what a file actually shows; never trust the filename.
- 2026-07-14 — Oliver's uniform spec: FRONT of shirt carries a small `logo-light-bottom` chest print on the upper left chest (tone-on-tone on navy, blue R pops) — front-facing workers are now fully brandable. Chest swatch added to preflight; template + QA updated.
- 2026-07-14 — v4 validated 5/5 with chest logos. Model renders the chest print well but is INCONSISTENT about which chest side (wearer-left vs wearer-right varies per roll) — if Oliver standardizes a side, pin it in the CREW_BLOCK ("on the wearer's LEFT chest, over the heart") and QA it. Model may also plausibly embellish lighting (lit the wine-cellar downlights) — judgment call at QA.
- 2026-07-14 — Oliver correction (v5): the front chest print is the SAME `logo-dark-bottom` white-letter lockup as the back, just small — NOT `logo-light-bottom`. One swatch now serves both prints; the third reference is gone; chest side pinned to the wearer's LEFT ("top left of the shirt"). Preflight, orientation axis, template, and QA updated.
- 2026-07-14 — v5 validated 3/3 on Oasis. Chest-side fix that WORKS: "wearer's LEFT" alone still flipped ~50% — adding camera-space phrasing ("because he faces the camera, this small chest logo appears on the RIGHT half of his chest as seen in the image") landed it correctly. Use both phrasings together for any front-facing worker.
- 2026-07-14 — raw media trove discovered: Downloads Drive export "Projects Photos" holds per-address folders with real Before sets; "Ostella Dr, Los Angeles" (patchy lawn + flagstone steppers → turf) inferred = Oasis. Bases live OUTSIDE the repo — survey the trove before declaring a project blocked. Ostella Before 7/8 rejected for visible people (pool swimmers, homeowner at table); 6/10/11 clean.
- 2026-07-14 — tape-measure poses: "stretching the tape" renders the tape standing VERTICALLY in mid-air ~50% — specify "taut and LOW along the ground, hovering just inches above the grass" and which hand holds the housing at knee height.
- 2026-07-14 — model may silently REMOVE a thin foreground obstacle (canopy pole) where the worker is inserted — anchor skinny vertical objects by name + "MUST stay exactly where it is" and add REMOVE to the forbidden verbs.
