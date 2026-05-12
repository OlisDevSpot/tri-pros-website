# Project Stories Carousel — Design Recommendations

Generated via `ui-ux-pro-max` skill. Paste-ready Tailwind classes for the `/experience` page Project Stories carousel. Every recommendation references the existing codebase and locked design system.

---

## 1. Slide Layout (HIGHEST PRIORITY)

**Recommendation:** Keep the image-left / content-right split on desktop but widen the image to 8 cols (from 7), narrow content to 4, and increase the content area's vertical padding to create asymmetric editorial breathing room. On mobile, stack image-top / content-below.

### Image aspect ratio

Use **3:2** across all breakpoints — it's the photojournalism standard and shows residential architecture better than 16:10 (too cinematic/landscape) or 4:5 (too portrait for room shots).

```
Current:  aspect-[16/10] sm:aspect-[3/2] lg:aspect-auto
Proposed: aspect-[3/2]
```

**Why:** Consistent aspect ratio prevents layout shift between breakpoints and gives embla a predictable slide height.
**Avoid:** `aspect-auto` on lg — it makes the image height slave to the content column, causing inconsistent slide heights across data.

### Outer `<article>`

```diff
- grid grid-cols-1 lg:grid-cols-12 gap-0 bg-foreground/[0.02] border border-foreground/10 overflow-hidden
+ grid grid-cols-1 lg:grid-cols-12 gap-0 bg-foreground/[0.02] border border-foreground/[0.06] overflow-hidden transition-colors duration-500 hover:border-foreground/[0.12]
```

**Why:** Softer default border (0.06 instead of 0.10) reads more premium; the hover brightens it subtly without needing shadow/lift.
**Avoid:** `shadow-lg` or `ring` on hover — too SaaS, not editorial.

### Image container

```diff
- relative aspect-[16/10] sm:aspect-[3/2] lg:aspect-auto lg:col-span-7 overflow-hidden bg-card
+ relative aspect-[3/2] lg:col-span-8 overflow-hidden bg-card
```

**Why:** 8 cols gives the hero image more visual weight — this is a photo-first section, the image does the selling.

### Content column

```diff
- relative lg:col-span-5 flex flex-col items-center text-center lg:items-start lg:text-left justify-center p-8 sm:p-10 lg:p-12 xl:p-14 gap-6 lg:gap-8
+ relative lg:col-span-4 flex flex-col items-center text-center lg:items-start lg:text-left justify-center px-6 py-8 sm:px-8 sm:py-10 lg:px-10 lg:py-14 xl:px-12 xl:py-16 gap-5 lg:gap-7
```

**Why:** Tighter horizontal padding + more vertical padding creates the "tall column of breathing room" feel from editorial architecture magazines. Gap reduced slightly (6→5, 8→7) to keep the content cluster tighter as a unit.

### Quote

```diff
- font-serif italic text-xl sm:text-2xl leading-[1.4] text-foreground max-w-prose
+ font-serif italic text-lg sm:text-xl lg:text-2xl xl:text-[1.625rem] leading-[1.45] text-foreground/90 max-w-[28ch]
```

**Why:** `max-w-[28ch]` instead of `max-w-prose` keeps lines short and dramatic — editorial quotes breathe when they're narrow. `text-foreground/90` is softer than pure white, easier on dark backgrounds. Stepping through 4 sizes (lg→xl) prevents the quote from looking undersized on wide screens.
**Avoid:** `text-3xl` or larger — the quote should feel intimate, not shouting.

### Attribution

```diff
- space-y-1
+ space-y-0.5
```

Homeowner name:
```diff
- text-sm font-medium text-foreground tracking-wide
+ text-sm font-medium text-foreground/80 tracking-wide
```

Meta line — no changes needed, already correct.

**Why:** Tighter spacing between name and meta; slightly softer name color so it doesn't compete with the quote.

### CTA ("View This Project")

```diff
- inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-foreground
+ inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-primary
```

