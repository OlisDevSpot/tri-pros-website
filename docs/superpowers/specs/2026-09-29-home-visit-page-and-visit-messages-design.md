# Home Visit Page and Visit Messages — Design

**Date:** 2026-09-29 · **Status:** approved 2026-10-05, building full v1 before launch (D24) · **Brainstorm:** 2026-09-29 session; the owner approved every section of the first draft. **Revised** 2026-09-29 after a stress test against the code, the booking call scripts, Twilio/FCC/iCalendar documentation and 180 days of meeting data. The owner ruled on the stress-test questions the same day (D13–D19; deferred items in §15). **Extended** 2026-09-29 with message control (§7.5, D20–D23). **Ruled and re-checked against the code** 2026-10-05 (D24–D27, §17, §18). **Plans:** `docs/superpowers/plans/2026-10-05-visit-messages-foundation.md` covers §12a step 1; the rest follow in §12a order.

## 1. Goal

Make booked meetings stick. A booked meeting should become a meeting that happens, with every decision-maker present and a homeowner looking forward to it. This is the #1 pre-meeting risk named in `docs/customer/journey-map.md:49-58` and `docs/sales/in-home-meeting-playbook.md:20-36`.

The means:
- a **home visit page** that the homeowner and Tri Pros both look at;
- a **confirmation track** with two sides: office → homeowner → rep;
- a short sequence of texts from the main line, plus a summary email with a calendar invite.

**Baseline** (dev = scrubbed prod, 167 non-project meetings in the last 180 days):
- 28% of meetings ended `cancelled` (32) or `no_show` (15);
- `confirmedAt` is set on 2 meetings, so today's confirmation rate is not measured at all;
- 27% are booked for the same day, 31% for the next day, 36% for 2–7 days out;
- 31% of customers have no email.

**Success** is a higher **Sit** rate (`CONTEXT.md` "Sit") and a lower share of meetings that end `cancelled` or `no_show`, measured as §13 defines. The data comes from `meeting_messages`, the homeowner-confirmation columns and meeting outcomes. No dashboard in v1.

## 2. Scope

**In v1**
- **Home visit page** at `/home-visits/<meetingId>?token=<shareToken>`. A homeowner opens it with the token; staff open it signed in. Staff see a staff bar on top.
- **Send visit summary.** The setter sends it by hand during the booking call (D13), as a meeting entity action; staff can resend it. It goes by SMS as an MMS with a contact card, and by email with an `.ics` invite.
- **Day-before reminder.** Sent automatically at 6:00 PM Pacific, unless a summary went out after noon that day (D14).
- **Rep confirmation.** Sent automatically at 8:30 AM Pacific on the meeting day. It is worded as the rep confirming.
- **Homeowner confirms.** By tapping *I'll be there* on the page, or by replying YES to any visit text. The office sees it on the page and on its meeting cards; only the office moves a meeting to **Confirmed** (D15).
- **Homeowner requests a new time.** The meeting outcome becomes `reschedule_needed` and the office is notified.
- **Twilio routes.** A status-callback webhook and an inbound-message endpoint (§7.3). They cover delivery status, opt-out, YES, and forwarding other replies to staff.
- **Staff Messages drawer.** Shows the meeting's sequence (what was sent, what is scheduled, what will be skipped and why), every visit text and email for the meeting and its reschedule chain, and the homeowner's replies.
- **Message control (§7.5, D22).** A dashboard **Visit messages page** with Upcoming, History and Sequence tabs.
  - Staff skip an automatic text for one meeting, and undo the skip.
  - A super-admin edits each text's wording and pauses the day-before reminder or the rep confirmation for every meeting.
  - Send times and the noon cutoff are fixed in code and shown read-only.
- **Calendar cancellation.** When a meeting whose invite went out is cancelled, the homeowner gets an email that removes the calendar entry (D17).

**Applies to** non-project meetings only (`isProjectMeeting`, `src/shared/constants/enums/meetings.ts:139`). A project meeting serves an existing project; the page's "what to expect → proposal" content does not fit it.

**Out of v1.** Recorded in §15 for later:
- the on-my-way button;
- the unconfirmed-visit alert;
- the time-change notice;
- post-visit texts and project-lifecycle texts;
- a main-line inbox UI, and replying from the main line at all (staff answer by calling, D16);
- a customer hub;
- any marketing texts;
- per-lead-source text templates (`leadSources.voipInHouseConfigJSON.transactionalSmsTemplates` stays unused), including a program-lead bridge line (deferred);
- a short-link alias for SMS;
- editable send times, editable email wording, and a *Send now* for a scheduled text (§15).

## 3. Owner decisions

