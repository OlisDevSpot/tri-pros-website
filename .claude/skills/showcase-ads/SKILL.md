---
name: showcase-ads
description: End-to-end Showcase ad production for Meta — generate clips/VO/music via Higgsfield, assemble with Remotion, iterate on drafts (tweak 90%-good videos), and publish PAUSED via the campaign-as-code sync engine. Use for creating a new ad (any trade/format), editing an existing reel, regenerating a single asset, or shipping an approved creative to Meta.
---

# Showcase Ads — production pipeline

One skill, four operations. Parse the request into one of:
**create** (new ad from a brief) · **edit** (tweak an existing reel) ·
**asset** (regenerate one piece: clip/VO/music/still) · **publish** (approved
creative → Meta, PAUSED).

## Canonical rules (read before any copy/creative decision)

- `docs/marketing/showcase-offer.md` — THE offer. Vocabulary, guardrails,
  rules-for-ads (clean link + url_tags, multi-text variants, APPLY_NOW, never
  GET_QUOTE, no pricing).
- Truthfulness: before→after transforms ONLY from genuine same-room pairs
  (portfolio `before_after_pairs_json`). Frame portfolio work as "the standard
  every Showcase home gets", never as a past Showcase selection.
- Meta AI-disclosure (2026): AI clips + synthetic VO ⇒ self-declare "AI Info"
  in Ads Manager (menu-level, fine). Photoreal AI HUMANS with visible faces ⇒
  prominent overlay — avoid; branded crew shots pose workers FROM BEHIND.
- ⛔ Activation is human-only. Everything lands PAUSED. Never touch ACTIVE.
- Logo intro is MANDATORY: `logoIntro` prop — lockup springs in centered over
  the cold open, docks into the watermark slot at `dockFrame` (+15f glide),
  where the persistent watermark (same art file, `watermarkWidth` 150) takes
  over seamlessly. Use `brand/logo-dark-right.svg` for both.

## Assets & locations