**Why:** The CTA is currently `text-foreground` (white) which makes it blend into the content. Switching to `text-primary` (brand blue) creates the only color pop in the card — the eye lands here as the action target.
**Avoid:** Making this a filled button — editorial CTAs are text links with motion, not blocks.

### Slide number overlay

```diff
- absolute top-5 right-5 font-serif italic text-2xl text-background/90 mix-blend-difference invert
+ absolute top-4 right-5 font-serif italic text-xl text-foreground/20 select-none
```

**Why:** `mix-blend-difference invert` is clever but unpredictable over varied photography — sometimes it flips to magenta or green. A simple low-opacity foreground color is reliable and stays editorial. Smaller size (xl vs 2xl) makes it less distracting.
**Avoid:** Removing the number entirely — it signals "this is a curated collection" which builds perceived value.

### Large decorative quote mark

```diff
- pointer-events-none absolute -top-6 lg:top-2 left-1/2 -translate-x-1/2 lg:left-8 lg:translate-x-0 font-serif italic text-[10rem] lg:text-[14rem] leading-none text-primary/[0.07] select-none
+ pointer-events-none absolute -top-4 lg:top-4 left-1/2 -translate-x-1/2 lg:left-6 lg:translate-x-0 font-serif italic text-[8rem] lg:text-[11rem] leading-none text-primary/[0.05] select-none
```

**Why:** Slightly smaller and even more ghostly (0.05 opacity) — the current 14rem at 0.07 is visible enough to read as a design element competing with the actual quote text. At 11rem / 0.05 it's pure texture.

---

## 2. Carousel Pattern

**Recommendation: Option A — 1-up full-width.** Keep the current pattern.

**Embla opts (unchanged):**
```ts
{ align: 'start', loop: false }
```

**Why:** For 3-8 large editorial cards with hero photography + blockquote, full-width 1-up gives each homeowner story maximum respect. Peek-next (B) works for product cards, not testimonials — peeking trivializes the story. 2-up (C) halves the image and quote impact. Stacked deck (D) hides the photography.

**Change to consider — `loop: true` when count > 2:**
```ts
{ align: 'start', loop: slides.length > 2 }
```

**Why:** With 3+ slides, looping removes the dead-end feeling on the last slide and keeps the browsing momentum going. With 1-2 slides, looping feels odd.
**Avoid:** `slidesToScroll: 2` or `containScroll: 'trimSnaps'` — both break the 1-up editorial pacing.

---

## 3. Navigation UX

### Arrow buttons — move to content-aligned row with counter

Replace the current centered arrows + dots + counter with a single editorial nav row:

**Layout change** — combine arrows and counter into one row, remove dots:

```tsx
{/* Navigation row */}
<div className="mt-8 flex items-center justify-between lg:justify-start lg:gap-8">
  {/* Counter */}
  <span className="font-serif italic text-sm text-foreground/60 tabular-nums min-w-[4ch]">
    {String(activeIndex + 1).padStart(2, '0')}
    <span className="text-foreground/20 mx-1.5">/</span>
    {String(count).padStart(2, '0')}
  </span>

  {/* Progress bar */}
  <div className="hidden sm:block flex-1 max-w-48 h-px bg-foreground/10 relative overflow-hidden">
    <div
      className="absolute inset-y-0 left-0 bg-primary transition-all duration-500 ease-out"
      style={{ width: `${((activeIndex + 1) / count) * 100}%` }}
    />
  </div>

  {/* Arrows */}
  <div className="flex items-center gap-3">
    <Button ...prev className="size-10 rounded-none border-foreground/10 ..." />
    <Button ...next className="size-10 rounded-none border-foreground/10 ..." />
  </div>
</div>
```

**Why:** Dots become meaningless past 5 items and add visual noise. The counter + progress bar gives positional awareness without clutter. Left-aligned (on desktop) feels editorial; centered felt like a product carousel.

### Arrow button classes (refined)

