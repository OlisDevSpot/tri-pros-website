# Who We Are: the proof column for points 1, 4 and 6

Status: draft for owner approval. Exploration run 2026-09-23 (`/ui-exploration`). Studies page: https://claude.ai/artifact/7oZkzCGhDS2FVo8NpMycA6 (version 2 is what this spec describes).

## 1. Goal

The owner's words: the six points "should feel much more structured & aesthetic … the right side in many sections should be more powerful, and more effective in conveying its importance/structure." This round covers Proper licensing (1), Communication (4) and Proof of performance (6). The heading column does not change.

In the room, the agent needs one thing to point at on every point. The homeowner needs to see the same kind of proof on every point, so that "this company checks every box" is something they see rather than something they're told.

## 2. Decisions already made (do not re-litigate)

| # | Decision | Source |
|---|---|---|
| D1 | Direction **C, Centrepiece + rail**: one large artefact fills the media row, with a rail of exactly three proof tiles under it. | Owner pick, studies page |
| D2 | Proof of performance quotes are **real portfolio homeowner quotes** from the existing `showroomDisplay.getAll` read. | Owner, Phase 1 |
| D3 | The reputation marks (Google, Yelp, BBB, Family-owned) **move from Licensing to Proof of performance**. | Owner, Phase 1 |
| D4 | Workers' comp, professional liability and the license classification are **excluded** because the constants disagree with the certificate and the license. No follow-up. | Owner, Phase 2 |
| D5 | The agent's business card is **centred on the timeline**. | Owner correction on the mock |
| D6 | The copy shown in study C (rail eyebrows, tile kickers, timeline stages and captions) is approved as shown. | Owner, "Looks good" on version 2 |
| D7 | The device scene is a laptop, and a tablet in both orientations, touch and trackpad. | Spec 2026-09-12 §2, still binding |
| D8 | A rail is exactly three tiles. The type enforces it. | Studies page risk note, adopted here |
| D9 | Quotes never auto-advance. The agent switches them. | Presentation in a room: movement the agent didn't start pulls attention |
| D10 | The before/after uses the installed `react-compare-slider` (4.0.0-2) with its default touch handling. | §4.6 |

## 3. Content

Every value comes from a constant or the API. New copy is marked **new (D6)**.

### Point 1: Proper licensing and permits (`kind: 'credentials'`)
- **Centrepiece:** the license and the certificate of insurance, as rendered today (`CredentialDocuments`, R2 `tpr-license.jpg` and `tpr-coi-2026.jpg`), with the "Tap to view" cue.
- **Rail eyebrow:** "What protects you" (new, D6).
- **Tile 1:** kicker "License" (new), `ShieldCheck` icon; value `#${licenses[0].licenseNumber}`; label "CA contractor license" (existing copy). Opens the license **at the license number**, focus `{ x: 0.29, y: 0.35 }`.
- **Tile 2:** kicker "Insurance" (new), `FileText` icon; value from the existing `liabilityCoverage` derivation of `insurances.ts` ($2M); label "Insurance per project" (existing). Opens the certificate **at the aggregate limit and the per-project box**, focus `{ x: 0.62, y: 0.45 }`. The certificate confirms it: $2,000,000 general aggregate, with the aggregate limit applying per project.
- **Tile 3:** kicker "Bond" (new), `BadgeCheck` icon; value "Bonded"; label "Most contractors aren't" (existing copy). Not a button.
- **Removed from this slide:** the three protection figures (they become the rail) and the reputation list (D3).

### Point 4: Communication (`kind: 'agent'`)
- **Centrepiece:** the `AgentCard` (unchanged component, meeting owner via props), centred (D5), over a four-stage timeline labelled "From today to the final walkthrough":

| Stage (`when`) | Caption | Source |
|---|---|---|
| Today | `You meet ${firstName}` | new (D6) |
| Before work starts | Walk the job together | new (D6); replaces commitment 3 |
| During the job | `${firstName} keeps you posted` | new (D6) |
| Final walkthrough | `Still ${firstName}` | new (D6); from the subheading "from today to the final walkthrough" |

  `firstName` is the first word of the meeting owner's name (the same rule as `partnerFirstName` in the constants). The first stage's dot is filled ("you are here").
- **Rail eyebrow:** "What you can count on" (new).
- **Tiles:** "Contact" / `due-diligence.ts` communication `stat` ("1") / "Dedicated contact, start to finish" (new label). "Replies" / "Same day" / "Calls and texts answered" (from commitment 1). "Updates" / "Weekly" / "Progress update with photos" (from commitment 2). Icons `User`, `Clock`, `Camera`.
- The `commitments` array retires; its three lines are carried by stage 2 and tiles 2 and 3.

