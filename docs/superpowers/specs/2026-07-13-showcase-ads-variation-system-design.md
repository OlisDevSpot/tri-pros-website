# Showcase-ads variation system — design

**Date:** 2026-07-13
**Status:** Approved (design review with Oliver, 2026-07-13)
**Problem:** The kitchen and bathroom Showcase reels came out nearly identical — same pacing, same transitions, same music bed, same card layouts. The skill's "house timeline v5" section reads as a prescription (copy `kitchens-showcase-reel-02.json`), the variation guidance is buried in a reference file, and half the variation menu isn't renderable (schema implements only `fade|none` transitions, one card shape, one caption style; 2 music beds exist). Creative fatigue on Meta punishes this: winning hooks decay ~37%/week and near-duplicate creatives compete with themselves.
**Goal:** Make variation a first-class, enforced step of reel production — every axis explicit, every menu item renderable, every reel provably different from the last — while keeping the brand system, script skeleton, narrative sequence, and Gia VO constant.

## Architecture decision

**Hybrid: granular schema knobs + coherent-combo rules in the skill** (chosen over named style packs and free-for-all knobs). The Remotion schema exposes the full knob inventory so anything is expressible via props JSON; the skill layer enforces coherence — each reel picks exactly ONE value per axis (mixed transition styles within one ad read amateur, per `docs/marketing/editing/editing-patterns.md`). Taste lives in the skill; capability lives in the composition.

**Audit rule (anti-rot):** no menu item may appear in the skill doc unless the composition implements it, and no composition knob may be missing from the menu. Whenever either side changes, reconcile both.

## 1. Constants vs. variation axes

### House constants (never vary)

- **Gia VO** (ElevenLabs voice `530df032-c311-483b-a750-cb3c9e1bcdfd`)
- **Script skeleton:** selection line → AAA-grade/built-to-be-photographed → Showcase price → brand line ("And at Tri Pros Remodeling? We do it again…") → again-run → homeowners only → "see if your home qualifies"
- **Narrative sequence** (the house timeline): cold open on AFTER beauty frame → hard snap to BEFORE → transform morph → crew/during card → photo-burst hero → proof/checkmarks card → end card. The *sequence* is fixed; every step's *presentation* varies.
- **Snap moment treatment:** always hard cut + white flash + shutter SFX — it is narrative, not decoration, and exempt from the transition-family axis.
- **Brand system:** logo intro + dock, watermark, end-card layout, brand block content, safe zones (14/35/6).
- **Caption style** — the NEW build-as-spoken system (§3), once its emphasis font is picked and frozen.
- **All copy rules** in `docs/marketing/showcase-offer.md` (casting-call framing, APPLY_NOW, no pricing, homeowners only).
- **One motion per moment** (Oliver, draft-3 + draft-5 rulings, 2026-07-13): `punchIns` and `zoomOutReveals` are deprecated — each clip/photo gets exactly ONE entrance motion; never stack two scale animations within ~1s or straddling a cut. Emphasis comes from SFX + caption highlight, not frame-scale jolts. All variation menus respect this.

### Seven variation axes

| # | Axis | Menu | Rotation rule |
|---|---|---|---|
| 1 | **Hook treatment** | word-stagger · text-punch spring · freeze-frame + slow push · typewriter-luxe. PLUS hook phrasing rotation: "We're Selecting 5 X in Your Area" · "Your X Could Be One of 5" · "5 X in Southern California Will Be Chosen" (any phrasing within offer rules) | must differ from previous reel |
| 2 | **Transition family** (ONE per reel) | fade · whip-pan · directional wipe · match-dissolve · zoom-punch | must differ from previous reel |
| 3 | **Card language** | cards: framed-native · polaroid · split-compare · letterboxed-wide · offset-editorial. Burst styles: full-bleed snap · polaroid scatter · grid assemble | must differ from previous reel |
| 4 | **Pacing profile** | standard (v5 timings) · brisk (shorter holds, more cuts, montage feel) · cinematic (longer holds — Ken Burns spreads over more frames so it slows for free — dissolve-heavy) | must differ from previous reel |
| 5 | **Music bed** | curated library rotation (§4) | must differ from previous reel |
| 6 | **Signature accent** (one per reel, respecting one-motion-per-moment) | color-pop on reveal · screen-shake (translate-only) on boom · Ken Burns pan permutation · flash-frame accents · sfx-forward minimalism (no visual accent) | free, recorded |
| 7 | **Text content** | checkmark copy set, end-card headline phrasing (within offer rules) | free, recorded |

