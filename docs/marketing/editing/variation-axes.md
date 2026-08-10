# Variation axes — Showcase reels

Companion to [editing-patterns.md](./editing-patterns.md) and
[sfx-and-accents.md](./sfx-and-accents.md). Canonical for `docs/superpowers/specs/2026-07-13-showcase-ads-variation-system-design.md`.
**Problem this solves:** the kitchen and bathroom Showcase reels came out nearly
identical (same pacing, transitions, music, cards) — creative fatigue on Meta
punishes this (winning hooks decay ~37%/week; near-duplicate creatives compete
with themselves). This doc is the enforced menu; `video/props/variation-ledger.md`
is the enforcement log.

**Audit rule (anti-rot):** no menu item below may exist unless `video/src/lib/schema.ts`
implements it, and no schema knob may be missing from a menu here. Whenever
either side changes, reconcile both in the same change.

## House constants (never vary)

- **VO voice — ROTATES as of 2026-07-25 (Oliver's call; supersedes the
  Gia-always constant).** Curated ElevenLabs preset pool: Sterling `dc382508…`,
  Mabel `fa64fba4…`, Brooks `c2acff45…`, Quinn `80914268…`, Tallulah
  `f32c8f51…`; bench: Harper `47fb207f…`, Gia `530df032…`. One voice per reel,
  recorded in the ledger's Text set column. The SCRIPT skeleton below stays
  constant regardless of voice.
- **Script skeleton:** selection line → AAA-grade/built-to-be-photographed →
  Showcase price → brand line ("And at Tri Pros Remodeling? We do it again…")
  → again-run → homeowners only → "see if your home qualifies".
- **Narrative sequence** (the house timeline): cold open on AFTER beauty frame
  → hard snap to BEFORE → transform morph (tail-trimmed at build completion)
  → after-walkthrough glide of the finished space (mandatory companion clip,
  Oliver 2026-07-14 — recipe in SKILL.md; the pair shares the "Morph 1"
  pacing slot, walkthrough may stretch it up to ~+60f for VO room) →
  crew/during card → photo-burst
  hero → proof/checkmarks card → end card. The *sequence* is fixed; every
  step's *presentation* varies (axes below).
- **Snap moment treatment:** always hard cut + white flash + shutter SFX — it
  is narrative, not decoration, and exempt from the transition-family axis
  (`transitionIn: 'none'` reserved for this beat).
- **Brand system:** the ratified `ReelLogo` badge (stacked lockup in a
  cyan-accent panel — same language as the stills; `src/components/reel-logo.tsx`
  owns intro glide + settled badge), watermark on/off, end-card layout, brand
  block content, safe rects x 65–1015 / y 420–1248 with the logo badge docked
  top-LEFT (x 80, y 440), compact so it never reaches the centered chapter
  label. 2026-07-27 research superseded the old 14/35/6 rule (feed crops 9:16 to
  4:5/1:1, erasing the top 285–420 px); logo treatment codified in
  `.claude/skills/showcase-ads/SKILL.md` (logo-treatment + safe-rects rules) and
  `docs/marketing/stills/still-ad-standard.md#logo-treatment`.