### Point 6: Proof of performance (new `kind: 'performance'`)
- **Centrepiece:** drag-to-compare before/after of the existing stand-in pair (`IMAGES.bathroomBefore` and `bathroomAfter`, 1280×714), "Before" and "After" tags.
- **Rail eyebrow:** "The record" (new). Tiles: "Projects" / `performance.stat` ("520+") / `performance.statLabel` ("Projects completed"). "Delivered" / `companyInfo.valueOfProjectsInDollars` as compact USD ("$9M") / "In projects delivered" (new). "Satisfaction" / `companyInfo.clientSatisfaction` as a percentage ("98%") / "Client satisfaction". Icons `Home`, `FileText`, `Heart`.
- **Reputation line** (moved, D3), in this order: Google `4.9 ★ · 212 reviews`, Yelp `4.9 ★ · 49 reviews`, `A+ BBB rating`, `Family-owned · 2 generations`. Same `ReputationMark` data and component, laid out as a wrapping row.
- **Homeowner quote:** up to three, from `useHomeownerQuotes` (§5). Shows the project's hero image thumbnail, the quote, and the caption `${shortName} · ${city} · ${trade}`, where `shortName` is the first name plus last initial ("Sarah T."). Pager dots when there's more than one.

## 4. Architecture

### 4.1 Types (`src/features/meeting-flow/types/index.ts`)
- `ProofTile { kicker: string; icon: LucideIcon; value: string; label: string; opens?: { document: number; focus: { x: number; y: number } } }`. `opens.document` indexes the slide's `documents`, and `focus` is a fraction of the scan.
- `ProofRail { eyebrow: string; tiles: readonly [ProofTile, ProofTile, ProofTile] }`. The tuple is the three-tile rule (D8).
- `TimelineStage { when: string; caption: (firstName: string) => string }`.
- `HomeownerQuote { id: string; text: string; shortName: string | null; city: string; trade: string | null; image: string }`.
- `WhoWeAreContent` arms:
  - `credentials`: `{ documents, rail, openLabel }`. `protection` and `reputation` are removed.
  - `agent`: `{ cardRole, timeline: TimelineStage[], rail }`. `commitments` is removed.
  - `performance` (new): `{ media: BeforeAfterMedia, rail, reputation: ReputationMark[] }`.
  - `point`: `{ proof }`. `media?` is removed, since supervision is the only `point` left.

### 4.2 Components (feature-local, `ui/components/steps/who-we-are/`)
- `ProofRail`: the eyebrow plus a `<ul>` of three `ProofTile`s. A hairline sits on top of the row, and the tiles are separated by hairlines, not boxed as cards.
- `ProofTile`: the kicker (icon and text in `--presentation-accent`), the value (`text-presentation-figure`, Syne 700, tabular numerals) and the label (`text-presentation-label`, white/62). With `onOpen`, it's a `<button>` with a zoom glyph in the kicker row and an accent top rule on hover and focus-visible.
- `ContactTimeline`: an `<ol>` of stages with a connecting line. The line draws (`scaleX`, or `scaleY` when vertical) as a `motion` element driven by `useSlideInView()`.
- `BeforeAfterCompare`: `ReactCompareSlider` with `next/image` items (`fill`, `object-cover`). The default handle is restyled through `buttonStyle` to a solid white knob with no backdrop blur (the Scrim-Not-Blur rule). "Before" and "After" tags as in `BeforeAfterPair` today.
- `HomeownerQuote`: `figure`, `blockquote` and `figcaption`, with an accent opening quote mark. The pager is buttons with `aria-pressed` and 44px targets, and it doesn't render for a single quote.
- `PerformanceSection`: the new `performance` kind.
- `GrowthLayout`: the growth-slide wrapper (§4.4). `ComparisonSection` moves onto it, so its class string lives in one place.
- Changed:
  - `CredentialsSection` owns the open-document state `{ document, focus } | null`, so the documents and the rail tiles open one dialog.
  - `CredentialDocuments` takes an `onOpen` and no longer owns the dialog.
  - `AgentSection` renders the card, timeline and rail.
  - `PointSection` loses the media branch.
  - `DocumentDialog` takes an optional `focus`: it opens scaled to 2.4× at the focus point, a tap toggles zoom, and a visible Zoom in/out button (44px) mirrors it. The `// LAZY:` header stays.
  - The `index.tsx` switch gains `case 'performance'`.

### 4.3 Data flow
The step stays constant-driven. The only new read is the quotes, which `PerformanceSection` takes from `useHomeownerQuotes()`. The agent still arrives as a prop from the view. The timeline gets `firstName` from `agent.name`.