**Hard rule:** a new reel may not repeat the immediately previous reel's value on ANY of axes 1–5. (Menus have ≥3 values each, so this is always satisfiable.) Axes 6–7 vary at discretion but are always recorded in the ledger.

## 2. Schema + composition expansion (`video/`)

All changes to `video/src/lib/schema.ts` + components, back-compat with the two existing props files (they must re-render unchanged).

- **`clip.transitionIn`** grows: `'none' | 'fade' | 'whip' | 'wipe' | 'dissolve' | 'zoomPunch'`; new optional **`transitionDirection`**: `'left' | 'right' | 'up' | 'down'` (whip/wipe only; default `left`). Implementations per `editing-patterns.md` parameterizations: whip = 6–8f translate + X-only directional blur + mandatory whoosh; wipe = 12–18f animated clip-path + 4px divider; dissolve = 12–18f opacity cross; zoomPunch = outgoing 1→1.6 w/ blur, incoming 1.3→1 over 8–10f.
- **`clip.cardStyle`** (new, applies when `layout: 'framed'`): `'native' | 'polaroid' | 'split' | 'letterbox' | 'offset'`, default `'native'` (= current framed card). `polaroid` = white border + bottom chin, slight rotation; `split` = before|after side-by-side with divider line, requires new optional **`clip.secondarySrc`**; `letterbox` = wide card with cinematic top/bottom bars; `offset` = editorial off-center card with asymmetric margin + rule line.
- **`clip.kenBurns`** becomes an object `{ zoom: 'in' | 'out', pan: 'none' | 'left' | 'right' | 'up' | 'down' }`; a preprocess step (or zod `.transform`) accepts the legacy string form `'in' | 'out'` so existing props parse.
- **`photoBurst.style`** (new): `'fullbleed' | 'polaroid-scatter' | 'grid'`, default `'fullbleed'` (current). polaroid-scatter = each photo lands as a rotated polaroid stacking on the previous; grid = photos assemble into a 2×2.
- **New top-level props:** `hookStyle: 'wordStagger' | 'punch' | 'freeze' | 'typewriter'` (default `'wordStagger'`); `colorPops: number[]` (frames: hold desaturated → snap to full color over 2–4f); `screenShakes: { frame: number, intensity: number }[]` (8–12f decaying random translate).
- **Pacing profiles are NOT schema** — they are skill-level recipes that set per-clip `durationInFrames` and cut density. No Ken Burns speed knob needed: the zoom interpolates over the clip's full duration, so longer holds are slower pushes by construction.

## 3. Caption system redesign (the new constant)

Replace page-swap karaoke (`KaraokeCaptions`) with **build-as-spoken reveal**:

- Each word fades/rises in over ~3f exactly at its whisper-timed `startMs`; the line holds on screen until the sentence completes, so text visibly assembles under the narrator's voice. Line-breaking reuses/extends `paginate-captions.ts` logic (sentence-punctuation boundaries; max chars per line so it can never overflow; gapless).
- **Base words:** current treatment — white, heavy stroke-under-fill (keep the `wordSpacing` compensation; a thick WebkitTextStroke swallows word spaces).
- **Emphasis words:** marked in the VO script passed to `scripts/transcribe.mjs` with `*word*` markup (e.g. `*AAA-grade*`, `*spa feeling*`); the script strips the markers for matching and carries an **`emphasis: boolean`** flag onto the matched `wordCaptions` entries. Rendered in a luxury display serif, **primary brand blue**, ~1.15× scale.
- **Interpretation confirmed with Oliver:** emphasis words are blue + luxe serif; base words stay white for legibility over bright footage.
- **Font pick (one-time HITL):** during implementation, render 2–3 sample frames with serif candidates (Fraunces, Playfair Display italic, one more) to `/mnt/c/Users/porat/Downloads/` for Oliver's pick; the pick freezes as the house caption style. Fonts load via `@remotion/google-fonts` (the existing pattern in `video/src/lib/fonts.ts` — Playfair Display + Nunito already load this way).
- Old `KaraokeCaptions` page-swap mode is retired once the new component ships and both existing reels re-render acceptably with it (they will change appearance — that is the point; Oliver reviews the re-rendered look during implementation QA).

## 4. Music library (one-time build + manifest)

- One session generates **6–8 sonilo beds** (~2cr each), distinct briefs with an **explicit BPM in every prompt** (BPM → free beat grid: beat = `1800/BPM` frames @30fps). Candidate briefs: upbeat acoustic claps (current sound) · cinematic build · warm piano intimate · percussive clap-stomp · soul/retro warmth · minimal electronic pulse.
- **`video/public/audio/music-manifest.json`** (committed — it's small text; the .m4a files stay gitignored/regenerable): `[{ file, brief, bpm, vibe }]`. The brief must be verbatim-regenerable.
- Reel workflow: pick a bed ≠ previous reel's bed; snap chapter-boundary cuts and SFX hits to the bed's downbeat grid.

## 5. Ledger + workflow enforcement (skill rewrite)

### Variation ledger

**`video/props/variation-ledger.md`** (committed, human-readable): one row per reel:

```
| date | trade | props file | hook (style · phrasing) | transitions | cards · burst | pacing | music | accent | text set |
```

Backfill rows for `kitchens-showcase-reel-02` and `bathrooms-showcase-reel-01` (both: word-stagger, fade, framed-native + full-bleed burst, standard, music-bed-02-upbeat) — making the duplication visible in row 1 vs row 2 is the point.

### Create-mode workflow change

1. After pair research, **draft a creative direction** from the ledger: one value per axis, differing from the previous reel on axes 1–5, with a one-line rationale per pick.
2. Present it **at the same stop as the base-pair gallery** — one combined HITL gate (pair pick + creative direction approval), no new round-trip.
3. On approval: execute; the props file realizes the direction.
4. **Ledger row appends in the same commit as the props file.**

### SKILL.md restructure

- The "house timeline (v5 baseline)" section becomes **"the fixed narrative skeleton"** — sequence only, no presentation values.
- A new **"Variation axes"** section carries the 7-axis table + hard rule + ledger instructions (or points to a `references/variation-axes.md` if SKILL.md gets too long).
- `kitchens-showcase-reel-02.json` is demoted from "canonical example" to "one point in variation space — **copying its presentation values into a new reel is a defect**, not a shortcut."
- Edit mode is unaffected (smallest-change principle stands); asset and publish modes unaffected.

## 6. Verification

- `pnpm tsc` (in `video/`) + unit tests for the new caption line-builder (extend/replace `paginate-captions.test.ts`).
- **Back-compat gate:** both existing props files parse and render before merge (visual change from the new caption component is expected and reviewed; schema back-compat means no props edits required).
- **Knob demo:** a throwaway props file exercising every new knob (each transition, each card style, each burst style, each hook style, color-pop, shake), QA'd via extracted frames viewed at each beat. Not committed.
- **First real proof:** the next reel produced under the new skill must show a ledger row differing from bathrooms-01 on all of axes 1–5.

## Out of scope

- Speed ramps / time-remap and object-wipe/portal transitions (deprioritized in editing-patterns.md; add on demand).
- ElevenLabs with-timestamps migration for captions (separate upgrade path, unchanged).
- Any change to offer copy rules, publish flow, or Meta sync.
