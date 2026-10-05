# Who We Are proof column: follow-ups

Shipped on `main`, `1982022d..f9a1df3b`: Licensing, Communication and Performance rebuilt on study C, "Centrepiece + rail". The owner's hands-on round (`c05f6fc1`) removed the homeowner quote, put Performance on one screen and linked the Google, Yelp and BBB ratings. Round 2 (`f9a1df3b`) turned the ratings into buttons and moved family ownership into the record as a fourth tile. Spec: `docs/superpowers/specs/2026-09-23-who-we-are-proof-column-design.md`. Each item below is written for a grilling session. It says what the issue is, why it matters, and the ideal solution. There's no code here.

## Issues

### 1. Grown slides lock after one wheel notch at phone width

**What:** below about 400px wide, a slide taller than the screen stops scrolling after one wheel notch. The comparison slide does it today, and any growth slide can: comparison, extras and communication. Whether it bites depends on how far the content sits below the fold. The cause is in the presentation engine: every section has `scroll-snap-stop: always` with `scroll-snap-type: y mandatory`, so the scroller snaps back to the section start instead of scrolling within it.

**Why it matters:** phones aren't a target for the meeting, so nobody hits this today. But the growth-slide design depends on "content past the first screen is reached by scrolling". Whoever opens a deck on a phone will find content they can't reach.

**Ideal:** the engine treats a grown section differently. Either it snaps only to the start of sections that fit one screen, or it drops `snap-stop: always` on sections taller than the scroller. That needs its own small design pass on the engine, which this work wasn't allowed to touch.

### 2. `cn()` drops the presentation text sizes

**What:** `cn()` runs `tailwind-merge`, which doesn't know the custom `text-presentation-{display,title,figure,lead,body,label}` sizes. It reads them as a text colour, so when a real colour class sits beside one, it removes the size. `placeholder-slot.tsx` passes `text-presentation-label text-white/55` through `cn()` and very likely renders at the default size today.

**Why it matters:** the bug is silent. There's no lint or type error, the size just disappears, and it will recur in every presentation component that combines a size and a colour in `cn()`.

**Ideal:** register the presentation size scale as a font-size group through `extendTailwindMerge` in `src/shared/lib/utils.ts`. Then confirm the placeholder slot's label size.

### 3. Communication fits a portrait tablet with no headroom

**What:** at 820×1180, Communication measures 792.39px against a 792.4px budget. The dev agent has no years of experience and a short name. A fully filled card, or a name that wraps, adds about 30px.

**Why it matters:** it's a growth slide, so it scrolls a few pixels instead of clipping. But the spec says "one screen on the tablet".

**Ideal:** check with a real, fully filled agent profile. If it overflows, the next lever is the vertical timeline's entry spacing or the card's inner padding, not the rail.

### 4. The agent card breaks the email mid-word at phone width

**What:** at 390px the card wraps `sean@triprosremodeling.com` inside the word. `AgentCard` was out of scope and is unchanged.

**Ideal:** let the email shrink its size before it wraps, or break only at the `@`.

### 5. The document focus points are fractions of the current scans

**What:** the License and Insurance tiles open their document zoomed at a stored point (`x`, `y` as fractions of the image). A comment in `who-we-are-slides.ts` marks the trap.

**Why it matters:** replace a scan and the zoom lands on the wrong line.

**Ideal:** keep the points next to the document records, or re-measure them whenever a document changes.

### 6. The before/after pair is still a stand-in

**What:** the compare uses the existing stand-in pair (spec §9).

**Ideal:** a real Tri Pros project, shot from the same position before and after, at the compare's aspect ratio.

### 7. The compare is hidden at phone width

**What:** below a 30rem presentation (phones), Performance shows only the record and the review buttons. Four record rows plus the buttons leave the compare no height, so it's hidden rather than squeezed to a strip.

**Why it matters:** phones aren't a target for the meeting. But the slide's centrepiece is missing there.

**Ideal:** a 2×2 record at phone width, which needs ProofTile to know it's in a two-column rail. That would give the compare about 150px back.

## Decisions the build made for you

- **The record's figures always round down** ("$9M", "98%"). A sales figure never rounds up.
- **On a phone-width rail, each tile is one row:** the label on the left, the figure on the right. That's how the spec's "each tile becomes a row" was built.
- **When the timeline turns vertical** (portrait tablet and phone), the card sits right on the timeline with a tight gap, and the rail keeps the group gap. That's what fits one screen at 820×1180.
- **In the Who We Are code, the timeline's items are called "entries",** because "stage" is the shell's word. The type keeps its spec name, `TimelineStage`.
- **Tapping the compare knob hands ↑/↓ back to the deck.** Arrow keys move the divider only after tabbing to it.
- **The compare keeps the photo's proportion at full column width,** and it centres with the record as one group (`PointLayout mediaHeight="own"`). It crops top and bottom only when the screen is too short for it.
- **The review ratings are three equal buttons.** Each has the platform's mark on a white chip, the rating with a star or BBB's grade, the review count and an out-link arrow. BBB has no mark in any icon set, so its chip shows the "BBB" wordmark, as the funnel trust badges do. The BBB seal is reserved for accredited businesses, so it isn't used.
- **The record has four tiles on Performance:** Projects, Delivered, Ownership ("2 / Generations, family‑owned"), Satisfaction. `ProofRail` allows three or four. The hyphen in "family-owned" is non-breaking, so a narrow tile never splits it.
- **Review links open in a new tab,** so the meeting stays where it was. Google opens the existing search URL. You chose that over the profile's reviews link, which you can swap in at `reviews.ts`.