- **Caption style:** the build-as-spoken `RevealCaptions` system — words
  fade/rise at whisper timing; emphasis via `*word*` markup. Emphasis serif
  FROZEN 2026-07-14 (Oliver's pick from three rendered samples): Playfair
  Display italic (`EMPHASIS_FONT` in `video/src/lib/fonts.ts`).
- **All copy rules** in `docs/marketing/showcase-offer.md` (casting-call
  framing, `APPLY_NOW`, no pricing, homeowners only).
- **One motion per moment** (Oliver, draft-3 + draft-5 rulings, 2026-07-13):
  `punchIns` and `zoomOutReveals` are deprecated — each clip/photo gets
  exactly ONE entrance motion; never stack two scale animations within ~1s or
  straddling a cut. Emphasis comes from SFX + caption highlight, not
  frame-scale jolts. All variation menus below respect this.

## Seven variation axes

| # | Axis | Menu | Rotation rule |
|---|---|---|---|
| 1 | **Hook treatment** | word-stagger · text-punch spring · freeze-frame + slow push · typewriter-luxe. PLUS hook phrasing rotation: "We're Selecting 5 X in Your Area" · "Your X Could Be One of 5" · "5 X in Southern California Will Be Chosen" (any phrasing within offer rules) | must differ from previous reel |
| 2 | **Transition family** (ONE per reel) | fade · whip-pan · directional wipe · match-dissolve · zoom-punch | must differ from previous reel |
| 3 | **Card language** | cards: framed-native · polaroid · split-compare · letterboxed-wide · offset-editorial. Burst styles: full-bleed snap · polaroid scatter · grid assemble | must differ from previous reel |
| 4 | **Pacing profile** | standard (v5 timings) · brisk (shorter holds, more cuts, montage feel) · cinematic (longer holds — Ken Burns spreads over more frames so it slows for free — dissolve-heavy) | must differ from previous reel |
| 5 | **Music bed** | curated library rotation (see below) | must differ from previous reel |
| 6 | **Signature accent** (one per reel, respecting one-motion-per-moment) | screen-shake (translate-only) on boom · Ken Burns pan permutation · flash-frame accents · sfx-forward minimalism (no visual accent). ⛔ color-pop DEPRECATED (Oliver 2026-07-14: desaturated/b&w sections rejected — never use) | free, recorded |
| 7 | **Text content** | checkmark copy set, end-card headline phrasing (within offer rules) | free, recorded |

**Hard rule:** a new reel may not repeat the immediately previous reel's value
on ANY of axes 1–5. (Menus have ≥3 values each, so this is always
satisfiable.) Axes 6–7 vary at discretion but are always recorded in
`video/props/variation-ledger.md`.

**Axis 0 — Concept (angle).** Above these seven presentation axes sits the
**concept** (the narrative angle + skeleton — material-hero, five-kitchens
montage, transform morph, …; full menu in `SKILL.md` → "Concept menu"). It is
the FIRST creative decision and follows the same must-differ-from-previous rule:
a new reel picks a concept ≠ the immediately previous reel's. Record the concept
(and the postable-gate score) in the ledger row alongside the axes. Sameness of
angle is the deeper creative-fatigue risk — vary it first, then vary the seven
axes within it.

## Axis 1 — Hook treatment → `hookStyle`

Schema: `hookStyle: 'wordStagger' | 'punch' | 'freeze' | 'typewriter'` (default
`'wordStagger'`), rendered by `HookTitle` over `hookStartFrame` →
`hookStartFrame + hookDurationInFrames`. Phrasing rotates independently of
style — pick both fresh each reel where possible; at minimum the style must
differ from the previous reel per the hard rule.

## Axis 2 — Transition family → `clip.transitionIn` / `clip.transitionDirection`

Schema: `transitionIn: 'none' | 'fade' | 'whip' | 'wipe' | 'dissolve' | 'zoomPunch'`
(default `'none'`), `transitionDirection: 'left' | 'right' | 'up' | 'down'`
(whip/wipe only, default `'left'`). Pick ONE family for the whole reel and
apply it to every non-snap clip boundary — mixed transition styles within one
ad read amateur (`editing-patterns.md`). The snap moment is exempt: it always
uses `transitionIn: 'none'` regardless of the reel's chosen family.

Overlap frames (`video/src/lib/transitions.ts` `TRANSITION_FRAMES`, how long
the outgoing clip keeps running under the incoming one):

| Family | Frames | Notes |
|---|---|---|
| fade | 10 | opacity cross, no direction needed |
| whip | 7 | + directional blur; ALWAYS pair a whoosh SFX |
| wipe | 14 | animated clip-path + divider line |
| dissolve | 14 | the "transformation beat" family — pairs with cinematic pacing |
| zoomPunch | 9 | outgoing 1→1.6 w/ blur, incoming 1.3→1 |

## Axis 3 — Card language → `clip.cardStyle` / `secondarySrc` / `photoBurst.style`

Schema: `cardStyle: 'native' | 'polaroid' | 'split' | 'letterbox' | 'offset'`
(default `'native'`, applies when `layout: 'framed'`). `split` requires
`secondarySrc` (the AFTER half) — **`secondarySrc` always renders as a STILL
IMAGE regardless of the primary clip's `kind`**, so pair a before video/photo
(`src`) with an after photo (`secondarySrc`), never expect it to play back.

Burst styles: `photoBurst.style: 'fullbleed' | 'polaroid-scatter' | 'grid'`
(default `'fullbleed'`).

## Axis 4 — Pacing profile

Pacing is NOT a schema knob — it's a skill-level recipe that sets per-clip
`durationInFrames` and cut density. Ken Burns has no separate speed knob: the
zoom interpolates over the clip's full duration, so a longer hold is a slower
push by construction.

| Beat | Standard (v5 baseline, frames) | Brisk (holds ×0.7, 60f floor) | Cinematic (holds ×1.3) |
|---|---|---|---|
| Cold open | 75 | 60 (floor; 52.5 rounds below it) | 98 |
| Morph 1 | 240 | 168 | 312 |
| Crew/during still | 105 | 74 | 137 |
| Morph 2 + burst | 186 | 130 | 242 |
| Checkmarks card | 150 | 105 | 195 |
| End card | 120 (fixed — CTA beat, not a "hold") | 120 | 120 |

- **Brisk**: shorten every establishing hold to ×0.7 (never below 60f — faster
  reads as a glitch, not montage energy) and add one extra beat to the
  `photoBurst.photos` array versus the previous reel's count (montage feel =
  more cuts, not just shorter ones).