| What | Where |
|---|---|
| Brand logos (committed) | `video/public/brand/` — `logo-dark-right.svg` (end card), `logo-dark.svg` (icon watermark), `logo-dark-bottom.svg` (shirt prints). ⚠️ NAMING TRAP: the `logo-dark-*` files are the LIGHT-COLORED art (white letters + blue mark) FOR dark grounds. On navy shirts / dark backgrounds Oliver's rule is: letters must be WHITE and visible ⇒ ALWAYS `logo-dark-*` files. The `logo-light-*` files (black letters, for light grounds) are wrong on navy and live in `public/company/logo/` |
| Generated clips/stills/audio (gitignored) | `video/public/{clips,stills,audio}/` — regenerable; the props JSON is the durable recipe |
| Props JSON (committed = the creative's source of truth) | `video/props/<trade>-<concept>-NN.json` |
| Renders | `video/out/` (gitignored); deliver drafts to `/mnt/c/Users/porat/Downloads/` |
| Portfolio sources | Neon DB `before_after_pairs_json` + public R2; downloaded candidates may exist in the session scratchpad |
| Meta ad assets | `public/funnels/<slug>/ads/` (images, committed) + `ads/videos/` (gitignored) |

## Higgsfield recipes (CLI `higgsfield`, workspace must be set)

Check `higgsfield account status` first; `higgsfield workspace list` + `workspace set <id>` if "No workspace selected". Costs: Kling 3.0 5s ≈ 10cr · Seedance 2.0 1080p ≈ 9cr/s · nano_banana_2 2k still ≈ 6cr · TTS ≈ 0.6cr · sonilo 30s ≈ 2cr.

- **B-roll clip** (single-plane push/orbit/track): `kling3_0 --start-image <img> --duration 5 --aspect_ratio 9:16 --sound off`. ⚠️ Output follows the START IMAGE aspect — pre-crop the photo to 9:16 (sharp, pick crop window visually) for full-bleed; keep landscape only for framed-card layout.
- **Before→after transform** (the money shot): `seedance_2_0 --start-image <before> --end-image <after> --duration 8 --resolution 1080p --aspect_ratio 9:16 --generate_audio false` — honors 9:16 even from landscape inputs. Same-room pairs only.
- **During/crew still** (two-step, logo fidelity is the hard part):
  1. Scene: `nano_banana_2 --image-references <before> --image-references <after> --image-references <shirt-print-ref> --aspect_ratio 3:2 --resolution 2k` + prompt: same room mid-construction consistent with both references, two workers in navy shirts, logo from third reference printed large on shirt BACKS, natural poses, faces away from camera, contractor-progress-photo realism.
  2. Logo pass (first pass always mangles the lockup): build a pixel-exact shirt-print reference — rasterize `video/public/brand/logo-dark-bottom.svg` (WHITE letters — see naming trap above) onto a navy swatch with sharp (`sharp(svg,{density:300}).resize(900)` composited on `{r:34,g:48,b:74}`), then `nano_banana_pro --image-references <scene> --image-references <swatch>` + prompt: keep scene EXACTLY, replace both shirt-back prints with the exact logo — mark + "TRI PROS" + "REMODELING" letter-perfect, warped to fabric. Verify legibility at 100%; re-roll until the company name reads.
- **VO**: `text2speech_v2 --variant elevenlabs --voice_id <id> --voice_type preset` — voices via `higgsfield voices list` (female: Mabel `fa64fba4…`, Gia `530df032…`, Quinn `80914268…`, Tallulah; male: Sterling `dc382508…`). Liveliness comes from script punctuation (contractions, "!", "…", em-dash beats). Generate 2–3 takes for Oliver to pick; iterate until the vibe lands.
- **Music bed**: `sonilo_music --duration 30 --prompt "<style>, no vocals"`. House default: upbeat feel-good (bright acoustic strums, claps, light driving percussion, optimistic, radio-ad polish). Mixed quiet: `musicVolume` 0.12 (ducks under VO; peaks ~0.24).
- Always `--wait`; run long jobs via background Bash. Download result URLs with curl into the scratchpad, then copy keepers into `video/public/`.

## Assemble & render (Remotion, `video/` package)

Composition `ShowcaseReel` (1080×1920@30) is fully props-driven — see
`video/src/lib/schema.ts` for the schema. Per-clip: `kind` video|image (image
gets Ken Burns), `layout` full|framed (framed = native-aspect card on dark
ground; label chip or checkmark rows above via `checkmarkClipIndex`), hook
word-stagger on clip 1, captions mirror the VO (muted viewers), `watermarkSrc`
icon top-right, logo end card with CTA pill.

House timeline (v5 baseline — `props/kitchens-showcase-reel-02.json` is the
canonical example): cold open on an AFTER beauty frame with the logo intro
(2.5s) → hard snap to the BEFORE (shutter + flash) → morph #1 plays (8s) →
framed crew/during still (2.5s, "OUR CREW, ON SITE") → morph #2, a DIFFERENT
project, with zoom-out reveal + riser on its after moment (8s) → framed
checkmarks clip (5s) → end card (4s). The inverted-reveal hook (after-first)
is the DEFAULT hook pattern for transform-capable trades. VO = Gia
(house voice), starts frame 15, and must include a line over morph #2.

```bash
cd video && pnpm tsc
pnpm exec remotion render ShowcaseReel out/<name>.mp4 --props=props/<name>.json
# QA stills: pnpm exec remotion ffmpeg -y -i out/<name>.mp4 -ss <t> -frames:v 1 <png>
```

QA every render: extract frames at each beat, view them, check safe zones /
caption legibility / logo presence. Copy the mp4 (+ any audio takes needing a
decision) to `/mnt/c/Users/porat/Downloads/` and stop for Oliver's review.

## Captions — word-synced, CapCut-style (MANDATORY for every reel)

Captions are karaoke word-highlight, timed from the audio itself — NEVER
hand-timed frames (they drift), and the hook title is NEVER duplicated as a
subtitle (VO line 1 plays UNDER the hook title; karaoke pages are suppressed
until the hook exits).

Pipeline (after generating any VO):
```bash
cd video && node scripts/transcribe.mjs \
  --audio public/audio/<vo-file> \
  --script "<the exact VO script text>" \
  --props props/<reel>.json
```
This installs whisper.cpp 1.5.5 + small.en on first run (~2 min), extracts DTW
word timestamps, and reconciles against the KNOWN script — output text is
always exactly the script words (never ASR garble like "Triple A grade");
unmatched runs get interpolated timing. Writes `wordCaptions` into the props.
`voStartFrame` in props anchors audio time to composition frames.

Rendering: `KaraokeCaptions` (pages via createTikTokStyleCaptions @1200ms,
active word = brand blue + 1.1 pop, heavy stroke-under-fill). Gotcha solved in
the component: a thick WebkitTextStroke visually swallows word spaces —
`wordSpacing` compensates; never remove it.

Pagination is ours, not the library's (`src/lib/paginate-captions.ts`,
unit-tested): max 3 words / 16 chars per page (single line, can never
overflow), sentence punctuation breaks pages, and timing is GAPLESS — a page
appears the moment its predecessor's last word ends and holds until its
successor appears, so pages can never lag the voice or blink out between
sentences.

