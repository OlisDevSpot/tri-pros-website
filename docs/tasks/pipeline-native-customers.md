# Task: Pipeline Native Customers

**Status:** 🟡 BLOCKED — waiting on Notion CRM Migration (Task #1)
**Branch:** `migrating-notion`
**Spec:** `docs/superpowers/specs/2026-03-19-pipeline-native-customers-design.md`
**Plan:** _Not yet written_ — invoke `writing-plans` skill once Notion migration session completes
**Date Designed:** 2026-03-19

---

## One-liner

Add `needs_confirmation` limbo stage, `CreateMeetingModal` with trade/scope picker, `meetingScopesJSON` JSONB column, and clean up the dashboard by centralizing actions to the customer pipeline view.

---

## Why It's Blocked

The Notion migration session removes `notionContactId` from the meetings `create` procedure and replaces the Notion contact search with a `customerId` FK. The pipeline-native-customers spec depends on that being done first — otherwise the `CreateMeetingModal` would need to support both the old and new flow simultaneously.

**Execute Task #1 (Notion CRM Migration) before starting this task.**

---

## How to Resume This Task

Start a new Claude Code session and say:
> "I want to implement the pipeline-native-customers feature. The spec is at `docs/superpowers/specs/2026-03-19-pipeline-native-customers-design.md`. First, invoke the `writing-plans` skill to create the implementation plan, then we'll execute it."

The brainstorming and design are 100% complete. Jump straight to `writing-plans`.

---

## What This Feature Does (Summary)

### 1. `needs_confirmation` Pipeline Stage
- New first stage in the active customer pipeline (limbo stage)
- A customer is in `needs_confirmation` when they have **no upcoming meeting with a `scheduledFor` datetime**
- Displayed as the leftmost kanban column with an orange badge
- `computeCustomerStage` default fallback changes from `'meeting_scheduled'` → `'needs_confirmation'`

### 2. Two Ways to Create a Meeting
**A. Button on kanban card** — only visible on `needs_confirmation` cards:
```
"+ Schedule Meeting" button → opens CreateMeetingModal
```

**B. Drag to `meeting_scheduled`** — intercepted in `handleMoveItem`:
```
drag: needs_confirmation → meeting_scheduled → open CreateMeetingModal instead of calling mutation
```

### 3. CreateMeetingModal
**File:** `src/features/meetings/ui/components/create-meeting-modal.tsx`
- Meeting Type: pill radio — `Fresh | Follow-up | Rehash` (required)
- Date & Time: optional datetime picker
- Trades & Scopes: `MeetingScopePicker` component (optional, can be set during meeting)
- On submit: calls `meetingsRouter.create({ customerId, type, scheduledFor?, meetingScopesJSON? })`

### 4. MeetingScopePicker Component
**File:** `src/features/meetings/ui/components/meeting-scopes-picker.tsx`
- Props: `value: MeetingScopes`, `onChange: (scopes: MeetingScopes) => void`
- Reuses: `useGetAllTrades` + `useGetScopes` + `Select` + `MultiSelect` (same hooks as `SOWSection`)
- Stripped down version of `sow-field.tsx` — no title, price, or Tiptap
- Used in both `CreateMeetingModal` AND `MeetingIntakeView` (persistent header above step content)

### 5. meetingScopesJSON on Meetings Table
**Schema change:**
```sql
ALTER TABLE meetings ADD COLUMN type text;
ALTER TABLE meetings ADD COLUMN meeting_scopes_json jsonb;
```

**Type:** `MeetingScopes = Array<{ trade: string; scopes: string[] }>`

**Proposal snapshot:** When `proposal.create` is called with a `meetingId`, it reads `meetingScopesJSON` from that meeting and injects it as the initial `projectJSON.sow` (trade + scopes only, no SOW content).

### 6. Dashboard Cleanup
**Remove from dashboard:**
- `CreatePicker` (plus icon — add meeting or proposal) — obsolete, proposals come from meetings
- `action-center` sidebar step — being relocated

**Move to customer pipelines view:**
- `ActionCenterSheet` wraps `ActionCenterView` in `BaseSheet` with a `ZapIcon` icon button
- Button sits in the pipeline view header alongside the existing view toggle

---

## Critical Implementation Details

### BLOCKER: leftJoin in getCustomerPipelineItems
`src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` line ~60:
```ts
// WRONG (customers with no meetings are invisible):
innerJoin(meetings, eq(customers.id, meetings.customerId))

// CORRECT:
leftJoin(meetings, eq(customers.id, meetings.customerId))
```
Also change `orderBy(desc(max(meetings.createdAt)))` → `orderBy(desc(customers.updatedAt))`.
**This must be done FIRST or needs_confirmation customers will never appear.**

### computeCustomerStage logic update
`src/features/customer-pipelines/lib/compute-customer-stage.ts`:
```ts
// Add explicit check BEFORE default:
if (data.hasScheduledFutureMeeting) return 'meeting_scheduled';
// Change default from 'meeting_scheduled' to:
return 'needs_confirmation';
```
`needs_confirmation` is a limbo stage — a meeting MUST have a `scheduledFor` datetime to be "scheduled".

### meetingTypes enum change
`src/shared/constants/enums/meetings.ts`:
```ts
// OLD:
export const meetingTypes = ['Initial', 'Follow-up'] as const;
// NEW:
export const meetingTypes = ['Fresh', 'Follow-up', 'Rehash'] as const;
```
NOTE: `meetingTypes` is JSONB-only — there is NO pgEnum for it in `meta.ts`. Add a native `type text` column to the meetings table. Do NOT add a pgEnum.

### insertMeetingSchema fix
`src/shared/db/schema/meetings.ts` — `customerId` is currently in the `.omit()` block. Remove it so `customerId` becomes required for `create`.

### tRPC meetings.router create procedure
- Remove Notion dependency entirely
- New input: `{ customerId: z.string().uuid(), type: z.enum(meetingTypes), scheduledFor?: z.string().optional(), meetingScopesJSON?: meetingScopesSchema.optional() }`

### ActionCenterSheet prop
`BaseSheet` prop is `close` (not `onClose`):
```tsx
<BaseSheet close={onClose} title="Action Center">
  <ActionCenterView />
</BaseSheet>
```

### getActionQueue orphan mapping
`src/features/agent-dashboard/dal/server/get-action-queue.ts`:
- Add `leftJoin(customers, eq(meetings.customerId, customers.id))` to orphan meetings query
- Use `sql<string>\`COALESCE(${customers.name}, ${meetings.contactName}, 'Unknown')\`.as('customerName')`
- In the mapping block, change `m.contactName` → `m.customerName`

### dashboard-steps.ts
Remove `'action-center'` and `'create-meeting'` from `dashboardSteps`. TypeScript will flag stale references — clean them up in `dashboard-hub.tsx`.

---

## Files to Create/Modify

| Action | File |
|--------|------|
| Modify | `src/shared/db/schema/meetings.ts` — add `type`, `meetingScopesJSON` columns; remove `customerId` from `.omit()` |
| Modify | `src/shared/constants/enums/meetings.ts` — change `meetingTypes`, add `needs_confirmation` to pipeline stages |
| Modify | `src/shared/entities/meetings/schemas.ts` — add `meetingScopeEntrySchema`, `meetingScopesSchema`; add `.catch(undefined)` for legacy 'Initial' values |
| Modify | `src/trpc/routers/meetings.router.ts` — remove Notion dep, accept `customerId` + `type` |
| Modify | `src/trpc/routers/proposal.router.tsx` — snapshot `meetingScopesJSON` on proposal create |
| Modify | `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` — `leftJoin` + `orderBy` fix |
| Modify | `src/features/customer-pipelines/constants/active-pipeline-stages.ts` — add `needs_confirmation` stage |
| Modify | `src/features/customer-pipelines/lib/compute-customer-stage.ts` — update stage logic |
| Modify | `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` — intercept drag, add modal state, add `ZapIcon` ActionCenter button |
| Modify | `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx` — add `onCreateMeeting` prop + button |
| Create | `src/features/meetings/ui/components/create-meeting-modal.tsx` |
| Create | `src/features/meetings/ui/components/meeting-scopes-picker.tsx` |
| Modify | `src/features/meetings/ui/views/meeting-intake-view.tsx` — embed `MeetingScopePicker` as persistent header |
| Create | `src/features/agent-dashboard/ui/components/action-center-sheet.tsx` |
| Modify | `src/features/agent-dashboard/constants/dashboard-steps.ts` — remove `action-center`, `create-meeting` |
| Modify | `src/features/agent-dashboard/constants/sidebar-items.ts` — remove `action-center` entry |
| Modify | `src/features/agent-dashboard/ui/views/dashboard-hub.tsx` — remove `ActionCenterView` and `CreateMeetingView` blocks |
| Modify | `src/features/agent-dashboard/ui/components/dashboard-sidebar.tsx` — remove `CreatePicker` |
| Modify | `src/features/agent-dashboard/dal/server/get-action-queue.ts` — fix orphan query |
| Delete | `src/features/meetings/ui/views/create-meeting-view.tsx` — replaced by modal |

---

## Visual Mockups

Two HTML mockups were created during brainstorming:
- `.superpowers/brainstorm/1117783-1773908655/kanban-modal.html` — kanban card + create meeting modal
- `.superpowers/brainstorm/1117783-1773908655/intake-scopes.html` — meeting intake scopes panel
