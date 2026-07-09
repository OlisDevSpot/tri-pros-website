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

## Assets & locations

| What | Where |
|---|---|
| Brand logos (committed) | `video/public/brand/` — `logo-dark-right.svg` (end card), `logo-dark.svg` (icon watermark), `logo-dark-bottom.svg` (shirt prints). "dark" = white+blue art for dark grounds; light-theme variants in `public/company/logo/` |
| Generated clips/stills/audio (gitignored) | `video/public/{clips,stills,audio}/` — regenerable; the props JSON is the durable recipe |
| Props JSON (committed = the creative's source of truth) | `video/props/<trade>-<concept>-NN.json` |
| Renders | `video/out/` (gitignored); deliver drafts to `/mnt/c/Users/porat/Downloads/` |
| Portfolio sources | Neon DB `before_after_pairs_json` + public R2; downloaded candidates may exist in the session scratchpad |
| Meta ad assets | `public/funnels/<slug>/ads/` (images, committed) + `ads/videos/` (gitignored) |

## Higgsfield recipes (CLI `higgsfield`, workspace must be set)

Check `higgsfield account status` first; `higgsfield workspace list` + `workspace set <id>` if "No workspace selected". Costs: Kling 3.0 5s ≈ 10cr · Seedance 2.0 1080p ≈ 9cr/s · nano_banana_2 2k still ≈ 6cr · TTS ≈ 0.6cr · sonilo 30s ≈ 2cr.

- **B-roll clip** (single-plane push/orbit/track): `kling3_0 --start-image <img> --duration 5 --aspect_ratio 9:16 --sound off`. ⚠️ Output follows the START IMAGE aspect — pre-crop the photo to 9:16 (sharp, pick crop window visually) for full-bleed; keep landscape only for framed-card layout.
- **Before→after transform** (the money shot): `seedance_2_0 --start-image <before> --end-image <after> --duration 8 --resolution 1080p --aspect_ratio 9:16 --generate_audio false` — honors 9:16 even from landscape inputs. Same-room pairs only.
- **During/crew still**: `nano_banana_2 --image-references <before> --image-references <after> --image-references public/company/logo/logo-dark-bottom.jpg --aspect_ratio 3:2 --resolution 2k` + prompt: same room mid-construction consistent with both references, two workers in navy shirts, logo from third reference printed large on shirt BACKS, natural poses, faces away from camera, contractor-progress-photo realism. Verify logo fidelity; re-roll if mangled.
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

House timeline: portrait hook (5s) → framed crew/during still (2.5s, "OUR
CREW, ON SITE") → transform (8s) → framed island/checkmarks (5s) → end card
(4s). Vary per brief; VO ≈ 13s starting at frame 15.

```bash
cd video && pnpm tsc
pnpm exec remotion render ShowcaseReel out/<name>.mp4 --props=props/<name>.json
# QA stills: pnpm exec remotion ffmpeg -y -i out/<name>.mp4 -ss <t> -frames:v 1 <png>
```

QA every render: extract frames at each beat, view them, check safe zones /
caption legibility / logo presence. Copy the mp4 (+ any audio takes needing a
decision) to `/mnt/c/Users/porat/Downloads/` and stop for Oliver's review.

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