```diff
- size-11 rounded-none border-foreground/15 bg-transparent hover:bg-foreground/[0.03] text-foreground disabled:opacity-30
+ size-10 rounded-none border-foreground/10 bg-transparent hover:bg-foreground/[0.05] hover:border-foreground/20 text-foreground/70 hover:text-foreground disabled:opacity-25 transition-all duration-200
```

**Why:** Smaller (10 vs 11), softer default state (foreground/70), more visible hover response (border brightens + text brightens). `transition-all` instead of default `transition-colors` so the border change animates too.

### Dots — remove entirely

**Why:** With a counter + progress bar, dots are redundant and add visual weight to what should be a clean editorial section. If you have 8 slides, 8 dots is noisy.
**Avoid:** Keeping both dots AND counter — choose one system.

### Drag/swipe affordance

No explicit affordance needed — the card itself is a Link, which on touch devices already implies swipability within a carousel context. Embla handles touch drag natively.
**Avoid:** Adding a "swipe to see more" label — it reads as a mobile web dark pattern.

### Keyboard nav

Already handled by shadcn Carousel (`ArrowLeft`/`ArrowRight` key listeners). Ensure the carousel container itself can receive focus:

```tsx
<Carousel ... className="w-full focus-visible:outline-none">
```

### Auto-advance

**No.** Auto-advancing testimonial carousels frustrate users who are mid-read. The average quote at 100-200 chars takes 5-8 seconds to read — any auto-advance timer either cuts them off or wastes time on short quotes.
**Avoid:** Auto-advance with pause-on-hover — it creates a "ticking clock" anxiety that undermines the relaxed editorial tone.

---

## 4. Hover & Interaction States

### Image hover (already good, minor refinement)

```diff
- object-cover transition-transform duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.04]
+ object-cover transition-transform duration-[1200ms] ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.03]
```

**Why:** 1.03 is more restrained than 1.04 — for large images, even 3% zoom is noticeable and elegant. 1200ms gives the zoom a languid, cinematic quality.

### Image gradient overlay — deepen on hover

```diff
- absolute inset-0 bg-gradient-to-t from-background/40 via-transparent to-transparent pointer-events-none
+ absolute inset-0 bg-gradient-to-t from-background/30 via-transparent to-transparent pointer-events-none transition-opacity duration-500 group-hover:from-background/50
```

Wait — Tailwind can't transition gradient stops. Instead, use two overlapping layers:

```tsx
{/* Base gradient */}
<div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/30 via-transparent to-transparent pointer-events-none" />
{/* Hover-deepened gradient */}
<div aria-hidden className="absolute inset-0 bg-gradient-to-t from-background/25 via-transparent to-transparent pointer-events-none opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
```

**Why:** Deepening the bottom gradient on hover draws the eye down toward the content column and creates a cinematic "focus pull" effect.

### Entire slide clickable — keep as-is

The full card is already wrapped in `<Link>`, which is correct. Entire-card click area is better for conversion than a small CTA-only target.
**Why:** On mobile, the quote area is the natural tap zone. Making only the CTA clickable would require precision tapping.

### Card lift/shadow/glow

**No.** The border-brightness hover (from section 1) is sufficient. Shadows and glows break the flat editorial aesthetic.
**Avoid:** `hover:shadow-xl` or `hover:-translate-y-1` — these are SaaS card patterns, not editorial.

---

## 5. Responsive Behavior

### 375px (mobile)

```
article:    grid-cols-1, no border radius
image:      aspect-[3/2], full width
content:    px-6 py-8, text-center, items-center
quote:      text-lg, leading-[1.45], max-w-[28ch]
attribution: text-sm name, text-xs meta
CTA:        text-[11px], centered
nav row:    justify-between (counter left, arrows right)
```

### 768px (md)

```
article:    still grid-cols-1 (image stacks above content)
image:      aspect-[3/2]
content:    px-8 py-10, still centered
quote:      text-xl (step up from lg)
nav:        progress bar becomes visible (hidden sm:block)
```

