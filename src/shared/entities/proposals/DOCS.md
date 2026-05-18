# Proposals Entity — Business Rules & Patterns

> Canonical reference for anyone writing code that touches proposals.
> In-file comments reference rules here by number (e.g., "See DOCS.md P-3").
> If code contradicts this document, the document wins — fix the code.

## Status Lifecycle

```
draft → sent → approved
                 ↑ (auto on contract signed, see C-3)
       → declined (manual only, see C-5)
```

## Business Rules

### Pricing (P)

**P-1. finalTcp is DERIVED, never stored.**
`finalTcp = max(0, startingTcp - sum(discount incentives))`. Single source of truth: `lib/compute-final-tcp.ts`. Any code needing the final price MUST call `computeFinalTcp()`. The SQL equivalent in `queries.ts` mirrors this formula exactly for sort/filter.

**P-2. Only `discount`-type incentives reduce TCP.**
`exclusive-offer` incentives are informational and do not affect the price. The filter is in `computeTotalDiscounts()`.

**P-3. startingTcp is post-breakdown in all pricing modes.**
In `breakdown` mode the form syncs `startingTcp = sum(sectionPrices) + miscPrice` before saving. `computeFinalTcp` does not need to know about pricing mode.

### Kind & Creation (K)

**K-1. `kind` is server-derived and frozen at insert.**
`deriveProposalKind(meetingProjectId)`: meeting has project → `additional-work`; no project → `initial-sale`. The `insertProposalSchema` omits `kind` — clients never set it. See `lib/derive-proposal-kind.ts`.

**K-2. `kind` never changes after creation.**
Even if the meeting later gets a project (from the initial-sale being approved), the proposal's kind stays as-is. Each project has exactly one `initial-sale` and N `additional-work` proposals.

**K-3. Token is server-generated at creation.**
Format: `tpr-{16 hex chars}`. Generated in `dal/server/mutations.ts`. The `insertProposalSchema` omits `token`. Tokens are permanent — never rotated, never expired.

**K-4. SOW is snapshot from meeting trade selections at creation.**
If the meeting has `flowStateJSON.tradeSelections` and the input has no existing SOW, the create DAL snapshots trade selections into `projectJSON.data.sow`. After creation, the SOW is independent of the meeting's trade selections.

**K-5. One approved initial-sale per meeting.**
Enforced by DB unique index: `(meetingId) WHERE kind='initial-sale' AND status='approved'`. Multiple draft/sent initial-sales on the same meeting can coexist (agent iterating on offers).

### Visibility & Access (V)

**V-1. Agent visibility = meeting participation.**
Non-omni agents see a proposal ONLY when they participate in the proposal's meeting (any role). Predicate: `userParticipatesInMeeting(userId, proposals.meetingId)`. See `lib/visibility.ts`.

**V-2. Token access bypasses visibility scoping.**
A valid share token (`?token=tpr-xxx`) IS authentication. The shareable middleware sets `ctx.scope = eq(proposals.token, token)` and `ctx.ability = null`. CASL checks are skipped — the token is the authorization.

**V-3. Both `getById` and `update` are shareable.**
Homeowners view AND edit proposals via token (e.g., selecting a finance option). The `shareable: { tokenColumn: 'token' }` on the spec routes both through `shareableProcedure`.

**V-4. Omni users (super-admin) see all proposals.**
`scope = null` — no WHERE predicate applied.

### Contracts & Signing (C)

**C-1. Contract events are idempotent.**
`viewed`: earliest-wins (first view is meaningful, later views are noise). `completed`/`declined`: write-once (terminal events, duplicates are Zoho retries).

**C-2. Zoho operation types diverge from docs.**
Both documented and observed values are mapped in `lib/contract-events.ts`. Confirmed via live webhook test 2026-05-04.

**C-3. `completed` auto-approves the proposal.**
Sets `status = 'approved'` and stamps `approvedAt`. This matches the manual approval flow.

**C-4. `declined` does NOT auto-change status.**
Customer-initiated declines are rare and usually recoverable. Agent intervenes manually.

**C-5. Notification triggers.**
Only `completed` and `declined` events trigger push notifications.

### CSLB Compliance (L)

**L-1. Cancellation window: 3 business days standard, 5 for seniors.**
Per Cal. Civil Code 1689.6/1689.7 (post AB 2471, effective 2021-01-01).

**L-2. Business day = any day except Sunday.**
Named federal holidays are NOT currently excluded (intentional simplification). See `lib/cslb-start-date.ts` for the caveat.

**L-3. Window starts day AFTER signing.**
Signing day is Day 0. Earliest legal start is the calendar day after the Nth business day.

### Duplication (D)

**D-1. Duplicating a proposal resets status to `draft`.**

**D-2. Duplicating reassigns ownership to the current user.**

**D-3. Duplicated proposals get a fresh token and re-derived kind.**
The duplicate calls `proposalCreateDal` internally, so kind/token are server-derived from the current meeting state (not copied from source).

## Patterns in This Entity

### DAL Pattern
All data access through `dal/server/queries.ts` (reads) and `dal/server/mutations.ts` (writes). Returns `DalReturn<T>`. Uses `dalDbOperation` + `ThrowableDalError` internally. See `memory/coding-conventions.md` Rule 15.

### Server Spec
`lib/server-spec.ts` — `proposalServerSpec` satisfying `EntityServerSpec<typeof proposals>`. Wires visibility, schemas, shareable config, JSONB merge columns.

### tRPC Router
`trpc/routers/proposals.router/index.ts` — uses `createEntityRouter(proposalServerSpec, factory)`. CRUD inlined for type inference. Business queries (getFullView, list) on business sub-router. Delivery + contracts mounted as deferred service-layer sub-routers.

---

*Last updated: 2026-05-17. If a rule here is wrong, fix this document AND the code.*
