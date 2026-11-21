# Issue #29 (May 2026): lessons before the worktree goes

Sources: branch `feat/29-…` (42 commits, 2026-05-13/14, tip `3e4a5b3eb`), its uncommitted diff, the plan `docs/superpowers/plans/2026-05-13-proposal-navigator.md`, the layout spec `0334612d8` and its plan `6937a8bcd`, and local `main` at `2f0ba2f21` (2026-10-30). The master tracker already mined this branch once (§4.4 of `docs/plans/2026-09-20-multi-proposal-meeting-flow-epic.md`, W1–W6, WD1–WD6). This file adds root causes and what has changed on main since then.

## 1. What it tried to build
- One homeowner page per **meeting**, at `/proposals/m/[meetingId]?p=<proposalId>&token=…`, listing every non-draft proposal from that visit.
- A left column (the "navigator") with one card per proposal. Clicking a card switches the proposal shown. On mobile it became a pull-out sheet. It hid itself when there was only one proposal.
- The share link moved from the proposal to the meeting: a new `meetings.token`, a nullable `proposals.token`, and a migration script that copied each meeting's oldest proposal token.
- Old `/proposal-flow/proposal/<id>` links became a redirect to the new page. A new `proposals.displayOrder` column set the order of the cards.

## 2. Where it struggled

**P1. Who scrolls the page (about 10 fix commits, then a full redesign).**
- What happened: the sidebar had to stay put while the proposal scrolled, and the top bar had to highlight the section on screen. Each fix moved the scrolling element. `1845f8061` moved it to the view. `0f9b3836d` moved it to a wrapper. `61f3f1a07` moved it back into `<Proposal/>`. `3e4e23dd9` restored the old height chain. Then the agent wrote a redesign spec and plan and built it within 33 minutes (`0334612d8` 20:34 → `3e4a5b3eb` 21:07). The redesign switched to whole-page ("document") scrolling and a fixed navbar.
- Root cause: the old page was an app shell. That means a fixed-height column with `<Proposal/>` as its own scrolling box, registered as the "scroll root" (the element that scrolls) through `ScrollRootProvider` (merge-base `proposal-flow/layout.tsx`). Two features depended on that one choice. A "sticky" element (CSS that pins an element while its scrolling box moves) only works inside the box that scrolls. The section highlighter watched whichever element was registered as the root. Every move fixed one feature and broke the other. The plan never said which element scrolls; it only carried `sticky top-0` and `h-full` snippets (plan lines 866, 1113). In that shell, a sidebar beside a scrolling `<Proposal/>` needs no `sticky` at all.

**P2. Section highlight never fired.**
- What happened: the uncommitted `use-active-section.ts` adds a retry on each frame until the sections exist. It also adds a `JSON.stringify` memo.
- Root cause: the IntersectionObserver (a browser API that reports which elements are on screen) was created on mount. The sections did not exist yet, because the proposal loads in the browser after mount. The effect also listed `activeId` and a new array on every render as its inputs, so it tore itself down and rebuilt constantly.

**P3. Hydration mismatches (`d3694643e`, `40f9cb7bd`, uncommitted `use-has-mounted.ts`).**
- What happened: "hydration" is when the browser takes over HTML the server rendered; it breaks when the two disagree. The fixes treated the symptom. One removed a Suspense boundary. Another hid the view mode until after mount.
- Root cause: the agent/homeowner view mode depended on CASL (the permissions library). At the time, CASL knew the user only in the browser, so the server always rendered "customer" and the browser rendered "agent". The commit comment says the nuqs loader "seeds" `?view`. It does not: a loader only parses the URL.

**P4. The selected proposal was read three ways (`932ac2abf`, `a5483b15a`).**
- The code read it from the route param (`useParams`), the raw URL (`useSearchParams`) and nuqs (`useQueryState`; nuqs keeps state in the URL). The uncommitted diff starts a shared parser module. There was no single owner for URL params.