**Key decision:** Keep stacked layout at md (768px). The 2-column split doesn't work until the image has enough horizontal space to be impactful.

### 1024px (lg) — editorial desktop kicks in

```
article:    grid-cols-12
image:      lg:col-span-8, aspect-[3/2]
content:    lg:col-span-4, lg:items-start lg:text-left, lg:px-10 lg:py-14
quote:      lg:text-2xl
nav row:    lg:justify-start lg:gap-8 (left-aligned)
```

### 1440px (xl) — polish

```
content:    xl:px-12 xl:py-16
quote:      xl:text-[1.625rem] (26px — slightly larger than 2xl's 24px)
```

**Avoid:** Changing the grid split at xl — 8/4 works all the way up. Adding more columns to the image just makes the content column too narrow to read.

---

## 6. Motion Choices

### Embla slide transition

**Keep default.** Embla's native scroll animation is smooth and interruptible. Custom spring physics via embla plugins add complexity without meaningful UX gain for a 1-up editorial carousel.

### Section entry on scroll-into-view

Use `SECTION_ENTRANCE` (current) — it's already wired and appropriate. The carousel fades up as a unit.

### Ken Burns on active slide

**No.** The hero section already uses ken-burns. Repeating it in the carousel creates motion fatigue and competes with the hero. The subtle `group-hover:scale-[1.03]` is enough image motion.
**Avoid:** CSS `animation: ken-burns 20s` on the active slide — it fights with embla's scroll transform and causes jank.

### Quote/attribution stagger on slide change

**Yes — but keep it subtle.** When a new slide becomes active, stagger the content elements in with a 50ms delay between each.

```ts
// New variant to add to experience-motion.ts
export const SLIDE_CONTENT_STAGGER: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.06 },
  },
}

export const SLIDE_CONTENT_CHILD: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.1, 0.25, 1] },
  },
}
```

Wrap the content column's children in a `<motion.div variants={SLIDE_CONTENT_STAGGER}>` keyed to `activeIndex`:

```tsx
<motion.div
  key={activeIndex}
  variants={SLIDE_CONTENT_STAGGER}
  initial="hidden"
  animate="visible"
  className="contents"
>
  {/* eyebrow, quote, attribution, CTA — each wrapped in motion.div variants={SLIDE_CONTENT_CHILD} */}
</motion.div>
```

**Why:** The stagger adds life to slide transitions without custom embla animation. It signals "new content arrived" which helps with the flat feeling.
**Avoid:** Stagger delays > 100ms per child — the total sequence shouldn't exceed ~300ms or it feels sluggish.

**Reduced motion:** When `useReducedMotion()` returns true, set `initial="visible"` and skip the stagger. Content appears instantly.

---

## 7. Edge States

### 1 slide only

Hide all carousel chrome. Render the single card as a static feature:

```tsx
if (slides.length === 1) {
  return (
    <section ref={ref} className="py-20 lg:py-32">
      <div className="container">
        <SectionHeading ...>...</SectionHeading>
        <motion.div variants={SECTION_ENTRANCE} ...>
          <ProjectStoryCard slide={slides[0]} index={0} />
        </motion.div>
      </div>
    </section>
  )
}
```

**Why:** A carousel with one slide and disabled arrows looks broken. A single editorial card looks intentional.

### 2 slides

Keep the carousel but force `loop: false` and remove the progress bar (it jumps from 50% to 100% which looks odd). Keep arrows + counter.

```ts
{ align: 'start', loop: slides.length > 2 }
```

### Very long quote (300+ chars)

**Clamp to 4 lines on mobile, 5 on desktop.** Add a line-clamp utility:

```diff
- font-serif italic text-lg sm:text-xl lg:text-2xl ...
+ font-serif italic text-lg sm:text-xl lg:text-2xl ... line-clamp-4 lg:line-clamp-5
```

