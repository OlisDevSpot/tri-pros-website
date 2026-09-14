# Specialties Trade Sheet — Follow-ups

Built 2026-09-14 on main (`5ddf4e55..5f19509f`) from `docs/superpowers/specs/2026-09-13-specialties-trade-sheet-design.md` and its plan. This document introduces what the build left open, for a grilling session. No code here. Each item says what it is, why it matters, and what the ideal answer looks like.

---

## Fix first

### 0. Unticking a trade's last scope does not take it off the project once it was saved
Item 1's keep rule keeps any entry the server already holds. So when an agent unticks the last scope of a trade that was already saved, an empty entry stays. The Specialties page shows the trade as not selected, but the closing step, proposal scope-of-work defaults, the SOW snapshot, and the Google Calendar description still list it. Only "Remove from project" clears it, and the result depends on timing: unticking within 800 ms of ticking drops it.
**Why it matters:** an un-picked trade can reach a proposal.
**Ideal answer:** keep a server-held entry with zero items only when the server copy also had zero items, which is the legacy meeting-creation case. One condition in `normalizeForWrite`, plus a check for the untick path.

---

## Decisions the build made on your behalf

### 1. Trades with no items are saved again
The spec said a trade with no scopes or add-ons is never persisted. The build found that meeting creation and the old step already save such trades, sometimes with reasons and notes, and the first edit would have deleted them. The rule is now: every entry is kept except a completely empty one that was never on the server; "Remove from project" deletes explicitly and shows whenever the trade has anything stored. The page still draws a trade as selected only with one or more items.
**Why it matters:** the seven readers of `tradeSelections` (persona profile, programs, portfolio, closing, proposal defaults, the SOW snapshot, Google Calendar) keep seeing zero-item entries, as they do today.
**Ideal answer:** decide whether zero-item entries are meaningful ("they mentioned roofing") or noise. If meaningful, the downstream readers should say so explicitly; if noise, a one-time cleanup plus a creation-form change removes them.

### 2. Three scope tiles per row on the tablet drawer
The plan's check text said two per row at 820px; the plan's own code and the measured tile heights favored three. Three shipped.
**Ideal answer:** look at it on the tablet. Switching is one class.

### 3. Focus return lives in `ResponsiveSheet`
No opener in the app is a Radix trigger, so the primitive records the focused element on open and restores it on close.
**Ideal answer:** keep it. See item 12 for its known gaps.

### 4. The curated photos are committed as webp
The original photos live in a git-ignored folder and never deploy. Ten optimized copies (1.27 MB) now sit in `public/meeting-flow/trades/`.
**Ideal answer:** replace them with `mediaFiles` when the R2 cover-image migration (#243, #244) lands, then delete the folder.

---

## Open questions for you

### 5. "Remove from project" has no undo
It drops the trade's items, reasons, and note in one tap, with no confirm and no undo.
**Why it matters:** an agent can lose a note mid-meeting.
**Ideal answer:** an undo toast (the repo's destructive-action pattern is a confirm dialog, but that interrupts a live conversation), or keep the note and reasons when items are removed.

### 6. The photo pushes the first scope row below the fold at 1024px
On a laptop at 1024×768 the trade photo takes most of the sheet's first screen.
**Ideal answer:** cap the photo height at that width, or move it beside the outcome line.

### 7. The outcome line's colored left border
`OutcomeLine` uses a primary left border, which the design system's anti-slop list discourages. It came from the studies page.
**Ideal answer:** a quote treatment without a colored rail, or keep it as the one deliberate accent.

### 8. Buttons that open the sheet announce themselves as toggles
Trade tiles and project-strip chips carry `aria-pressed` because the spec said so, but pressing them opens a dialog rather than toggling.
**Ideal answer:** `aria-haspopup="dialog"` plus visually hidden "N items on the project" text.

---

## Engineering follow-ups

### 9. The view merges patches into a cached `flowStateJSON`
`handleFlowStateChange` spreads the cached blob and writes it whole, with no optimistic update. Two steps writing close together can put an older trade selection back on the server. The provider now re-writes after such a rollback, but only once the server has echoed its own last write.
**Ideal answer:** an optimistic cache update in the view, or a per-key merge on the server. This is data access, so it is yours to run.

### 10. `PlaceholderSlot` should move and become surface-neutral
It stays in `steps/who-we-are/` because the Who We Are corrections are uncommitted there. The trade photo recolors it with descendant variants that work with both its committed and uncommitted versions.
**Ideal answer:** after the Who We Are corrections commit, move it to `ui/components/presentation/`, give it a color API that reads on dark and light grounds, raise its 12px label, and delete the descendant-variant workaround.

### 11. Code built for the gated tasks is unused
`deriveLeadTrades`, `ScopeTile mode="open"`, `StartHint`, `SPECIALTIES_COPY.lead`, `units.item`, `sheet.addons`, and `sheet.noScopesAddonsOnly` exist for Tasks 8 and 9 (add-on chips, lead panels) and are not rendered.
**Ideal answer:** run the two data-access items in the spec's §9, then build Tasks 8 and 9. If either gate closes for good, delete its code.

### 12. `ResponsiveSheet` as a reusable primitive
- `contentClassName` applies to both branches, so callers must know to prefix width classes with `lg:`.
- Crossing the `lg` breakpoint while open swaps Sheet and Drawer, remounts the children, and loses the recorded opener.
- iPadOS Safari does not focus a button on tap, so a sheet opened by touch has no opener to return focus to.
- Below `lg`, a sheet open on page load renders as a Sheet for one frame.
**Ideal answer:** separate `sheetClassName` and `drawerClassName`, record the opener in a ref that survives the swap, and fall back to the element that received the pointer event.

### 13. Focus after the pairing card switches trades
Opening the paired trade unmounts the focused "Open" button, so focus lands on the dialog container.
**Ideal answer:** move focus to the new trade's first scope tile.

### 14. The roofing pairing is broader than the playbook
The playbook pairs insulation with a roofing redeck ("attic is already accessible"); the card shows for any roof selection.
**Ideal answer:** show it only when the redeck scope is selected. The pairing type lives in `types/index.ts`, which held another session's edits during this build.

### 15. Write-path edge cases the final review found
- A second value from another device, arriving within one debounce of the first, can be overwritten by the first for 800 ms. The fix is clearing the provider's dirty flag when it adopts a foreign value; its docblock currently claims more protection than it has.
- A stale merge back to the value from before the agent's first edit is treated as foreign, so that edit is lost.
- A failed write is never retried until the next edit.
- An unblurred note is always lost when the whole view unmounts, because the provider's cleanup runs before the note field's. Closing the sheet is safe.
**Ideal answer:** item 9's root-cause fix removes most of these; the dirty-flag reset is a one-line change on its own.

### 16. Near-invisible borders on shared inputs in light mode
The shared `Textarea` and `Input` use `border-input`, and `--input` is white in the light theme.
**Ideal answer:** a design-system token decision for `--input`, fixed once for the whole app.

### 17. The same untracked-photo problem in Who We Are
`who-we-are-sections.ts` points the before/after pair at the git-ignored `portfolio-photos/projects/Riviera/` folder, so those photos are missing in any deploy too.
**Ideal answer:** the same treatment as item 4.

### 18. Data access still waiting on you (spec §9)
- Energy Saver qualification compares Notion trade ids to slugs and never matches; decide the rule.
- Get the lead's requested trades onto the meeting-flow customer (`customer_lead_attribution.captureJSON.requestedTrades`); this lifts the lead-panels gate.
- Confirm add-ons belong in proposal SOW defaults; this lifts the add-on chips gate.
