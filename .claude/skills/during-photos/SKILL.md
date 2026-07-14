---
name: during-photos
description: Use when a portfolio project needs "during construction" photos, when inserting branded Tri Pros crew into job-site imagery, when filling a project's before→during→after gallery story, or before ANY Higgsfield edit that adds workers to a real photo.
---

# During Photos — branded crew inserted into REAL job-site photos

> **PRODUCTION BASELINE (Oliver, 2026-07-14).** The v5 pipeline is the approved
> standard for all portfolio during photos, now and for every future project
> added to the portfolio. Standard package: **1–3 during photos per project**.
> The HITL gate is NEVER skipped, including bulk runs: candidates go to
> Oliver's Downloads first; only after his manual pick do images move into the
> project's during bucket via `scripts/add-during-media.ts`. The pipeline
> operates on EXISTING DB projects only — see API surface.

## Iron rule (Oliver's ruling, 2026-07-13)

**The scene must BE a real photo. Never generate the scene.** Generated scenes
drift in site dimensions and proportions and are BANNED for portfolio use. The
model gets exactly one job: insert workers into an unmodified real photo.
If you catch yourself passing a before+after pair to nano_banana_2 to "create
a mid-construction scene" — stop; that is the superseded v1 approach
(history: `docs/superpowers/specs/2026-07-13-portfolio-during-photos-design.md`).

## API surface (the contract every run fulfills)

**The pipeline decorates EXISTING projects — it NEVER creates one (Oliver's
ruling, 2026-07-14, after a same-day rollback of 18 wrongly-created projects).
A "project" means a row in the `projects` table; its photos live in
`mediaFiles` rows bucketed by `phase` (before/during/after/uncategorized) with
R2-hosted URLs. The whole loop: existing project → its own before/during
photos as bases → branded during candidates → Oliver's HITL pick → insert
winners back into THAT project's during bucket.**

| | |
|---|---|
| **Input** | an existing project **accessor** (query `projects` + its `mediaFiles` where phase in before/during — those URLs are the ONLY base pool), optional base pick, optional crew task, count 1–3 |
| **Output (candidate)** | edited PNG(s) → `/mnt/c/Users/porat/Downloads/tri-pros-during-<accessor>-<task>-<crew>.png` for Oliver's HITL pick — MANDATORY gate, never skip |
| **Output (approved)** | `pnpm tsx scripts/add-during-media.ts <accessor> <file...>` — converts to webp, uploads to R2 `projects/<projectId>/during/<uuid>.webp`, inserts the `mediaFiles` row (phase='during') on that same project. Refuses unknown accessors by design |
| **Environment** | scripts hit the DB selected by NODE_ENV (dev by default); prod promotion is a separate explicit Oliver decision |
| **Cost** | ~2 cr per edit pass; re-rolls cheap — iterate freely |

Legacy note: `public/portfolio-photos/projects/<Title>/` folders and the
`media-files.ts` seed are a LEGACY path — the live portfolio is the scraper-
imported DB projects. Do not stage new projects from disk folders.

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
| Project has no before/during media rows | STOP — report to Oliver. Do NOT reach for disk folders or the Downloads raw trove to invent bases for it, and NEVER create a new project to house orphan photos |
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

## Cross-project variation (Oliver, 2026-07-14 — MANDATORY for every run)

Variation must exist not only within a photo and within a project's set, but
ACROSS the whole portfolio. A visitor browsing several project galleries must
never feel the same crew was stamped into every job.

**Procedure — before generating for ANY project:**
1. Read `variation-ledger.md` (same directory). It records, per project photo:
   base type, crew count, orientation mix, task family, and each worker's
   appearance signature.
2. Choose specs that AVOID repeating another project's signature: no two
   projects may share the same (count, orientation, task-family) triple as the
   dominant look of their set, and no worker appearance signature (build +
   hair/headwear + pants + accessory) may recur across projects.
3. After candidates pass QA and ship to Downloads, APPEND the new rows to
   `variation-ledger.md` in the same commit as any ledger learnings.

