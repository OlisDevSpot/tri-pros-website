# ShowcaseReel v5 — raised creative baseline

**Date:** 2026-07-09 · **Status:** approved by Oliver · **Scope:** `video/` package + `.claude/skills/showcase-ads/SKILL.md`

Raise the default quality of every ad the `showcase-ads` skill produces. Four
pillars, decided in brainstorm (Oliver picked A on all four):

1. Inverted-reveal hook built from a morph (after-first → snap to before → transform).
2. Branded logo intro with a center-entrance → dock-to-watermark exit.
3. Caption engine v2: 3-word single-line pages, gapless page timing.
4. A second before→after morph (Travertine kitchen) as mid-video proof.

Budget guidance: generation cost is not a constraint until cumulative spend
passes ~$100 — do not optimize resolution/duration down for credits.

## 1. Timeline (kitchens-showcase-reel-02, 1080×1920 @30fps, ~900f)

| Beat | Frames | Content | Accents |
|---|---|---|---|
| Cold open | 0–75 | Picasso AFTER beauty frame (extracted from the last frame of the existing `kitchens-picasso-transform.mp4` — no new generation), slow zoom-out 108→100%. Logo enters centered (~0–35), docks to top-right (~35–50) and becomes the watermark. Hook text word-staggers in as the logo docks | logo dock lands = soft click |
| The snap | ~75 | Hard cut to the Picasso BEFORE frame | camera shutter + 5f white flash, peaked ON the cut |
| Morph #1 | 75–315 | Existing Picasso transform plays forward | punch-in (≥1.15, instant) on the stressed VO word |
| Crew card | 315–390 | Framed during-still, "OUR CREW, ON SITE" | short airy whoosh |
| Morph #2 | 390–630 | NEW Travertine kitchen transform (Seedance 2.0, 8s, 1080p, 9:16) | zoom-out reveal (150→100% over ~10f) on the after moment; riser peaks ON the reveal |
| Checkmarks | 630–780 | Island-track framed card + checkmark rows | ascending UI clicks, one per row |
| End card | 780–900 | Logo lockup + CTA pill | soft low thud |

- VO gains one short line over morph #2 (e.g. "And we do it again, and
  again.") so the second transform is narrated, then `transcribe.mjs` reruns
  and captions re-sync automatically. Voice: Mabel v2 unless Oliver's pending
  verdict on the five alternative takes says otherwise.
- Truthfulness: Travertine has 3 genuine same-room kitchen pairs in
  `projects.before_after_pairs_json` (confidence 0.85–0.9); pick the most
  dramatic angle by eyeballing the pairs. Same-room rule intact.

## 2. LogoIntro component (new)

New `video/src/components/logo-intro.tsx` + `logoIntro` prop in the schema
(`{ src, enterFrame, dockFrame }` shape; exact fields at implementation).

- Entrance: spring scale+fade, centered over the after-shot, readable ~1s.
- Exit-as-dock: ONE continuous interpolation of position + scale that lands
  the logo exactly on the watermark slot (top-right, 14%/6% safe-zone
  compliant, 110px wide). No fade-out.
- The standalone watermark renders only after the dock completes — one logo
  exists at all times; no pop, no duplicate frame.
- Both endpoints of the motion stay inside the 2026 unified safe zone
  (top 14%, sides 6%).

## 3. Caption engine v2 (fixes both v4 bugs by construction)

Replace `createTikTokStyleCaptions` pagination in `karaoke-captions.tsx` with
a custom pager over `wordCaptions`:

- **Pages:** max 3 words AND a hard character budget (~16 chars) per page —
  a line can physically never overflow the frame. Page breaks prefer
  punctuation boundaries.
- **Gapless timing:** a page's start snaps back to the previous page's end,
  and every page holds until its successor starts. This kills the v4 bug
  where the next line appeared only when its (sometimes late-interpolated)
  first word started — i.e. "a word behind the voice".
- **Highlight unchanged:** the active-word flip still uses each word's true
  `startMs`/`endMs`; only page visibility timing changes.
- Style: font ~56 (down from 58), same stroke-under-fill +
  `wordSpacing` compensation (never remove — thick stroke swallows spaces),
  single line guaranteed so no wrapping logic needed.

## 4. Schema & composition changes

- `schema.ts`: add `logoIntro` (optional — end-card-only ads may skip it) and
  `zoomOutReveals: [{frame}]` (150→100% over ~10f, mirrors `punchIns` shape).
- `showcase-reel.tsx`: render LogoIntro; gate the existing watermark on
  dock-complete; implement zoom-out reveal in the clip scale wrapper alongside
  punch-ins.
- New props file `video/props/kitchens-showcase-reel-02.json` (v4's
  `kitchens-showcase-reel-01.json` stays as-is for reference).

## 5. Skill baseline (SKILL.md)

Rewrite the house-template section so every future ad inherits this baseline:

- Inverted-reveal hook = DEFAULT hook pattern for transform-capable trades.
- Logo intro = MANDATORY (center entrance → dock-to-watermark).
- Captions v2 rules (3-word pages, gapless).
- Default accent map: snap = shutter+flash · dock = click · reveal =
  riser+zoom-out · checkmark rows = ascending clicks · end card = thud.
  Variants deviate from this map deliberately (per the variant rule: 1 hook
  pattern + 1 accent transition + 1 caption style).

## 6. Out of scope (stays on the documented roadmap)

Whip pans, speed ramps/time-remap, wipe/slider reveals, color pop,
library-SFX swap-in from Pixabay/Mixkit, sonilo BPM beat-grid.

## 7. Assets & generation plan

- Extract Picasso after/before frames with `remotion ffmpeg` (free).
- One new Seedance 2.0 job (~72cr) + re-roll allowance; download best take to
  `video/public/clips/kitchens-travertine-transform.mp4`.
- New VO take (script + one line) → `transcribe.mjs` → render → QA frames at
  every beat → deliver draft to `/mnt/c/Users/porat/Downloads/`.