- **Cinematic**: lengthen holds ×1.3, pair with the `dissolve` transition
  family (axis 2), and set `kenBurns.pan` to a non-`'none'` direction on the
  lengthened image beats so the slower push reads intentional rather than
  static. Prefer `zoom: 'in'` with cinematic pans — see the Ken Burns gotcha
  below.

## Axis 5 — Music bed → `musicSrc` + manifest rotation

Source of truth: `video/public/audio/music-manifest.json` (local file — all of
`video/` is gitignored by design; the
`.m4a` files themselves are gitignored/regenerable from the `brief`). Pick a
bed whose `file` ≠ the previous reel's `musicSrc`, per the ledger.

| File | BPM | Vibe |
|---|---|---|
| music-bed-01.m4a | — (legacy) | mellow |
| music-bed-02-upbeat.m4a | — (legacy) | upbeat acoustic — used by BOTH shipped reels; the duplication this system exists to prevent |
| music-bed-03-cinematic-build.m4a | 90 | cinematic build |
| music-bed-04-warm-piano.m4a | 80 | warm piano |
| music-bed-05-clap-stomp.m4a | 110 | clap-stomp percussive |
| music-bed-06-soul-retro.m4a | 100 | retro soul groove |
| music-bed-07-minimal-pulse.m4a | 120 | minimal electronic pulse |
| music-bed-08-acoustic-sunrise.m4a | 95 | acoustic sunrise |
| music-bed-09-orchestral-luxe.m4a | 105 | orchestral luxe |

**Beat-grid math:** `beat = 1800 / bpm` frames @30fps (e.g. 90 BPM → 20f/beat,
120 BPM → 15f/beat). Snap chapter-boundary cuts and SFX hits to that grid. New
beds only get generated when the library has a real gap (e.g. a trade needing
a different emotional register) — rotate the existing 9 first.

## Axis 6 — Signature accent → `colorPops` / `screenShakes` / `kenBurns.pan` / `flashFrames` / sfx-only

Free axis (no must-differ rule) but respect one-motion-per-moment: these are
audio/color/shake accents layered on top of the clip's single entrance
motion, never a second scale effect.

- ⛔ **Color-pop — DEPRECATED (Oliver 2026-07-14).** The 45f desaturated
  hold reads as unrequested black-and-white footage ("doesn't look good").
  Schema knob (`colorPops`) survives for legacy props only — always leave
  it `[]`.
- **Screen-shake (translate-only) on boom** → `screenShakes: { frame,
  intensity }[]`, 10f decaying jitter, translate only (no scale — keeps
  one-motion-per-moment intact). **Entries must be ≥10 frames apart** for the
  same first-match-wins reason; closer spacing means the earlier shake's
  window swallows the later one and the cut reads unsynced.