### 4.4 Layout and responsive behaviour
- **Licensing stays a fixed-canvas slide on `PointLayout`.** The documents fill the `1fr` media row and the rail is the `auto` copy row. That fills the row that was left empty today, which was the root cause of the gaps: the row was sized for a centrepiece that Communication and Performance didn't have.
- **Communication and Performance are growth slides**, like the comparison slides (C42): content in flow, a minimum of one screen (`min-h-[calc(100cqh-var(--band-h,0px))]`), centred vertically when shorter. Measured reason: at 1024×768 the heading is a band and a slide is 504px tall, but the timeline, card and rail need about 430px after the capsule clearance, and Performance needs about 800px. On 1440×900 and 820×1180 both fit one screen (verified in §7).
- The compare's width is `min(100%, calc(42cqh * 1280 / 714))`, centred, at its true aspect ratio, so it never dominates a tall stage.
- **The timeline turns vertical below a 40rem presentation container** (`@max-[40rem]/presentation:`): 564px tablet portrait and phone go vertical, and 720px and up stay horizontal. In vertical mode the card and the timeline column are both centred (D5).
- **The rail stacks to one column below a 30rem container** (phone only; not a target, but it must not break). Each tile becomes a row, and no value clips.
- Container units and queries use the named `presentation` container (spec C §11). No new `lg:` breakpoints.

### 4.5 Motion and reduced motion
- Reveal orders:
  - Licensing: documents 0, rail 1.
  - Communication: card 0, timeline 1, rail 2.
  - Performance: compare 0, rail and reputation 1, quote 2.
- The tiles inside a rail aren't staggered individually.
- The timeline line draws over 1.1s on `BRAND_EASE`, after a 0.25s delay, when the slide is in view.
- Reduced motion comes from the presentation's existing `MotionConfig reducedMotion="user"` (C46). Transforms are skipped, so the line appears already drawn and the reveals become fades. There's no new gate.
- Switching quotes is instant, with no crossfade.

### 4.6 The compare slider inside the snap scroller
Checked against the installed source: the root sets `touchAction: 'pan-y'`, so a vertical swipe on the photo scrolls the deck and a horizontal drag moves the divider. The handle is `role="slider"`, `tabIndex=0`, and takes arrow keys at 5% a step. Keep `onlyHandleDraggable` false: a tap on the photo jumps the divider, which is harmless and faster for the agent. Items carry `transform: translateZ(0)`; that sits on inner elements, never the `<section>`, so the snap-area rule holds.

### 4.7 Accessibility
- Tiles that open a document are buttons named for what they open, e.g. "License number 1076760, open the license at the number".
- The timeline is an `<ol>` with an `aria-label`.
- The quote pager buttons are named "Quote n of m".
- Every touch target is at least 44px: pager dots, the dialog's zoom button and the compare handle (56px by default).

## 5. Data access

**Reads used as-is:**
- `projectsRouter.showroomDisplay.getAll`, already fired when the meeting opens: `TradeSelectionProvider` → `useShowcaseProjects` (same `queryOptions`, same `SHOWCASE_PROJECTS_STALE_MS`), so the quote hook reads the cache. Fields used: `project.id`, `project.homeownerQuote`, `project.homeownerName`, `project.city`, `heroImage.url`, `scopeIds`.
- `useConstructionCatalog()` (`scopesByTrade`, `tradesById`) for the trade label; `useTradeSelections()` for ordering.
- The meeting owner (`toPresentationAgent`) is unchanged.

**Writes:** none.

**Required changes the user runs first:** none (no DAL, tRPC, schema or seed change).

**UI adaptations at the edge** (`src/features/meeting-flow/lib/pick-homeowner-quotes.ts`):
- Keep rows with a hero image and a trimmed quote of 1–240 characters. The cap keeps a quote within four lines on the tablet with no clamping.
- Strip wrapping quote marks: some rows store `"…"`.
- Order projects that match the meeting's selected trades first (most matching scopes), then portfolio order. Take 3.
- `shortName`: first word plus last initial, or `null` when there's no name (the caption then starts at the city).
- `trade`: the trade with the most scope hits via the catalog, or `null`.

`useHomeownerQuotes()` (`src/features/meeting-flow/hooks/`) composes the query, catalog and selections with the picker, and returns `[]` while loading or on error.

The public showroom procedure already returns full project rows (tracker S1). This work reads the same response and doesn't widen that exposure. It's noted, not fixed here.

