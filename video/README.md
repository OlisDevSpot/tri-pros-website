# tri-pros-video — Remotion ad-creative package

Self-contained Remotion project (own `node_modules`, own tsconfig — excluded from
the app's `pnpm tsc`/`pnpm lint`). Assembles Meta ad videos from Higgsfield-generated
clips + ElevenLabs voiceover + licensed music.

The offer rules for all copy in these videos are canonical in
`docs/marketing/showcase-offer.md` — read it before editing any text prop.

## Pipeline (per creative)

1. **Clips** — Higgsfield image-to-video from real portfolio photos
   (`higgsfield-generate` skill / CLI; 9:16, 4–15s each) → `video/public/clips/`
2. **Voiceover** — ElevenLabs (script-exact, warm American read) → `video/public/audio/`
3. **Music** — Artlist (paid-ads license tier) → `video/public/audio/`
   ⚠️ NEVER commit licensed music — `video/public/` is gitignored.
4. **Props** — one JSON per creative in `video/props/` (committed; this is the
   creative's source of truth). Captions mirror the VO — most viewers watch muted.
5. **Render**:
   ```bash
   cd video
   pnpm exec remotion render ShowcaseReel out/kitchens-reel-01.mp4 \
     --props=props/kitchens-showcase-reel-01.json
   ```
6. Output goes to Meta via the sync engine's video ad format
   (`scripts/meta/DOCS.md`) — copy the render into
   `public/funnels/<slug>/ads/videos/` and reference it from the campaign spec.

`pnpm studio` (inside `video/`) opens the Remotion preview studio.

## Compositions

- **ShowcaseReel** (1080×1920 @ 30fps, duration = Σ clips + end card):
  hook headline (0–2.5s, word-stagger) → b-roll with burned-in captions →
  optional ✓ checkmark overlay on clip 2 → branded end card with CTA pill.
  Meta 9:16 safe zones enforced by `SafeZone` (14% top / 22% bottom / 6% sides).

## Meta AI-disclosure note

AI-generated clips + synthetic VO ⇒ self-declare **AI Info** on the ad in Ads
Manager (menu-level label). Avoid photoreal AI *people* — those trigger the
prominent "AI-generated" overlay, which is a trust liability for remodeling.
Real founder/customer footage needs no disclosure.
