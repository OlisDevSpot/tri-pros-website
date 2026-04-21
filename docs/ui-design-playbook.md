# UI Design Playbook

> How we design UI at Tri Pros. The process that produced the participants modal
> redesign (PR #119) and the lead sources admin page (PR #122) in one shot —
> documented so it's repeatable, not accidental.

**Read this before any non-trivial UI work.** The memory pointer is
`memory/feedback-ui-work-methodology.md`; this doc is the canonical long form.

---

## Why this playbook exists

LLM-generated UI converges on a predictable failure mode: **generic admin
template**. Primary color everywhere, nested cards, uppercase-tracked labels
per row, full-width primary hover, centered modal with centered content,
placeholder-only search, destructive-color-on-hover. Every trait individually
looks "polished" in isolation; stacked, they read unambiguously as AI slop.

This playbook prevents that. It forces two kinds of thinking before code:

1. **User-flow reasoning** — who's here, why, what they need at this exact
   moment, and which of those needs deserves the primary focal point.
2. **Audit from three independent lenses** — UX rules, web interface
   guidelines, and aesthetic distinctiveness — before any layout decision is
   locked in.

The result is interfaces that feel designed *for this specific use case*
rather than assembled from shadcn defaults.

---

## The three-phase process

Every non-trivial UI task goes through these phases, in order. Skipping a
phase produces the exact slop this document exists to prevent.

### Phase 1 — User-flow brainstorming

Answer these six questions explicitly, in writing, before proposing any
layout. Ask the human any you can't answer from code + context. Do **not**
skip to layout because "the answer seems obvious."

1. **Who uses this?** Role, seniority, permissions, frequency of visits. A
   super-admin on a daily page earns different affordances than an agent on a
   monthly one.
2. **What is the scenario's context?** When does the user open this surface?
   What happened just before? What's their mental state — focused, in a hurry,
   investigating, recovering from an error?
3. **What exactly are they trying to achieve right now?** Map 3–5 concrete
   scenarios. Format each as a sentence: *"I just X, now I need to Y."* Not
   categories ("view performance") — sentences ("the telemarketer asked for
   the Home Depot intake URL and I need to copy it in under 10 seconds").
4. **Which scenario is most probable?** If A fires 50× a week and B fires
   once a month, A drives the layout. The less-frequent scenarios get second-
   class real estate.
5. **What makes their life easier?** Quick actions on cards, pre-filled
   defaults, copy-to-clipboard affordances, keyboard shortcuts, URL-driven
   state, optimistic updates, action history. Pick the 2–3 that matter for
   the winning scenario.
6. **Where does the eye land first?** This answers where the single primary-
   color moment lives and what's above the fold. Only one thing can be the
   focal point; the rest is secondary.

**Output of phase 1:** a scenario-mapped rationale. Every later layout
decision must cite which scenario it serves.

### Phase 2 — Three-skill audit

Run each skill in order against the proposed design (or the existing UI if
auditing). Do not run in parallel — each builds on the last.

1. **`ui-ux-pro-max`** — checks against the priority matrix: accessibility →
   touch → performance → style → layout → typography → animation → forms →
   navigation → charts. Produces a ranked violations list tied to rule IDs
   (`primary-action`, `state-clarity`, `elevation-consistent`, etc.).
2. **`web-design-guidelines`** (Vercel) — independent checklist. Catches the
   things the first pass misses: `aria-live`, curly quotes, non-breaking
   spaces, `overscroll-behavior`, `spellCheck={false}`, `autoComplete="off"`,
   headings hierarchy (`<h3>` not `<div>`), placeholder example patterns.
3. **`impeccable`** — aesthetic quality and AI-slop detection. Tests whether
   someone would say "AI made this" on sight. Commits to a distinctive
   direction: refined operational / maximalist / brutal minimal / etc. Names
   the one decision someone will remember.

**Output of phase 2:** an implementation-ready punch list. Each item
references which audit produced it so trade-offs are legible.

### Phase 3 — Implement + self-audit

Write code using the punch list. Before committing:

- `pnpm tsc --noEmit` clean
- `pnpm lint` clean (modulo pre-existing warnings on unrelated files)
- Re-read the punch list; anything skipped must be justified inline or
  converted to a follow-up issue
- Verify the "one primary-color moment" at rest. Count the uses on the
  visible surface. If more than 1–3, go back
- Verify no banned patterns: side-stripe borders >1px, gradient text, nested
  cards, hero-metric layout template, placeholder-only forms

**Output of phase 3:** a commit + PR that cites both the user-flow rationale
and the specific audit findings addressed.

---

## Hard rules — not negotiable

Violating these triggers redesign, not tweaking:

| Rule | Why | Failure signal |
|------|-----|----------------|
| **One primary-color moment at rest** | 60-30-10 rule — primary is the 10%. Overuse kills hierarchy. | Same brand hue on label + button + hover + focus + badge |
| **Flat surfaces inside contained surfaces** | Nested cards are the #1 AI admin tell. | Modal → muted-bg section → card row stack |
| **Destructive color visible before hover** | Mobile has no hover. Users shouldn't discover "X is destructive" by accident. | `text-muted hover:text-destructive` on a delete icon |
| **Touch targets ≥ 44pt (36px only visual)** | iOS HIG + Material. Mis-taps on 36px buttons are measurable. | Icon button at `size-9` without expanded hit area |
| **Uppercase-tracked labels: one per section, max** | Decorative treatment loses meaning when repeated. | OWNER label, section label, button label all in tracking-wide |
| **Placeholder never replaces a label** | Accessibility + pattern example. | `<CommandInput placeholder="Search…" />` with nothing else |
| **Semantic color tokens, not raw Tailwind colors** | Theme switch + brand evolution. | `text-teal-700 dark:text-teal-400` hardcoded |
| **Every number is `tabular-nums`** | Prevents layout shift as values change. | Stat numbers without `tabular-nums` |
| **All transitions gated behind `motion-safe:*`** | Reduced-motion respect. | Raw `transition-colors` without prefix |

---

## Banned patterns

Match-and-refuse. If you're about to write any of these, rewrite the
element structure entirely.

- **Side-stripe borders** — `border-left:` or `border-right:` > 1px with
  brand color. Includes `var(--primary)` and "accent" variables. Rewrite
  with full borders, bg tints, or no visual indicator.
- **Gradient text** — `background-clip: text` + gradient fill. Use solid
  color and emphasize with weight.
- **Hero-metric layout** — big number + small label + supporting stats +
  gradient accent. Use a compact horizontal strip instead.
- **Nested cards** — card wrapping another card wrapping another. Flatten
  with spacing + hairline borders.
- **Full-row primary hover** on list items. Use `bg-muted/60` neutral.
- **Sparklines as decoration** — tiny charts that convey nothing. If you'd
  add one "for polish," delete it.
- **Centered-title-+-centered-X-+-centered-content dialog** — the generic
  template. Left-align content inside modals unless there's a reason.
- **Emoji as structural icons** — use `lucide-react` SVG.
- **`window.confirm` / `window.alert`** — use `useConfirm` from
  `@/shared/hooks/use-confirm`.

---

## Case study — Lead Sources admin page (PR #122)

This was a greenfield page built in one commit that shipped clean. Here's
exactly what happened and why, as a template.

### Phase 1 — user-flow brainstorming (actual execution)

**Who:** super-admin, visits occasionally but with intent (monthly for
configuration; weekly for performance check).

**Scenarios mapped:**

| # | Scenario | Frequency | What they need |
|---|----------|-----------|----------------|
| A | "Telemarketer asks for the Home Depot intake URL" | high | Find source → copy → close |
| B | "New campaign launched — register it" | medium | Create source → get URL |
| **C** | **"Which source brought most leads this month?"** | **medium/weekly — PRIMARY** | Compare stats across sources |
| D | "Deactivate a source" | low | Toggle active |
| E | "Which customers came from source X?" | ad-hoc | Source → customer list |
| F | "Require email on Angi form now" | rare tuning | Edit formConfigJSON |

**Initial primary guess (A — copy URL)** was **overridden by the user** who
clarified: "lead sources don't update frequently; performance tracking is
the main purpose — hence the 3× width on the right column." This reshaped
every subsequent decision.

**Lesson:** the user-flow conversation is not a rubber-stamp. The first
scenario ranking is frequently wrong and the whole layout shifts when it
gets corrected. Ask even when you think you know.

**Focal-point decision:** the left card is a picker; the right pane is the
analytics surface. Eye lands on → selected card (persistent nav) → stats
strip at the top of the right pane (answers "how is this source doing?").
The single primary-color moment lives on the selected card's background
tint.

### Phase 2 — three-skill audit (outputs)

**ui-ux-pro-max lens:**
- Pattern: split-pane list + detail (CRM/admin canon)
- Style: refined operational (continuity with participants modal)
- Color: brand-tinted neutrals; primary as 10%, used for selection + small
  semantic callouts
- Typography: functional sans; `tabular-nums` on every count

**web-design-guidelines (Vercel) lens:**
- `aria-label` on every icon-only button ✓
- `role="tablist"` + `role="tab"` + `aria-selected` on time-range chips ✓
- `autoComplete="off"` + `spellCheck={false}` on search inputs ✓
- Placeholder ends with `…` and shows pattern ("Search team by name or
  email…") ✓
- `<h1>` for page title, `<h2>` for source name, `<h3>` for sections ✓
- `translate="no"` on the URL `<code>` (brand token)
- `Intl.DateTimeFormat` / `Intl.NumberFormat` for locale-aware display ✓

**impeccable lens:**
- Reject hero-metric template → compact 3-stat strip
- Reject sparklines → deltas only via text (skipped for v1 to avoid
  decoration)
- One primary moment: selected card background tint — NOT on stats, NOT on
  Add button in the list, NOT on hover states
- Flat surfaces: right pane uses `border-t border-border/40` between
  sections, no nested cards
- Crown of the interface: the selected card is the thing someone will
  remember. It shows the user "you are here."

**Punch list emerged with specific file paths:** card primitive, list
component, detail wrapper, performance strip, time-range chips, intake URL
card, form config editor, customers section, slide-over, view, page.
Backend: router procedures + entity hooks + action configs hook.

### Phase 3 — implementation (what got locked in)

**Design commitments that survived from punch list → ship:**

- Selected left card: `bg-primary/5 ring-1 ring-inset ring-primary/15` —
  the lone primary moment. Same pattern as the owner row on the participants
  modal (PR #119). Cross-surface continuity.
- Left card compound component `LeadSourceOverviewCard` mirrors
  `UserOverviewCard` shape (Root + Indicator + Name + Slug + Identity +
  Stat + Actions) — uses existing pattern, not a new one.
- Right pane sections separated by `border-t border-border/40 pt-6` and
  `gap-8`. No `bg-muted` section wrappers.
- Stats strip: 3-column grid, `tabular-nums`, range stat emphasized at
  `text-2xl font-semibold`, others at `text-xl font-semibold`. Labels in
  `text-[11px] uppercase tracking-wide text-muted-foreground` — the *one*
  instance of the decorative label treatment.
- Time-range chips: `role="tablist"`, pill-shaped, `tabular-nums`. Active
  chip uses `bg-foreground/5` (neutral, not primary).
- Destructive delete button: `text-destructive/55` at rest, full
  destructive on hover — mobile users see destructive intent.
- All touch targets: minimum 44px via `size-11` on action buttons.
- Search inputs: `spellCheck={false}` + `autoComplete="off"` + placeholder
  with example pattern.
- `useConfirm` for every destructive prompt (delete, rotate token) — never
  `window.confirm`.
- Sheet + slide-over for create flow — continuous with the detail pane, no
  navigation hop.
- URL-driven selection (`?id=xyz`) via `nuqs` — direct-linkable, back-
  button works, browser history preserved.
- Auto-select first source when no param and list loads — zero-friction
  entry.

**Zero entries from the punch list were skipped.** This is the metric.

---

## Checklists

### Before writing any UI code

- [ ] User-flow scenarios mapped (3–5 concrete sentences)
- [ ] Primary scenario identified and confirmed with the human
- [ ] Focal point decided — one primary-color moment named
- [ ] Three-skill audit complete with ranked findings
- [ ] Punch list has file paths and specific class commitments
- [ ] Cross-surface continuity checked — does this echo any existing
      distinctive moment? (owner-row tint, sidebar sunken well, etc.)

### Before committing UI code

- [ ] `pnpm tsc --noEmit` clean
- [ ] `pnpm lint` clean on touched files
- [ ] Primary-color moment count on the visible surface ≤ 3
- [ ] No nested cards (modal or section → card row is OK; card → card is not)
- [ ] No side-stripe borders > 1px
- [ ] No gradient text
- [ ] All touch targets ≥ 44px
- [ ] All numbers have `tabular-nums`
- [ ] All transitions gated behind `motion-safe:*`
- [ ] All destructive buttons have destructive color at rest
- [ ] All search inputs have `spellCheck={false}`, `autoComplete="off"`,
      placeholder ending with `…`
- [ ] All icon-only buttons have `aria-label`
- [ ] All section labels use real heading tags, not styled divs
- [ ] `aria-live="polite"` on regions that update optimistically

---

## When this playbook does NOT apply

- Literal one-line style tweaks ("change `mt-2` to `mt-3`")
- Pure logic / non-visual refactors
- Backend-only changes with no user-facing surface
- Copy changes that don't affect layout

If the change touches **layout, hierarchy, color usage, component
composition, or more than a single interactive element**, the full
playbook applies.

---

## Related docs and memory

- `memory/feedback-ui-work-methodology.md` — the rule memory pointing here.
- `memory/feedback-design-aesthetic.md` — previous aesthetic feedback.
- `memory/feedback-highlight-outline-pattern.md` — outline-over-ring convention.
- `memory/feedback-motion-patterns.md` — motion/react conventions.
- `memory/pattern-entity-overview-card.md` — compound overview card pattern.
- `memory/project-sidebar-animation.md` — sunken-well reference aesthetic.

---

## Changelog

- **2026-04-21** — Initial version. Distilled from PR #119 (participants
  redesign) and PR #122 (lead sources admin page).
