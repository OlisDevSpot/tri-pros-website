# Meeting Polish Batch — Spec

## Context

Tri Pros recently moved from a single-owner meeting model to a participant-based model (`meeting_participants` table, participants UI in place). That migration left regressions and missing derivations in adjacent surfaces (today view, GCal links, proposal → meeting outcome chain). A few unrelated QoL gates (phone visibility, click propagation, card polish) also accumulated.

This spec bundles **8 tracked tweaks** into one batch because each is small and scoped. Per user preference: **detailed but light and concise — 80/20**. Design depth is applied only where decisions have real consequences (participants-era fixes). The rest are stated as "do this, here, once."

Groups:
- **A — Participants-era fixes**: #6, #8 (real design surface; prevents double-booking)
- **B — Meeting Overview Card polish**: #3, #4 (contained to one component)
- **C — Mechanical fixes bundle**: #1, #2, #5, #7 (stated as targeted diffs)
- **D — Foundational refactor**: #9 (users entity — prerequisite for #3, #6, #8)

---

## 1. Gate customer phone for agents

**Rule**: `canSeePhone = isSuperAdmin || customerHasAnySentProposal`

- Compute server-side in the customer DAL. Do not expose raw `phone` in query results when the viewer can't see it — return `phone: null`. This prevents leakage through any consumer.
- Single entity helper: `shared/entities/customers/lib/can-see-phone.ts` → `canAgentSeePhone(ability, customer)`, mirroring existing ability patterns (`ctx.ability.can('manage', 'all')`).
- In `customers/api.ts` `getCustomer*` fns, join proposals aggregate (`hasSentProposal = exists(proposals where meeting.customerId = customer.id AND status = 'sent')`) and null the phone for non-super-admin agents when `hasSentProposal = false`.
- Client-side: where phone is rendered, add a subtle `"Unlocks after first proposal sent"` tooltip when null. No feature-specific gating in components — they just render what they receive.

**Leak surfaces to confirm** (phone currently rendered on agent views):
- `src/shared/entities/customers/components/profile/customer-profile-header.tsx`
- `src/shared/components/contact-actions/ui/phone-action.tsx`
- `src/features/agent-dashboard/ui/components/action-detail-sheet.tsx`
- `src/features/customer-pipelines/ui/components/create-project-form.tsx`
- meeting-card / dot-content (schedule)

---

## 2. Auto-derive `proposal_sent` meeting outcome

In `src/trpc/routers/proposals.router/delivery.router.ts` `sendProposalEmail`, after `updateProposal(... { status: 'sent' })` succeeds and `proposal.meetingId` is present, conditionally update the meeting outcome:

- Only overwrite if current outcome is `not_set` or `proposal_created` (don't stomp terminal states like `converted_to_project`, or manually-set outcomes like `lost_to_competitor`).
- Wrap in helper `shared/entities/meetings/lib/derive-outcome-on-proposal-sent.ts` → `deriveOutcomeOnProposalSent(meetingId)`. Keeps logic callable from any future "sent" event source.

---

## 3. Meeting Overview Card — Participants slot (full + compact variants)

`MeetingOverviewCard` is already a compound component — the schedule meeting card (`src/features/schedule-management/ui/components/meeting-card.tsx`) composes its own layout from the same slots. So this item adds **one new slot** with two variants (`full` and `compact`) that cover every render context in one place.

**New slot**: `<MeetingOverviewCard.Participants variant="full" | "compact" />` inside `src/shared/entities/meetings/components/overview-card.tsx`. Extract the actual rendering to a dedicated file `src/shared/entities/meetings/components/participants-slot.tsx` (one component per file, named exports).

**Shared data + logic** (both variants):
- Roles from `meetingParticipantRoles` const: `owner`, `co_owner`, `helper`.
- Sort by `PARTICIPANT_ROLE_SORT_ORDER` from `shared/entities/meetings/constants/participants.ts`.
- Compose shared primitives from item #9 (`UserAvatar`, `UserAvatarStack`, `UserRow`, `UserContactActions`).
- Super-admin gate via client-side ability hook for privileged actions.

**`variant="full"`** — rendered as a sibling card next to `ProposalCard` in the Meeting Overview detail view.
- Full rows (one per participant): `UserRow` with avatar + name + role icon/badge + subtitle (title/phone/email).
  - `owner` — crowned (existing `ParticipantRoleIcon isOwner`), top of list
  - `co_owner` — secondary crown variant, below owner
  - `helper` — no crown, below co-owners
- **Quick actions per row**:
  - **v1**: Call (uses existing `contact-actions/phone-action.tsx` pattern, respects phone-gate from item #1), Email (`mailto:`)
  - **Super-admin only**: Change Role, Remove (inline menu)
  - **v2 (deferred)**: In-app message
- Footer: `Manage Participants` button (super-admin only) → opens existing `ManageParticipantsModal`.
- **Placement in overview card**: peer with ProposalCard — 2-col grid on md+, stacked on mobile. ParticipantsCard left, ProposalCard right.

**`variant="compact"`** — rendered inside schedule meeting cards (today view + this-week view) below the scheduled-time row. Space-constrained; prioritize at-a-glance.
- Render: `UserAvatarStack` (3 avatars visible, `+N` overflow) + role legend dot colors layered on each avatar (owner=primary, co_owner=secondary, helper=muted).
- **Hover** (desktop) / **tap** (mobile): Radix Tooltip listing each participant: avatar + name + role label.
- **Click on the avatar stack**: opens a small Popover with:
  - Each participant as a condensed `UserRow` with Call + Email quick actions
  - `Manage Participants` button at bottom (super-admin only)
  - Popover `stopPropagation`s so it doesn't trigger item #5's card click.
- Defensive: if zero participants, render nothing (don't reserve space).

**Render sites to wire up** (consumers of `MeetingOverviewCard`):
- `src/shared/entities/meetings/components/overview-card.tsx` view — `variant="full"`
- `src/features/schedule-management/ui/components/meeting-card.tsx` (today view + week view) — `variant="compact"` between the time row and the phone row
- Any other compound consumer (grep for `MeetingOverviewCard.` usages at implementation time and add the compact slot where appropriate — e.g., customer modal meeting list rows)

**Dependency**: item #9 (users entity) for `UserAvatar`, `UserAvatarStack`, `UserRow`, `UserContactActions`. Runs after #9.

---

## 4. Condensed full-date badge

Next to the existing "time until/from" badge in the overview card.

- New helper: `shared/lib/formatters.ts` → `formatMeetingShortStamp(scheduledFor)`.
- Format rules (date-fns):
  - Same day: `Today / 2PM`
  - Within current week: `Thu / 2PM` (`EEE / ha`)
  - Further out: `Thu May 2 / 2PM` (`EEE MMM d / ha`)
- Null scheduledFor → render nothing.

---

## 5. Meeting card click — stopPropagation across contexts

Root cause: meeting card rendered inside kanban cards (pipelines/dashboard fresh, projects) bubbles clicks to the parent, which also opens the customer overview modal.

- Single source of truth: the meeting card component owns its click. Its root handler calls `e.stopPropagation()` before invoking "View Meeting".
- File: `src/features/schedule-management/ui/components/meeting-card.tsx` (and any other MeetingCard variants).
- Consumers stop having to care — parent kanban cards can keep their click handler; nested meeting cards won't leak.

---

## 6. Intake + standalone meeting creation — optional participants field

Add `participantUserIds?: string[]` to:
- Intake form schema (customer+meeting mode only)
- Standalone create-meeting form schema

Server:
- tRPC mutation wraps meeting insert + participant inserts in a single transaction.
- Files: `src/trpc/routers/meetings.router.ts` (`create`), intake router (equivalent path).

UI:
- New `ParticipantsMultiSelect` input (or reuse an existing agent-picker if one exists).
- **Auto-populate by context**:
  - **From existing project** (e.g., "Create meeting for Project X"): prefill with the **union of all users who ever participated in any meeting on this project** (distinct user ids across all project meetings). Fallback empty if the project has no prior meetings.
  - **Fresh intake / new customer**: default to `[currentUser.id]` (self as owner).
- Snapshot section renders above the field when prefilled: `"Pre-filled from project history (N people) — edit if needed"`.
- Server-side helper: `src/shared/entities/projects/lib/get-project-participant-union.ts` → returns distinct `userId[]` for a given `projectId` by querying `meeting_participants` joined to `meetings` filtered by `projectId`.

Dispatching = the participants are attached at creation time; no separate "dispatch" action needed.

---

## 7. Fix GCal event deep link

In `src/shared/services/google-calendar/lib/map-to-gcal.ts` `buildMeetingDescription` (around line 84):

Replace
```
const dashboardUrl = ROOTS.dashboard.meetings.byId(meeting.id, { absolute: true, isProduction: true })
sections.push(`🔗 View in Dashboard: ${dashboardUrl}`)
```
with
```
const scheduleUrl = `${ROOTS.dashboard.schedule({ absolute: true, isProduction: true })}?highlightMeeting=${meeting.id}&highlightDate=${encodeURIComponent(meeting.scheduledFor)}`
sections.push(`🔗 View in Schedule: ${scheduleUrl}`)
```

nuqs plumbing (`highlightMeeting` + `highlightDate`, layout force, scroll-into-view, highlight timeout) already exists in `src/features/schedule-management/hooks/use-schedule-highlight.ts` and `src/features/schedule-management/ui/views/schedule-view.tsx`.

---

## 8. Today view swimlanes — group by participant combo

Today view in `src/features/schedule-management/lib/today-view-helpers.ts` currently keys lanes by `event.ownerId`. Co-participants become invisible → they look free during meetings they're actually at.

**Changes:**

1. Widen `ScheduleCalendarEvent` (`src/features/schedule-management/types/index.ts`) to carry `participants: { id, name, image }[]` (sorted ascending by id). Requires the upstream query (`meetingsRouter.getAll` or whatever `activityToCalendarEvent` uses) to join `meeting_participants`.
2. Replace `groupEventsByOwner` with `groupEventsByParticipantCombo(events)`:
   - Combo key = `participants.map(p => p.id).join('|')` (already sorted)
   - Returns `Map<comboKey, ScheduleCalendarEvent[]>`
3. Replace `getUniqueOwners` with `getUniqueCombos(events)`:
   - Returns `{ key, participants: SwimlaneParticipant[] }[]`
   - Sort: combo size descending (bigger teams first), then alphabetical by first participant name.
4. Update `SwimlaneRow` to accept `combo` prop and render stacked avatars (up to 3 visible, `+N` badge for overflow). Collapsed state shows only avatar stack.

**Semantics**: `{A}` and `{A,B}` are different lanes. `{A,B}` and `{B,A}` collapse to the same lane (sorted key).

---

## 9. Users entity migration (`shared/entities/agents` → `shared/entities/users`)

**Rationale**: `shared/entities/agents` is too narrow. The underlying domain is `users` (internal users). Meeting participants, headshots, schedule swimlanes, participant pickers, avatars all share the same primitives. Promoting `users` to a first-class entity with the project's Single Unit folder structure gives every downstream consumer one canonical source. Running this before items #3, #6, #8 lets those items compose the new primitives instead of building ad-hoc versions we'd have to refactor later.

**Existing state**:
- `src/shared/entities/agents/` contains only `schemas.ts` (minimal).
- `shared/constants/enums/user.ts` already holds user role const arrays — leave in place; entity imports from there.
- 6 import sites currently reach `shared/entities/agents`: `db/schema/auth.ts`, `trpc/routers/agent-settings.router.ts`, `features/agent-settings/schemas/profile-form.ts`, `features/agent-settings/ui/components/{customer-brand-section,headshot-upload,profile-header-card}.tsx`.

**Scope — create `src/shared/entities/users/`** (Single Unit folder structure):
- `schemas.ts` — move from `agents/schemas.ts` as baseline (derived select/insert over `db/schema/auth.ts user` table); expand with computed fields as needed.
- `types/` — derived TS types.
- `constants/` — role label/color maps; any display-config maps.
- `lib/` — `get-initials.ts`, `format-user-name.ts`, `get-user-avatar-url.ts`.
- `hooks/` — `use-users.ts` (shared listing query, cached; today likely lives in agent-settings or is fetched ad-hoc).
- `components/` (new shared primitives — one component per file, named exports):
  - `user-avatar.tsx` — `UserAvatar`: avatar + initials fallback; optional role-icon overlay slot
  - `user-avatar-stack.tsx` — `UserAvatarStack`: stacked avatars, `+N` overflow badge (used by item #8 Swimlane + item #3 card footer)
  - `user-row.tsx` — `UserRow`: avatar + name + optional subtitle slot (used by item #3)
  - `user-multi-select.tsx` — `UserMultiSelect`: picker (basis for item #6's `ParticipantsMultiSelect`, which composes `UserMultiSelect` + role selector)
  - `user-contact-actions.tsx` — `UserContactActions`: Call + Email button cluster (used in item #3)

**Migration steps**:
1. Create `shared/entities/users/` with primitives above. Move schemas from `agents/schemas.ts` to `users/schemas.ts`.
2. Update the 6 import sites to point at `users/`.
3. Delete `shared/entities/agents/` once no imports remain.
4. **Do NOT rename** `features/agent-settings/` or `trpc/routers/agent-settings.router.ts` — those describe a specific feature ("agent-facing settings"); renaming is out of scope for this item.

**Verification**: `pnpm tsc` clean, `pnpm lint` clean, agent-settings feature still works end-to-end (headshot upload, profile form, customer-brand section), no stale imports from `entities/agents`.

---

## Critical files

| Item | Files |
|---|---|
| 1 | `src/shared/dal/server/customers/api.ts`, `src/shared/entities/customers/lib/can-see-phone.ts` (new), ~5 render sites |
| 2 | `src/trpc/routers/proposals.router/delivery.router.ts`, `src/shared/entities/meetings/lib/derive-outcome-on-proposal-sent.ts` (new) |
| 3 | `src/shared/entities/meetings/components/overview-card.tsx`, `src/shared/entities/meetings/components/participants-slot.tsx` (new, exposes full + compact variants), `src/features/schedule-management/ui/components/meeting-card.tsx` (wire compact slot) |
| 4 | `src/shared/lib/formatters.ts`, `overview-card.tsx` |
| 5 | `src/features/schedule-management/ui/components/meeting-card.tsx` |
| 6 | `src/features/intake/schemas/intake-form-schema.ts`, `src/shared/entities/meetings/components/create-meeting-form.tsx`, `src/trpc/routers/meetings.router.ts`, new `ParticipantsMultiSelect` |
| 7 | `src/shared/services/google-calendar/lib/map-to-gcal.ts` |
| 8 | `src/features/schedule-management/lib/today-view-helpers.ts`, `src/features/schedule-management/ui/components/schedule-today-view.tsx`, `src/features/schedule-management/types/index.ts`, upstream queries |
| 9 | `src/shared/entities/users/**` (new), delete `src/shared/entities/agents/`, update 6 import sites: `src/shared/db/schema/auth.ts`, `src/trpc/routers/agent-settings.router.ts`, `src/features/agent-settings/schemas/profile-form.ts`, `src/features/agent-settings/ui/components/{customer-brand-section,headshot-upload,profile-header-card}.tsx` |

---

## Verification

Run `pnpm tsc` and `pnpm lint` after each group (never `pnpm build`). Manual end-to-end checks:

1. **Phone gating**: create customer as agent → phone hidden + tooltip shown. Send a proposal → phone visible. Sign in as super-admin → phone always visible.
2. **proposal_sent**: create meeting (outcome `not_set` or `proposal_created`), send proposal → meeting outcome flips to `proposal_sent`. Manually set outcome to `lost_to_competitor` → sending a proposal does NOT overwrite.
3. **Participants slot**:
   - *Full variant* — meeting overview page shows owner crowned + co-owners + helpers listed with quick Call/Email actions. Super-admin sees Change Role / Remove / Manage; agents don't.
   - *Compact variant* — schedule today view + week view each meeting card shows stacked avatars with role-coloured dots. Hover reveals tooltip with name + role per participant. Click opens a popover with contact actions; popover does not trigger the card's View Meeting click.
4. **Date badge**: badge shows `Today / 2PM`, `Thu / 2PM`, or `Thu May 2 / 2PM` based on distance.
5. **Meeting card click**: in pipelines/fresh, click meeting card → opens meeting only; customer modal does NOT open.
6. **Intake + create-meeting**: participants multi-select renders; auto-fills for project context; on submit, rows land in `meeting_participants`.
7. **GCal link**: sync meeting → GCal event description link → click from Google Calendar → lands in schedule view, correct week, meeting highlighted for 10s.
8. **Today view**: create `{A}` solo and `{A,B}` meetings on same day → 2 distinct lanes; A does not appear free during the `{A,B}` meeting.
9. **Users entity migration**: `pnpm tsc` + `pnpm lint` clean after migration; open agent-settings page → profile form, headshot upload, and customer-brand section all load and save correctly; grep for `entities/agents` returns zero matches.

---

## Decisions locked in

1. **ParticipantsCard placement**: peer with ProposalCard (2-col grid on md+, stacked on mobile).
2. **Project-context auto-populate**: union of all users across all prior meetings on the project. Distinct `userId[]` from `meeting_participants` joined to `meetings` by `projectId`.
3. **Today-view swimlane sort**: combo size desc → alpha by first participant name.

## Implementation order (one PR per step)

1. **Group C mechanicals** (items 2, 5, 7) — low risk, high ratio of value to effort.
2. **Phone gating** (item 1) — isolated to DAL + ~5 render sites.
3. **Date badge** (item 4) — single component + one helper.
4. **Users entity migration** (item 9) — prerequisite for 5, 6, 7 below. Ships new shared primitives (`UserAvatar`, `UserAvatarStack`, `UserRow`, `UserMultiSelect`, `UserContactActions`) and migrates 6 import sites off `entities/agents`.
5. **Swimlane combo refactor** (item 8) — widen query + refactor helpers + update component; uses `UserAvatarStack` from item 9.
6. **Participants slot** (item 3) — new `participants-slot.tsx` exposing `full` + `compact` variants; wired into meeting overview page AND schedule meeting card (today + week); uses `UserAvatarStack` + `UserRow` + `UserContactActions` from item 9.
7. **Intake/create-meeting participants field** (item 6) — schema + UI + transactional mutation + project-union helper; composes `UserMultiSelect` from item 9 + role selector.