| # | Decision |
|---|---|
| D1 | Confirmation has two sides and three confirmations, shown on one shared screen: **Booked** (office), **You** (homeowner), **{Rep}** (rep). |
| D2 | Homeowner actions: *I'll be there*, reply YES, and *Can't make it? Request a new time*. Partners are brought in by a request plus a share link (§8.1 item 3), not an attendee form. |
| D3 | Every visit message comes from **one main line**. The rep's personal touch lives in the copy and on the page, not in a different phone number. |
| D4 | The v1 texts are the summary (sent manually), the day-before reminder (automatic, 6 PM), and the rep confirmation (automatic, 8:30 AM). The 8:30 text *is* the rep's confirmation. The only other outbound text is the thank-you answer to a YES reply (§7.3). |
| D5 | Page content: what to expect and how to prepare, why homeowners trust us, and projects near you. No "what we heard" section. |
| D6 | The summary also goes by email, with a calendar invite. Reminders stay SMS-only. **Amended in review:** the sender is the existing single customer sender, `buildSenderFrom(rep)` → "{Rep} at Tri Pros Remodeling <notifications@…>" (`resend/constants.ts:10-14` keeps one mailbox for reputation). Replies and calendar RSVPs go to `RESEND_LEAD_INBOX` (info@). No `hello@` mailbox. |
| D7 | The link is shaped `home-visits/<meetingId>?token=…` and mirrors `ROOTS.public.proposalReview(id, token)`. The token belongs to the visit: a reschedule hands it to the replacement, and old paths redirect (§5). |
| D8 | Meeting verbs live in a new `src/shared/modules/meetings/`. It is started **out of order**, ahead of the consolidation, and documented as such (§4.2). |
| D9 | The arrival window runs from the **booked time to 30 minutes after**. |
| D10 | Verification uses a rules script (the `scripts/verify-analytics-rules.ts` precedent) plus `pnpm tsc` / `pnpm lint`, Playwright, and a manual owner gate. No new test runner. |
| D11 | Nothing on the §15 roadmap is marked "next". |
| D12 | The decision-maker ask is a polite request with a share link: *"We kindly request that everyone needed to make this decision is present during our meeting. Want to keep your partner in the loop? Copy link to meeting"* (owner, 2026-09-29). |
| D13 | The setter sends the visit summary by hand during the booking call. The booking scripts' step 5.7 ("reply yes to my text") points at it (§14). |
| D14 | The day-before reminder is skipped when a visit summary for the current time went out after 12:00 PM Pacific on the day before the meeting. A Fri 10 AM visit booked Thu 2 PM gets the summary and Friday's rep confirmation; booked before Thu noon, it gets all three. If no summary went out, the reminder still goes (safety net). |
| D15 | Only the office moves a meeting to **Confirmed** (`confirmedAt`; the `CONTEXT.md` meaning does not change). The homeowner's confirmation is a separate fact, **homeowner confirmed**, shown on the home visit page and on the office's meeting cards so the office can act on it. |
| D16 | No way to reply from the main line in v1. Staff answer replies by calling. |
| D17 | A cancelled meeting whose invite went out gets a calendar cancellation email. |
| D18 | The main line is the 213 DID for now. It will change later, so nothing assumes a fixed number. |
| D19 | The §3a vocabulary and the `features/visit-confirmation` folder are approved. |
| D20 | The legacy pgEnum columns on `meetings` convert to `text` in this push (§5) (owner, 2026-09-29). |
| D21 | The rep confirmation keeps "{Rep} just confirmed your home visit" for now, and is revisited when the team grows (owner, 2026-09-29). Its wording is an editable template (§7.5), so a change needs no code. |
| D22 | Visit messages are visible and controllable from the dashboard: the sequence, what was sent, what is scheduled, what was or will be skipped, and manual skipping (owner, 2026-09-29). **Wording + on/off:** a super-admin edits each text's wording and pauses the day-before reminder or the rep confirmation for every meeting. Send times and the noon cutoff stay in code and are shown read-only. Dispatchers, and agents on their own meetings, skip texts. |
| D23 | One planner, two views: a pure planner computes each step's state, the scheduled runs send exactly the steps it marks due, and the page and drawer display the same result (owner picked approach A, 2026-09-29). |
| D24 | Full v1 ships before any homeowner gets a text: every step of §12a, message control and the home visit page included (owner, 2026-10-05). |
| D25 | Visit-message surfaces (the Visit messages page, the Messages drawer, send summary, skip) are **super-admin only for now**. Dispatchers get them later, with the permissions rework (epic #285). **Agents are not in line for them:** an agent has no need to text the homeowner or to run the automatic texts, for the foreseeable future. This replaces D22's "dispatchers, and agents on their own meetings, skip texts" (owner, 2026-10-05, closing §17). |
| D26 | `EMAIL_DEV_OVERRIDE` covers **every** email outside production, not only visit emails. This reverses the 2026-08-11 ruling that left the variable out (owner, 2026-10-05). |
| D27 | The D22 terms in §3a are approved (owner, 2026-10-05). |
| D28 | **Code lives where its module will be** (owner, 2026-10-05). SMS and texting are not app-wide: they belong to a `voip` module (not yet created) that may use the app's entities. Until it exists, VoIP primitives go under the VoIP service (`src/shared/services/voip/lib/`) and move with the rest of VoIP later; VoIP client code sits with the VoIP entities. The same holds for meetings and customers, both due to migrate: new meeting-core code goes to `src/shared/modules/meetings/core/`, the address `entities/meetings/**` moves to. Nothing domain-specific in naked `src/shared/lib/`. Build with the module architecture in mind without coding defensively: no shims, no re-exports, no abstractions for a move that has not happened. |

## 3a. Vocabulary (approved, D19)

`CONTEXT.md:113` reserves **Stage** for pipelines, and `CONTEXT.md:93` avoids "rank / tier / featured" for portfolio projects. This spec uses:

| Term | Meaning | Code |
|---|---|---|
| **Home visit page** | The homeowner-facing page of one meeting. Never a synonym for the meeting row. | route `/home-visits/[meetingId]`, `HomeVisitView` |
| **Main line** | The one company DID that sends visit messages and receives their replies. Replaces "company line". | `voip_dids.is_main_line`, `getMainLineDid` |
| **Visit message** | A text or email Tri Pros sends about a meeting, or a homeowner's reply to one. | `meeting_messages` |
| **Visit summary**, **day-before reminder**, **rep confirmation** | The three sent texts (D4). With **confirmation reply** (the thank-you after a YES), **visit cancellation** (the calendar cancellation email, D17) and **homeowner reply** (inbound), they make up the message kinds. | `meetingMessageKinds` |
| **Confirmation track** | The three confirmations on the page: the office's (a visit message went out), the homeowner's (**homeowner confirmed**, or the office recorded **Confirmed**), the rep's (a rep confirmation went out for this time). Replaces "three-stage track". | `ConfirmationTrack`, `deriveConfirmationTrack` |
| **Homeowner confirmed** (added with D15) | The homeowner said they'll be there for this time: tapped *I'll be there* or replied YES. Shown to the office; never moves the pipeline. The office still sets **Confirmed**. | `meetings.homeowner_confirmed_at`, `homeowner_confirmed_via`, `MeetingOverviewCard.HomeownerConfirmed` |
| **Rep** | The meeting's `owner` participant (existing word). Homeowner copy uses the rep's name. | `meeting_participants.role = 'owner'` |
| **Portfolio match** | Existing term. "Projects near you" is a portfolio match ordered by distance. | `matchPortfolioProjects` |
| **Reschedule chain** | A meeting and the meetings it replaced, linked by `rescheduled_from_id`. | `getRescheduleChain` |

**Added with D22** (approved, D27):

| Term | Meaning | Code |
|---|---|---|
| **Visit messages page** | The dashboard page that shows and controls visit messages across meetings. Tabs: Upcoming, History, Sequence. | `/dashboard/visit-messages`, `VisitMessagesView` |
| **Sequence** | The ordered visit messages a meeting can get: visit summary → day-before reminder → rep confirmation. The confirmation reply and the visit cancellation are reactions, shown with it but not steps. | `VISIT_MESSAGE_SEQUENCE` |
| **Visit message template** | The wording of one visit text, with `{{tokens}}`. **Default** = the wording in code; **edited** = a super-admin's saved wording. | `visit_message_templates`, `VISIT_MESSAGE_TEMPLATE_DEFAULTS` |
| **Skip** | A person stops one automatic text for one meeting time. Recorded as a `skipped` visit message with reason `manual`; **Unskip** removes it before the text's time. | `meetingService.messages.skip` / `.unskip` |
| **Paused** | A super-admin stopped one automatic kind for every meeting until it is resumed. | `visit_message_pauses` |
| **Visit message plan** | Each sequence step's state for one meeting, computed from its visit messages, the rules, pauses and the current time. | `planVisitMessages` |

**Feature folder.** Feature names say what the feature does, never the entity (`features/meetings/` is the rule's ❌ example); `home-visits` is a synonym for the meeting. The folder is `src/features/visit-confirmation/` (D19). The route stays `/home-visits`.

## 4. Architecture

### 4.1 Where code lives

| Home | Owns |
|---|---|
| `src/features/visit-confirmation/` (new feature) | Page view and sections, `ConfirmationTrack`, `RepCard`, homeowner action bar, staff bar, Messages drawer UI (with its sequence section), link-preview card component, and the Visit messages page (`VisitMessagesView`: Upcoming, History, Sequence tabs; template card) |
| `src/app/(frontend)/home-visits/[meetingId]/` | Route page and layout (§8.5) |
| `src/app/(frontend)/dashboard/visit-messages/page.tsx` | Visit messages page route (§7.5); `ROOTS.dashboard.visitMessages`; a sidebar entry in `get-sidebar-nav.ts` |
| `src/app/api/home-visits/[meetingId]/{ics,preview-image}/route.ts` | Token-checked `.ics` download and link-preview image |
| `src/app/api/company/vcard/route.ts` | The company contact card (MMS media and *Save our contact*) |
| `src/shared/modules/meetings/` (new, §4.2) | Root `meetingService` (CRUD spread, `queries`, getters), the `business` child holding the verbs, and the `messages` unit: `meeting_messages` server-spec, dal (including its field list), service, `visit_message_templates` and `visit_message_pauses` DAL, `lib/` (planner, renderer, template validator, the `.ics` builder), `constants/` (kinds, template keys, defaults, tokens, the send schedule). `core/lib/` holds the new meeting-core rules (`arrival-window.ts`, `confirmation-reset.ts`), the address `entities/meetings/**` migrates to (D28) |
| `src/shared/services/voip/lib/` (new) | `sms-merge-template.ts` (the `{{token}}` pattern, `renderMergeTemplate`, `listMergeTokens`, the `MergeToken<TVars>` type) and `sms-segments.ts` (`countSmsSegments`, moved from `features/campaigns-admin/lib/` and made encoding-aware). VoIP primitives, not app-wide; they move into `modules/voip/` with the rest of VoIP (D28) |
| `src/shared/entities/voip-messages/components/sms-body-editor.tsx` (new) | The SMS body editor (textarea, token chips, segment and encoding counter), promoted from `CadenceMessageRow`. VoIP client code, so it sits with the VoIP entities until `modules/voip/` exists, never in `shared/components/` (D28); plan 3's UI process confirms the file. `insertAtCursor`, a plain textarea helper, moves to `src/shared/lib/insert-at-cursor.ts` |
| `src/shared/domains/permissions/` | The `VisitMessages` feature gate (§7.5) |
| `src/shared/entities/meetings/` (existing core; moves later) | New columns, the `update.before` rules and the `update.after` cancellation dispatch, client schemas, `MEETING_ACTIONS` entries, the **Send visit summary** action and dialog, the `MeetingOverviewCard.HomeownerConfirmed` part |
| `src/shared/entities/users/dal/server/` | Rep public-profile read (`getRepPublicProfile`) |
| `src/shared/entities/customers/dal/server/` | `findCustomersByPhone` (multi-row) and the portfolio distance read |
| `src/shared/modules/projects/core/lib/` | `matchPortfolioProjects`, moved from `features/meeting-flow/lib/` (second consumer) |
| `src/shared/services/voip/voip-messages.service.ts` | A shared send core extracted from `sendSms`, and `sendFromMainLine` on top of it |
| `src/app/api/webhooks/twilio/route.ts` (new) | Status callbacks (async webhook) |
| `src/app/api/voip/twiml/messaging-inbound/route.ts` (new) | Inbound messages (sync, returns TwiML) |
| `src/shared/services/email.service.ts` + `providers/resend/emails/` | Visit summary email template and dev override |
| `src/shared/lib/business-time.ts` (existing) | Pacific day and clock formatters and `businessDateTime`, added next to `businessDayWindow`; time in the business zone is app-wide |
| `src/shared/services/providers/upstash/jobs/` | `send-day-before-reminders`, `send-rep-confirmations` and `send-visit-cancellation`, registered in `src/app/api/qstash-jobs/route.ts` |
| `scripts/setup-visit-message-crons.ts` | Creates the two QStash schedules (`scripts/setup-gcal-cron.ts` precedent) |

The rule behind this split:
- The **page** belongs to a feature, because it is one surface's use of meetings. `ConfirmationTrack` and `RepCard` have one consumer, so they stay in the feature (code moves to the entity only when two features import it).
- Everything that says what a meeting *is* or what you can *do* to one belongs to meetings. That includes the send action, which appears on every meeting action surface.

### 4.2 The out-of-order meetings module

- `src/shared/modules/meetings/service.ts` exports `meetingService`. It follows the owner's module shape (customers-module spec D7):
  - `...meetingCrud` spread onto the service;
  - reads under a `queries` namespace (`meetingService.queries.getHomeVisitView`);
  - children as getters (`business`, `messages`). The `messages` child has the same shape: `meetingService.messages.queries.{forMeeting, upcoming, history, sequence, shareLink}` and the verbs `skip`, `unskip`, `saveTemplate`, `resetTemplate`, `setPaused` (§7.5);
  - peer services referenced only inside method bodies or getters;
  - every method takes `ctx` first. Jobs and webhooks pass `SYSTEM_CONTEXT`.
- The core has not moved yet. `meetingCrud`, schemas, components and hooks stay at `src/shared/entities/meetings/` until the consolidation moves them to `modules/meetings/core/`. The core gains only what §5 and §8.3 name.
- **The router follows the service (C17, `docs/codebase-conventions/service-architecture.md:75`).** Once `meetingService` exists it is the one server API for meetings. The verbs this spec touches move into `meetingService.business` and their router procedures become thin adapters:
  - `rescheduleMeeting` → `meetingService.business.reschedule` (§5);
  - `setOutcomeWithReason` → `meetingService.business.setOutcomeWithReason` (the homeowner's new-time request reuses it).

**Documentation (owner D8: "very clear").** Repo rules forbid a new `DOCS.md`, file banners and citing plans from code (`CLAUDE.md`), so it lives in three places:
1. **One trap comment in `modules/meetings/service.ts`**, in the ADR-0002 `@migration(<dependency>)` form (`docs/adr/0002-entity-server-system.md:197`). It states:
   - the meetings core still lives in `src/shared/entities/meetings`;
   - it moves to `./core` when `entities/` folds into `modules/`.
2. **An entry in the per-module carry list, §7 of `docs/superpowers/specs/2026-09-29-customers-module-design.md`.** It covers the meetings core move, the module being partly built, and the pieces this spec added.
3. **The project memory entry.**

### 4.3 One page, two viewers

The page's server component resolves the mode, then prefetches one query and renders through `HydrateClient` (the dashboard pages' pattern, e.g. `src/app/(frontend)/dashboard/schedule/page.tsx`):

| Visitor | Mode | Query |
|---|---|---|
| Session with dashboard access (`getCachedSession` + ability), and the scoped meeting read succeeds | **Staff**: the homeowner page plus the staff bar | `meetingsRouter.reads.homeVisitView` on `meetingProcedure` |
| Token matches a meeting | **Homeowner**: the page only | `meetingsRouter.homeVisit.view` on `systemProcedure` |
| Neither | 404 (`notFound()`). This does not reveal whether the meeting exists. | — |

A signed-in homeowner (a Google sign-in with role `user`) fails the dashboard check and falls through to the token. A staff read that returns FORBIDDEN or NOT_FOUND also falls through to the token.

**The page body renders one view, `HomeVisitView`**, built by `meetingService.queries.getHomeVisitView` in both modes. It contains:
- the homeowner's first name;
- the time and arrival window;
- the address (`formatCustomerAddress`);
- the rep public profile;
- the derived confirmation track;
- the office's note;
- the new-time request;
- the main-line number;
- nearby projects (card fields only).

The raw meeting row never leaves the server; `agentNotes`, `contextJSON` and `flowStateJSON` stay private. *View as homeowner* is exact by construction.

This deliberately does **not** copy the proposal page. There, the homeowner/agent split is client-side only, and the full row reaches token visitors (§16).

**The token sub-router** `meetingsRouter.homeVisit` is the only token-authorized surface. Every procedure is on `systemProcedure`:
- It resolves the token to a meeting.
- It exposes `view` (the read above) and two writes, `confirm` and `requestNewTime`. No procedure takes field data.
- The writes rate-limit per IP + token using the existing Upstash `Ratelimit` + `clientIp` (`funnels.router.ts:18-32,103-107`).

**Staff procedures** stay in the session-scoped trees:
- `meetingsRouter.reads.homeVisitView` on `meetingProcedure`;
- `meetingsRouter.business.resetShareLink` on `meetingProcedure`, mirroring `meetingService.business`;
- `meetingsRouter.business.sendVisitSummary` on the visit-messages procedure (§7.5);
- `meetingsRouter.messages.*`, mirroring `meetingService.messages` (§7.5): the Messages drawer read, `shareLink`, the Visit messages page reads, skip and unskip on the visit-messages procedure; template and pause writes on `superAdminProcedure`.

⚠️ **Trap:** do **not** set `meetingServerSpec.shareable`. `createCrudRouter` would then make meetings `crud.update` token-writable, and field checks run only `if (ctx.ability)` (`src/trpc/lib/create-crud-router.ts:83-95`). A sub-router-scoped `shareableMiddleware` does not work either: its token path wins over the session (`shareable-middleware.ts:39-48`), so a staff member holding a link could never reach staff mode. ADR-0002 rejected separate token procedures (`:145`); §14 records this exception as an amendment.

### 4.4 What is reused, generalized, or new

**Reused as-is**
- `EntityActionMenu` + `useMeetingActionConfigs`, which covers the confirm toggle, Reschedule and outcome.
- `formatCustomerAddress`, `BUSINESS_TIMEZONE`, `businessToday` / `businessDayWindow` / `addCalendarDays` (`src/shared/lib/business-time.ts`), and the company constants.
- Marketing trust components: `HeroTrustBadges`, `CredentialStrip` + `buildCredentials`, `Block`, fed by `reviews.ts` ratings. `ReviewCard` is **not** used: its only data is the placeholder `testimonials.ts` (§16).
- `getPortfolioProjects` (server-side), mapped to card fields before anything reaches the client. Its rows carry `customerId`, `address` and `homeownerName`.
- `matchPortfolioProjects`, `compareStoryStrength`, `hasHeroImage`.
- The `notifyHomeownerMoveForwardRequest` pattern (`notification.service.ts:85-129`): participants plus the system owner, via `webPushClient.sendToUsers`.
- The funnel `ImageResponse` precedent (`src/app/(frontend)/funnels/[trade]/opengraph-image.tsx`).
- `generateToken` (`src/shared/lib/generate-token.ts`).
- `buildSenderFrom`, `RESEND_LEAD_INBOX`, and the `List-Unsubscribe` header pattern (`email.service.ts:74-76`).
- `complianceService.canOutboundTo` / `addToDnc` (`src/shared/services/voip/compliance.service.ts`), until the customers module replaces them.

**Generalized.** These are explicit costs:
- **Rep public profile.** `AgentCard` is tied to the presentation, and `getByIdWithJoins` selects none of bio, quote, specialties, languages or certifications. The users entity gains `getRepPublicProfile`, an allow-listed read: display name (`nickname ?? first name`), `headshotUrl`, `bio`, `quote`, `yearsOfExperience`, `tradeSpecialties`, `languagesSpoken`, `certifications`. The feature's `RepCard` renders it. The presentation card stays as it is; converging the two is a later owner call.
- **Pacific time formatting.** `business-time.ts` gains the day and clock formatters the copy needs; the arrival-window text is a meetings rule (`modules/meetings/core/lib/arrival-window.ts`) built on them. `formatStringAsDate` (`formatters.ts:54`) is reused where its format fits. The private formatter in `notification.service.ts:23-34` is replaced by the shared one (a non-defensive move). SMS, email, page and `.ics` all use it.
- **Projects near you.** `matchPortfolioProjects` moves to `modules/projects/core/lib/` with its `PortfolioMatch` type and `FALLBACK_MATCH_COUNT`, and meeting-flow imports it from there (one change, no re-export).
  - Its trade input is the meeting's `flowStateJSON.tradeSelections`, captured at booking. When there are none, the lead's funnel trade (`customer_lead_attribution.funnelSlug`, `isFunnelSlug` → `getTradeFacts(slug).notionTradeId`) stands in as a trade-only selection.
  - It gains an optional distance input that orders each match group nearest first. Meeting-flow passes none and keeps today's order.
  - Distances come from a customers DAL read: the haversine distance between this customer's geocode and each portfolio project's customer geocode. Coordinates never leave the server and are never added to `getPortfolioProjects`, whose rows reach the public showroom (`showroomDisplay.getAll`).
  - It never uses `projectsRouter.showroomDisplay.getAll`, the known unauthenticated full-row read.
  - `SERVICE_AREA_CITIES` is not used: it maps 45 of the 750 service ZIPs.
- **SMS authoring** gets its second consumer: visit message templates (§7.5) next to campaign cadence messages. Moves are non-defensive: consumers switch and the old files are deleted in the same change.
  - `countSmsSegments` moves from `features/campaigns-admin/lib/sms-segments.ts` to `src/shared/services/voip/lib/sms-segments.ts` (D28). It becomes encoding-aware:
    - it returns `{ chars, segments, encoding: 'gsm7' | 'ucs2' }`;
    - GSM-7 extension characters count as two;
    - UCS-2 uses 70/67 per segment.

    Today it assumes GSM-7 (`sms-segments.ts:1-3`).
  - `insertAtCursor` moves from `features/campaigns-admin/lib/` to `src/shared/lib/insert-at-cursor.ts`.
  - The textarea, token chips and counter in `CadenceMessageRow` (`cadence-message-row.tsx:105-148`) become `SmsBodyEditor`. It takes the token list as a prop and counts the body rendered with the tokens' sample values, so `{{visit_link}}` counts as a full link. `CadenceMessageRow` composes it.
  - `SmsMergeToken` (`entities/voip-campaigns/lib/sms-merge-tokens.ts:16`) becomes `MergeToken<SmsMergeVars>`, built on the shared type. `renderSmsTemplate` (`services/voip/campaigns/lib/render-sms-template.ts`) calls the shared `renderMergeTemplate`. The template validator finds tokens with the renderer's own pattern, so the two cannot disagree.

**New**
- the page and its sections;
- `ConfirmationTrack`;
- the send dialog and staff bar;
- the `HomeownerConfirmed` card part;
- the Messages drawer;
- the two Twilio routes;
- the two scheduled runs and their setup script;
- the summary and cancellation email templates and the `.ics` builder;
- the vCard route;
- the link-preview image;
- the visit message planner, template validator and renderer;
- the Visit messages page;
- the `visit_message_templates` and `visit_message_pauses` tables.

## 5. Data model

The ADR-0005 placement rule applies: single facts about a meeting are columns; repeating history is a child table. Option sets are `text` columns with a const array and its type (`docs/codebase-conventions/enum-standardization.md`, no pgEnum without a DB-side consumer).

**`meetings`, new columns**
- `share_token text NOT NULL UNIQUE`.
  - Generated by `generateToken()` in `meetingCrud`'s `create.before`, as lead-sources generates its token in its create hook (`entities/lead-sources/dal/server/crud.ts:48`). Unlike lead-sources, no caller supplies a token: the hook always mints one, and the reschedule handoff swaps the original's token onto the replacement after the create (see *Client schemas* below).
  - A DB default `replace(gen_random_uuid()::text, '-', '')` exists only so the push fills existing rows. Application inserts always supply `generateToken()`.
  - Staff **Reset link** writes a fresh `generateToken()` through `meetingService.business.resetShareLink`.
- `new_time_requested_at timestamptz`: when the homeowner tapped *Request a new time*. A fact for measurement; the page's state follows the outcome.
- `homeowner_confirmed_at timestamptz` and `homeowner_confirmed_via text` (`sms_reply | in_app`, the `homeownerConfirmationOptions` set: every way a homeowner can confirm): the homeowner's own confirmation (D15). Only `meetingService.business.confirmByHomeowner` writes them; `confirmedAt` stays the office's.
- `rescheduled_from_id uuid`, FK `meetings`, `ON DELETE SET NULL`: the meeting this one replaced.

**Legacy pgEnum conversion.** This push touches `meetings`, so its three legacy pgEnum columns (`meeting_type`, `meeting_outcome`, `pipeline`, `db/schema/meetings.ts:25-27`) convert to `text` in the same push (`enum-standardization.md#legacy-pgenum-conversion`, D20).

**Client schemas.** `meetingSchemas` (the DAL spec schemas) keep the new columns so hook output survives: `createCrudDal` parses the spec schema *after* the hooks run (`create-crud-dal.ts:88,120`). The meetings crud router receives client schemas that omit `share_token`, `homeowner_confirmed_at`, `homeowner_confirmed_via`, `new_time_requested_at` and `rescheduled_from_id` (`createCrudRouter`'s own `schemas` config, `create-crud-router.ts:56,74`). Today every meeting column is agent-writable through `crud.update` (`abilities.ts:96`).

**Duplicate.** `duplicate.exclude` (`entities/meetings/dal/server/crud.ts:134`) adds `shareToken`, `homeownerConfirmedAt`, `homeownerConfirmedVia`, `newTimeRequestedAt` and `rescheduledFromId`. Otherwise a Duplicate copies the token and fails on the unique index.

**`meetings`, rule changes in the crud hooks** (`src/shared/entities/meetings/dal/server/crud.ts:60-77`)
- `update.before`: a moved `scheduledFor` clears `confirmedAt` (today's rule) and `homeowner_confirmed_at` / `homeowner_confirmed_via`. Both confirmations hold for one time.
  - The existing clear runs only when `confirmedAt` is set, so the guard is restructured to clear either confirmation.
  - `new_time_requested_at` is kept; it records what the homeowner did.
  - **Deferred (owner, §15):** a moved time does not reset a `reschedule_needed` outcome. After an in-place time edit, `bool_or(meetingOutcome = 'reschedule_needed')` (`pipeline-items.ts:215`) keeps the customer in the kanban Reschedule stage, and the meeting stays ineligible for visit messages, until staff change the outcome. The Reschedule action does not have this gap, because it cancels the original.
- `update.after`: on a transition to `cancelled`, dispatch `send-visit-cancellation` (§7.1), next to the existing Google Calendar removal (`entities/meetings/DOCS.md#gcal-removed-on-cancel`).
- The Google Calendar inbound sync moves times with a raw update (`entities/meetings/dal/server/google-calendar.ts:122-133`) that bypasses these hooks. It already mirrors the `confirmedAt` clear in SQL (`:130`), and it mirrors the homeowner-confirmation clear the same way.

**`meeting_messages`, a new child table** (`modules/meetings/messages/`: server-spec, dal, service)

| Column | Notes |
|---|---|
| `id`, `created_at`, `updated_at` | standard helpers |
| `meeting_id uuid NOT NULL` | FK `meetings`, `ON DELETE CASCADE` |
| `kind` | `visit_summary \| day_before_reminder \| rep_confirmation \| confirmation_reply \| visit_cancellation \| homeowner_reply` |
| `channel` | `sms \| email` |
| `for_scheduled_for timestamptz NOT NULL` | the meeting time this message described (for a homeowner reply, the meeting time when it arrived) |
| `status` | `pending \| sent \| failed \| skipped \| received` (`received` = a homeowner reply) |
| `reason text` | why a row is `failed` or `skipped`: `twilio:<code>`, `send_error`, `dnc`, `no_phone`, `no_email`, `booked_after_noon` (D14), `paused`, `manual` |
| `voip_message_id uuid` | FK `voip_messages`, `SET NULL` (the SMS leg or the reply) |
| `email_provider_id text` | Resend id (the email leg) |
| `actor_user_id text` | FK `user`, `SET NULL`: who sent a summary or skipped a step; null means automatic |
| `note text` | the office note on a summary |

- A partial unique index on `(meeting_id, kind, channel, for_scheduled_for) WHERE kind IN ('day_before_reminder', 'rep_confirmation', 'visit_cancellation')` makes the automatic sends idempotent. Summaries can be resent. QStash delivers at least once, so this index is the only dedupe; the QStash message id is not used. A manual skip is a row under the same index, which is how it stops the run (§7.5).
- The const arrays and their types live in `modules/meetings/messages/constants/` (a module's own option set may be co-located, `enum-standardization.md` "Exception").
- **Visibility.** The unit's server spec declares `meetings` as its `parent` and no `visibility` of its own, like `proposal_views` (`modules/proposals/views/server-spec.ts`): a viewer sees the visit messages of the meetings they can see. Who reaches the visit-message surfaces at all is the `VisitMessages` gate (§7.5, D25).

**`visit_message_templates`, a new table** (`modules/meetings/messages/`): a super-admin's edited wording. A row exists only for an edited template. Code holds the defaults, and **Reset to default** deletes the row. Nothing is seeded.

| Column | Notes |
|---|---|
| `key text PRIMARY KEY` | `visit_summary \| day_before_reminder_unconfirmed \| day_before_reminder_confirmed \| rep_confirmation \| confirmation_reply` (`visitMessageTemplateKeys`) |
| `body text NOT NULL` | validated on save (§7.5) |
| `updated_by_user_id text` | FK `user`, `SET NULL` |
| `created_at`, `updated_at` | standard helpers |

**`visit_message_pauses`, a new table:** a row means that automatic kind is paused for every meeting; **Resume** deletes it.

| Column | Notes |
|---|---|
| `kind text PRIMARY KEY` | `day_before_reminder \| rep_confirmation` (`pausableVisitMessageKinds`) |
| `paused_by_user_id text` | FK `user`, `SET NULL` |
| `created_at` | when it was paused |

Neither table goes through `createCrudRouter`: their writes are super-admin verbs on `meetingService.messages` (§7.5). `app_settings` (one JSON blob per feature, `db/schema/app-settings.ts`) is not used: nothing reads or writes it today, and these are fixed fields (ADR-0005).

**`voip_dids`, new column**
- `is_main_line boolean NOT NULL DEFAULT false`, with a partial unique index `WHERE is_main_line` (the `is_primary` index precedent, `voip-dids.ts:31-33`), so at most one DID is the main line.
- A voip-dids DAL query, `getMainLineDid`.

**Reschedules keep the link.** `meetingService.business.reschedule` replaces the router's `rescheduleMeeting` (`src/trpc/routers/meetings.router/business.router.ts:86`, `entities/meetings/DOCS.md#reschedule-cancels-and-rebooks`). It keeps today's order and is not one transaction: `meetingCrud`'s after-hooks dispatch jobs and write participants outside a threaded transaction (`entities/meetings/dal/server/crud.ts:36-38`).
1. create the replacement with `rescheduled_from_id` = the original and a token of its own;
2. copy participants and cancel the original (today's steps);
3. hand the token over in one small transaction on the meetings DAL (`handOffShareToken`): the original gets a fresh token and the replacement takes the original's;
4. write the customer note.

A failure before step 3 leaves the original's token where it was.

The page looks meetings up **by token**. When the token belongs to a different meeting than the path's `meetingId`, it redirects to that meeting's path with a `moved` search param, which shows the banner.

`getRescheduleChain(meetingId)` (meetings DAL, recursive CTE on `rescheduled_from_id`) returns the meeting and its predecessors. Visit messages are read across the chain, so a replacement keeps its history, its office confirmation and its YES target.

## 6. The confirmation track

`deriveConfirmationTrack(meeting, chainMessages)` is a pure function in `modules/meetings/messages/lib/`.

| Confirmation | Done when | After the time moves |
|---|---|---|
| **Booked** (office) | any `sent` outbound visit message exists in the chain | Still done. Staff see **"Time changed since the summary, resend"** when no summary exists for the current `scheduledFor`, and **"Summary not sent"** when none exists at all. |
| **You** (homeowner) | `homeowner_confirmed_at` is set, or the office recorded `confirmedAt` (a phone confirmation) | Both cleared by the `update.before` rule; a reschedule's replacement starts unconfirmed |
| **{Rep}** | a `sent` `rep_confirmation` exists in the chain **for the current `scheduledFor`** | Pending again with no clearing code, because the lookup is keyed by time |

A homeowner reached only by the day-before reminder therefore sees the office confirmation done. The office sees the homeowner's confirmation on its meeting cards (§8.3) and moves the meeting to **Confirmed** itself (D15).

Because the automatic runs look for "no message **for this time**", a moved meeting re-arms both the reminder and the rep confirmation by itself.

## 7. Messaging

### 7.1 Sends

**Eligibility.** One pure predicate, `isVisitMessageEligible`, in `modules/meetings/messages/lib/`:
- non-project (`isProjectMeeting`);
- outcome still `not_set` (not in `DECIDED_OUTCOMES`, `constants/enums/meetings.ts:156`). This excludes cancelled, no-show and `reschedule_needed` meetings, whether staff or the homeowner set them;
- `scheduledFor` in the future.

**Visit summary** (manual; the setter sends it during the booking call, D13): `meetingService.business.sendVisitSummary(ctx, { meetingId, note? })`
- **Who.** `update VisitMessages` on a meeting the sender can see (§7.5; a super-admin for now, D25).
- **Preconditions.** The meeting is eligible. A main line is configured. In production, the 10DLC campaign SID is set.
  - Per-meeting failures disable the action with the reason (§8.3).
  - System failures (no main line, no campaign SID) are shown in the send dialog.
- **SMS leg:** `voipMessagesService.sendFromMainLine`.
  - `sendSms` cannot send from the main line: it requires the agent's sticky DID (`voip-messages.service.ts:139`). Its steps become a shared send core that both use: the do-not-contact gate (`:107`), the 10DLC gate, the dev override (`:152`), the `queued` row (`:155`), `statusCallback`, and the Twilio call.
  - The 10DLC gate keys on `VERCEL_ENV === 'production'` (the `environment` convention), not `NODE_ENV` (`:131`), which preview deploys also set.
  - `sendFromMainLine` sends `from` the main line with `agentUserId` null. It adds `mediaUrl` to the Twilio params (`buildTwilioMessageParams`, `:71-82`).
  - Twilio error **21610** (recipient opted out at the carrier) records the leg as `skipped`, reason `dnc`.
  - The summary is sent as **MMS** carrying the company contact card (`mediaUrl` → the vCard route).
- **Email leg**, when the customer has an email:
  - React Email template, sender `buildSenderFrom(repName)`, `replyTo: RESEND_LEAD_INBOX`, the existing `List-Unsubscribe` mailto, and a plain-text part passed explicitly (no send passes `text` today).
  - An `.ics` attachment, sent as `text/calendar; method=REQUEST`:
    - `METHOD:REQUEST`;
    - `UID = <first meeting id of the reschedule chain>@triprosremodeling.com`, so a resend after a reschedule updates the same calendar entry instead of adding one;
    - `SEQUENCE` = the number of summary emails already sent in the chain;
    - `ORGANIZER` = `RESEND_LEAD_INBOX` (it receives RSVPs; an RSVP records no confirmation in v1), `ATTENDEE` = the homeowner;
    - duration `MEETING_ESTIMATED_DURATION_MS`, the address as `LOCATION`, and the page link.
  - An "Add to Google Calendar" link.
- One `meeting_messages` row per leg, with `actor_user_id` = the sender. The dialog reports each leg: sent, skipped + reason, or failed.
- If sent outside 8 AM–9 PM Pacific, the dialog warns first.

**The two automatic runs act on the plan (D23).** Neither run has rules of its own. Each loads its candidate meetings, computes `planVisitMessages` for each (§7.5), and acts on its kind's step when the step is `due`:
- with a `skipReason`, it records a `skipped` row with that reason (a conflict on the partial unique index means another delivery got there first);
- otherwise it claims and sends: insert a `pending` row (a conflict means skip), send with the current template, then record the outcome.

Rules for both runs:
- One failing meeting never stops the run.
- The run evaluates the plan at its **scheduled time** (today's 6:00 PM or 8:30 AM Pacific), not the wall clock. A QStash delivery a moment early therefore cannot turn a due step into a scheduled one and miss it.
- The run sends sequentially; the QStash route's `maxDuration` is 60 s. At today's volume (about one meeting a day) that is ample.

**Day-before reminder:** a QStash cron at `CRON_TZ=America/Los_Angeles 0 18 * * *` → `meetingService.business.sendDayBeforeReminders(SYSTEM_CONTEXT)`.
- **Candidates:** eligible meetings whose `scheduledFor` falls in tomorrow's Pacific window (`businessDayWindow(addCalendarDays(businessToday(), 1))`).
- **The planner skips it** (recorded as `skipped` rows) when:
  - D14: the chain has a `sent` `visit_summary` for the current `scheduledFor` whose `created_at` is after 12:00 PM Pacific on the day before the meeting (reason `booked_after_noon`). That homeowner got the summary hours ago; the meeting-day rep confirmation still goes;
  - the kind is paused (`paused`);
  - the customer has no phone (`no_phone`) or is on do-not-contact (`dnc`);
  - staff skipped it (`manual`, already a row).
- It sends even when no summary went out (safety net).
- The variant, confirmed or unconfirmed (§7.2), follows the track's **You** at send time.

**Rep confirmation:** `CRON_TZ=America/Los_Angeles 30 8 * * *` → `meetingService.business.sendRepConfirmations(SYSTEM_CONTEXT)`.
- **Candidates:** eligible meetings today.
- **Not applicable** (no row) when:
  - the owner participant is not a real rep (`getSystemOwnerId()`);
  - the meeting starts before 9:00 AM.
- Skipped for the same `paused`, `no_phone`, `dnc` and `manual` reasons as the reminder.

**Visit cancellation** (automatic, D17): the `update.after` dispatch (§5) runs `send-visit-cancellation` → `meetingService.business.sendVisitCancellation(SYSTEM_CONTEXT, { meetingId })`.
- It sends only when a summary email went out in the chain and the meeting has no successor. A reschedule also cancels its original, but the replacement continues the same calendar entry (same UID), so no cancellation goes out. The job checks at run time. A reschedule creates the replacement before it cancels the original, so the successor is always there to see.
- An email with an `.ics` sent as `text/calendar; method=CANCEL`: the same UID, `SEQUENCE` one above the last summary, `STATUS:CANCELLED`. Email only; no text.
- One `meeting_messages` row (`kind = visit_cancellation`, `channel = email`).

**Schedules as code.** `scripts/setup-visit-message-crons.ts` creates the two cron schedules with `qstashClient.schedules.create`, following `scripts/setup-gcal-cron.ts`: dry run by default, `--apply` to write, and a duplicate guard. It runs as `DRIZZLE_TARGET=prod NODE_OPTIONS="--conditions=react-server" pnpm tsx scripts/setup-visit-message-crons.ts`, with no `package.json` entry; it reaches `server-only` modules, as `gcal:cron:setup` does. All three job keys are registered in `src/app/api/qstash-jobs/route.ts`, whose unknown keys return 200 silently.

**Pausing automation** is the super-admin switch on the Sequence tab (§7.5). The QStash schedules keep running, and each run records the paused kind's steps as `skipped`, reason `paused`, so the History tab shows what a pause withheld. Resuming does not resend a run that already happened.

**First-message rule.** "Reply STOP to opt out" is included whenever the main-line thread with that number has no earlier outbound message. The summary always includes it. The renderer appends it; it is not part of any template, so an edit cannot remove it.

### 7.2 Copy

All SMS copy is **GSM-7 only**: no emoji, curly quotes or em dashes, because any of them switches the message to UCS-2 and roughly triples its cost. The MMS summary is billed per message, not per segment. With the full link (about 117 characters), a reminder is two segments.

The rep is named `nickname ?? first name`, and the copy never uses a pronoun for the rep.

The texts below are the **default templates** (`VISIT_MESSAGE_TEMPLATE_DEFAULTS`, in `modules/meetings/messages/constants/`). A super-admin can replace each one with edited wording (§7.5). Sends render whichever is current with `renderVisitMessage(body, vars, { stopLine })`, a pure function in `modules/meetings/messages/lib/` built on the shared `renderMergeTemplate`. The renderer:
- collapses the double space an empty `{{office_note}}` leaves;
- appends the STOP line under the first-message rule (§7.1).

The verify script (§11) checks that every default passes the template validator. Wording is polished during the build.

| Template key | Default |
|---|---|
| `visit_summary` | `Hi {{first_name}}, this is Tri Pros Remodeling. Your home visit is booked for {{visit_date}} at {{visit_time}} with {{rep_name}}. {{office_note}} Meet {{rep_name}} and see your visit details: {{visit_link}} Reply YES to confirm.` |
| `day_before_reminder_unconfirmed` | `Hi {{first_name}}, a reminder that {{rep_name}} from Tri Pros Remodeling will see you tomorrow, {{visit_date}} at {{visit_time}}. Reply YES to confirm, or request a new time here: {{visit_link}}` |
| `day_before_reminder_confirmed` | `Hi {{first_name}}, see you tomorrow at {{visit_time}}! {{rep_name}} is looking forward to meeting you. Your visit: {{visit_link}} - Tri Pros Remodeling` |
| `rep_confirmation` | `Good morning {{first_name}}! {{rep_name}} just confirmed your home visit and is scheduled to arrive between {{arrival_window}}. Your visit page: {{visit_link}} - Tri Pros Remodeling` (D21) |
| `confirmation_reply` | `Thank you, {{first_name}}, you're confirmed for {{visit_date}} at {{visit_time}}. See you then! - Tri Pros Remodeling` |

**Visit cancellation (email, fixed wording):** subject `Your home visit on {Wed, Oct 7} is cancelled`; the body gives the visit time and "Questions or want a new time? Call or text us at {main line}." The summary email's wording is fixed too. Emails are not templates in v1 (§15).

In the day-before variants, *confirmed* means the track's **You** (§6).

**Tokens** (`VISIT_MESSAGE_TOKENS`, `MergeToken<VisitMessageVars>`):

| Token | Renders | Sample |
|---|---|---|
| `first_name` | the customer's first name | Maria |
| `rep_name` | the rep's `nickname ?? first name`; **"your rep"** when the meeting has no rep (system owner) | Oliver |
| `visit_date` | Pacific date | Wed, Oct 7 |
| `visit_time` | Pacific time | 10:00 AM |
| `arrival_window` | the arrival window (D9) | 10:00 and 10:30 AM |
| `visit_link` | `publicUrl(ROOTS.public.homeVisit(meetingId, token))` | the full link |
| `office_note` | the note typed in the send dialog (`visit_summary` only) | empty |

The rep confirmation needs no fallback because it never sends without a rep (§7.1). Dispatcher bookings land system-owned, so the summary and reminder often use "your rep". The Sequence tab previews both forms.

`{{visit_link}}` = `publicUrl(ROOTS.public.homeVisit(meetingId, token))`. `publicUrl` is `src/shared/config/public-url.ts`. The new `ROOTS` builder mirrors `proposalReview` (`roots.ts:110`). The `/home-visits` prefix is added to `NAV_PATH_RE` (`eslint.config.js:7`).

### 7.3 Replies

Two routes, per `docs/codebase-conventions/webhook-routes.md:156`:
- **`/api/webhooks/twilio`** (async webhook) receives status callbacks. `sendSms` already points `statusCallback` there (`voip-messages.service.ts:24`), but the route has never existed.
- **`/api/voip/twiml/messaging-inbound`** (sync) receives inbound messages and returns TwiML: an empty `<Response/>`. The YES auto-reply goes out through `sendFromMainLine` as a `confirmation_reply` visit message, so it is recorded, shows in the drawer and gets status callbacks.

Both routes:
1. Verify `twilioClient.verifyWebhookSignature` (`providers/twilio/client.ts:197-204`) against the exact public URL (`VOIP_WEBHOOK_BASE_URL` + path + query). A bad or missing signature returns **401**; a malformed envelope returns 400; a handler failure returns **200** and is logged (`webhook-routes.md` Rule 4). The doc comment above `verifyWebhookSignature` (`:196`) says 403; it is corrected to 401 in the same change.
2. Parse with the Zod schemas in `providers/twilio/webhooks/messaging.ts`. The inbound schema gains `OptOutType` and `MessagingServiceSid`.
3. Call `meetingService.business` or `voipMessagesService`; the routes hold no business logic.

**Status callbacks.** `voipMessagesService.applyStatusCallback` (`:229`) is today a plain pass-through to `patchMessageStatusByProviderId` (`entities/voip-messages/dal/server/mutations.ts:71`). It gains two rules: map Twilio's statuses that the DB enum lacks (`accepted`, `sending`, …), and never move a message backwards (a late `sent` does not overwrite `delivered`). A `failed` or `undelivered` **visit summary** pushes to the meeting's participants and the system owner: "Text to {name} failed, call them." Error 30006 (landline) arrives this way.

**Inbound matching.** The sender's number is normalized with `toNationalDigits` and looked up with `findCustomersByPhone`, a new multi-row query (`findCustomerByPhone` returns one row, `customers queries.ts:101-115`). The **matched meeting** is the soonest eligible meeting within the next 7 days, across those customers, whose reschedule chain has at least one `sent` outbound visit message. Every reply is stored in `voip_messages` on the main-line thread `(voipDidId, remoteE164)`, and a matched reply also gets a `meeting_messages` row (`kind = homeowner_reply`, `status = received`). Idempotency comes from `provider_message_id UNIQUE` (`upsertInboundMessage`).

Keywords follow Twilio's semantics: **the whole message**, trimmed, lowercased and stripped of punctuation, must equal a keyword. A reply that merely starts with one is "anything else".

| Payload | Action |
|---|---|
| `OptOutType = STOP` (Advanced Opt-Out reports what Twilio did) | Record. Mark every customer with that phone do-not-contact (`addToDnc`, reason `stop_keyword`). Push to the matched meeting's participants and the system owner: "{name} texted '{body}' and is opted out of texts. Call them about {visit time}." Twilio sends the carrier-required reply. |
| `OptOutType = START` / `HELP` | Record. Twilio's replies apply. START notifies the office, and does **not** clear do-not-contact (which also covers calls). |
| Confirm keyword (`yes`, `y`, `confirm`, `confirmed`; list in `modules/meetings/messages/constants/`) | `meetingService.business.confirmByHomeowner(ctx, { meetingId, via: 'sms_reply' })` on the matched meeting when the homeowner has not confirmed it, then send the auto-reply (a `confirmation_reply`). It never sets `confirmedAt` (D15). Already homeowner-confirmed: no-op, no reply. No match: treat as "anything else". |
| Anything else | Record, then push to the matched meeting's participants and the system owner ("{name} replied: …"), linking to the staff Messages drawer. No auto-reply. Unmatched replies push to the system owner only. |

**Free-text opt-outs.** Since April 2025, the FCC requires honoring a revocation "by any reasonable means" within 10 business days (47 CFR 64.1200(a)(10)). A reply like "stop texting me" arrives as "anything else", and the Messages drawer offers **Mark do-not-contact** for it (`complianceService.addToDnc`, reason `customer_request`, through a customers router procedure; `customerService.business.markDnc` once the customers module lands).

**Messages drawer reads** go through `meetingService.messages.queries.forMeeting(ctx, { meetingId })` on the visit-messages procedure (§7.5). It returns:
- a small header: customer first and last name, visit time, rep, and whether the customer has a phone and an email;
- the meeting's visit message plan;
- the chain's `meeting_messages` joined to their `voip_messages` rows.

Visibility follows the meeting (§5), behind the `VisitMessages` gate (§7.5). The join reads the `voip_messages` rows directly: main-line rows have no `agentUserId`, so that table's own visibility (`entities/voip-messages/lib/visibility.ts:16`) would hide them. *Mark do-not-contact* is a customers procedure under the customer's own scope, shown only to viewers who can update that customer.

### 7.4 Compliance and environments

- **Do-not-contact checks** use the API that exists at build time. Today that is `complianceService.canOutboundTo` / `addToDnc`. The customers-module spec replaces them with `customerService.queries.canContact` and `customerService.business.markDnc` in its **Phase 3** (§5.3), not Phase 0.
- **Opt-out detection** on the main line uses `OptOutType`, not a keyword list. The customers spec's merged `isStopKeyword` matches the first token and includes `cancel`, `end`, `remove` and `revoke` (`customers-module-design.md:245`). It must not be applied to main-line replies, where "Cancel, can we do Thursday?" would mark the customer do-not-contact (§14).
- The A2P campaign is **Customer Care** (`docs/plans/voip-in-house/phase-0-setup.md:73`). Everything in v1 fits it, including MMS. The repo records the campaign as SUBMITTED on 2026-05-22 with approval unconfirmed, and its sample text is not in the repo (§12).
- **Consent.** Telemarketing bookings record no SMS consent: the intake has no consent field and the booking scripts have no consent line. Informational texts need prior express consent, which may be verbal, and 10DLC vetting requires the campaign's message flow to describe it. The booking scripts gain the consent question (§14), and the campaign describes it (§12).
- New env `EMAIL_DEV_OVERRIDE` (D26): outside production **every** email goes to that address, and a send is refused when it is not set. The guard sits in the Resend client, the one place email leaves the app. It is declared in `resendEnvFragment` and rejected in production after parse, like `VOIP_DEV_OVERRIDE_NUMBER` (`server-env.ts:186-190`, `VERCEL_ENV`).
- Texts get the same floor: outside production the send core refuses to send unless `VOIP_DEV_OVERRIDE_NUMBER` is set. The dev database holds real customer phones and emails (the refresh scrub leaves them), and the 10DLC gate stops covering preview deploys once it keys on `VERCEL_ENV`.

### 7.5 Message control (D22, D23)

Staff can see what each homeowner got, what goes out next and why something will not go, and stop a text for one meeting. A super-admin changes the wording and pauses an automatic kind. Everything shown comes from the one planner the runs obey, so "scheduled" on screen is what the run will do.

**The planner.** `planVisitMessages(input)` is a pure function in `modules/meetings/messages/lib/`. It takes:
- the meeting: `id`, `scheduledFor`, `createdAt`, whether it is a project meeting, its outcome, and whether its owner is a real rep;
- the chain's `meeting_messages`;
- contact facts: whether the customer has a phone and whether they are on do-not-contact (one batched read per page or run, never per row);
- the paused kinds;
- `now` (a run passes its scheduled time, §7.1).

It returns one step per sequence kind, in `VISIT_MESSAGE_SEQUENCE` order (`visit_summary`, `day_before_reminder`, `rep_confirmation`): `{ kind, plannedFor, state, reason?, row?, variant? }`.

**Planned times** come from `VISIT_MESSAGE_SCHEDULE` in `modules/meetings/messages/constants/`. `scripts/setup-visit-message-crons.ts` builds its cron expressions from the same constant, so the page and the schedules cannot drift.

| Step | Planned for | Window closes |
|---|---|---|
| Visit summary | none (manual, D13) | — |
| Day-before reminder | 6:00 PM Pacific the day before; D14 cutoff 12:00 PM that day | midnight, when "tomorrow" stops being true |
| Rep confirmation | 8:30 AM Pacific on the day, for visits at 9:00 AM or later | the visit time |

**States**, in order of precedence:

| State | When | The page shows |
|---|---|---|
| `sent`, `failed`, `sending`, `skipped` | A row exists for the current `scheduledFor`. The state is the row's status, with `pending` shown as `sending`; a `pending` row older than 10 minutes shows as failed (§10). Recorded rows win even if the meeting later became ineligible. | the result, reason and actor |
| `not_applicable` | A project meeting, a decided outcome, or a rep confirmation for a visit without a rep or before 9:00 AM | "Doesn't apply: {reason}" |
| `scheduled` | An automatic step whose planned time is ahead. `skipReason` is set when the run will record a skip: `booked_after_noon`, `paused`, `no_phone`, `dnc`. | "Sends {time}", or "Will skip: {reason}" |
| `due` | An automatic step whose planned time has passed, window still open, nothing recorded. The runs act on exactly these (§7.1). | "Sending now"; after 15 minutes, "Late: the run has not sent it" |
| `not_sent` | Nothing is recorded and nothing will send. For the summary before anyone sends it: reason `never_sent`, or `time_changed` when the chain has a summary for another time. For an automatic step whose window closed: `booked_after_run` when the meeting was created after the planned time, otherwise `no_record`. | "Not sent: {reason}"; the summary step offers **Send summary** |

`no_record` cannot tell an in-place time move from a failed run, because nothing records when `scheduledFor` last changed. The page says both.

Steps are keyed by the current `scheduledFor`, so a moved meeting re-arms both automatic steps (§6) and a skip covers one meeting time. `deriveConfirmationTrack` stays a separate function (§6); both read the same chain.

**Skip and unskip.** `meetingService.messages.skip(ctx, { meetingId, kind })` and `.unskip`.
- Only the two automatic kinds can be skipped. The summary is manual, and the confirmation reply and visit cancellation are reactions.
- **Skip** inserts `{ kind, channel: 'sms', for_scheduled_for: <current>, status: 'skipped', reason: 'manual', actor_user_id }`. It is allowed while the step is `scheduled` or `due`. A conflict on the partial unique index returns the recorded state.
- **Unskip** deletes that row. It is allowed only for a `manual` row for the current time, before the planned time. After that the run has passed, and removing the row would leave a step no run will send.

**Templates.** `meetingService.messages.saveTemplate(ctx, { key, body })` validates the body, upserts the row and records `updated_by_user_id`. `.resetTemplate(ctx, { key })` deletes the row, restoring the default.
- A send reads the current template when it renders.
- The History tab shows the body actually sent (`voip_messages.body`), so templates need no versions.

**The validator.** `validateVisitMessageTemplate(key, body)` is pure and lives in `modules/meetings/messages/lib/`. The editor runs it live; the save runs it again as the authority.

*Errors* (block the save):
- an empty body;
- characters outside GSM-7, each listed (curly quotes, em dashes, emoji; §7.2);
- unknown tokens, found with the renderer's own pattern;
- a token the key does not allow (`office_note` outside the summary);
- a required token missing:

  | Key | Required |
  |---|---|
  | `visit_summary` | `visit_link`, `visit_date`, `visit_time` |
  | `day_before_reminder_unconfirmed`, `day_before_reminder_confirmed` | `visit_link`, `visit_time` |
  | `rep_confirmation` | `rep_name`, `arrival_window`, `visit_link` |
  | `confirmation_reply` | `visit_date`, `visit_time` |

- the word STOP. The renderer adds the STOP line, and a second copy would repeat it.

*Warnings* (the save goes through):
- more than two segments when rendered with sample values. The summary is exempt, because it goes as MMS;
- `he`, `she`, `him`, `his` or `her` as a whole word, since the copy names the rep and never uses a pronoun (§7.2);
- the summary or the unconfirmed reminder no longer asks the homeowner to reply YES.

**The editor.** `SmsBodyEditor` (§4.4) gets the tokens the key allows and the live validator. Its preview renders sample values in both rep forms (named, and "your rep") and shows the appended STOP line where it applies.

**Pauses.** `meetingService.messages.setPaused(ctx, { kind, paused })` inserts or deletes the `visit_message_pauses` row.

**Who can do what** (D25: super-admins only for now)

| | super-admin | dispatcher | agent |
|---|---|---|---|
| See visit messages (page and drawer) | every meeting | later, with #285 | no |
| Send summary, skip, unskip | ✓ | later, with #285 | no |
| Edit wording, reset, pause, resume | ✓ | — | — |

- **One gate.** `VisitMessages` is a non-entity CASL subject, a feature gate like `LeadsPool` (`permissions/types.ts:32-39`). No role is granted it today, so only a super-admin (`manage all`) passes. The server's **visit-messages procedure** (`meetingProcedure` + `read VisitMessages`) and the client's action and nav gates check the same subject; writes check `update VisitMessages`.
- **Rows follow the meeting.** `meeting_messages` declares `meetings` as its parent (§5), so a viewer sees the visit messages of the meetings they can see. Widening later is a grant, not a rewrite. Dispatchers arrive with the permissions rework (epic #285), where a dispatcher sees every meeting.
- Until then the setter who sends the summary during the booking call (D13) is a super-admin. Of D22's "dispatchers, and agents on their own meetings, skip texts", the dispatcher half waits for that grant and the agent half is withdrawn (D25). The booking toast and the two meeting actions show only to someone who can `update VisitMessages`.
- Reps still see **Homeowner confirmed** on their meeting cards (a meeting fact, not a visit-message surface) and still get the push when a homeowner replies. That push opens the customer profile for anyone who cannot `read VisitMessages`.
- Template and pause writes use `superAdminProcedure` (`init.ts:93`), as campaign setup does (`voip-campaigns.router.ts:102`).
- These surfaces show customer names, visit times and message bodies, never phone numbers.

**The Visit messages page**
- **Route:** `/dashboard/visit-messages`, behind `protectDashboardPage`.
- **Nav:** a sidebar entry in the main group after Schedule (`get-sidebar-nav.ts`), enabled for `read Meeting`.
- **Tabs:** held in a `nuqs` search param. The server prefetches the active tab's query, as the campaigns page does (`dashboard/campaigns/page.tsx:29-36`).
- **Deep link:** `?meeting=<id>` opens that meeting's Messages drawer.

**Upcoming** (the default tab)
- Lists every automatic step planned from the start of today through the end of the day after tomorrow (Pacific), grouped by run, e.g. "Tonight 6:00 PM · Day-before reminders" and "Tomorrow 8:30 AM · Rep confirmations".
- Each group header counts will send, will skip, sent, skipped and failed. A paused kind shows a banner naming who paused it and when.
- Each row shows:
  - the customer, visit time and rep;
  - the state and reason, plus the variant for a reminder;
  - **Skip** / **Unskip** and **Open** (the drawer).
- **Summary not sent:** eligible meetings in the next 7 days whose summary step is `not_sent`, each with **Send summary** (the entity's send dialog).
- **Cost:** plans are computed on each load for the few meetings in the window. At about one meeting a day that is trivial.

**History**
- A records table (`DataTable`) over the `meeting_messages` rows in scope, newest first.
- Filters for status, kind and channel come from a field list, `MEETING_MESSAGE_FIELDS`, built like the meetings field list (`entities/meetings/dal/meeting-fields.ts`, `dal/server/meeting-field-sql.ts`) under the records epic.
- Each row shows: time, customer, visit time, kind, channel, status and reason, actor, delivery status, body. A row opens the drawer.

**Sequence**
- The sequence in order. Each step shows:
  - when it goes, read-only from `VISIT_MESSAGE_SCHEDULE` ("6:00 PM Pacific the day before. Skipped when the summary went out after noon that day.");
  - its template or templates, marked **Default** or "Edited by {name} · {date}", with a sample preview.
- The two reactions follow: the confirmation reply (a template) and the visit cancellation email (fixed wording).
- Super-admins also get the editor (Save, Reset to default) and, on the two automatic steps, the **Paused** switch.
- Anyone later given `read VisitMessages` without super-admin sees it read-only.

**The Messages drawer** (§8.3) opens with the meeting's sequence: the three steps with state, planned time, reason and actor, plus Skip and Unskip. The history follows. The staff bar and the Visit messages page open the same drawer.

**After booking (D13).** `CreateMeetingForm`'s create success (`create-meeting-form.tsx:66-74`) shows a toast when:
- the meeting is non-project;
- the viewer can `update VisitMessages`.

The toast reads "Meeting booked" with the action **Send visit summary**, which goes to `/dashboard/visit-messages?meeting=<id>`. The toast-with-action precedent is `proposal-flow/ui/components/table/index.tsx:111`. The form unmounts on success, so the action navigates to the drawer instead of opening a dialog in place. The setter sends the summary from there during the call (D13). The records spec edits the same form for its setter picker (§14).

## 8. The page

The visual design runs through `/ui-exploration` as the **first step of the page work** (§12a step 6; it needs no backend, so it can start any time): user flow → critique → studies → spec → `/impeccable`. It is mobile-first and in the marketing world per `DESIGN.md` ("Blueprint Authority"). This section fixes content and behavior only.

### 8.1 Homeowner content, top to bottom

1. **Hero.**
   - "Your home visit, {first}", the date/time and the address.
   - **Add to calendar** (`.ics` + Google link) and **Save our contact** (vCard).
   - On the day, the arrival window.
2. **Confirmation track.**
   - Booked → You → {Rep}.
   - While **You** is pending, the primary button is **I'll be there** (`homeVisit.confirm` → `confirmByHomeowner`, via `in_app`). The secondary is *Can't make it? Request a new time*, which asks for confirmation first.
3. **Everyone who decides (D12).** "We kindly request that everyone needed to make this decision is present during our meeting. Want to keep your partner in the loop?" with **Copy link to meeting** (`navigator.share` where available, falling back to copy). Copy lives in the feature's `constants/`.
4. **Meet your rep.** `RepCard`, then **Call or text us**. That button uses the main line, which forwards calls to the office (§12). The page shows only the main line, so replies land on the thread the visit messages came from.
5. **Note from our team**, only if one was sent.
6. **What to expect and how to prepare.** The agenda and a checklist.
7. **Why homeowners trust us.** Ratings (`reviews.ts`), license / insurance / bond, awards, stats.
8. **Projects near you.** 2–3 portfolio matches (§4.4) linking to `ROOTS.landing.portfolioProject(accessor)`.

### 8.2 States

| State | Page |
|---|---|
| Upcoming | as above |
| Confirmed | You ✓ (homeowner confirmed, or the office recorded **Confirmed**); primary becomes "You're all set" |
| New time requested | "Got it, we'll reach out shortly to find a new time"; confirm hidden |
| Day of | arrival window in hero; {Rep} ✓ once the 8:30 text went out |
| Moved | token belongs to another meeting → redirect + "Your visit moved to {…}" banner |
| Cancelled | "This visit was cancelled. Questions? Call or text us." |
| Past | "Thanks for having us" + contact |
| > 30 days past `scheduledFor` | "This link has expired" + contact. A page cannot return HTTP 410, and the page is `noindex`, so no special status. |
| No rep assigned (system owner) | "Your rep will be confirmed soon"; rep confirmation pending |

### 8.3 Staff mode

A sticky staff bar, clearly styled as the app world. It sits outside the page's `.theme-marketing` wrapper, because that class remaps the shadcn variables (Warm-Cool Border Rule). It holds:
- the confirmation track, with whether and how the homeowner confirmed, and the staff nudges (§6);
- **Send summary / Resend**;
- **Copy homeowner link**;
- **Reset link**, behind `useConfirm`;
- **View as homeowner**;
- the meeting's `EntityActionMenu` (its confirm toggle sets **Confirmed**);
- **Messages (n)**, which opens the Messages drawer: the sequence with Skip / Unskip, then the history (§7.5).

The dialog and drawer are code-split behind skeletons (heavy children are code-split, e.g. `add-customer-sheet.tsx`).

**Staff procedures** use the session, never the token sub-router (§4.3):
- The Messages drawer, the share token for *Copy homeowner link*, and *Send summary* use the visit-messages procedure (§7.5).
- *Reset link* is a `meetingsRouter.business` write on `meetingProcedure`.

**Outside the page**
- `MeetingOverviewCard` gains a `HomeownerConfirmed` part (D15): "Homeowner confirmed · by text / on the page · {time}", rendered only when `homeowner_confirmed_at` is set. It is composed into the dashboard meeting card (`dashboard-meeting-card.tsx`), the schedule card (`meeting-card.tsx`) and the kanban card (`customer-kanban-card.tsx:212`), where the office works the Needs Confirmation stage. Their queries select the two columns (the kanban's through `pipeline-items.ts`, which already selects `confirmedAt`).
- `MEETING_ACTIONS` gains `sendVisitSummary` (`['update', 'Meeting']`) and `openHomeVisit` (`['read', 'Meeting']`), as click configs with `on…` overrides in `useMeetingActionConfigs`.
- Actions cannot be hidden per meeting, only disabled (`entity-actions/types.ts:34-48`). `sendVisitSummary` is disabled with a reason for project meetings, past meetings and ineligible outcomes. `MeetingEntity` gains `meetingType` (`use-meeting-action-configs.tsx:41-48`).
- The surfaces that render meeting actions: the customer profile meetings list, the project entity card, the kanban card (both menus), the schedule card, the dashboard meeting card, the meetings table, and the records row toolbar. The calendar dot's `DotActions` ignores disabled reasons (`dot-actions.tsx:22-40`), so it leaves both actions out.

### 8.4 Link preview and asset routes

- **Preview image.** `generateMetadata` sets `og:image` to `/api/home-visits/<meetingId>/preview-image?token=…`, an `ImageResponse` route following the funnel `opengraph-image.tsx`. It shows the rep's photo, "Your home visit" and the date, at least 900 px wide (iMessage).
  - Next's `opengraph-image` file convention cannot read `?token=`, which is why a route is used.
  - The route needs its own `outputFileTracingIncludes` entry for the font and logo, as the funnel image has (`next.config.ts:58-62`); without it, production returns 500.
  - `generateMetadata` sets the whole `openGraph` block (title and description too), because Next replaces the root layout's block wholesale.
  - iMessage and Google Messages fetch previews client-side and ignore `robots.txt`. Previews from unknown senders need a tap, which *Save our contact* removes.
- **`.ics` download.** `/api/home-visits/<meetingId>/ics?token=…` serves the same file the email attaches (one builder).
- **vCard.** `/api/company/vcard` returns `text/vcard` with `Content-Disposition: attachment; filename="tri-pros.vcf"` (Twilio: a matching content type, a filename of 20 ASCII characters or fewer). Name, address, website and email come from the company constants, and the phone is the main line.
- `/home-visits` is added to the `src/app/robots.ts` disallow list; `/api` is already there.

### 8.5 Route layout

`src/app/(frontend)/home-visits/[meetingId]/layout.tsx` sits under the root `(frontend)` layout only (no site nav, footer or CTAs; no tracking scripts, since the Meta Pixel is mounted only in the funnels layout). It overrides what the root sets for the public site:
- `robots: { index: false, follow: false }` and no `alternates.canonical` (the root sets `index: true` and a canonical, `layout.tsx:92-105`);
- a `viewport` that allows pinch-zoom (the root sets `maximumScale: 1, userScalable: false`, `:108-115`);
- a `.theme-marketing` wrapper around the page body, because the marketing tokens exist only under that class (`globals.css:96-218`).

**Referrer policy** stays at the browser default (`strict-origin-when-cross-origin`), like the proposal page (`proposal-flow/proposal/[proposalId]/page.tsx:6-9`). Cross-origin requests (images, Google Calendar) then receive only the origin.

## 9. Security

- The token is 128 bits (`generateToken`), unique, revocable (Reset link), and the page shows "expired" 30 days after the visit.
- Homeowners get only `HomeVisitView`. Its exact field list is an allow-list checked by the verify script.
- Homeowner writes: two verbs, no field input, rate-limited per IP + token.
- Clients cannot write `share_token`, the homeowner-confirmation columns, `new_time_requested_at` or `rescheduled_from_id` (§5).
- Staff mode requires a session with dashboard access plus a successful scoped meeting read.
- Twilio routes: signature-verified; 401 otherwise.
- Portfolio distances are computed server-side; customer coordinates never reach a client or a public read.
- Never set `meetingServerSpec.shareable` (§4.3).
- Visit-message surfaces sit behind the `VisitMessages` gate (§7.5), which only a super-admin passes today (D25). They show no phone numbers.
- Only a super-admin changes wording or pauses a kind (`superAdminProcedure`). The server re-runs the validator on save, and the STOP line and required tokens cannot be edited away.

## 10. Failure handling and edge cases

| Case | Behavior |
|---|---|
| Summary: one leg fails | The other leg is unaffected. Row status and reason are recorded; the dialog shows each leg. |
| Summary: SMS delivery fails later (landline, 30006) | Status callback → office push |
| Recipient opted out at the carrier (21610) | Leg `skipped`, reason `dnc` |
| Automatic run: crash between claim and send | The `pending` row blocks a double send. The drawer shows `pending` older than 10 min as failed. |
| No phone / on do-not-contact / no email | Leg `skipped` with reason |
| No main line / 10DLC missing in prod | The send dialog shows the reason and does not send |
| Booked after noon for tomorrow (summary sent) | No day-before reminder; the summary and the meeting-day rep confirmation go (D14) |
| Booked for the same day after 8:30 | No rep text; the summary covers it |
| Meeting before 9:00 AM | No rep text |
| Two customers share a phone | YES confirms the soonest eligible meeting across them; STOP marks every row with that phone |
| Reply "Cancel, can we do Thursday?" | Not a Twilio opt-out (not a single word) → forwarded to staff as "anything else" |
| Reply "Yes but my husband can't make it" | Not a confirm keyword → forwarded to staff |
| Reply after a reschedule | Matches the replacement through its reschedule chain |
| Reschedule fails mid-way | The token handoff is the last write before the note, so the original keeps its token |
| Time edited in place after a new-time request | Stays `reschedule_needed` (kanban Reschedule, no visit messages) until staff change the outcome; deferred (§5, §15) |
| Meeting cancelled after its invite went out | Cancellation email removes the calendar entry (D17) |
| Reschedule | No cancellation email; the next summary updates the same calendar entry |
| Skipped text, then the time moves | The skip covered the old time. Both automatic steps re-arm for the new time; the old skip stays in history. |
| Unskip after the text's time | Not offered: the run has passed (§7.5) |
| Kind paused during a run's time | The run records `skipped`, reason `paused`. Resuming later does not resend. |
| Template edited between the preview and the run | The run sends the wording current at send time; History shows the body sent |
| Summary or reminder for a meeting with no rep | `{{rep_name}}` renders "your rep" (§7.2); no rep confirmation |
| Template saved with a curly quote or emoji | Rejected, with the characters listed |
| QStash delivers the run a moment early | The run evaluates the plan at its scheduled time, so the step is still due (§7.1) |
| The run never fires | Steps show "Late" after 15 minutes, then `not_sent` (`no_record`) once the window closes |
| A meeting is booked by someone who can `update VisitMessages` | The toast's **Send visit summary** opens the meeting's drawer on the Visit messages page (§7.5) |

## 11. Verification

- **`scripts/verify-visit-messages.ts`**, run with `pnpm tsx` like the analytics rules script: pure, `node:assert/strict`, no DB or env. It checks:
  - `deriveConfirmationTrack`, including a reminder-only meeting and a reschedule chain;
  - `isVisitMessageEligible`;
  - `planVisitMessages`:
    - every state and reason in §7.5;
    - the D14 skip rule (a summary after noon the day before skips the reminder; one before noon does not);
    - pauses; a manual skip; a moved time re-arming both steps;
    - `booked_after_run` against `no_record`;
    - a run evaluated at its scheduled time a moment early;
  - the cancellation rule (no cancellation for a reschedule's original);
  - every default template passes `validateVisitMessageTemplate`;
  - the validator rejects non-GSM-7 characters, unknown and disallowed tokens, missing required tokens, and STOP, and warns on pronouns, length and a missing YES;
  - `renderVisitMessage` output: the "your rep" fallback, the collapsed empty note, and the STOP line appended by the first-message rule;
  - `countSmsSegments` on GSM-7, extension characters and UCS-2;
  - whole-message keyword matching (a reply starting with YES is not a confirm);
  - `.ics` output (stable UID across a chain, SEQUENCE, METHOD);
  - arrival window and Pacific formatting across both DST switches;
  - the `HomeVisitView` field allow-list.
- **`pnpm tsc` and `pnpm lint`.**
- **Playwright:** every §8.2 state and staff mode, at phone and desktop widths (`/api/dev/playwright-session` for auth).
- **Twilio smoke test.** Before any other messaging work is trusted, one real send from the main line and one real reply, because this Twilio path has never carried traffic (no route has existed; `voip_dids` and `voip_messages` are empty).
- **Owner gate (manual, dev).** The owner prepares the test data by hand; nothing is seeded (no-DB-writes-for-testing rule).
  - Dev uses the 626 reserve as its main line: flagged `is_main_line` on the dev DB, with its messaging webhook pointed at the tunnel. A number has one messaging webhook, so if the production main line later moves to 626 (D18), dev needs another DID.
  - The test customer's phone is the `VOIP_DEV_OVERRIDE_NUMBER`, so the owner's replies match the customer (the override texts that number but records the customer's number, `voip-messages.service.ts:152-158`). `EMAIL_DEV_OVERRIDE` points at the owner.
  - Then:
    - send a summary;
    - reply YES (expect **You** ✓ on the page and the homeowner-confirmed badge on the dashboard, schedule and kanban cards, with the kanban card still in Needs Confirmation);
    - reply "Yes but…", reply with free text, reply STOP then START, and request a new time (expect the kanban Reschedule stage);
    - reschedule, then reply YES again (expect the replacement homeowner-confirmed and no cancellation email);
    - cancel a meeting whose invite you received (expect the calendar entry removed);
    - trigger both runs by publishing each job URL once from the QStash console;
    - message control (§7.5):
      - skip a scheduled rep confirmation, unskip it, skip it again, then trigger the run (expect a `manual` skipped row and no text);
      - as a super-admin, pause the day-before reminder, trigger the run (expect `skipped` / `paused`), then resume;
      - edit a template, try a curly quote (expect it rejected), save, and trigger a send (expect the new wording); then reset to default;
      - book a meeting and send the summary from the toast;
      - check Upcoming, History and Sequence against what was actually sent;
    - open the invite in Gmail and Outlook, then resend after a reschedule (expect one updated event);
    - check the link preview on iPhone and Android;
    - score the email on mail-tester.

## 12. Rollout: owner tasks before launch

1. **Flag the main-line DID `is_main_line`** (D18: the 213 number for now). `voip_dids` is empty and nothing fills it today, so this is two steps: run the Twilio resync, then flag the row (the sending plan ships the script). The 213 number was labelled a CloudTalk transfer target in Twilio in May; CloudTalk is retired (the dialer is JustCall) and no code reads that label, so forwarding its calls (item 3) moves nothing in the app. When the main line changes later, keep the old number's messaging webhook, so replies to texts it already sent still arrive.
2. **The 10DLC campaign.**
   - Confirm it is approved and set `TWILIO_10DLC_CAMPAIGN_SID`.
   - Its message-flow description covers phone bookings: the verbal consent question from the booking scripts (§14), what the texts are, "Msg & data rates may apply", HELP and STOP.
   - It declares **embedded links** (and embedded phone numbers, if asked).
3. **In Twilio, for the main line:**
   - confirm it sits in the Messaging Service attached to the Customer Care campaign;
   - confirm the number is MMS-capable;
   - enable **Advanced Opt-Out**, and remove **YES** from the opt-in keywords (secondary keywords can be removed; YES is the confirm keyword here);
   - leave the service's incoming-message setting on "Defer to sender's webhook", and point the number's messaging webhook to `{VOIP_WEBHOOK_BASE_URL}/api/voip/twiml/messaging-inbound`;
   - **forward its voice calls to (818) 470-7656**, so a homeowner calling back reaches a person.
4. **`VOIP_WEBHOOK_BASE_URL`** is a host that serves this app. `EPIC.md` names `voip.triprosremodeling.com`, which is not in `APP_HOSTS`.
5. **Create the two QStash schedules** with `scripts/setup-visit-message-crons.ts --apply`.
6. **Read each default on the Sequence tab** and edit any wording before the first real send (§7.5). The summary's wording also belongs in the 10DLC campaign's sample messages (item 2).
7. **`pnpm db:push:dev`**, then prod when the owner says so. First check whether the `voip_*` tables exist in prod.
8. **Separate DNS hygiene**, not blocking:
   - move DMARC from `p=none` to `quarantine` once reports are clean;
   - publish a Google Workspace DKIM record (`google._domainkey` is empty today).

## 12a. Build order (for the plan)

1. **Foundation.**
   - Schema (§5), including the legacy pgEnum conversion, client schemas, the duplicate exclude, and the `visit_message_templates` and `visit_message_pauses` tables.
   - The `meetings` `update.before` rules and the Google Calendar inbound mirror.
   - The `modules/meetings` root, with its documentation (§4.2), and `reschedule` / `setOutcomeWithReason` moved into `meetingService.business`.
   - The `messages` unit and `getRescheduleChain`.
   - Pacific formatters in `business-time.ts`; the arrival window and confirmation reset in `modules/meetings/core/lib/`; the `.ics` builder in `modules/meetings/messages/lib/`.
   - `ROOTS.public.homeVisit` and `NAV_PATH_RE`.
   - `src/shared/services/voip/lib/` (merge template, encoding-aware segments), with the campaign consumers moved onto it (§4.4).
   - The `VisitMessages` gate, the `meeting_messages` spec (child of `meetings`) and the visit-messages procedure.
   - `deriveConfirmationTrack`, `isVisitMessageEligible`, `planVisitMessages`, `VISIT_MESSAGE_SCHEDULE`, the template keys, defaults and tokens, `validateVisitMessageTemplate`, `renderVisitMessage`, and keywords.
   - The verify script.
2. **Twilio path live.**
   - The shared send core extracted from `sendSms` (with the `VERCEL_ENV` gate), `getMainLineDid` and `sendFromMainLine` with MMS.
   - The two Twilio routes, the schema additions and the status mapping.
   - The Twilio smoke test (§11).
3. **Messaging.**
   - vCard route.
   - Email template and `EMAIL_DEV_OVERRIDE`.
   - `sendVisitSummary`.
   - The two runs acting on the plan, their jobs, and the setup script built from `VISIT_MESSAGE_SCHEDULE`.
   - The cancellation dispatch, job and email.
   - Reply handling: matching, confirm, opt-out, notifications, `findCustomersByPhone`.
4. **Staff entry points.**
   - The `MeetingOverviewCard.HomeownerConfirmed` part on the three cards.
   - The `sendVisitSummary` / `openHomeVisit` actions and the send dialog. These can be tested in dev with the overrides before the page lands. Production use waits for step 6, so that no real homeowner receives a link to an unfinished page.
5. **Message control** (§7.5).
   - The UI process first: user flow → `ui-ux-pro-max` → `web-design-guidelines` → `/impeccable`. It is app-world (dashboard) UI.
   - `SmsBodyEditor` promoted from `CadenceMessageRow`.
   - `meetingService.messages` queries and verbs, and `meetingsRouter.messages`.
   - The Messages drawer: sequence, history, *Mark do-not-contact*.
   - The Visit messages page (Upcoming, History with `MEETING_MESSAGE_FIELDS`, Sequence with the editor and the Paused switch), its route, `ROOTS` entry and sidebar entry.
   - The booking toast.
6. **The home visit page.**
   - `/ui-exploration` first.
   - Then `HomeVisitView`, the rep public profile and `RepCard`, the moved `matchPortfolioProjects` and the distance read, sections, states, homeowner verbs, the staff bar (composing step 5's drawer), the route layout, and the asset routes.
7. **Docs and rollout** (§12, §14).
   - The owner gate (§11).

**Plans.** One plan per runnable slice, in this order: (1) foundation = step 1; (2) sending and replies = steps 2–4; (3) message control = step 5; (4) the home visit page = step 6; step 7 closes the launch. Plans 3 and 4 start with their UI process, so each is written when its turn comes.

## 13. Measurement

Two outcomes:
- **Sit** rate;
- the share of meetings that did not happen (`cancelled` + `no_show`).

Two comparisons, because the automatic reminder reaches nearly every eligible meeting after launch:
1. eligible meetings scheduled before launch against those scheduled after (the §1 baseline is the "before" side);
2. after launch, meetings with a sent `visit_summary` against meetings without one.

A reschedule's cancelled original is not counted as a cancellation: it has a successor through `rescheduled_from_id`.

Within messaged meetings only:
- homeowner confirmation rate, split by `homeowner_confirmed_via`;
- how often the office's **Confirmed** follows a homeowner confirmation (the baseline records almost no office confirmations: 2 of 167 meetings);
- YES-reply rate;
- new-time-request rate against the `no_show` rate;
- skipped texts by reason (`manual`, `paused`, `booked_after_noon`, `no_phone`, `dnc`).

The analytics epic can add the view later. v1 only has to write the data.

## 14. Coordination and doc updates (made in the build, in the change that makes them true)

- **`CONTEXT.md`:**
  - the §3a terms (D19), including **Homeowner confirmed** next to **Confirmed**, whose meaning does not change (D15);
  - add **Rep confirmed**;
  - fix the stale **DID** entry (`:28`), which lists three DID kinds the schema doesn't have. It becomes "a DID is assigned to a user, or is the one main line (`is_main_line`)".
- **Booking call scripts** (`docs/plans/voip-campaigns/*-booking-call-script.md`): step 5.7 becomes "I'm sending your visit details from Tri Pros now; reply YES so I know it came through" (D13), preceded by the consent question that matches the campaign's message-flow text (§7.4).
- **ADR-0002:** an amendment recording the `meetingsRouter.homeVisit` token sub-router. Entity-level `shareable` makes `crud.update` token-writable, and the shareable middleware's token-wins order cannot produce staff mode.
- **`docs/codebase-conventions/webhook-routes.md`:** the Twilio row's status changes from "not yet scaffolded" to live for messaging.
- **`src/shared/entities/meetings/DOCS.md`:** `#reschedule-cancels-and-rebooks` (token handoff, `rescheduled_from_id`, reference impl moves to `meetingService.business.reschedule`) `#duplicate-copies-setup-only` (the new excluded columns), and the cancellation email next to `#gcal-removed-on-cancel`.
- **`docs/plans/voip-in-house/EPIC.md`:** add a decisions-log entry. Meeting lifecycle SMS ships through this spec, from one main line, which is not the agent's sticky DID. It supersedes the meeting parts of Phase 2 and the Phase 5 "Confirm meeting via SMS" item.
- **Customers-module spec:**
  - §7: add the meetings carry entry (§4.2), and change the voip row ("dormant: no route, no job, no caller") now that this spec makes it live;
  - §5.3: its merged `isStopKeyword` (first-token, with `cancel` / `end` / `remove` / `revoke`) must match whole messages like Twilio, or stay off main-line replies (§7.4).
- **Campaigns admin:** `CadenceMessageRow` composes `SmsBodyEditor`, and `features/campaigns-admin/lib/{sms-segments,insert-at-cursor}.ts` are deleted in the same change (§4.4). Campaign bodies get the encoding-aware counter too.
- **Records bulk-actions spec** (`2026-09-28-records-bulk-actions-and-entity-tables-design.md` §4.4) edits `CreateMeetingForm` for its setter picker. The booking toast (§7.5) is additive; whichever lands second rebases.
- **`CONTEXT.md`:** the D22 terms once approved (Visit messages page, Sequence, Visit message template, Skip, Paused).
- **Memory:**
  - `project-dispatcher-role.md`: dispatchers get visit messages with the permissions rework (#285), not through a capability branch here (D25);
  - fix `project-voip-in-house.md`, which is stale: it says no `voip_*` tables and puts compliance at `services/compliance.service.ts`;
  - update this project's memory.

## 15. Roadmap (recorded, none marked next — D11)

| When | Opportunity | Customer Care fit |
|---|---|---|
| Before the visit | Automatic time-change notice · On my way + ETA · unconfirmed safety-net alert (internal) · program-lead bridge line per lead source (deferred by the owner) | ✓ / ✓ / n/a / ✓ |
| After the visit | Same-day thank-you + proposal on its way · proposal link by text (**after** the §16 leak fix) · follow-up call reminder · financing application status | ✓ |
| After signing | Welcome + what's next · permit · materials · crew day-before + morning-of (same machinery) · inspection · completion + warranty · payment due / receipt · document upload request (`l_doc`) | ✓ |
| Staff tools | Main-line inbox UI (v1 replies are push-only; staff answer by calling, D16) · customer hub (one page per customer; own spec, own pricing-visibility thinking) · *Send now* for a scheduled text · editable send times and noon cutoff · editable email wording · dispatcher meeting visibility beyond visit messages (dispatcher Phase B) · revisit the rep-confirmation wording when the team grows (D21) | n/a |
| Relationship | Review request (confirm with Twilio; may need a Mixed campaign) · referral ask · seasonal tips · rehash / dead reactivation | ⚠️ / ❌ (need a Marketing campaign plus express written consent) |

**Deferred rule (owner, 2026-09-29):** a moved `scheduledFor` resets a `reschedule_needed` outcome to `not_set` (§5).

## 16. Side findings (outside this spec)

- **The proposal page leaks internal cost to homeowners.**
  - `proposalsRouter.business.getFullView` returns every proposal column to token visitors (`src/shared/modules/proposals/core/dal/server/queries.ts:84`), including `projectJSON` → `sow[].financials.costLines`. `docs/ubiquitous-language.md` says cost is never visible to the homeowner.
  - The homeowner/agent split is client-only (`features/proposal-flow/ui/components/proposal/index.tsx:74`).
  - Token visitors can also call proposals `crud.update` on any update-schema field.
  - No proposal procedure is rate-limited.
  - **Blocks** the roadmap's "proposal link by text".
- **Funnels show placeholder reviews as Google reviews.** The bathrooms, kitchens and default funnel landing blocks include `{ kind: 'reviews' }` (`domains/funnels/constants/{bathrooms,kitchens,default-landing-blocks}.ts`). `ReviewsBlock` renders `testimonials.ts` ("Sarah & Michael Johnson, Custom Luxury Home", "David Chen, Commercial Office Building") with `platform="Google"` and stock headshots. Invented reviews presented as real are exposure under the FTC's consumer-review rule (16 CFR Part 465).
- **`PortfolioProof` links to a route that does not exist.** It builds `/portfolio/${accessor}` (`src/features/landing/ui/components/services/portfolio-proof.tsx:99,113`), but the route is `/portfolio/projects/<accessor>` (`src/shared/config/roots.ts:50-51`).
- **`convertUTCToPST` is wrong during daylight saving.** It subtracts a fixed 8 hours (`src/shared/lib/formatters.ts:109`). It has no callers; delete it.
- **`robots.ts` disallows `/tests`**; the route is `/test`.
- **The company phone is hardcoded** in two email templates instead of `contact-info.ts`: `tel:8184707656` in `resend/emails/customer-confirmation-email.tsx:122`, and the `repPhone = '8184707656'` default in `proposal-email.tsx:131`.

## 17. Owner decisions (closed 2026-10-05)

1. **Dispatcher reach (§7.5).** Ruled D25: super-admins only for now; dispatchers later, with the permissions rework (#285). The owner confirmed the same day that agents stay out: they have no need to text homeowners or to run the automatic texts for the foreseeable future, so control sits with super-admins and passes to dispatchers when the time is right.
2. **D22 vocabulary.** Approved (D27).
3. **`EMAIL_DEV_OVERRIDE`.** Ruled D26: every email outside production.
4. **First rollout.** Ruled D24: full v1 before launch.

## 18. Code re-check, 2026-10-05

The spec was checked against main six days after it was written. What changed in this document as a result:

- **Reschedule is not one transaction** (§5): `meetingCrud`'s after-hooks cannot run inside one.
- **`meeting_messages` follows its parent meeting** (§5, §7.5), the shape the permissions rework also expects.
- **The cron setup command** needs the `react-server` condition (§7.1).
- **Dev sends fail closed**, for email and for texts (§7.4).
- **The 213 DID** is not a live transfer target (§12).

What the plans carry (no sentence above depended on it):

- An action can now be left out per row (`hidden` on an action config, since `a1d70db1`). The two new meeting actions are hidden for project meetings and disabled with a reason otherwise; §8.3 says "only disabled".
- `MeetingsTable` is gone. The records table reads row actions from `useMeetingActionConfigs` through `useMeetingsTable`, and an eighth surface, `ProjectMeetingList`, renders meeting actions.
- The History tab is built on the current table stack (an `EntityTableView` constant, `useEntityTable`, a prefetched first read), not a bare `DataTable`.
- `formatBusinessTime` already exists; the new formatters wrap it. Node prints a narrow no-break space before AM/PM, which is not GSM-7, so the wrappers replace it.
- The page's staff / homeowner / 404 choice needs an awaited server call; `prefetch()` returns nothing to branch on (§4.3).
- `matchPortfolioProjects` takes the construction catalog as a third argument (§4.4).
- Local `.env` points `VOIP_WEBHOOK_BASE_URL` at the production host. Dev sets it to the tunnel, or status callbacks and signature checks miss (§11).
- The Twilio status schema rejects a status outside its list with a 400; the callback route maps unknown statuses instead (§7.3).
- A status callback that arrives before the message row has its SID updates nothing today (§7.3).
- A run cannot read its scheduled time from the QStash request, and a retry after midnight would look like the next day's run. The run resolves its own instant and refuses to run early (§7.1).
- Two pending pieces of work edit the same `meetingCrud` hooks: the records bulk-actions plan (`set_by`) and the project-meeting-outcomes spec (`site_visit`). This work lands first; D20's pgEnum conversion removes that spec's `ALTER TYPE` step.