**Why:** A 300+ char quote at `text-2xl` could easily run 8-10 lines and push the CTA below the fold. Clamping preserves layout consistency across slides. The full quote lives on the project page (the CTA destination).
**Avoid:** `line-clamp-3` — too aggressive, cuts most 2-sentence quotes.

### Missing meta segments

Already handled — the current code renders `slide.meta` only if truthy. The `buildProjectStorySlides` function composes meta from available parts (title, location, completion date), joining with ` · `. If all parts are missing, meta is empty string and the `{slide.meta ? ... : null}` guard hides it cleanly.

No changes needed.

---

## 8. Accessibility

### `aria-roledescription="carousel"`

Add to the Carousel wrapper:

```tsx
<Carousel
  opts={...}
  setApi={setApi}
  className="w-full"
  aria-roledescription="carousel"
  aria-label="Project stories from real homeowners"
>
```

**Why:** `aria-roledescription` overrides the generic `group` role with a more descriptive label, helping screen reader users understand the interaction pattern.

### `aria-live` on slide change

Add a visually-hidden live region outside the carousel that announces the current slide:

```tsx
<div className="sr-only" aria-live="polite" aria-atomic="true">
  {`Slide ${activeIndex + 1} of ${count}: ${slides[activeIndex]?.homeowner} — ${slides[activeIndex]?.meta}`}
</div>
```

**Why:** `aria-live="polite"` announces without interrupting. `aria-atomic="true"` reads the full string on each change instead of just the diff.
**Avoid:** `aria-live="assertive"` — slide changes aren't urgent enough to interrupt screen reader flow.

### Each slide's aria-label

Add to `CarouselItem`:

```tsx
<CarouselItem
  key={...}
  className="..."
  role="tabpanel"
  aria-roledescription="slide"
  aria-label={`${slide.homeowner}: ${slide.quote.slice(0, 80)}${slide.quote.length > 80 ? '...' : ''}`}
>
```

**Why:** Gives each slide a meaningful label. Truncating the quote at 80 chars prevents screen readers from reading a novel on focus.

### Focus visible on arrow buttons

Already using shadcn `Button` which has `focus-visible:ring` styles. Ensure the custom dot buttons (if kept) also have focus-visible:

```
focus-visible:outline-2 focus-visible:outline-primary focus-visible:-outline-offset-2
```

(Per project convention — outline, not ring, to avoid scrollable container clipping.)

### `prefers-reduced-motion`

Embla has a `reducedMotion` option in its API. However, the simplest approach is to respect it at the motion/react level (already done for section entrance). For embla scroll transitions specifically, if you want to disable smooth scrolling:

```ts
// In the component, after api is set:
const prefersReduced = useReducedMotion()

// Pass to embla opts:
{ align: 'start', loop: slides.length > 2, duration: prefersReduced ? 0 : undefined }
```

Setting `duration: 0` makes embla snap instantly instead of animating.

**Why:** Users who enable reduced motion should still be able to navigate slides — they just shouldn't see the smooth scroll animation.

---

## Summary of Changes (Priority Order)

| # | Change | Impact | Effort |
|---|--------|--------|--------|
| 1 | CTA color → `text-primary` | High — creates visual anchor | 1 min |
| 2 | Image col span 7→8, content 5→4 | High — more photo presence | 2 min |
| 3 | Quote `max-w-[28ch]` + `text-foreground/90` | High — editorial feel | 1 min |
| 4 | Replace dots with progress bar | Medium — cleaner nav | 15 min |
| 5 | Slide content stagger animation | Medium — adds life | 20 min |
| 6 | Border softening (0.06 default, 0.12 hover) | Low — polish | 2 min |
| 7 | Slide number fix (remove mix-blend) | Low — reliability | 1 min |
| 8 | Accessibility additions (aria-live, roledescription) | Medium — compliance | 10 min |
| 9 | Single-slide static fallback | Low — edge case | 5 min |
| 10 | Long quote line-clamp | Low — edge case | 1 min |
| 11 | Loop when count > 2 | Low — UX polish | 1 min |