**Precondition (the owner's shared tree):** the docs-prune edits are still uncommitted in four files this build changes: `constants/who-we-are-slides.ts`, `types/index.ts`, `steps/who-we-are/index.tsx`, `steps/who-we-are/document-dialog.tsx`. Each hunk only removes a doc citation from a comment. Commit them first, or the build's pathspec commits will carry them.

## 6. Error handling and edge cases
- **No quotes** (loading, error, or none pass the filter): the quote block doesn't render. The slide is complete without it, and nothing is reserved for it.
- **One quote:** no pager.
- **The quotes arrive while the agent is on slide 6** (unlikely, since the read fires when the meeting opens): the growth layout re-centres. That's acceptable, with no skeleton.
- **No agent phone:** the card drops the line, as today. The timeline and rail don't depend on it.
- **A replaced document scan:** the `focus` fractions refer to the current scan. The constant carries a one-line trap comment saying so.
- **A long agent first name:** the captions wrap (`text-balance`) and never clip.

## 7. Verification
The plan runs the recipe in `docs/how-to/ui-exploration.md` Phase 7 with the tools in `.superpowers/sdd/2026-09-22-presentation-config-and-critique/tools/` (fresh CSS injected, because the dev server compiles CSS only at boot).
- **Viewports:** 1440×900, 1024×768, 820×1180, 390×844, plus present mode (sidebar collapsed) at 1440×900. The palette is fixed dark, so one scheme is enough, with a light-scheme spot check at 1440.
- **Measured per slide, per viewport:**
  - The rail's bottom sits at or above the capsule's top minus 8px.
  - The centrepiece and the rail don't overlap.
  - The card's centre x is within 1px of the timeline's centre x (D5).
  - The timeline is horizontal at 1136 and 720 stage widths and vertical at 564 and 390.
  - No text is clipped (`scrollWidth <= clientWidth` on tile values and captions).
  - Communication and Performance are exactly one screen at 1440×900 and 820×1180.
- **Behaviour:**
  - A licensing tile opens the dialog zoomed, and the zoom toggles.
  - A touch-emulated vertical drag on the compare changes `scrollTop` and snaps to the next slide.
  - A horizontal drag changes the divider.
  - Arrow keys on the handle move it.
  - The quote pager switches quotes.
  - A tRPC response intercepted to `[]` hides the quote block.
  - With reduced motion emulated, the timeline line is drawn at rest.
- `pnpm tsc`, `pnpm lint`. Never `pnpm build`.

## 8. Files

**Create** (`src/features/meeting-flow/`):
- `ui/components/steps/who-we-are/proof-rail.tsx`
- `ui/components/steps/who-we-are/proof-tile.tsx`
- `ui/components/steps/who-we-are/contact-timeline.tsx`
- `ui/components/steps/who-we-are/before-after-compare.tsx`
- `ui/components/steps/who-we-are/homeowner-quote.tsx`
- `ui/components/steps/who-we-are/performance-section.tsx`
- `ui/components/steps/who-we-are/growth-layout.tsx`
- `hooks/use-homeowner-quotes.ts`
- `lib/pick-homeowner-quotes.ts`

**Modify:**
- `types/index.ts`
- `constants/who-we-are-slides.ts`
- `ui/components/steps/who-we-are/index.tsx`
- `ui/components/steps/who-we-are/credentials-section.tsx`
- `ui/components/steps/who-we-are/credential-documents.tsx`
- `ui/components/steps/who-we-are/document-dialog.tsx`
- `ui/components/steps/who-we-are/agent-section.tsx`
- `ui/components/steps/who-we-are/point-section.tsx`
- `ui/components/steps/who-we-are/comparison-section.tsx` (onto `GrowthLayout`)

**Delete:** `ui/components/steps/who-we-are/before-after-pair.tsx` (its only consumer was the `point` media branch).

**Unchanged and still used:** `check-list.tsx` (team slide), `proof-figure.tsx` (scope, supervision and team slides), `reputation-mark.tsx` (now on Performance).

**Off limits:** DAL, `src/trpc/`, schema, seeds, entity services, and `src/shared/components/presentation/` (no engine change is needed).

## 9. Out of scope and follow-ups
- **Out of scope:** the heading column; points 2, 3 and 5; the comparison slides' content; the hook and closing; spec C's remaining Tasks 9 and 10 (no file overlap).
- **Candidate next round:** the rail on points 2, 3 and 5 (the owner's "many sections"). The primitive is built for it.
- Permits have no fact to show (no constant), so point 1's title stays half-proven until one exists.
- The before/after is still the funnel stand-in. Real project pairs (`beforeAfterPairsJSON`) are empty in the dev data.
