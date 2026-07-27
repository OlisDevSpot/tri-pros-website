# Still-Ad Standard — what a good static ad IS

> Canonical requirements for every still-image ad (single image, carousel card,
> video thumbnail) we ship to Meta. The stills twin of the video system's
> `docs/marketing/editing/variation-axes.md`. A card that fails ANY ground-truth
> line does not ship — "nice photo + caption" is not an ad.
> Rendering pipeline: Remotion still compositions in `video/src/stills/`
> (see `.claude/skills/showcase-ads/SKILL.md`). Offer rules:
> `docs/marketing/showcase-offer.md` (vocabulary, CTA rules, truthfulness).
>
> **Read order:** ground-truths (never break) → five-layers (how a card is
> built) → eligibility-widget (our lead device) → style-directions (the three
> A/B skins) → named-patterns → QC. The ground-truths bind every style; the
> style only changes the skin, never the bones.

## ground-truths

Ratified 2026-07-27 after a production audit (live cards read as amateur in
feed — logo floating oversized, text on busy photo, corners fighting, nine
focal points). These 11 rules are INVIOLABLE and apply to every card in every
style. A style may change color, type, and photo treatment; it may never
break a ground-truth. If a card fails one, it does not ship regardless of how
good it otherwise looks. Each rule below names the failure it exists to
prevent.

1. **Protected text zone — text never sits on unmodified photo.** Every text
   element lives on a *structured ground*: either a solid/diagonal panel, a
   horizontal band, or a ≥70%-opacity shaped block. Text real estate and photo
   real estate are visibly separate. (Prevents: the "caption slapped on a
   photo" tell — our live hooks sat on glass-shower mullions at ~2:1 contrast.)
   The chooser picks **panel vs. heavy-scrim-block per card** based on what the
   photo can support — busy/low-contrast photo → solid or diagonal panel;
   clean/dark photo with room → heavy scrim block. Never "light gradient only."
2. **One left rail.** Eyebrow, hook, support, and CTA all align to a single
   vertical axis. Measure it; don't eyeball it. (Prevents: the loose,
   each-line-starts-somewhere-different look.)
3. **Logo: one fixed corner (TOP-LEFT), one size cap (≤14% of canvas width),
   always in a clean zone.** Identical position and size on every card of every
   format and both funnels. Never top-right. Never over busy texture. (Prevents:
   the oversized floating sticker, and the corner-hopping across our set that
   stopped viewers from learning where the brand lives. Supersedes the old
   "logo top-right" rule — reels already dock top-left for crop safety; this
   unifies stills to match.)
