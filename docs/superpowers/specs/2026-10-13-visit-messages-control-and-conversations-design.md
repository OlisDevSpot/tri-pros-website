# Visit messages on the card, the visit sheet, and the Conversations page

**Status:** APPROVED by the owner 2026-10-13, with the access, dock and shared-file rulings folded in (§2.15, §10). UI exploration: [studies page](https://claude.ai/artifact/KGiVahYKFHCMAkPLwmn5zF) (round 7 is what this spec describes).
**Amends:** `2026-09-29-home-visit-page-and-visit-messages-design.md`. This spec replaces its §7.5 page and drawer (`/dashboard/visit-messages`, the Messages drawer), its §8.3 `HomeownerConfirmed` part, and steps 4–5 of its §12a. The planner, the states, the templates, the validator and the pauses in §7.5 stay as written; this spec says where staff see and use them.
**Plans:** 3a (the card meter and the visit sheet) and 3b (the Conversations page). 3b reuses the conversation thread 3a builds.

---

## 1. Goal

The owner's goal for the epic: make booked visits stick. The decision-makers are home, the homeowner expects the visit, and the sit rate goes up.

Dispatchers and super-admins meet this surface in three moments, which the owner weighted equally:

- **The booking call.** "I just booked the visit with the homeowner still on the phone. I need to send the visit summary and walk them through the link."
- **The day-before check.** "I'm scanning tomorrow's visits. Which ones aren't confirmed, and what's missing?"
- **A reply came in.** "A homeowner texted back. I need to read it and answer, fast, with the right words."

What makes this easier:
- every card says how confirmed its visit is at a glance;
- the full conversation is one click away;
- one page holds every homeowner text on the main line;
- the team's best wording is one keystroke away and can be changed live.

## 2. Decisions already made (owner, 2026-10-12 → 10-13)

Do not reopen these.

1. **Not a screen of its own.** The visit-message controls live on the meeting card, as sub-components of the `MeetingOverviewCard` compound (owner, 2026-10-09). The §7.5 Visit messages page and drawer are dropped.
2. **The meter.** Every eligible meeting card shows a confirmation meter: three strips, one per homeowner signal, in the order they happen.
   - The signals are **Texted** (the visit summary was delivered), **Opened page** (they opened their visit page) and **Confirmed** (a YES, or confirmed on the page).
   - More green means more confirmed.
   - The owner turned down six other proposed signals (calendar add, saved contact, who's coming, project details, reconfirmed, met the specialist).
3. **Tight views show strips only.** The schedule shows the strips with no words. Pipeline and dashboard cards add one status line.
4. **Detail lives in a sheet.** The detail is a sheet with two tabs, **Sequence** and **Conversation**. It opens on Conversation when a homeowner reply is waiting for an answer, and on Sequence otherwise.
5. **The calendar invite reports only facts about the event:** sent, Google added them as a guest, or Google rejected the email.
   - Nothing reads, shows or waits on the homeowner's RSVP. The owner said they "will most likely NOT confirm on google calendar. And that is ok."
6. **No replies box in Sequence.** Replies belong in Conversation.
7. **Per-visit text editing.** Every text that hasn't gone out yet (visit summary, day-before reminder, rep confirmation) can be edited for this visit, with **Reset to default**.
8. **Message colors.** Our texts are green and the homeowner's grey, iOS style. Failed sends use the destructive style.
9. **The Conversations page** monitors **every homeowner text on the main line**. It is its own dashboard page in the nav.
   - **Visit-first list:** the tabs are **Upcoming visits** (the default) / **Newest** / **Archived**. Upcoming visits groups threads by visit day, with the meter on each visit row; everything else sits under "Other conversations".
   - **Archive** sends a thread to the Archived bucket.
   - **⋯ menu:** the conversation's actions live in the standard `⋯` dropdown (`EntityActionMenu`): View profile, Open visit, Reschedule, Call, Mark as unread, Archive. They are never full-width buttons.
   - **Details sheet:** the customer's name opens a details sheet, not a rail. It shows View profile (which opens the existing customer profile modal), Call, the visit with its meter, Open visit, Reschedule, and the same **timeline** as the thread.
   - **No money in the details:** no proposals and no pipeline value. This page is for pre-confirmation conversations. Post-appointment conversations (follow-ups, proposal check-ins) are a later extension.
   - **Phone layout:** the list scrolls like the dashboard, with the dock floating over it. An open chat fills the screen, only the messages scroll, and there is no gap above the reply box.
10. **Quick messages.**
    - **Chips:** chips above the reply box.
    - **Slash menu:** `/` in the reply box lists every quick message, grouped.
    - **Manage sheet:** editing happens only in a **Manage** sheet (edit, add, reorder, reset to defaults). There is no inline editing.
    - **Team-wide data:** quick messages are shared and persistent, so the owner can try wording live.
11. **No next-step guidance.** The owner rejected the next-step bar ("too bulky and inflexible") and the command palette.
12. **The elevation ladder applies to every surface, in both schemes.**
    - Page surfaces are `bg-card` + `border` + `rounded-xl` with the low end of the tinted shadow ramp.
    - A panel inside a panel climbs a rung, with its own edge.
    - Controls stand one rung up; fields sink; menus sit on the top rung.
    - The round 6 mock "felt very flat" because its surfaces had no edge and no lift.
13. **Compose, never re-create.** Every part is built from the primitives and patterns already in the app (§4.1). The owner flagged the mock re-rendering the sheet on every click, and the build must not do the same.
14. **Messaging primitives:** shadcn's official chat items `message`, `bubble`, `marker` and `message-scroller` (research note: `docs/plans/2026-10-12-messaging-ui-components-research.md`). The inbox list is built from primitives we already have.
15. **Access is per phone line (DID)** (owner, 2026-10-13). Every agent will get their own Twilio number for their digital assistant, which sends automated texts and alerts the agent when a customer reaches out.
    - **Super-admins:** one unified Conversations page, with a line switcher (all lines, or one line).
    - **Dispatchers:** only the main dispatch line (the main line). All dispatchers work the same customers; no dispatcher owns a customer or a thread.
    - **Agents:** only their own line. This arrives with the post-meeting conversations, not in this build.

    This build is the pre-meeting conversations, for dispatchers and super-admins only. Visibility is a rule on the thread's line, so adding agents later is a permissions change, not a redesign.
16. **Mobile dock:** Conversations replaces Meetings in the dock for now. The owner will rethink the mobile nav items later (follow-up).

## 3. Content

Company names come only from `companyInfo` (`src/shared/constants/company/`) through the existing templates. Nothing in this spec adds a company claim. Visit length, warranty terms and counts are deliberately absent.

### 3.1 The meter and its status line

Strips, left to right:

| Strip | Green | Amber (waiting on the homeowner) | Red | Grey |
|---|---|---|---|---|
| Texted | `visit_summary` delivered for the current time | sending | failed / undelivered | not sent yet (orange `attention` tone: the office owes this one) |
| Opened page | a page open is recorded for this meeting | texted, and the visit page exists (plan 4 shipped) | — | not texted, or plan 4 not shipped |
| Confirmed | `homeownerConfirmedAt` set | texted, no confirmation | — | not texted |

A reply that is not a YES turns Confirmed purple (`action`): "replied, no YES".

The status line appears on pipeline and dashboard cards; the schedule shows strips only. These are the exact strings, first match wins:

1. `Visit summary failed` (danger)
2. `Visit summary not sent` (attention)
3. `Sending visit summary…` (info)
4. `Replied: "{latest reply}"` (action), while a reply waits for an answer
5. `Confirmed by text · {day}` / `Confirmed on the page · {day}` (success)
6. `Awaiting YES · reminder {when}` or `Awaiting YES · reminder skipped` (pending)

The strip-only variant carries an `aria-label` that spells out each signal, e.g. "2 of 3 signals: Texted yes, Opened page not yet, Confirmed not yet".

### 3.2 The visit sheet

- **Header:**
  - the customer name, then `{Day, Mon D} · {h:mm AM}`;
  - **Open meeting** (existing view action) and the close button;
  - the meter, with labels and times under each strip (`Delivered Fri`, `Sat 11:09 AM`, `Not yet`).
- **Tabs:** `Sequence` and `Conversation ({n})`. When a reply waits for an answer, Conversation carries an action-tone dot.
- **Sequence:** one row per step, in order (visit summary, calendar invite, day-before reminder, rep confirmation). The copy follows §7.5's state table, with these additions:
  - **Visit summary.** Not sent: "Not sent yet", with **Send visit summary**, **View text** and **Edit text**. Sent: "Delivered {when} · Sent by {name}", with **View text** and **Resend** (Resend asks first). Failed: "Failed: {plain reason}", with **Edit phone** and a disabled **Send again** until the phone changes.
  - **Calendar invite.** Before the summary: "Goes out with the visit summary". Sent: "Sent {when} · Google added them as a guest, so time changes and a cancellation reach them from Google." Refused: "Google rejected the email on file · The event is on the calendar without them; fix the email and the next sync adds them.", with **Edit email**.
  - **Day-before reminder / Rep confirmation.**
    - Scheduled: "Sends {when}", with **View text**, **Edit text** and **Skip**. The meta line says which reminder variant goes out ("Asks them to reply YES." / "The 'see you tomorrow' version: they already confirmed.").
    - Skipped: "Skipped by {name} · Undo before it is due and it goes out as planned.", with **Undo**.
    - Won't send: "Won't send: {reason}" (e.g. "The visit summary never reached the homeowner.").
  - **Edited for this visit · Reset to default** appears in the meta line of any step whose text was edited.
- **Edit text** opens an inline editor inside that step:
  - **Insert field chips:** First name, Visit date, Visit time, Arrival window, Specialist, Coordinator, Visit link. The editor shows fields as `[Visit time]` labels, and optional sections are resolved for this visit before editing.
  - **Live preview:** "What {First name} gets", plus `{n} characters · {n} texts`. An emoji adds "(an emoji makes each text hold 70 characters)". The visit summary adds "the opt-out line is added automatically".
  - **Required fields:** the required tokens per kind are guarded with "Keep {fields}: this text needs {it/them}." and **Save** stays disabled until they are back.
  - **Buttons:** **Save for this visit**, **Reset to default**, **Cancel**.
- **Conversation:** the thread (§3.4) and the reply box. No replies box appears in Sequence.

### 3.3 Conversations page

- **Page bar:** `Conversations`, with the subtitle naming the line (`Main line`). Super-admins get a line switcher in the page bar: `All lines`, `Main line`, and one entry per agent line by agent name. With `All lines` selected, each row carries a line tag. Dispatchers see no switcher.
- **List:**
  - Tabs: `Upcoming visits` · `Newest` · `Archived {n}`. Search placeholder: "Search names, numbers and messages".
  - Upcoming visits groups: `Tomorrow · Tue, Oct 13` / `Wed, Oct 14` … with "{n} visits", then `Other conversations`.
  - Each row shows:
    - avatar initials, or `?` for an unknown number;
    - the name, or the formatted number when unknown;
    - the time;
    - an unread dot;
    - a one-line preview, prefixed `You:` or `Auto:` for our texts;
    - the meter, for visit threads;
    - tags: `Needs reply` (action) and `Not delivered` (danger); Newest and Archived add the context tag (`Visit Oct 14 · 4:00 PM`, `Unknown number`, the stage).
  - Empty states: "Nothing here." and "Nothing archived."
- **Thread header:**
  - the avatar, and the **name as a button** that opens the details sheet;
  - the sub-line (`Visit Oct 14 · 4:00 PM` / `Unknown number` / the stage) and the meter;
  - `⋯` with View profile, Open visit, Reschedule, Call, Mark as unread, then a separator and Archive / Unarchive.
- **Details sheet:**
  - customer: name, city · lead source, the stage tag, **View profile**, **Call**;
  - visit: date · time, the labelled meter, **Open visit**, **Reschedule**;
  - **Timeline**, in order: booked by, texts sent and their delivery, homeowner events ("Opened their visit page"), replies, then the scheduled texts still to come (dashed).
  - An unknown number shows "No customer has this number. The YES may belong to a visit booked under a different phone.", with **Link to customer** and **New customer**.
- **Reply box:** placeholder `Text {First name}, or type / for quick messages`; helper `From the main line · Enter to send, Shift+Enter for a new line`. When texting can't reach the number, the placeholder is "This number can't receive texts" and the box is disabled. After a STOP it is "They replied STOP. Texting is off." and the box is disabled.
- **Quick messages:** the chips row ends with `Manage…`. The `/` menu groups items under their group heading as `/{command} {name}` plus a one-line preview, with `Manage quick messages…` at the bottom.
- **Manage sheet** (`Quick messages`):
  - the grouped list, each row with ↑ ↓ and edit;
  - **+ New quick message** and **Reset to defaults**;
  - the editor fields: Name, Command, Group, the text with field chips, a preview "What {First name} gets", and **Save for the team** / Delete / Cancel.

**Default quick messages.** These are the seed and the "Reset to defaults" set. The wording is the owner's to approve.

| Group | Command | Name | Text |
|---|---|---|---|
| Confirm | `/confirm` | Ask to confirm | Hi [First name], just checking we're still on for [Visit date] at [Visit time]. Reply YES to confirm. |
| Confirm | `/link` | Resend visit page | Here's your visit page with the agenda and everything you need: [Visit link] |
| Confirm | `/joining` | Who's joining? | Will anyone else be joining us for the visit? We like to make sure everyone who'll be part of the decision can be there. |
| Reschedule | `/newtime` | Offer another time | No problem! What day and time work better for you? |
| Reschedule | `/moved` | Moved, confirm new time | Done! You're now set for [Visit date] at [Visit time]. Reply YES to confirm. |
| Before the visit | `/how` | How the visit works | Your specialist is assigned closer to the visit, and you'll get their name the morning of. The agenda is on your visit page: [Visit link] |
| Unknown number | `/who` | Who is this? | Hi! Thanks for your reply. Who am I texting with? I'll find your visit. |

**Which chips show.** The chips are the first three or four quick messages that fit the thread:
- unknown number: `who`;
- an unanswered reply on a visit: `newtime`, `moved`, `link`;
- an unconfirmed visit: `confirm`, `link`, `joining`, `how`;
- a confirmed visit: `joining`, `how`, `link`.

A quick message whose fields cannot be filled for the thread (for example [Visit date] with no visit) is hidden from the chips. In `/` it shows dimmed with "Needs a visit".

### 3.4 The thread (shared by the visit sheet and the Conversations page)

- **Order:** messages oldest first, with a day separator (`Marker variant="separator"`: `Friday, Oct 9`, …, `Today`).
- **Our texts** align end, with a green bubble.
  - The header names the source: `Visit summary · sent by Dana`, `Automatic reply`, `Day-before reminder`, `Rep confirmation`, or the staff member's first name.
  - The footer reads `{time} · Delivered`, `{time} · Sent`, `Sending…`, or `{time} · Not delivered: {plain reason}` in the destructive style.
- **Theirs** align start, with a grey bubble and a time footer.
- **Notes inside the thread:**
  - a matched YES: "Matched as YES: visit confirmed";
  - an unmatched YES from an unknown number: "Not matched to a visit, so no automatic reply went out.";
  - homeowner events, as success-tone markers: "Opened their visit page · 11:09 AM".
- **Coming up:** visit texts still scheduled show at the end as dashed bubbles: "{label} · scheduled", "{when}: goes out automatically", with **Edit text** and **Skip**. These open the same per-visit editor and skip verb as the visit sheet.
- **Plain reasons for Twilio codes:**

  | Code | Shown as |
  |---|---|
  | 30006 | "landline or can't receive texts" |
  | 21610 / 30004 | "they opted out (STOP)" |
  | 30003 | "the phone is off or unreachable" |
  | 30005 | "unknown or inactive number" |
  | 30007 | "blocked by the carrier as spam" |
  | anything else | "the carrier didn't deliver it (Twilio {code})" |

## 4. Architecture

### 4.1 Existing pieces this composes (never re-create)

- **Card and actions:**
  - the `MeetingOverviewCard` compound (`src/shared/entities/meetings/components/overview-card.tsx`) and its context (`meeting`, `actions`, `changeOutcome`);
  - `useMeetingActionsHost` / `MeetingActionsHost` (`src/shared/modules/meetings/core/components/meeting-actions-host.tsx`), which already hosts the meeting dialogs;
  - `MEETING_ACTIONS` and `use-meeting-action-configs`;
  - `EntityActionMenu` for the ⋯ menu;
  - `useCustomerActionsHost` with `CUSTOMER_ACTIONS.view` for View profile, the same path the kanban card uses;
  - the existing Reschedule dialog and `PhoneAction` for Call.
- **Sheets and primitives:**
  - `ResponsiveSheet` (`src/shared/components/dialogs/sheets/responsive-sheet.tsx`): a right Sheet at `lg` and up, a vaul Drawer below. It handles focus return, the overlay and scroll lock.
  - From `src/shared/components/ui/`: `Tabs` (underline variant), `ToggleGroup` / pill `TabsList` for the list tabs, `Input` (search), `Textarea` + `InputGroup` (reply box and editors), `Badge`, `Avatar`, `Button`, `DropdownMenu`, `Popover` (the `/` menu), `Tooltip` / `HybridPopoverTooltip`, `ScrollArea` and `Separator`.
- **Text logic:**
  - the merge-template code in `src/shared/services/voip/lib/`: `renderMergeTemplate`, `listMergeTokens`, `findSectionErrors` (`sms-merge-template.ts`), `countSmsSegments` and `findNonGsm7` (`sms-segments.ts`);
  - from the messages module: `VISIT_MESSAGE_TOKENS`, `VISIT_MESSAGE_REQUIRED_TOKENS`, `VISIT_MESSAGE_TEMPLATE_DEFAULTS`, `renderVisitMessage`, `buildVisitMessageVars` and `validateVisitMessageTemplate`.
- **Status logic:**
  - `planVisitMessages` (steps and states) and `deriveConfirmationTrack` (texted and confirmed, today unused);
  - `isVisitMessageEligible`;
  - the status tones (`src/shared/constants/status-tones.ts`).
- **Navigation:** `getSidebarNav` (`src/features/agent-dashboard/lib/get-sidebar-nav.ts`) and the mobile dock (`src/features/agent-dashboard/constants/mobile-dock.ts`, `lib/get-mobile-dock-tabs.ts`).

### 4.2 Card part: `MeetingOverviewCard.VisitMeter`

- **Data:** a new compound part reading a new optional field, `meeting.visitMeter: VisitMeter | null`, on `MeetingOverviewCardData` (shape in §5.1). It renders nothing when the field is null: project meetings, decided or past meetings, or a list that does not load it.
- **Props:** `variant: 'line' | 'strips'`. `line` (default) shows the strips plus the status line. `strips` shows strips only, with the full `aria-label` and a tooltip.
- **Click:** runs a new meeting action, `MEETING_ACTIONS.visitMessages` ("Visit messages", ability `['read', 'VisitMessages']`). It opens the visit sheet through the host and stops the card's own click.
- **Placement:**

  | Card | File | Variant | Position |
  |---|---|---|---|
  | Schedule | `src/features/schedule-management/ui/components/meeting-card.tsx` | `strips` | under the time and outcome row |
  | Kanban (fresh-pipeline meeting sub-card) | `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx` | `line` | under the time chip |
  | Dashboard | `src/features/agent-dashboard/ui/components/dashboard-meeting-card.tsx` | `line` | — |

- **Sizing:** the strips fill the card width in `strips`, and sit at 16 × 6 px each in `line`. The part keeps card height constant across states.

### 4.3 The visit sheet

- **Hosting:** `VisitMessagesSheet` is hosted once by `MeetingActionsHost` (the same pattern as its Reschedule and Notes dialogs). Opening it flips host state; cards never mount it.
- **Built from:**
  - a `ResponsiveSheet` holding a header (name, time, Open meeting, close, and `VisitMeterLegend`, the labelled meter);
  - `Tabs`: Sequence (`VisitMessageSteps`) and Conversation (`ConversationThread` + `ConversationComposer`, §4.4).
- **Default tab:** decided once, when the sheet opens. It is Conversation when the meeting's thread has an unanswered inbound message, else Sequence. It never flips while the sheet is open.
- **Steps:** rows come from the per-meeting read (§5.1). Each row is a component for its kind; actions call the verbs in §5.2. The editor (`VisitMessageTextEditor`) is a region inside the row, not a nested dialog.
- **No re-mounting on updates:** mutations update the React Query cache (optimistic for Skip/Undo; settled for Send). The sheet stays mounted, so its entrance animation plays once and its scroll position holds.

### 4.4 Conversation components (shared)

These live with VoIP, per the memory rule that texting is VoIP: `src/shared/services/voip/components/` (§8). The visit sheet and the Conversations page both use them.

- **`ConversationThread`** takes a thread id, or a meeting id that it resolves to the main-line thread. It renders shadcn `MessageScroller` (pinned to the newest message, a scroll-to-bottom button, and the reader's place kept when older history loads above) → `Message` / `Bubble` / `Marker` items, plus the "Coming up" block for a visit thread.
- **Bubble variants** in our copy of `bubble.tsx`:
  - `ours` (green fill, white text) and `theirs` (one rung above the thread surface, with its edge), backed by new tokens `--bubble-ours`, `--bubble-ours-foreground`, `--bubble-theirs` and `--bubble-theirs-foreground` in `globals.css`, checked by `pnpm theme:check`;
  - `destructive` for failed sends, as shipped;
  - `scheduled` for the dashed "coming up" bubbles.
- **`ConversationComposer`** is `InputGroup` + `Textarea` + a send `Button`, the chips row and the `/` menu (`Popover` anchored to the reply box). Enter sends; Shift+Enter adds a new line. A chip or menu item fills the box for editing and never sends on its own. Sending calls the staff send verb (§5.2).
- **`QuickMessagesManageSheet`** is a `ResponsiveSheet` holding the grouped list and the editor. It is opened from the chips row and the `/` menu.

### 4.5 Conversations page

- **Route:** `src/app/(frontend)/dashboard/conversations/page.tsx`, with `ROOTS.dashboard.conversations()`. The feature code lives in `src/features/conversations/` (views, list, row, details sheet).
- **Navigation:** a sidebar item after Meetings, "Conversations", enabled by `ability.can('read', 'VisitMessages')`. It also needs an unread count, if the sidebar supports counts (it does not today; follow-up). In the mobile dock it replaces Meetings (§2.16). Super-admins get the line switcher in the page bar (§3.3).
- **Layout:** follows the dashboard shell and `PageBar`. At `lg` and up it is a two-pane `ResizablePanelGroup` (list | thread), each a page surface. Below `lg` it is one column: the list is part of the page scroll under the floating dock; an open thread is a full-screen view (back button, sticky header, only the messages scroll, the reply box flush above the safe area, the dock hidden).
- **State:** the selected thread and the tab live in the URL (`?thread=<id>&tab=visits|newest|archived`), so links, refresh and back work.

### 4.6 Elevation, by element (both schemes)

| Element | Token rule |
|---|---|
| Page bar, list pane, thread pane | Page surfaces: `bg-card border rounded-xl shadow-xs`, rung 1 |
| Reply area, details sections, visit-sheet step list, Manage list rows, editor | A panel inside a panel: another `bg-card` with `border`, one rung up |
| Chips, buttons inside those | Stand: `bg-control` + `border-control-border` + `shadow-xs` (they climb with the surface) |
| Search, reply box, editor fields | Sink: `Input` / `Textarea` primitives, `bg-input-background` + `border-input` |
| Sheets | A portaled `bg-card`, starting at rung 1 |
| ⋯ menu, `/` menu | Top rung: `bg-popover` / frosted `surface-overlay` |
| List rows | `hover:bg-row-hover`, `bg-row-selected`, `data-press` + `pressed:bg-row-press` |
| Tabs | `bg-tab-track` with `bg-tab-active` |
| Their bubble | One rung above the thread surface (`bg-muted`), with its edge |
| Our bubble | `--bubble-ours` |

No literal colors anywhere; `pnpm theme:check` and the theme ESLint guard must pass.

### 4.7 Responsive, motion, accessibility

- **Breakpoint:** the `lg` breakpoint (`useIsBelowLg`) is the one switch, the same as `ResponsiveSheet`'s. iPad portrait gets the phone layout.
- **Motion:** only the sheet's own open and close (the primitive's), the `/` menu's pop, and the bubble enter on send. Each is under 200 ms with the app easing, and none under `prefers-reduced-motion`.
- **Accessibility:**
  - the thread is `role="log"` with `aria-live="polite"`;
  - the meter has a full `aria-label`;
  - the `/` menu is the existing `Command` primitive (`src/shared/components/ui/command.tsx`) inside the `Popover`: a filtered listbox with arrow keys and Enter;
  - focus returns to the opener when any sheet closes (`ResponsiveSheet` already does this);
  - every icon button has a name.

## 5. Data access (the owner runs these before the gated build tasks)

The UI tasks use the reads and writes below. Everything marked **new** is backend work outside the UI-only rule. It is listed here once, as the single handoff. Plan tasks that depend on it sit behind a USER GATE.

### 5.1 Reads

**Used as-is:**
- `meetingsRouter.reads.list` (dashboard, schedule) and `customerPipelinesRouter.getCustomerPipelineItems` (kanban);
- `voipMessagesService.fetchThread` (exists; not routed);
- the messages module's `getVisitMessageContext`, `listChainMessages`, `listPausedKinds`, `getTemplateBodies` and `getRescheduleChain`.

**New:**

1. **`visitMeter` on the list rows** the cards render, computed in one batched query per list, never per card. Add it to `listMeetings` (`src/shared/entities/meetings/dal/server/queries.ts`) and to `pipeline-items.ts` (it selects only `scheduledFor` and `confirmedAt` today). Map it through `toCalendarEvent` / `ScheduleMeetingEvent`, which drop every homeowner field today. Shape:
   ```ts
   interface VisitMeter {
     texted: 'not_sent' | 'sending' | 'delivered' | 'failed'
     opened: boolean
     visitPageLive: boolean      // false until plan 4's page exists
     confirmed: { via: 'sms_reply' | 'in_app' | 'office', at: string } | null
     waitingReply: { text: string, at: string } | null  // an inbound message with no outbound after it
     nextReminder: { at: string } | null | 'skipped'
   }
   ```
2. **`meetingsRouter.messages.forMeeting({ meetingId })`** on `visitMessagesProcedure` (defined today, used by nothing). It returns:
   - the `planVisitMessages` steps;
   - the meter (as above, with times);
   - the chain's `meeting_messages` rows joined to `voip_messages` (body, status, delivered/failed at, failure reason) and actor first names;
   - the paused kinds, with who paused and when;
   - the per-visit overrides (§5.3, item 3);
   - the invite state (`homeownerInvitedAt` plus the refusal, §5.3 item 4);
   - the page opens.

   It also needs a `meetingsRouter.messages` sub-router, which does not exist yet.
3. **The conversations routes:**
   - `voipRouter.conversations.list({ tab: 'visits' | 'newest' | 'archived', q, didId })` → threads on the lines the caller may see (§5.4); `didId` (a line, or `'all'`) narrows it for super-admins and is ignored for everyone else. Each thread carries: id, customer (id, name, city, lead source, stage label) or the unknown number, last message preview and time, `unread`, `needsReply`, `failedLast`, `archived`, and the upcoming visit (meeting id, `scheduledFor`, `visitMeter`) when there is one. Search covers names, numbers and message text.
   - `voipRouter.conversations.thread({ threadId })` → messages oldest first, each labelled by source: the `meeting_messages.kind` when the text belongs to a visit message, else the staff first name, else "Automatic reply". It also returns homeowner events and the coming-up steps for the upcoming visit.
   - There is no `voipRouter` today, only `voipCampaignsRouter`; a new router file is needed.
4. **`quickMessagesRouter.list()`** → all quick messages in order.

### 5.2 Writes

**Used as-is:**
- `meetingsRouter.business.sendVisitSummary` (`visitMessagesWriteProcedure`), for Send and Resend;
- the existing Reschedule, customer edit and meeting actions.

**New:**

1. `meetingService.messages.skip({ meetingId, kind })` / `unskip`, as §7.5 already specifies (a `skipped` row with reason `manual` for the current time; unskip deletes it before the planned time). They are routed as `meetingsRouter.messages.skip` / `.unskip`.
2. `meetingService.messages.setOverride({ meetingId, kind, body })` / `clearOverride`. The body is validated with `validateVisitMessageTemplate` and the required tokens.
3. **Staff send from the main line.** `voipRouter.conversations.send({ threadId, body })` calls `voipMessagesService.sendFromMainLine` with a new optional `actorUserId`, so the thread can say who sent it. Today it always writes `agentUserId: null`.
4. `voipRouter.conversations.setArchived({ threadId, archived })`, `markUnread({ threadId })` and `markRead({ threadId })`. The thread is marked read when it opens.
5. `voipRouter.conversations.linkCustomer({ threadId, customerId })`, for an unknown number.
6. `quickMessagesRouter.create`, `update`, `delete`, `reorder({ ids })` and `resetDefaults()`, which re-seeds from the constants.

### 5.3 Schema (run with `pnpm db:push:dev`; prod with `db:push:prod` only when the owner says)

1. **`voip_threads`**:
   - columns: `id`, `voip_did_id`, `remote_e164` (unique together), `customer_id` (nullable FK), `archived_at`, `last_read_at`, `last_message_at`, `created_at`;
   - an inbound message sets `archived_at = null` (a new text brings a thread back) and bumps `last_message_at`;
   - backfill: one row per distinct `(voip_did_id, remote_e164)` in `voip_messages` on the main line.
2. **`quick_messages`**: `id`, `command` (unique), `name`, `group_name`, `body`, `sort_order`, `created_by_user_id`, `updated_at`. It is seeded from `QUICK_MESSAGE_DEFAULTS` (§8).
3. **`visit_message_overrides`**: `meeting_id` (FK, cascade), `kind` (pausable kinds plus `visit_summary`), `body`, `updated_by_user_id`, `updated_at`, with the primary key `(meeting_id, kind)`.
   - The senders (`sendVisitSummary`, `run-automatic-kind`) must use the override body when one exists.
   - `handOffVisit` moves overrides to the reschedule replacement, as it moves `homeownerInvitedAt`.
4. **`meetings.homeowner_invite_refused_at`** (timestamptz) and **`homeowner_invite_refused_reason`** (text). They are written where `scheduling.service.ts` handles Google's 400 today (it only logs), and cleared when the email changes or a later sync accepts the guest.
5. **`visit_page_opens`**: `id`, `meeting_id` (FK, cascade), `opened_at`. Plan 4's page writes it on load; plan 3 only reads it, so it has no rows until plan 4 ships.

### 5.4 Permissions

- **Grants:** `VisitMessages` (`read`, `update`) goes to `dispatcher` in `src/shared/domains/permissions/rules/dispatcher.ts`. Today no role grants it, so only super-admin passes.
  - Agents get nothing in this build (spec D25 stands for pre-meeting work).
- **Thread visibility by line** (§2.15). It is enforced in the conversations DAL, not only in the UI, following the CASL compiler patterns from #285:
  - super-admin: every line;
  - dispatcher: the main line only;
  - agent: their own sticky line, which is a rule added with the post-meeting build. Today agents have no `VisitMessages` grant, so they reach nothing.

  A reply always leaves from the thread's own line (`sendFromMainLine` for the main line).

  - The Conversations page, the visit sheet and quick-message management all gate on `VisitMessages`: `read` to see, `update` to send, skip, edit, archive and manage.
- **Client checks:** use `useAbility` (`@/shared/domains/permissions/client`). Actions are disabled with a reason, not hidden, except the nav item and the meter part, which do not render without `read`.
- **No phone numbers on these surfaces** except an unknown number, which is shown because it is the only identity.

### 5.5 Freshness

ADR-0006 keeps realtime to the meeting flow, so these surfaces poll:
- the open thread and an open visit sheet: every 5 s while visible;
- the conversation list: every 15 s;
- every list: refetch on window focus.

The existing `meeting.updated` event (`homeownerConfirmedAt`) also invalidates the meter. Moving to push is a follow-up.

## 6. Error handling and edge cases

- **A send fails at the provider:** the bubble shows "Not delivered: {plain reason}", and the Texted strip turns red when the failure is the visit summary. A 30006 or STOP disables the reply box with its reason.
- **No main line configured:** Send and the reply box are disabled with "No main line is configured." (the existing `precondition-failed` reason).
- **Rescheduled visit:** the sheet reads the reschedule chain, so the history keeps the earlier time's texts. Overrides travel with `handOffVisit`. Skips do not travel, because they are for a time.
- **Override no longer valid after a template change:** the override keeps its own body. The editor shows "Edited for this visit" so staff can reset it.
- **Quick message with unfillable fields:** hidden from the chips and dimmed in `/` (§3.3). Saving a quick message runs `findSectionErrors`; an unknown `[Field]` label stays literal text and shows a warning under the editor.
- **Duplicate command on save:** "That command is taken by {name}."
- **Two people in one thread:** there is no lock. Polling shows the other person's send within 5 s, and the reply box keeps its own draft per thread (in memory, keyed by thread id).
- **An archived thread gets a new text:** it moves back to the inbox and shows as unread.
- **Unknown number replies YES:** today it gets no automatic reply (open decision, §10). The page shows it with "Not matched to a visit…" and **Link to customer**.
- **Plan 4 not shipped:** the Opened page strip stays grey (`visitPageLive: false`), and the timeline shows no page events.
- **Loading:** the list and the thread use the dashboard's suspense and skeleton patterns, with no fades (memory: no fade anywhere). The visit sheet shows a skeleton of its steps until `forMeeting` resolves.
- **Empty thread** (just booked): "No texts with {First name} yet. The visit summary will be the first."

## 7. Verification

- **Static checks:** `pnpm tsc`, `pnpm lint`, `pnpm theme:check` (new bubble tokens on every rung, both schemes).
- **Playwright:** auth through `/api/dev/playwright-session`. Data comes from the existing dev meetings and `scripts/smoke-visit-flow.ts` (which creates and deletes its own rows); there is no seeding for visual checks. Viewports: 1440×900, 1024×768, 820×1180 and 390×844, in light and dark. Clear `.next` before judging CSS on a long-running dev server. Checks:
  1. **Schedule:** a card shows strips only; the `aria-label` names the three signals.
  2. **Pipeline (Fresh):** the meeting sub-card shows the strips plus the status line; card heights are equal across states.
  3. **Visit sheet:**
     - it opens on Sequence for a meeting with no unanswered reply, and on Conversation when a reply waits;
     - the sheet does not re-mount on Skip/Undo: the scroll position holds and the entrance runs once;
     - the editor blocks Save without the required fields and shows the segment count.
  4. **Conversations:**
     - the tabs, groups and Archived bucket work, and `?thread=` restores on reload;
     - the name opens the details sheet; View profile opens the customer profile modal;
     - `⋯` holds the actions.
  5. **Phone:** the list scrolls under the dock; an open thread fills the screen; the reply box's bottom edge sits flush (0 px gap); the thread scrolls and the page does not.
  6. **Quick messages:** `/` lists the groups; Manage edits, adds, reorders and resets; a change shows in another browser context after a reload (team-wide).
  7. **Elevation:** the computed background of each pane differs from the canvas, each pane has a border, and nested panels differ from their parent. Screenshot pairs go to `.playwright-mcp/` for an eye check in both schemes.
- **Hands-on:** the owner on a phone and a laptop: one booking call, one day-before scan, one reply.

## 8. Files

**Create:**
- `src/shared/modules/meetings/messages/components/`:
  - `visit-meter.tsx` (strips + line), `visit-meter-legend.tsx`;
  - `visit-messages-sheet.tsx`, `visit-message-steps.tsx`, one row file per step kind;
  - `visit-message-text-editor.tsx`.
- `src/shared/modules/meetings/messages/lib/`: `derive-visit-meter.ts` (pure, from the list-row facts), `visit-meter-copy.ts` (the status line).
- `src/shared/services/voip/components/`:
  - `conversation-thread.tsx`, `conversation-message.tsx`, `conversation-composer.tsx`;
  - `quick-message-chips.tsx`, `quick-message-menu.tsx`, `quick-messages-manage-sheet.tsx`, `quick-message-editor.tsx`.
- `src/shared/services/voip/lib/twilio-failure-copy.ts` (code → plain reason) and `src/shared/services/voip/constants/quick-message-defaults.ts`.
- `src/features/conversations/`:
  - `ui/views/conversations-view.tsx`;
  - `ui/components/conversation-list.tsx`, `conversation-row.tsx`, `conversation-details-sheet.tsx`, `conversation-timeline.tsx`;
  - `constants/`, `lib/`.
- `src/app/(frontend)/dashboard/conversations/page.tsx` (+ `loading.tsx`).
- shadcn items, through the CLI with `--dry-run` first: `src/shared/components/ui/message.tsx`, `bubble.tsx`, `marker.tsx`, `message-scroller.tsx`.

**Modify:**
- `overview-card.tsx`: the `VisitMeter` part and the `visitMeter` field.
- `meetings/constants/actions.ts`, `use-meeting-action-configs.tsx` and `meeting-actions-host.tsx`: the `visitMessages` action, hosting the sheet.
- The three card files in §4.2.
- `to-calendar-event.ts` and the schedule types.
- `get-sidebar-nav.ts`, and the mobile dock (Conversations replaces Meetings, §2.16).
- `roots.ts` (`dashboard.conversations`).
- `globals.css`: bubble tokens; the scroll utilities the chat items need (§9).

**Off limits to UI tasks:** everything in §5 (DAL, `src/trpc/`, schema, permissions rules, services). The owner runs those first.

## 9. Shared-file changes (approved by the owner 2026-10-13)

From the research note, verified against the repo on 2026-10-12:

1. **Tailwind** goes from `4.1.18` to ≥ 4.3 (inside `^4`). The chat items use `scrollbar-thin` (4.3) and `inset-s-1/2` (4.2). Our own `scrollbar-gutter-stable` utility in `globals.css` collides with 4.3's built-in one and must be removed.
2. **`@shadcn/react`** is added (MIT, peer `react>=19`, no dependencies). `message-scroller` uses it.
3. **The shadcn CLI** lists `button` as a dependency of `message-scroller`. Refuse the overwrite of our customised `button.tsx`, and add the `icon-sm` / `icon-xs` sizes by hand.
4. **The `scroll-fade` and `shimmer` utilities** (from `shadcn/tailwind.css`, which we do not import and our installed `shadcn` 4.0.2 lacks) go into `globals.css`.
5. **The `cn` import:** the chat items import `cn` from a `cn` package. Confirm the CLI rewrites it to `@/shared/lib/utils` (the `--dry-run` shows it); fix by hand if not.
6. **New tokens:** `--bubble-ours`, `--bubble-ours-foreground`, `--bubble-theirs`, `--bubble-theirs-foreground` (and `@theme` mappings).
7. **Safari:** the shipped `tinted` bubble needs Safari 18+ (`oklch(from …)`). We do not use `tinted`; the `ours` / `theirs` tokens are plain values.

## 10. Choices worth the owner's eye

1. **Access:** resolved (§2.15). Super-admins see all lines with a switcher; dispatchers see the main line; agents come later with their own line.
2. **Mobile dock:** resolved (§2.16). Conversations replaces Meetings for now.
3. **Freshness:** polling (5 s / 15 s) now, push later.
4. **Chips' rule:** the chips are chosen by the thread's state (§3.3). The owner rejected the next-step bar as inflexible; the chips stay small and fill the box without sending. Confirm they stay.
5. **Name of the feature:** "Quick messages" in the UI (the owner has said both "quick messages" and "templates"; "templates" already means the visit-message templates in code).
6. **Code placement:** the conversation components live in `src/shared/services/voip/components/` (texting is VoIP); the page lives in `src/features/conversations/`.

## 11. Out of scope and follow-ups

- **The homeowner-replies assistant** (owner, 2026-10-12): a specialised chatbot for pre-confirmation → confirmed → sat. Vercel AI Elements can host it in the thread pane later.
- **Post-appointment conversations** (follow-ups, proposal check-ins, offers): the details sheet will gain proposals and value then.
- **A unified customer timeline** across calls, texts, meetings and proposals.
- **More homeowner signals**, beyond the three the owner kept.
- **The unmatched-YES auto reply** (smoke-test GAP 5): still the owner's decision.
- **Agent lines and the post-meeting conversations:** agents + super-admins, each agent on their own line with a digital assistant that sends automated texts and alerts the agent. The visibility rule (§5.4) and the line switcher are built for it now; the agent grant and the assistant come then.
- **Rethink the mobile nav items** (owner, 2026-10-13): the dock's four slots were set before Conversations existed.
- **MMS images in the thread:** shadcn `attachment`.
- **Per-user read state:** `last_read_at` is shared by the team today.
- **Push updates** to replace polling.
- **A sidebar unread count** for Conversations.
- **The visit link** in the visit summary 404s until plan 4 ships (already true today; plan 3 does not change it).
- **Global template editing** (the §7.5 Sequence editor and the Paused switch): the per-visit editor ships here. Where the team-wide visit-message templates and pauses are edited is open; the Manage pattern from quick messages is the likely home.
