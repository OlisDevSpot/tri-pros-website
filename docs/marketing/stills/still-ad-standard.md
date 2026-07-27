# Still-Ad Standard — what a good static ad IS

> Canonical requirements for every still-image ad (single image, carousel card,
> video thumbnail) we ship to Meta. The stills twin of the video system's
> `docs/marketing/editing/variation-axes.md`. A card that fails ANY checklist
> line does not ship — "nice photo + caption" is not an ad.
> Rendering pipeline: Remotion still compositions in `video/src/stills/`
> (see `.claude/skills/showcase-ads/SKILL.md`). Offer rules:
> `docs/marketing/showcase-offer.md` (vocabulary, CTA rules, truthfulness).

## the-five-layers

Every card is built from all five layers. If a layer is missing, the card
reads as "image with text on it" — rejected.

1. **Photo layer** — real portfolio photography only (truthfulness guardrail).
   Graded for the composition: vignette / directional darkening toward text
   zones. Never a raw untouched photo.
2. **Depth layer** — what makes it feel designed, not captioned. At least one:
   shaped gradient scrim, duotone/brand-color panel, offset editorial frame,
   cut-line dividing photo zones, tilted polaroid frame, oversized numeral
   behind text. Text NEVER sits directly on unmodified photo.
3. **Structure layer** — at least one geometric device that organizes the eye:
   frosted panel, rule/underline, pill chips, split divider, corner frame.
4. **Text hierarchy layer** — four slots, distinct sizes, one alignment system:
   - *Eyebrow/badge*: offer marker ("KITCHEN SHOWCASE", "SHOWCASE — 5 SPOTS")
   - *Hook*: ≤ 7 words, the dominant element after the photo
   - *Support*: ≤ 9 words, one line
   - *CTA chip*: button-affordance shape ("See if your home qualifies") —
     every card except pure-photo carousel proof cards carries one
5. **Brand layer** — non-negotiable:
   - **Logo top-right on every card**, ≥ 7% of canvas width, on a frosted chip
     or clean-contrast zone (never over busy texture). Same corner across the
     whole ad set — viewers learn where to look.
   - Brand accent (funnel cyan) used at least once as a functional element
     (underline, chip, divider, CTA fill) — never as decoration spam.

## psychological-triggers

Each card commits to exactly ONE primary trigger and makes it visually
dominant (a card "about everything" triggers nothing):

| Trigger | Visual execution |
|---|---|
| Scarcity | The numeral **5** oversized or chipped ("5 SPOTS LEFT THIS ROUND") — not buried mid-sentence |
| Transformation | Before/after contrast IS the layout (split + labels + divider) |
| Qualification / curiosity | Question hook dominates ("Could your kitchen be one of the 5?") |
| Authority / standard | "Held to this standard" framing over flagship work + badge |
| Social proof | "Real homes in your area" framing, multi-project grid/scatter |

Secondary trigger allowed only in the support line.

## style-directions

Orthogonal to pattern: every card also declares a **style** (props field
`style`) — the art direction it renders in. Styles are first-class A/B units:
we deliberately mix styles across an ad set's slots, read per-ad
cost-per-qualified-lead, then scale the winning style into more slots and
kill losers on the monthly refresh. Ratified 2026-07-27 from a three-way
taste test (owner-picked: mix per slot).

| Style | Energy | Signature devices | Sanctioned extra typeface |
|---|---|---|---|
| `editorial-poster` | Loud, premium poster | Oversized condensed type as design element, giant numeral, cropped-off-edge words, watermark type, cinematic grade | One condensed display face (headlines only) |
| `luxury-minimal` | Quiet, expensive | Full-bleed re-graded photo, small wide-tracked caps, hairline rules, text-link CTA instead of chip | none (brand fonts only) |
| `dr-maximal` | Classic FB converter | Sticker chips ("ONLY 5 SPOTS"), marker circles/arrows, tilted before-polaroid, checkmark benefit chips, urgency subline (truthful only) | One marker/hand face (annotations only, never headlines) |

Rules:
- The five-layers, single-trigger, and QC requirements apply to every style.
- Default slot mapping (change deliberately, not by drift): heroes +
  before/afters → `dr-maximal`; numeral/CTA carousel cards →
  `editorial-poster`; proof/authority cards → `luxury-minimal`.
- The typeface budget is "brand fonts + the style's sanctioned face" — never
  more, never borrowed across styles.
- New styles enter this table only via an owner-ratified taste test.

## named-patterns

Every card declares its pattern (props field `pattern`). No pattern = no ship.

- **hook-dominant-hero** — full-bleed photo, scrim, oversized hook, CTA chip
- **split-before-after** — hard divider, BEFORE/AFTER pills, one caption, CTA chip
- **polaroid-scatter** — 2–3 tilted framed shots over brand panel, hook + CTA
- **editorial-frame** — photo inset in offset frame, hook in the margin zone
- **numeral-poster** — giant "5" as depth layer, photo through/behind, scarcity hook
- **cta-endcard** — brand-color ground, badge + hook + support + CTA chip (no photo required)

Within one ad set, no two cards share the same pattern unless they are
carousel proof siblings.

## legibility-qc

Run on every render before the human gate:

- [ ] Hook legible at 120 px thumbnail width (feed reality check)
- [ ] Text contrast ≥ 4.5:1 against its actual local background
- [ ] **Universal safe rects (researched 2026-07-27 — cross-placement crop +
      Reels-UI intersection; supersedes the old 14%/20%/6% rule):**
      · **4:5 (1080×1350):** ALL text/logo/CTA inside x 75–1005, y 135–950.
        Logo top-right allowed: inset ≥162 px from top, ≥86 px from right.
        Nothing in the bottom 30% (y > 945 — Reels-backfill caption band;
        1:1 surfaces crop 135 px off top AND bottom).
      · **1:1 (1080×1080):** everything inside 86 px margins; right margin
        108 px (Reels rail insurance); logo top-left preferred.
      · **9:16 (1080×1920, video/thumbnail masters):** everything inside
        x 65–1015, y 420–1248 (feed crops to 4:5 = top+bottom 285 px gone;
        1:1 surfaces = 420 px gone each end; Reels UI owns top 270 px +
        bottom 672 px; right rail ≈130 px wide mid-frame). Logo top-LEFT at
        (x≈80, y≈440), height ≤130 px. NEVER top-right on 9:16.
      · Assume geometric CENTER crop — never rely on smart-crop.
- [ ] One scan path: badge → hook → support → CTA (no competing focal points)
- [ ] No text over high-frequency texture without a depth layer under it
- [ ] Typographic punctuation (’ — ·), brand fonts only, ≤ 2 typefaces
- [ ] Meta compliance: first-person program claims only, no viewer attributes,
      no fake urgency, CTA language matches offer rules (never quote-language)

## per-format-notes

- **Single-image ads**: 1080×1350 (4:5); design must survive center-crop to 1:1.
- **Carousel cards**: 1080×1080; card 1 = strongest hook card; proof siblings
  may drop the CTA chip; final card = `cta-endcard`.
- **Video thumbnails**: same brand layer rules (logo top-right, hook visible);
  prefer a designed frame (hook card from the reel) over a raw video frame.