**P5. The share-link move was half done, and the old-link redirect leaked access.**
- The redirect `80f5e5ca1` ignored the incoming token (`token: _token`) and attached the meeting's valid token. Anyone with a bare proposal id got a working link (WD1).
- Only the two read procedures accepted the meeting token. View recording, the AI summary and contract signing still checked `proposal.token` (WD2).
- Drafts were hidden from the list only, not from the single-proposal read (WD3).
- Internal fields (outcome, customer id, participants) were sent to token holders and hidden in the UI (WD4).
- The real email and about 6 `window.open` links still built the old URL (WD5).
- The redirect queried `db` straight from a page, outside the data layer.
- Root cause: token checks were copied into each place that needed one, with no single resolver. The schema changed before anyone decided what old links become.

**P6. The scope changed and no reason was written down (W6).**
- The issue asked for a customer-based URL. The plan built a meeting-based one. Commit `abbf0a72c` still calls `/proposals/m/[meetingId]` "customer-centric".
- Root cause: the brainstorm's choices went into an implementation plan, not into a spec the owner approved.

**P7. Worktree database isolation was fixed after the fact.**
- `db:push:wt` arrived an hour after the schema commit (`a639bbc09` 17:45, `f060ef7d4` 18:55). Its fix `aec69e0d8` loaded `.env.local` without `override`. That is the same bug main later diagnosed and fixed (`3cf1f6279`, #259, 2026-07-13).
- Git cannot tell whether the 05-13 push reached the shared dev database.

**P8. Pace and verification.**
- On 05-13 it made 19 commits in 90 minutes, executing a 1,365-line plan step by step. No browser screenshots or checks show up in the history.
- An `as any` hid a wrong JSON key, so the scope summaries were silently empty (WD6).

## 3. What survived or changed since on main

| Branch idea | On main today |
|---|---|
| `meetings.token` | **Re-done, for another reason.** `meetings.shareToken` is NOT NULL UNIQUE (`schema/meetings.ts:48,68`, `568933957`, 2026-10-07). It belongs to the home-visit page `/home-visits/[meetingId]?token=` (`roots.ts:118`, `deliver-visit-text.ts:22`). A reschedule hands it to the replacement meeting. No proposal reads it, and the page route does not exist yet (HV9). |
| nullable `proposals.token` | **Not done.** Still `.notNull()` (`schema/proposals.ts:30`). Proposals are still shared by their own token (`modules/proposals/core/server-spec.ts:32`). |
| `proposals.displayOrder` | **Gone.** No column and no reference in `src/`. |
| `/proposals/m/[meetingId]` + redirect | **Not on main.** The homeowner page is still `/proposal-flow/proposal/[proposalId]/page.tsx`, linked by `ROOTS.public.proposalReview` (`roots.ts:115`). The redirect's leak is logged as WD1/H14. |
| nuqs `p` param | **Re-planned as `?proposal=`**: one `nuqs/server` module, no `withDefault`, never written from an effect (tracker §4.6 NQ1–NQ7, F17). Not built. |
| Customer-based URL (the issue's ask) | **Set aside:** one page per meeting (C15). A customer "portal key" (C23) was put on hold when the access question was deferred (C25, Q14). |
| Navigator sidebar | **Kept as an idea:** a switcher, hidden when there is one proposal (H1). Spec F is not written. |
| CASL gating, view mode | **Re-done at the root.** The server builds the rules and passes them in (`proposal-flow/layout.tsx`, `06d2908f5`). The view toggle was deleted (owner, 2026-10-15). Share links get field-level rules (`domains/permissions/rules/bearer.ts`, `5b9a23fd9`/`6422e8e07`) and a server-side homeowner view (`core/lib/to-homeowner-proposal-view.ts`). |
| Section tracking | **Replaced.** A scroll listener against a fixed line (`use-active-section.ts`, `a770d7ea5`, `0e1f197e2`). It still runs on `<Proposal/>`'s own scroll box (`proposal/index.tsx:83`), the arrangement the branch abandoned. |
| `db:push:wt` | **Dropped.** The root cause was fixed in `drizzle.config.ts:15` (`override: true`, `3cf1f6279`). |
| `getProposalsByMeeting` | **Rejected:** use the generic proposals list filtered by meeting (D6). |

⚠️ **Stale references in the tracker:**
- `docs/plans/2026-09-20-multi-proposal-meeting-flow-epic.md` Q14/C25/H2/H8 say the share key is undecided. They never mention that `meetings.shareToken` exists (`schema/meetings.ts:48`).
- §5 X1/X2 and H10 say "none fixed". They predate the share-link rules (`bearer.ts`, 2026-10-12).
- WD4/H10 treat participants as internal. The 2026-10-16 ruling makes them the rep cards, and `e150c1631` adds meeting reps to the proposal read.
- Proposed fix: update those rows before spec F is written.

## 4. Conclusions for the rebuild (decide before any code)

Tags: **[T]** = the tracker already covers it, with its IDs. **[NEW]** = not in the tracker.

1. **[NEW] Name the scroll owner in the spec.** The proposal page on main scrolls inside `<Proposal/>` (`proposal/index.tsx:83`), and chapter tracking reads that box. The switcher sits beside it as a column on desktop and a sheet on mobile, with no `sticky`. Switching to whole-page scrolling would mean moving the entire proposal page with it, in its own change.
2. **[NEW] Decide what switching does.** Does the proposal scroll back to the top? Does the active chapter reset? Does a half-moved cash-down slider save first?
3. **[NEW] Decide whether the meeting proposals page and the home-visit page are one page.** Both are one meeting, one link and one homeowner. If they are one page, the proposals can reuse `meetings.shareToken` and its reschedule handoff, which already answers Q18 for meetings. Settle the conflict first: the visit page shows "expired" 30 days after the visit (visit spec line 723), but proposal links must stay permanent (H3).
4. **[T: H3, H14, H8] Old links keep working.** Every emailed `/proposal-flow/proposal/<id>?token=` link must still open. The translator checks the old token before it redirects, never hands out a token, and has a written answer for proposals with no meeting.
5. **[T: H11, WD2] One token resolver** for reads, writes, view recording, the PDF, the AI summary and contract signing. **[NEW]** Build it on the existing share-link rules and homeowner view (`bearer.ts`, `to-homeowner-proposal-view.ts`), not a fresh check.
6. **[T: H10, H13, H15]** Homeowner data is trimmed on the server, and the draft rule lives inside the token's scope, not in one list filter.
7. **[T: H6, H12]** Every homeowner write names its target proposal, and no token writes outside its meeting.
8. **[T: H7, WD5] Change every link producer in the same change** as the new URL: ROOTS, action configs, email, SMS, push, PDF and Zoho.
9. **[T: F17, NQ1–NQ7] One URL-param module.** The selected proposal is `?proposal=`, read only through nuqs. Its default comes from the data and is never written back from an effect.
10. **[NEW] Card order without a column.** Pick a rule, for example the order proposals were sent. Add a column only if reps truly need to arrange the cards. The default selected proposal is Q15 **[T]**.
11. **[NEW] Rep cards are the meeting participants**, at most two, with only public fields (owner ruling 2026-10-16). Update WD4/H10 to match.
12. **[NEW] No view mode and no mount gates.** CASL with server-built rules decides what the page shows. If a hydration mismatch appears, find where the server and browser disagree.
13. **[NEW] Reuse the shared `OverviewCard`** (`shared/components/entities/overview-card/`) with a real selected state (`aria-current`), not a one-off card.
14. **[T: V-3, V-7] Database changes:** make a new column nullable, backfill it, then tighten it. Push dev first, and prod only on your explicit go. **[NEW]** In a worktree, confirm the target branch with `describeTargetDb` before the first push.
15. **[NEW] Process.** You approve a spec covering access, old links, the scroll owner and switching behaviour before a plan is written. Each UI step is checked in a real browser before the next one. Any change of scope (customer to meeting) is written in the spec with its reason.

## 5. Uncommitted work worth keeping
Nothing to port. The data layer, router, redirect and migration are all superseded (tracker §4.4). `useHasMounted` solved the wrong problem (see P3). `flattenScopeLabels` is three lines over a scope format that Wave 4 is replacing.

One idea worth carrying into spec F: the card's information order in the uncommitted `proposal-navigator-card.tsx`. That is the label, then the trades plus up to 4 scope labels ("a · b · c · d +n"), then the price beside the status badge. Those are the fields that tell alternatives apart at a glance.
