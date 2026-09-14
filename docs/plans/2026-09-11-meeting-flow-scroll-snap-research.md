# Meeting-flow scroll-snap presentation — research note

**Date:** 2026-09-11 · **Scope:** section-by-section, full-height snapping inside the meeting-flow step scroller (`src/features/meeting-flow/ui/views/meeting-flow.tsx`, the `min-h-0 flex-1 overflow-y-auto` div) · **Stack:** React 19, Next 15.5, `motion` ^12.18, Tailwind v4 (versions from `package.json`).

## Summary

CSS scroll snap on the existing scroll container does the whole job: `scroll-snap-type: y mandatory` on the scroller, `scroll-snap-align: start` + `scroll-snap-stop: always` on each section. Snap applies to nested scroll containers exactly as to the viewport, to programmatic scrolls, and to elements nested any depth below the scroller ([spec](https://www.w3.org/TR/css-scroll-snap-1/)). Wheel/trackpad/touch feel stays native because the browser, not JS, performs the scroll; the only JS is `useInView(ref, { root })` for reveals/active-section state and an optional `scroller.scrollTo()` for the Next/Prev buttons. Sticky columns coexist with snap (MDN's own example does it). Size sections with `100cqh` (scroller marked `@container-size`), not `h-full`, because the grid wrapper needed for the sticky column breaks percentage-height resolution. Never animate a transform on the element that carries `snap-start` — snap areas are computed from the *transformed* border box.

## 1. CSS scroll snap semantics

- **`mandatory` vs `proximity`** — mandatory: "the scroll container is required to be snapped to a snap position when there are no active scrolling operations"; proximity: "may snap … at the discretion of the UA" ([spec §scroll-snap-type](https://www.w3.org/TR/css-scroll-snap-1/#scroll-snap-type), [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-type)). MDN's warning: "Never use `mandatory` if the content inside one of your child elements will overflow the parent container because user will not be able to scroll the overflowing content into view" ([MDN basic concepts](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll_snap/Basic_concepts)). For a presentation where every section fits the snapport, mandatory is the right strictness. If a section is taller, the spec still keeps its interior reachable: "If the snap area is larger than the snapport in a particular axis, then any scroll position in which the snap area covers the snapport … is a valid snap position in that axis" ([spec §5.2.2](https://www.w3.org/TR/css-scroll-snap-1/#snap-overflow)) — so `min-h-[100cqh]` (not `h-`) is safe; MDN's warning is about content overflowing a *fixed-height* child.
- **Relative scrolls pick the next position in the scroll direction** — "Scroll snapping responds to a relative scroll by finding the nearest valid snap position in the intended direction (if possible), so a snapped element can't get 'trapped' when the snap positions are far apart" ([spec](https://drafts.csswg.org/css-scroll-snap-1/)). This is what makes one wheel notch (Windows) land on the *next* section rather than the nearest one.
- **`scroll-snap-align: start`** — "Start alignment of this box's scroll snap area within the scroll container's snapport is a snap position" ([spec §scroll-snap-align](https://www.w3.org/TR/css-scroll-snap-1/#scroll-snap-align)).
- **`scroll-snap-stop: always`** — "The scroll container must not pass over a snap position defined by this element during the execution of a scrolling operation; it must instead snap to the first of this element's snap positions." It "has no effect on non-relative scrolling operations, as they do not conceptually 'pass over' any snap positions" — relative = fling, pan, `scrollBy()`, PgUp/PgDn; `scrollTo()`/`scrollIntoView()` are absolute and unaffected ([spec ED](https://drafts.csswg.org/css-scroll-snap-1/#scroll-snap-stop), [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-snap-stop)). Baseline widely available since July 2022 (MDN). MDN notes it "can also negatively affect user experience by preventing the user from quickly scrolling to their desired content" — acceptable for a guided presentation. Chrome shipped it in M75 to "trap the inertial scrolling operations preventing the scroll from skipping" ([blink-dev intent](https://groups.google.com/a/chromium.org/g/blink-dev/c/bkUwigYHJDM/m/Bzvm8tkHAgAJ)) — this is the trackpad-fling case.
- **`scroll-padding`** — "offsets that define the optimal viewing region of a scrollport … For a scroll snap container this region also defines the scroll snapport—the area of the scrollport that is used as the alignment container for the scroll snap areas" ([spec §scroll-padding](https://www.w3.org/TR/css-scroll-snap-1/#scroll-padding)). Use it only if something overlays the top of the scroller; the fixed header here sits *outside* the scroller, so none is needed.
- **`scroll-behavior: smooth`** — only affects "scrolling triggered by the navigation or CSSOM scrolling APIs … any other scrolls, such as those performed by the user, are not affected" ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/scroll-behavior)). Snap applies to those programmatic scrolls too: the author can "request a particular bias for the scrollport to land on a snap position after scrolling operations (including programmatic scrolls such as the scrollTo() method)" ([spec ED](https://drafts.csswg.org/css-scroll-snap-1/)). Chrome's guidance: "Smooth scrolling controls the behavior of a programmatic scroll operation while scroll snap determines its destination … they can be used together" ([web.dev](https://web.dev/articles/css-scroll-snap)). So `scroll-smooth` on the scroller costs nothing for wheel/touch and only makes `scrollTo()` animate.
- **Nested scroller** — "Snap positions only affect the nearest ancestor scroll container on the element's containing block chain" ([spec](https://www.w3.org/TR/css-scroll-snap-1/)). The sections may sit inside a grid column inside the scroller; they still snap the scroller. MDN's examples all use an `overflow` div, not the viewport.
- **Re-snap after layout change** — "If the content or layout of the document changes … the UA must re-evaluate the resulting scroll position, and re-snap if required … the scroll container must be re-snapped to those same snap areas after the content change" ([spec ED §4.1.3](https://drafts.csswg.org/css-scroll-snap-1/)). Reveal animations that change layout (height) will therefore cause visible re-snaps; keep reveals to opacity/transform on inner wrappers (see §5).

### Browser caveats (primary sources)

| Engine | Caveat | Status |
|---|---|---|
| iOS Safari | Any `scroll-snap-type` (even `proximity`) suppresses momentum: "swipes move from one item to the next, instead of doing a normal momentum scroll" ([WebKit 243582](https://bugs.webkit.org/show_bug.cgi?id=243582)). | NEW / unfixed. For this design that *is* the wanted one-swipe-one-section feel; it means `snap-always` is mostly for Chrome/Android/trackpads. |
| iOS Safari | `scrollIntoView({behavior:'smooth'})` failed with `y mandatory` on the **root** scroller after browser chrome retracts; "does not occur in subscrollers" ([WebKit 245722](https://bugs.webkit.org/show_bug.cgi?id=245722)). | RESOLVED FIXED May 2026. Does not apply to our div scroller. |
| Safari 15.4 | `scroll-behavior: smooth` on an `overflow: hidden` box silently broke `scrollTo`/`scrollTop` ([WebKit 238497](https://bugs.webkit.org/show_bug.cgi?id=238497)). | Fixed 2022. Lesson: put `scroll-smooth` only on the real scroller, never on the `overflow-hidden` `SidebarInset`. |
| iOS Safari | Layout triggered during a scroll inside a snap container caused jitter ([WebKit 173887](https://bugs.webkit.org/show_bug.cgi?id=173887)). | Fixed Oct 2021; still the reason to avoid layout work mid-scroll. |
| Chrome | `scroll-snap-stop` shipped M75, targets inertial (fling) scrolls ([intent](https://groups.google.com/a/chromium.org/g/blink-dev/c/bkUwigYHJDM/m/Bzvm8tkHAgAJ)). Reported trackpad oddities in [issue 340895249](https://issues.chromium.org/issues/340895249) are **unverified** (page requires sign-in). | — |
| Firefox | Wheel scroll got stuck when a snap container had trailing content with no snap target ([bug 1753188](https://bugzilla.mozilla.org/show_bug.cgi?id=1753188)). | Fixed Firefox 149. Avoid unsnapped trailing content anyway: every child of the sections column is a snap child. |
| Firefox / Windows | `scroll-behavior: smooth` + `mandatory` + `always` + programmatic paging by `scrollLeft += width` got stuck at DPI-dependent items ([bug 1959811](https://bugzilla.mozilla.org/show_bug.cgi?id=1959811)). | UNCONFIRMED, Fx 137. Mitigation: programmatic nav should `scrollTo` the exact `offsetTop` of the target section, not page by a computed width. |
| Firefox / macOS Monterey | Trackpad momentum flaky with mandatory snap ([bug 1744289](https://bugzilla.mozilla.org/show_bug.cgi?id=1744289), dup of 1737820). | OS-version specific; current status of 1737820 **unverified**. |

`scrollsnapchange` / `scrollsnapchanging` events exist but are Chrome/Edge 129+ only; "Firefox and Safari do not currently support them" ([Chrome blog](https://developer.chrome.com/blog/scroll-snap-events); MDN marks the event "Limited availability" ([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollsnapchange_event)); the Safari 18.2 release post does not mention them ([WebKit](https://webkit.org/blog/16301/webkit-for-safari-18-2/))). Do not build "active section" on them — use `useInView`.

## 2. `position: sticky` inside a snap container

- Coexistence is documented: MDN's scroll-padding example is a `position: sticky; top: 0` heading **inside** a `scroll-snap-type: y mandatory` scroller, with `scroll-padding` reserving its height ([MDN basic concepts](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll_snap/Basic_concepts)). Neither the spec nor MDN mentions any sticky/snap conflict (spec text searched; no "sticky" occurrences).
- Snap positions come only from boxes with `scroll-snap-align` other than `none` ([spec](https://www.w3.org/TR/css-scroll-snap-1/#scroll-snap-align)). The pinned column has no `scroll-snap-align`, so it contributes no snap position; it cannot shift where sections land.
- Sticky is relative to the same scroller: a sticky element "sticks" to its nearest ancestor with a scrolling mechanism (`overflow` hidden/scroll/auto) ([MDN position](https://developer.mozilla.org/en-US/docs/Web/CSS/position)); the insets define a "sticky view rectangle" from the nearest scrollport, and the box moves only "while its position box remains contained within its containing block" ([css-position-3](https://www.w3.org/TR/css-position-3/#sticky-pos)).
- **The real gotcha is grid stretch, not snap**: a grid item stretches to the full grid height; a sticky box "as large as its containing block along a given axis cannot shift in that direction" ([css-position-3](https://www.w3.org/TR/css-position-3/#sticky-pos)). Give the pinned column `align-self: start` (Tailwind `self-start`) and a height of one snapport (`h-[100cqh]`). Its containing block is the grid container, which spans all sections, so it stays pinned for the whole presentation.
- An absolutely-positioned overlay driven from scroll position is **not** needed. If the pinned column must *change content* per section, derive that from the per-section `useInView` booleans (state), not from `scrollTop`. If it must *animate with* scroll, `useScroll({ container: scrollerRef })` + `useTransform` is the documented tool (§3).

## 3. `motion/react` v12 APIs (verified on motion.dev)

- **`useInView(ref, { root, margin, amount, once, initial })`** — `root`: "Set `root` to be the ref of a scrollable parent, and it'll use that element to be the viewport instead" (default: window). `amount`: `"some"` (default) | `"all"` | 0–1. `once`: stop observing after first entry. `initial`: value before measurement. `margin` "won't take affect within cross-origin iframes unless `root` is explicitly defined" ([docs](https://motion.dev/docs/react-use-in-view)). Every existing `useInView` call in this repo (landing/project-management) omits `root` because those pages scroll the window; inside the dashboard scroller `root` is mandatory or the observer measures against a viewport that never scrolls.
- **`whileInView` + `viewport={{ root, once, amount, margin }}`** on a `motion.*` element is the declarative equivalent, backed by an IntersectionObserver pool ([docs](https://motion.dev/docs/react-scroll-animations)).
- **`useScroll({ container, target, offset, axis })`** — `container`: "The scrollable container to track the scroll position of. By default, this is the browser viewport. By passing a ref to a scrollable element, that element can be used instead." `target` is "measured by layout position, ignoring CSS transforms." Returns `scrollY`, `scrollYProgress` (0–1) etc.; compose with `useTransform` and pass to `style` for GPU-accelerated scroll-linked effects; uses `ScrollTimeline` where available ([docs](https://motion.dev/docs/react-use-scroll)).
- **No snap helper exists.** `scroll()` / `useScroll` only *read* progress; the `scroll()` page has "no mention of scroll snapping, programmatic scrolling" ([docs](https://motion.dev/docs/scroll)). The hybrid `animate(0, 1, { onUpdate })` can drive `scrollTop` by hand ([upgrade guide](https://motion.dev/docs/upgrade-guide)) but is unnecessary here (see §Recommendation).
- **`<MotionConfig reducedMotion="user">`** — default is `"never"`; with `"user"`, "transform and layout animations will be disabled. Other animations, like opacity and backgroundColor, will persist" ([docs](https://motion.dev/docs/react-motion-config)). Currently only mounted in `coming-soon-state.tsx`; the presentation must mount its own.
- **`useReducedMotion()`** returns `true` "if the current device has Reduced Motion setting enabled"; docs show it gating parallax (`style={{ y: shouldReduceMotion ? 0 : y }}`) ([docs](https://motion.dev/docs/react-use-reduced-motion), [accessibility guide](https://motion.dev/docs/react-accessibility)). SSR initial value: **unverified** (not stated in docs).

## 4. Section height: `100%` vs `100cqh`

- Percentage height resolves "with respect to the height of the generated box's containing block. If the height of the containing block is not specified explicitly (i.e., it depends on content height), and this element is not absolutely positioned, the value computes to `auto`" ([MDN height](https://developer.mozilla.org/en-US/docs/Web/CSS/height); [CSS 2 §10.5](https://www.w3.org/TR/CSS22/visudet.html#the-height-property)). The containing block of a static element is "the content edge of the nearest ancestor box that is a block container" ([CSS 2 §10.1](https://www.w3.org/TR/CSS22/visudet.html#containing-block-details)) — so `100%` inside the scroller also excludes the scroller's own `py-6`.
- Flexbox makes the scroller definite: "if the flex container has a definite main size, a flex item's post-flexing main size is treated as definite" ([css-flexbox-1 §9.8](https://www.w3.org/TR/css-flexbox-1/#definite-sizes)). The chain here is definite: `html, body { height: 100% }` and `[data-slot='sidebar-wrapper'] { height: 100% }` (`globals.css`), `SidebarInset` `h-full` (`dashboard/layout.tsx`), `div.flex-1.min-h-0`, `MeetingFlowView` root `h-full flex-col`, scroller `min-h-0 flex-1`. `min-height: 0` is needed because the automatic minimum size of flex items otherwise prevents the scroller from shrinking below its content ([css-flexbox-1 §4.5](https://www.w3.org/TR/css-flexbox-1/#min-size-auto)). So `h-full` directly on scroller children *would* work today.
- **But** the sticky column requires a grid wrapper, and the sections then live in a grid item whose height is content-sized → `h-full` on a section computes to `auto`. Container units avoid the chain: `1cqh` = "1% of a query container's height", resolving against the nearest ancestor with `container-type: size`; the size features query "the query container's content box"; "If no eligible query container is available, then use the small viewport size for that axis" ([css-contain-3](https://www.w3.org/TR/css-contain-3/#container-lengths); [MDN length](https://developer.mozilla.org/en-US/docs/Web/CSS/length)). `container-type: size` "Applies layout containment, style containment, and size containment" ([css-contain-3](https://www.w3.org/TR/css-contain-3/#container-type)) — harmless for a scroller whose height comes from flex, not from its contents. Tailwind v4 ships `@container-size` for exactly this, with `h-[50cqb]`-style arbitrary values ([Tailwind](https://tailwindcss.com/docs/responsive-design)).
- Because `cqh` measures the **content box**, drop `py-6` from the snap scroller (pad inside each section) so `100cqh` equals the snapport and `snap-start` lands flush.

## 5. Transforms on snap children

The snap area "is determined by taking the **transformed** border box, finding its rectangular bounding box (axis-aligned in the scroll container's coordinate space), then adding the specified outsets" ([spec §snap area](https://www.w3.org/TR/css-scroll-snap-1/#scroll-snap-area)). A `translateY` entrance on the `<section>` that carries `scroll-snap-align` therefore moves its snap position while animating, and the re-snap rule (§1) makes the UA chase it. Rule: the element with `snap-start` is a static box; animate an inner `motion.div`. Motion's `useScroll` target measurement "ignoring CSS transforms" is consistent with this — it measures layout, not visuals ([docs](https://motion.dev/docs/react-use-scroll)).

## Recommendation

CSS snap + `useInView` with `root`. JS scrolling only for the Next/Prev/step-nav buttons, and even then via the native `scrollTo` (snap and `scroll-behavior` both apply to it, per §1). No wheel/touch interception, no `animate(scrollTop)`.

```tsx
'use client'
import { motion, MotionConfig, useInView } from 'motion/react'
import { useRef, type RefObject } from 'react'

export function SnapPresentation({ sections, aside }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  return (
    <MotionConfig reducedMotion="user">
      <div
        ref={scrollerRef}
        // relative → section.offsetTop is measured from this box; @container-size → 100cqh resolves here
        className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain snap-y snap-mandatory motion-safe:scroll-smooth @container-size"
      >
        <div className="grid grid-cols-1 gap-x-8 px-6 md:grid-cols-[18rem_1fr]">
          <aside className="hidden self-start md:sticky md:top-0 md:block md:h-[100cqh]">{aside}</aside>
          <div>
            {sections.map(s => <SnapSection key={s.id} root={scrollerRef} {...s} />)}
          </div>
        </div>
      </div>
    </MotionConfig>
  )
}

function SnapSection({ root, id, onActive, children }: SectionProps & { root: RefObject<HTMLDivElement | null> }) {
  const ref = useRef<HTMLElement>(null)
  const isInView = useInView(ref, { root, amount: 0.5 }) // once:false → re-reveals when scrolling back; also = "active section"
  return (
    // static box carries the snap alignment; nothing here is transformed
    <section ref={ref} id={id} className="flex min-h-[100cqh] snap-start snap-always flex-col justify-center py-10">
      <motion.div initial={false} animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }} transition={{ duration: 0.4 }}>
        {children}
      </motion.div>
    </section>
  )
}

// Next / Prev / step-nav: absolute scroll → snap-stop cannot trap it; behavior follows the CSS scroll-behavior
export function scrollToSection(scroller: HTMLElement, section: HTMLElement) {
  scroller.scrollTo({ top: section.offsetTop })
}
```

Tailwind mapping (all v4 docs): `snap-y` → `scroll-snap-type: y var(--tw-scroll-snap-strictness)`, `snap-mandatory` sets that variable ([scroll-snap-type](https://tailwindcss.com/docs/scroll-snap-type)); `snap-start` → `scroll-snap-align: start` ([scroll-snap-align](https://tailwindcss.com/docs/scroll-snap-align)); `snap-always` → `scroll-snap-stop: always` ([scroll-snap-stop](https://tailwindcss.com/docs/scroll-snap-stop)); `scroll-smooth` → `scroll-behavior: smooth` ([scroll-behavior](https://tailwindcss.com/docs/scroll-behavior)); `motion-safe:` → `@media (prefers-reduced-motion: no-preference)` ([variants](https://tailwindcss.com/docs/hover-focus-and-other-states)); `scroll-pt-*` → `scroll-padding-top` if an in-scroller overlay ever appears ([scroll-padding](https://tailwindcss.com/docs/scroll-padding)); `@container-size` → `container-type: size` ([responsive design](https://tailwindcss.com/docs/responsive-design)). `overscroll-contain` → `overscroll-behavior: contain`: "no scroll chaining occurs on neighboring scrolling areas" while the local bounce remains ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/overscroll-behavior)) — stops an iOS over-swipe at the last section from dragging the app shell.

Reduced motion is handled at three points: `MotionConfig reducedMotion="user"` turns the `y` reveal into opacity-only; `motion-safe:scroll-smooth` makes `scrollTo()` instant under `prefers-reduced-motion: reduce` (the media feature's documented intent: "removes, reduces, or replaces motion-based animations" — [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)); user wheel/touch scrolling is never animated by us.

**When would JS-driven scrolling be justified?** Only if a product requirement contradicts what CSS snap can express — e.g. a section intentionally taller than the snapport that must still page cleanly, or a "hold to free-scroll" override (an open CSSWG request, [csswg-drafts #7530](https://github.com/w3c/csswg-drafts/issues/7530)). Neither applies to the meeting-flow presentation. If it ever does, keep CSS snap for user input and use `scroller.scrollTo({ top })` for the programmatic case; do not reimplement wheel handling.

**Implementation notes (not research):** the shared step scroller in `meeting-flow.tsx` has `py-6`; the presentation step should either own its scroller (as sketched) or the shared one must drop vertical padding for that step. Every existing `useInView` call in the repo omits `root` — fine on window-scrolled pages, wrong inside the dashboard shell.

## Unverified

- Chromium issue 340895249 (trackpad snap behaviour) — page behind sign-in.
- Current status of Firefox bug 1737820 (macOS Monterey momentum) and Fx 1959811 (UNCONFIRMED).
- `useReducedMotion` SSR initial value — not stated in Motion docs.
- `Element.scrollTo` `behavior: 'auto'` following CSS `scroll-behavior` — verified for `scrollIntoView` on MDN; `scrollTo` shares the CSSOM View `ScrollOptions` dictionary but its MDN page was not fetched.

## Sources

- CSS Scroll Snap Module Level 1 (W3C TR): https://www.w3.org/TR/css-scroll-snap-1/ · Editor's Draft: https://drafts.csswg.org/css-scroll-snap-1/
- CSS Flexible Box Layout §9.8, §4.5: https://www.w3.org/TR/css-flexbox-1/#definite-sizes
- CSS Containment Level 3 (container units, container-type): https://www.w3.org/TR/css-contain-3/#container-lengths
- CSS Positioned Layout Level 3 (sticky): https://www.w3.org/TR/css-position-3/#sticky-pos
- CSS 2 §10.1 / §10.5: https://www.w3.org/TR/CSS22/visudet.html#containing-block-details
- MDN: scroll-snap-type · scroll-snap-stop · scroll-behavior · position · height · length · overscroll-behavior · prefers-reduced-motion · CSS scroll snap basic concepts · Using scroll snap events · Element.scrollIntoView · scrollsnapchange event (all under https://developer.mozilla.org/en-US/docs/Web/)
- Motion docs: https://motion.dev/docs/react-use-in-view · https://motion.dev/docs/react-use-scroll · https://motion.dev/docs/react-scroll-animations · https://motion.dev/docs/scroll · https://motion.dev/docs/react-motion-config · https://motion.dev/docs/react-use-reduced-motion · https://motion.dev/docs/react-accessibility · https://motion.dev/docs/upgrade-guide
- Tailwind v4 docs: scroll-snap-type · scroll-snap-align · scroll-snap-stop · scroll-behavior · scroll-padding · responsive-design (container queries) · hover-focus-and-other-states (motion-safe)
- Chrome: https://web.dev/articles/css-scroll-snap · https://developer.chrome.com/blog/scroll-snap-events · https://groups.google.com/a/chromium.org/g/blink-dev/c/bkUwigYHJDM/m/Bzvm8tkHAgAJ
- WebKit bugs: https://bugs.webkit.org/show_bug.cgi?id=243582 · https://bugs.webkit.org/show_bug.cgi?id=245722 · https://bugs.webkit.org/show_bug.cgi?id=238497 · https://bugs.webkit.org/show_bug.cgi?id=173887 · https://webkit.org/blog/16301/webkit-for-safari-18-2/
- Mozilla bugs: https://bugzilla.mozilla.org/show_bug.cgi?id=1753188 · https://bugzilla.mozilla.org/show_bug.cgi?id=1959811 · https://bugzilla.mozilla.org/show_bug.cgi?id=1744289
- CSSWG issue: https://github.com/w3c/csswg-drafts/issues/7530