**Spread targets across the portfolio** (soft quotas — bend for realism, never
for convenience): counts ≈ 40% solo / 40% crew-2 / 20% crew-3; orientations ≈
half backs-dominant, half mixed/front; task families follow each base's phase —
never default to the same task twice when the phase offers alternatives
(measuring, marking, material staging, compacting, cutting, setting, screeding,
cleanup are all distinct families).

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
> change: add {COUNT: one/two/three} construction worker(s) {for COUNT=1 write
> it as "exactly ONE construction worker — a single person, alone, absolutely
> no other people anywhere in the frame" — a bare "one" gets upgraded to two
> when the task reads two-person} {WHERE — into the graded dirt / inside the
> empty shell; if the worker adds new material, also pin the surface with
> negations ("NOT on the street, NOT in the gutter") and say where the new
> material may lie} at realistic scale for their distance
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
- [ ] ALL pre-existing in-scene text unchanged at 100% (machine decals, yard
      signs, tool/wheelbarrow brand labels) — the model re-spells text near
      inserted workers; pin known labels in the prompt ("stays exactly as
      printed, pixel-identical")
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
- 2026-07-14 — v6: "add one construction worker" rendered TWO when the visible task reads two-person (bucket pour at a material pile) → for solos always write "add exactly ONE construction worker — a single person, alone, absolutely no other people anywhere in the frame"; fixed on re-roll. Template COUNT slot updated.
- 2026-07-14 — v6: new-material placement drifts to the nearest "natural" spot — worker + rock landed in the street GUTTER beside the supply pile instead of the specified parkway bed (twice) → name the target surface with negations ("NOT on the street, NOT in the gutter"), give relative elevation ("one step higher than the street"), and constrain where the new material may lie ("only on the dirt bed, well inside its edges"); fixed on second re-roll.
- 2026-07-14 — v6: small/distant back logo garbles REMODELING (dusk gunite-shell shot rendered "N6MODELING") → append a spelling anchor: "the word REMODELING spelled exactly R-E-M-O-D-E-L-I-N-G in white spaced capitals — every letterform sharp, correctly spelled, no invented or distorted characters"; fixed on re-roll. Use whenever the worker is far from camera or the light is flat/dusk.
- 2026-07-14 — v6 bulk run (7 parallel agents, 20 candidates across 18 projects, ~24 edit passes + re-rolls ≈ 100cr). Systemic findings below; per-photo specs in variation-ledger.md.
- 2026-07-14 — v6: CHEST-PRINT SMALL TEXT is below the model's reliable text size — the "REMODELING" sub-line garbled on MOST front/profile rolls across four independent agents (mark + "TRI PROS" usually survive; worst on distant workers and <1000px bases; v5's close-framed solo was the lucky case, not the norm). Mitigations: prefer backs; bring front-facing workers CLOSE to camera; treat sub-line softness as an HITL judgment call. OPEN QUESTION for Oliver: relax the chest spec to mark + "TRI PROS" only?
- 2026-07-14 — v6: logo can render solid RED (all workers, one pass) — add "in white and light blue ONLY — never red, never orange, never any other color" when it strikes. Spelling anchors also fix ~1/6 back-print garbles; for multi-worker shots write "on ALL <N> shirt backs… correctly spelled".
- 2026-07-14 — v6: PROFILE orientation is sticky — the model collapses profiles to back view when the prompt describes the big back print in detail. Fix: de-emphasize the back print ("turned away, barely visible"), spell "true side view, both shoulders on the camera axis, nose toward frame edge", and put the wearer's LEFT side toward camera so the chest print is on the visible side (for away-angled workers the model paints it on whichever pec is visible). Reach-up profile poses migrate the print onto the SLEEVE (3/3, prompt-resistant) — avoid chest print + overhead reach; go backs instead.
- 2026-07-14 — v6: pose physics — kneeling workers gravitate to the nearest large flat surface (one rendered ON the countertop; pin "both feet on the FLOOR"); crouch/fasten tasks naturally render back-to-camera (correct physics — assign outward-facing tasks like carrying when you need a front view); tape measures: keep SHORT ("about four feet"), "only ONE tape measure in the scene", never extending toward camera (else it spans the room or spawns two housings).
- 2026-07-14 — v6: only stage workers on ground PLAINLY VISIBLE in frame — a work area occluded behind foreground structures makes the model hallucinate a new visible substrate (new bed/tree/task relocation, 3/3 rolls; Manshma dropped for this).
- 2026-07-14 — v6: negative tool bans backfire ("no claw hammer anywhere" made the hammer MORE prominent) — prefer positive hand-by-hand specs and simply omit unwanted objects.
- 2026-07-14 — v6: <1200px bases invite zoom-RECOMPOSE (edge objects deleted, framing tightened), not just rotation — LEAD the prompt with a four-edge anchor block naming what sits at each edge. Phone-screenshot bases are salvageable (crop letterbox/home-indicator via sharp .extract). Video frames are a legitimate during-source but crew videos have real people in ~every frame.
- 2026-07-14 — v6: parallel batch agents each invented worker signatures blind to one another → three near-identical "tall·buzzed·tan" variants slipped through (roof/bathroom1/altura-grading). For future bulk runs, pre-partition an appearance palette per agent in the dispatch prompts.
- 2026-07-14 — v6: PII hazard in raw trove — the ADU folder photo contains a legible blueprint with a customer name/address (also has embedded real workers; blocked). Never use bases with readable customer PII.
- 2026-07-14 — WORKFLOW CORRECTION (Oliver): a bulk run wrongly CREATED 18 new projects from disk/trove photos — all rolled back same day (rows + R2 objects deleted). The pipeline decorates EXISTING DB projects only: bases come from the project's own before/during mediaFiles, winners go back via `scripts/add-during-media.ts`. API surface + base-selection table rewritten; map the gameplan and confirm with Oliver before any bulk operation that touches the DB.