- **Ken Burns pan permutation** → `kenBurns: { zoom: 'in' | 'out', pan: 'none' | 'left' | 'right' | 'up' | 'down' }`.
  Legacy string form (`'in' | 'out'`) still parses (defaults `pan: 'none'`).
  ⚠️ `{ zoom: 'out', pan: <direction> }` clamps the zoom at a 1.06 floor
  partway through the clip while the pan keeps drifting — expected headroom
  behavior, not a bug, but prefer `zoom: 'in'` with a pan direction for a
  cleaner full-duration motion.
- **Flash-frame accents** → `flashFrames: number[]` (white luma flash, 4–6f
  peak, chapter-cut emphasis independent of the transition family).
- **SFX-forward minimalism** → leave `colorPops`/`screenShakes`/`flashFrames`
  empty; carry the beat entirely on the `sfx` cue array (whoosh/riser/boom
  grammar in `editing-patterns.md`).

## Axis 7 — Text content → checkmark + end-card copy sets

Two copy surfaces rotate independently, both within `showcase-offer.md`
rules (no pricing, homeowners only, AAA-grade/Showcase-price value line):

- **Checkmark sets** (`checkmarks: string[]`, max 4, shown above
  `clips[checkmarkClipIndex]`). Current named set — **`checkmarks-v1`**
  (used by both shipped reels):
  `["AAA-grade materials", "Beautiful AND functional", "Built to be photographed"]`
  **`checkmarks-v2`** (reel kitchens-03):
  `["AAA-grade finishes", "Camera-ready results", "Homeowners only"]`
  **`checkmarks-v3`** (reel bathrooms-02):
  `["AAA-grade finishes", "That spa feeling, daily", "Homeowners only"]`
- **End-card sets** (`endCard: { headline, sub, cta }`). **`endcard-v1`** —
  trade-templated headline `"Could Your {Trade} Be One of the 5?"`, sub
  `"AAA-grade work, at a Showcase price. Homeowners only."`, cta `"See If
  Your Home Qualifies"`. **`endcard-v2`** (reel bathrooms-02) — headline
  `"5 {Trade} Will Be Chosen. Yours?"`, same sub + cta.

When a genuinely new copy variant is written (new checkmark phrasing, new
end-card headline shape), name it (`checkmarks-v2`, `endcard-v2`, …), add it
here, and record the name used in the ledger's Text set column.

## Implementation notes (gotchas from prior build tasks)

- **Accent spacing** (code review of `accents.ts`): `colorPops` entries must
  be ≥48 frames apart; `screenShakes` entries ≥10 frames apart. Overlap
  resolution is first-match-in-array-order — closer spacing doesn't error,
  it silently glitches (the later accent never fires while an earlier one's
  window is still active).
- **Ken Burns zoom-out floor**: `{ zoom: 'out', pan: <direction> }` clamps
  zoom at a 1.06 floor partway through the clip while pan keeps drifting.
  Expected headroom behavior — prefer `zoom: 'in'` with pan for cinematic
  holds (axis 4).
- **Split card**: `secondarySrc` always renders as a STILL IMAGE (the after
  half), regardless of the primary clip's `kind` — pair a before video/photo
  with an after photo, never a before/after video pair.
- **Caption emphasis**: mark 1–3 `*word*` spans in the `--script` passed to
  `scripts/transcribe.mjs`. The emphasis serif renders italic, brand blue,
  case-preserved (`RevealCaptions`, `video/src/components/reveal-captions.tsx`).
  The old per-word blue karaoke highlight is GONE — emphasis markers are the
  only blue words now.
- **Transition frames**: fade 10f, whip 7f, wipe 14f, dissolve 14f, zoomPunch
  9f; whip/wipe take `transitionDirection` (left/right/up/down). See axis 2
  table above.
- **Music library**: 9 beds in the manifest — `music-bed-01` (legacy, no
  BPM), `music-bed-02-upbeat` (legacy, no BPM, used by BOTH shipped reels),
  `03-cinematic-build` 90bpm, `04-warm-piano` 80bpm, `05-clap-stomp` 110bpm,
  `06-soul-retro` 100bpm, `07-minimal-pulse` 120bpm, `08-acoustic-sunrise`
  95bpm, `09-orchestral-luxe` 105bpm.