Upgrade path when a direct ElevenLabs key exists: `/v1/text-to-speech/{voice}/
with-timestamps` returns synthesis-native character timing (zero drift by
construction, no whisper needed) — restructure transcribe.mjs around it then.

## Editing patterns — how variants stay different yet high-quality

Research libraries (symlinks; canonical files live in `docs/marketing/editing/`):
`references/editing-patterns.md` (patterns, frame params, benchmarks) and
`references/sfx-and-accents.md` (SFX palette, licenses, accent numbers, mixing
levels). READ both before designing any new variant. Composition rules:

- **Every variant picks: 1 hook pattern + 1 accent transition + 1 caption
  style.** Vary these three across variants (creative-fatigue rotation);
  keep transition style consistent WITHIN an ad.
- Hook rotation for Showcase: inverted reveal (after-first — THE remodeling
  hook) · cold open · text-punch · freeze-frame open · match-cut open.
- Rhythm: visual change every 2–4s; macro re-hook every 5–8s; hooks decay
  ~37%/week — rotate weekly.
- Schema knobs already implemented in `ShowcaseReel`: `punchIns` (hard scale
  jump on stressed VO words/downbeats, 1.10–1.15), `flashFrames` (luma flash
  peaked on chapter cuts), `sfx` (cues; grammar: whoosh=motion, riser peaks ON
  the reveal frame starting 30–60f before, boom=landing; riser→cut→boom),
  `captionVertical` (~0.55–0.62), `*word*` caption emphasis (one per line),
  per-clip `layout`/`kind`, `checkmarkClipIndex`, safe zone 14/35/6,
  `zoomOutReveals` (array of frames; 150%→100% scale over 10f on
  after-arrivals), `hookStartFrame`/`hookDurationInFrames` (hook window —
  karaoke pages stay suppressed until the sum elapses), per-clip
  `kenBurns: "in" | "out"` — all built in.
- Default accent map (house standard — deviate only with reason): snap =
  shutter + white flash · logo dock = quiet click · reveal = riser peaking ON
  the reveal + zoom-out · checkmark rows = ascending clicks · end card = soft
  thud.
- SFX assets live in `video/public/audio/sfx/` (AI-generated via `seed_audio`;
  regenerate freely). Beat-sync for free: prompt sonilo with an explicit BPM
  ("120 BPM" → beat = 15f @30fps) and snap cut frames to that grid.
- Not yet implemented (add on demand): whip pan (SVG directional blur), speed
  ramps/time-remap, wipe/slider reveal, color pop. Parameterizations are in
  the reference doc.

## Edit mode (the 90%-good workflow)

Map the note to the SMALLEST change, then re-render the same props file:
music vibe → regenerate bed, swap `musicSrc`; too loud → `musicVolume`;
voice → new TTS take, swap `voiceoverSrc` (+ retime captions if length moved);
one weak clip → re-roll just that generation, same filename; copy/timing →
props JSON only; layout/brand → composition components. Commit the props
change; renders are never committed.

## Publish (after explicit approval — hold stands)

1. Render final; copy to `public/funnels/<slug>/ads/videos/<file>.mp4`; pick a
   thumbnail frame → `public/funnels/<slug>/ads/<file>-thumb.jpg` (committed).
2. Add `format: 'video'` ad (or `carousel`) to
   `scripts/meta/campaign-specs/<trade>.campaign.ts` — multi-variant
   headlines/primaryTexts per offer-doc rule 5.
3. `pnpm meta sync` (dry-run) → review plan → `pnpm meta sync --apply` →
   verify PAUSED, commit `meta.lock.json` + spec + thumb.
4. Remind Oliver: tick "AI Info" self-declaration on the ad in Ads Manager.
