# Handoff Prompt — Project Stories Carousel Design Pass

Paste the prompt below into a fresh session and invoke `/ui-ux-pro-max`. The brief is self-contained — no prior context required.

---

## /ui-ux-pro-max

I need a design polish + escalation pass on the **Project Stories carousel** for the Tri Pros Remodeling `/experience` marketing page. This carousel is the page's single most important conversion section — real homeowner photos and quotes are the proof mechanism that turns visitors into inquiries. The current implementation works but reads as flat. I need it to feel cinematic, inviting, and click-worthy.

Return paste-ready Tailwind class strings, not generic advice. Every recommendation must include actual class strings I can paste, plus a 1-sentence justification so I know *why* and can override intelligently.

### Tech & design system (locked — do not redesign these)

- **Stack:** Next.js 15 App Router · React Server Components for views · Tailwind v4 · shadcn/ui (Radix) · `motion/react` (not framer-motion)
- **Carousel primitive:** shadcn `<Carousel>`, `<CarouselContent>`, `<CarouselItem>` from `@/shared/components/ui/carousel` (embla-carousel-react). Already imported and wired. Use this — do not propose a custom carousel.
- **Theme:** Dark mode hard-locked via `<html className="dark">`.
- **Color tokens (use semantic only — no raw hex):**
  - `bg-background` = oklch(0.2433 0.0247 263.9506) — deep blue-charcoal
  - `text-foreground` = oklch(0.9683 0.0069 247.8956) — near-white
  - `text-muted-foreground` = mid-gray
  - `text-primary` / `bg-primary` = oklch(0.6231 0.188 259.8145) — saturated brand blue (~#4d7fed). The ONLY accent color.
  - Editorial hairline divider = `border-foreground/10`
  - Subtle surface = `bg-foreground/[0.02]` to `bg-foreground/[0.05]`
- **Fonts (already loaded as Tailwind classes — no extra setup):**
  - `font-serif` = Playfair Display (display headings, italic accents — gorgeous italic glyphs, lean into them)
  - `font-sans` = Syne (eyebrows, tracked-out labels)
  - Body inherits Nunito at base size 16px
- **Motion patterns to reuse:**
  - Section entry: `useInView(ref, { once: true, margin: '-80px' })` + variants pattern toggling `'hidden' ↔ 'visible'`
  - Default duration 0.7s, ease `[0.25, 0.1, 0.25, 1]`
  - Existing variants in `constants/experience-motion.ts`: `SECTION_ENTRANCE`, `STAGGER_CONTAINER`, `STAGGER_CHILD`, `WORD_REVEAL`, `ACCENT_REVEAL`, `DRAW_X`
  - `prefers-reduced-motion` respected via `useReducedMotion()` from motion/react
- **Existing primitives already built (reuse, don't redesign):**
  - `<EditorialEyebrow chapter="01">LABEL TEXT</EditorialEyebrow>` — small uppercase tracked-out label with animated leading rule and optional serif italic chapter number
  - `<SectionHeading eyebrow chapter trailing={{ label, href }}>{children}</SectionHeading>` — eyebrow + Playfair H2 (children) with optional trailing arrow link
  - `<DrawnUnderline>{text}</DrawnUnderline>` — wraps inline text with hover-triggered underline draw via CSS `scaleX origin-left`
  - Page-wide SVG grain overlay is already present (don't add another)

### Data shape (real DB records — strict, no fake fallback)

```ts
interface ProjectStorySlide {
  imageUrl: string  // Cloudflare R2 hero image URL — guaranteed present
  imageAlt: string  // = project.title
  quote: string     // homeowner's actual quote — guaranteed present
  homeowner: string // e.g. "Sarah Williams"
  meta: string      // composed like "Kitchen Remodel · Pasadena, CA · Completed October 2024"
  href: string      // "/portfolio/projects/[accessor]" — guaranteed
}
```

The view filters out any project missing `homeownerQuote`, `heroImage.url`, or `accessor`. If the result array is empty, the entire section is hidden. **There is no fake/fallback testimonial data — do not design for one.**

### Audience & conversion intent

- **Visitor:** Affluent Southern California homeowner researching contractors for a $100K–$2M residential project (renovation, custom home, design-build)
- **Mental state:** Brand-curious, slightly skeptical, wants social proof
- **Goal of this section:** Prove "real homeowners trust us with their homes" through real photos + real quotes
- **CTA:** Click into the full project story page (`/portfolio/projects/[accessor]`) for deeper proof. Section is consumed mid-page, between Hero and Studio Story.

### What I need from you (be specific and prescriptive)

1. **Slide layout (HIGHEST PRIORITY)**
   - Best layout for a single slide: image left + content right? Image full-bleed with content overlaid? Image top + content below on mobile?
   - Image aspect ratio recommendation (16:9 / 3:2 / 4:5 / 1:1 / custom)
   - How prominent is the homeowner quote — full bleed Playfair italic, or contained block?
   - Where does meta line live (city · project type · completion date) — above quote, below attribution, somewhere else?
   - Treatment of "View This Project" CTA — button, text link with arrow, full-card click affordance?
   - Provide complete Tailwind class strings for: outer `<article>`, image container, content column, eyebrow row, quote, attribution, CTA

2. **Carousel pattern — pick ONE and justify**
   - **A** 1-up full-width (current): every slide takes full container width
   - **B** Peek-next: main slide centered, ~12-18% of next slide visible right edge
   - **C** 2-up split on desktop, 1-up on mobile
   - **D** Stacked deck: 1 slide visible, others scaled/blurred behind
   - **E** Something else editorial

   Which best serves a luxury construction brand showing 3-8 real project stories? Provide embla `opts` object (`{ align, loop, slidesToScroll, ... }`).

3. **Navigation UX**
   - Arrow buttons: placement (below carousel / floating beside slide / corner) and Tailwind classes
   - Dot indicators: dots / progress bar / counter / hybrid — recommend one with class strings
   - Slide counter ("01 / 08"): keep / replace / move
   - Drag/swipe affordance: visible hint on mobile? what kind?
   - Keyboard nav: ensure arrow keys work, focus visible
   - Auto-advance: yes/no with reasoning. If yes — duration, pause behavior

4. **Hover & interaction states**
   - Image hover treatment (scale, brightness, filter) — class strings
   - "View Project" CTA hover state
   - Should entire slide be hover-clickable, or only the CTA? Justify
   - Card "lift" / shadow / glow on hover — yes or no?

5. **Responsive behavior — per breakpoint Tailwind recipes**
   - 375 (sm-): slide structure, image height/aspect, quote font size, padding
   - 768 (md): transition point
   - 1024 (lg): full editorial desktop
   - 1440 (xl): polish state

6. **Motion choices (within locked patterns)**
   - Embla slide transition: default vs. customized — recommendation
   - Section entry on scroll-into-view: which variant
   - Should the homeowner image have subtle ken-burns on the active slide only? (Hero image elsewhere already uses ken-burns.)
   - Should the quote / attribution / CTA stagger in when a new slide becomes active?

7. **Edge states**
   - 1 slide only: hide carousel chrome (arrows, dots, counter) and render as static feature card? Provide alternate layout?
   - 2 slides: does carousel look weird with only 2? Adjustments?
   - Very long quote (300+ chars): truncate with ellipsis, clamp lines, or let it flow?
   - Missing `meta` field segments (no completion date, no city): graceful fallback

8. **Accessibility (call out specifics)**
   - `aria-roledescription="carousel"` placement
   - `aria-live` strategy on slide change
   - Focus visible style on dots and arrow buttons
   - `prefers-reduced-motion`: disable embla scroll transitions, or shorten? How exactly?
   - Screen reader announce of slide content (e.g. `aria-label="Slide 2 of 8: Sarah Williams quote about kitchen remodel"`)

### Deliverable format

Return one markdown document with sections matching the numbered list above. Each section must include:
- The recommendation in one tight sentence
- Paste-ready Tailwind class strings (or embla config / motion variant object)
- A 1-sentence justification ("Why:")
- An anti-pattern callout where relevant ("Avoid:")

Keep the doc under ~600 lines. Specific beats comprehensive — I'd rather have 8 sharp recipes than 30 hand-wavy paragraphs.