4. **Element budget: ≤5 overlay elements, one scan path.** The path is
   badge → hook → support → CTA, plus the logo. A sixth element means one must
   leave. (Prevents: the hero card's nine competing focal points — "about
   everything" triggers nothing.)
5. **Uniform, generous margins off the SAFE box.** Text starts at a consistent
   inset from the crop-safe rectangle (see legibility-qc), never off the raw
   canvas edge, and never kisses an edge. Top, left, right, and bottom insets
   are consistent within a card. (Prevents: "5 BATHS" nearly touching the left
   edge; ragged margins.)
6. **Cross-crop survival — design to the intersection of all three ratios.**
   The layout must hold when Meta center-crops the master to 4:5, 1:1, AND 9:16
   (feed, Reels, Stories all serve different crops from one upload). Assume
   geometric center-crop; never rely on smart-crop. (Prevents: elements Meta
   silently erases in a placement you didn't preview.)
7. **Thumbnail legibility — the hook survives at 120 px wide.** Support ≤ 9
   words. Any element illegible at feed scale is deleted, not shrunk. (Prevents:
   the tiny benefit chips that are noise at real feed size.)
8. **Contrast ≥ 4.5:1 against the ACTUAL local background** the text lands on —
   measured on the composited render, not assumed from the design intent.
9. **Corner balance / symmetry.** If a top corner carries an element, the
   opposite corner stays empty or carries only the small logo. Corners balance;
   they never both carry heavy elements at mismatched sizes and baselines.
   (Prevents: eyebrow-left vs. giant-logo-right fighting.)
10. **Photo standard.** Afters are bright, hero-lit, and decluttered; befores
    are honest but not murky/greenish. A dim after is a rejected card — the
    after IS the product. Grade every photo for its composition (directional
    darkening toward the text zone), never ship it raw.
11. **Structure devices must look intentional.** Dividers, frames, and cut-lines
    are crisp: clean diagonal, torn-paper edge, or hairline rule. Never a fat
    glowing full-bleed bar (reads as a broken render / signal glitch — our
    before/after cyan divider was exactly this failure).

## the-five-layers

Every card is built from all five layers. If a layer is missing, the card
reads as "image with text on it" — rejected. The five-layers implement the
ground-truths; where they overlap, the ground-truth wins.

1. **Photo layer** — real portfolio photography only (truthfulness guardrail).
   Graded for the composition: vignette / directional darkening toward text
   zones (ground-truth 10). Never a raw untouched photo. Occupies its own
   zone — never carries text (ground-truth 1).
2. **Depth layer** — the *protected text zone* itself (ground-truth 1): a
   solid/diagonal panel, a band, or a ≥70%-opacity shaped block that text sits
   on. Plus at least one designed-not-captioned device: oversized numeral
   behind text, offset editorial frame, tilted polaroid, duotone brand panel.
   Text NEVER sits directly on unmodified photo.
3. **Structure layer** — at least one geometric device that organizes the eye
   and looks intentional (ground-truth 11): frosted panel, rule/underline, pill
   chips, split divider (crisp/torn — never a glowing bar), corner frame.
4. **Text hierarchy layer** — four slots, distinct sizes, ONE alignment system
   on the single left rail (ground-truth 2):
   - *Eyebrow/badge*: offer marker ("KITCHEN SHOWCASE", "SHOWCASE — 5 SPOTS")
   - *Hook*: ≤ 7 words, the dominant element after the photo, legible at 120 px
   - *Support*: ≤ 9 words, one line
   - *CTA*: button-affordance shape ("See if your home qualifies") or the
     eligibility widget (see below) — every card except pure-photo carousel
     proof cards carries one
5. **Brand layer** — non-negotiable, per ground-truth 3:
   - **Logo TOP-LEFT on every card**, ≤ 14% of canvas width, on a frosted chip
     or clean-contrast zone (never over busy texture). Identical corner and
     size across the whole ad set and both funnels.
   - Brand accent (funnel cyan) used at least once as a functional element
     (underline, chip, divider, CTA fill) — never as decoration spam, never as
     a fat glowing bar.

## the-eligibility-widget

Our sanctioned lead device (owner pick 2026-07-27, over price/financing
anchoring). Mirrors the funnel's real first step — a ZIP gate — so the ad
previews the exact action the viewer is about to take. Curiosity + action
with no price shown, on-brand with our ZIP-gated qualification funnel.

- **Form:** a fake input affordance + button, e.g. `[ Enter ZIP ] [ Check → ]`
  or a labeled "SEE IF YOU QUALIFY" widget. It looks interactive but the whole
  image is the ad — the click goes to the funnel.
- **Where it fits:** it is a CTA-slot device — it replaces the CTA chip on the
  cards that lead with qualification (hero, endcard). It still obeys the CTA
  rules in the offer doc (never GET_QUOTE language, never a quote/price
  promise).
- **Pairs with scarcity, doesn't replace it:** "SEE IF YOU QUALIFY" widget +
  "5 spots this round" support line is the house combination.
- **Truthfulness:** the widget must reflect a real gate (ZIP/homeowner). Never
  fake a step the funnel doesn't have.

## psychological-triggers

Each card commits to exactly ONE primary trigger and makes it visually
dominant (a card "about everything" triggers nothing — ground-truth 4):

| Trigger | Visual execution |
|---|---|
| Qualification / curiosity | The eligibility widget + question hook dominate ("Could your kitchen be one of the 5?") |
| Scarcity | The numeral **5** oversized or chipped ("5 SPOTS LEFT THIS ROUND") — not buried mid-sentence |
| Transformation | Before/after contrast IS the layout (split + labels + crisp divider) |
| Authority / standard | "Held to this standard" framing over flagship work + badge |
| Social proof | "Real homes in your area" framing, multi-project grid/scatter |

Secondary trigger allowed only in the support line.

## style-directions

Orthogonal to pattern: every card also declares a **style** (props field
`style`) — the art direction it renders in. Styles are first-class A/B units:
we deliberately mix styles across an ad set's slots, read per-ad
cost-per-qualified-lead, then scale the winning style into more slots and
kill losers on the monthly refresh. Owner decision 2026-07-27: keep three
DISTINCT styles (not one shared skeleton) — but every style must now pass the
ground-truths above. The style changes the skin; the bones (protected text
zone, one rail, logo top-left, ≤5 elements, safe rects) never move.

| Style | Energy | Signature devices | Sanctioned extra typeface |
|---|---|---|---|
| `editorial-poster` | Loud, premium poster | Oversized condensed type as design element, giant numeral, cropped-off-edge words, watermark type, cinematic grade — all inside a solid/diagonal text panel | One condensed display face (headlines only) |
| `luxury-minimal` | Quiet, expensive | Full-bleed re-graded photo with a heavy scrim block for text, small wide-tracked caps, hairline rules, text-link CTA | none (brand fonts only) |
| `dr-maximal` | Classic FB converter | Diagonal brand panel holds ALL text (LA-Remodeling skeleton), sticker chips, benefit chips with icons, torn-paper before/after divider, eligibility widget | One marker/hand face (annotations only, never headlines) |

Rules:
- The ground-truths, five-layers, single-trigger, and QC requirements apply to
  every style. A style that violates a ground-truth is a broken style.
- Default slot mapping (change deliberately, not by drift): heroes +
  before/afters → `dr-maximal`; numeral/CTA carousel cards →
  `editorial-poster`; proof/authority cards → `luxury-minimal`.
- The typeface budget is "brand fonts + the style's sanctioned face" — never
  more, never borrowed across styles.
- New styles enter this table only via an owner-ratified taste test.

## named-patterns

Every card declares its pattern (props field `pattern`). No pattern = no ship.
Every pattern must realize the protected text zone (ground-truth 1) — the
zone type (panel / diagonal / band / scrim-block) is chosen per card.

- **panel-diagonal** — diagonal brand panel holds ALL text on one side; photo
  clean on the other (the LA-Remodeling skeleton; strongest legibility)
- **hook-dominant-hero** — full-bleed photo, heavy scrim block, oversized hook,
  eligibility widget or CTA chip
- **split-before-after** — crisp/torn divider (never glowing bar), BEFORE/AFTER
  pills, one caption on a scrim block, CTA chip
- **polaroid-scatter** — 2–3 tilted framed shots over a brand panel, hook + CTA
- **editorial-frame** — photo inset in offset frame, hook in the solid margin zone
- **numeral-poster** — giant "5" as depth layer, photo behind, text on a scrim
  block, scarcity hook
- **cta-endcard** — brand-color ground, badge + hook + support + eligibility
  widget (no photo required)

Within one ad set, no two cards share the same pattern unless they are
carousel proof siblings.

## legibility-qc

Run on every render before the human gate. These gates are written to catch
the exact failures from the 2026-07-27 audit.

- [ ] **Ground-truth sweep:** protected text zone present (no text on raw
      photo)? one left rail? logo top-left ≤14% in a clean zone? ≤5 elements,
      one scan path? corners balanced? divider intentional (not a glowing bar)?
      after bright/hero-lit? — any NO = no ship.
- [ ] Hook legible at 120 px thumbnail width (feed reality check)
- [ ] Text contrast ≥ 4.5:1 against its actual local background (measured on
      the render)
- [ ] **Universal safe rects (researched 2026-07-27 — cross-placement crop +
      Reels-UI intersection; ground-truth 6):**
      · **4:5 (1080×1350):** ALL text/logo/CTA inside x 75–1005, y 135–950.
        Logo top-LEFT: inset ≥162 px from top, ≥86 px from left.
        Nothing in the bottom 30% (y > 945 — Reels-backfill caption band;
        1:1 surfaces crop 135 px off top AND bottom).
      · **1:1 (1080×1080):** everything inside 86 px margins; right margin
        108 px (Reels rail insurance); logo top-left.
      · **9:16 (1080×1920, video/thumbnail masters):** everything inside
        x 65–1015, y 420–1248 (feed crops to 4:5 = top+bottom 285 px gone;
        1:1 surfaces = 420 px gone each end; Reels UI owns top 270 px +
        bottom 672 px; right rail ≈130 px wide mid-frame). Logo top-LEFT at
        (x≈80, y≈440), height ≤130 px. NEVER top-right on 9:16.
      · Assume geometric CENTER crop — never rely on smart-crop.
- [ ] One scan path: badge → hook → support → CTA (no competing focal points)
- [ ] No text over high-frequency texture without a protected zone under it
- [ ] Typographic punctuation (’ — ·), brand fonts only, ≤ 2 typefaces
- [ ] Meta compliance: first-person program claims only, no viewer attributes,
      no fake urgency, CTA language matches offer rules (never quote-language);
      eligibility widget reflects a real gate

## per-format-notes

- **Single-image ads**: 1080×1350 (4:5); design must survive center-crop to 1:1.
- **Carousel cards**: 1080×1080; card 1 = strongest hook card; proof siblings
  may drop the CTA chip; final card = `cta-endcard`.
- **Video thumbnails**: same brand layer rules (logo top-left, hook visible);
  prefer a designed frame (hook card from the reel) over a raw video frame.
