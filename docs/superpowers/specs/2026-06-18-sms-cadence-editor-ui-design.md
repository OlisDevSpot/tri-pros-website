# Per-Campaign SMS Cadence Editor — Admin UI (Design)

> **Date:** 2026-06-18
> **Status:** Design — pending implementation plan
> **Parent spec (runtime):** [2026-06-17-voip-campaigns-sms-cadence-design.md](./2026-06-17-voip-campaigns-sms-cadence-design.md)
> **Entity docs:** [src/shared/entities/voip-campaigns/DOCS.md](../../../src/shared/entities/voip-campaigns/DOCS.md) (`#sms-cadence`)

---

## 1. Problem

Each VoIP campaign can carry an automated SMS follow-up cadence in the
`voip_campaigns.sms_cadence` JSONB column. The runtime that *consumes* this
config (decision engine + renderer + `call.ended` orchestrator) is built,
reviewed, and live on `main`. The column has **no authoring surface** — today it
can only be set by raw SQL. This spec designs the super-admin UI to view and edit
a campaign's cadence, inside the existing `campaigns-admin` feature.

## 2. Scope

**In scope:** a per-campaign cadence editor (enabled / one-SMS-per-day / an
ordered ladder of ≤5 messages) surfaced from the Setup tab, plus the thin tRPC +
hook wiring to persist it, plus a **merge-token expansion** (see §6).

**Out of scope:** runtime cadence decision logic, dispositions, voicemail /
recording handling, per-lead timezone. (All already built per the parent spec.)

## 3. Key decisions (locked during brainstorming)

1. **Surface = Dialog per campaign.** The editor opens from a per-row "Edit
   cadence" button on the existing `SyncedCampaignsCard` table. Chosen over an
   inline-expandable row (competes for width in the Setup tab's 2-col grid) and a
   side sheet (heavier than needed for a low-frequency task). A focused modal
   scales cleanly as campaigns grow.
2. **Reuse the standardized CRUD DAL — no bespoke mutation.** The generic
   `voipCampaignCrud` (`entities/voip-campaigns/dal/server/crud.ts`, built by
   `createCrudDal(voipCampaignServerSpec)`) already exists, and the spec's update
   schema is `insertVoipCampaignSchema.partial()`, which accepts a partial
   `{ smsCadence }`. The tRPC procedure calls `voipCampaignCrud.update(...)`. We
   do **not** add an `updateCampaignSmsCadence` DAL function.
   - *Alternative considered:* mount the full generic crud router for
     voip-campaigns (it is not wired to `createCrudRouter` today, unlike
     meetings/customers/proposals). Rejected for v1 — a named, schema-validated,
     super-admin-gated procedure is smaller and keeps the campaigns router's
     hand-written "ops" shape. Revisit if more campaign CRUD lands.
3. **`maxMessages` is not exposed.** The schema array cap (`.max(5)`) already
   enforces ≤5, and the orchestrator's `>= maxMessages` gate is redundant with
   `>= messages.length` when they're equal. The mutation always sends
   `maxMessages: 5`. *(If "author 5, fire only 3" is ever wanted, the control
   returns — out of scope for v1.)*
4. **Empty cadence is valid.** Saving with `enabled: true` and zero messages is
   allowed; the cadence simply never fires. No hard block.
5. **Save semantics = invalidate-on-settled + toast** (mirrors `setSourcePolicy`).
   No optimistic update — the dialog holds a local draft and re-seeds from
   `listCampaigns` on next open.

## 4. User flow (the surface's reason to exist)

- **Who:** a single super-admin (Oliver). Deep domain knowledge; low-frequency
  task (cadences set once per campaign, tuned occasionally; ~2–4 campaigns total).
- **Scenario A — first-time arming (focal):** "Campaign is dialing but sends no
  texts. Write 2–5 messages with attempt thresholds, flip it on." Authoring-heavy
  → the message ladder is the focal surface.
- **Scenario B — tuning copy:** reword a message / nudge a threshold. Quick edit.
- **Scenario C — pause:** toggle `enabled` off without losing the ladder.
- **Scenario D — glance/audit:** "Is this campaign texting? How many messages?"
  Answered on the campaign row without opening the dialog.

## 5. Data flow (3 pieces — mirrors `setSourcePolicy`)

### 5.1 tRPC — `setCampaignSmsCadence`

Add to `src/trpc/routers/voip-campaigns.router.ts`:

- `superAdminProcedure`, input `z.object({ campaignId: z.string().uuid(),
  smsCadence: smsCadenceSchema })`.
- Body calls `voipCampaignCrud.update(ctx, input.campaignId, { smsCadence:
  input.smsCadence })`, returns the result via `dalToTrpc`.
- `smsCadenceSchema` validates the ≤5 / `afterAttempts ≥ 1` / non-empty-body
  rules server-side — reused, not re-spec'd.

### 5.2 Hook — `setCampaignSmsCadence`

Add to `src/features/campaigns-admin/hooks/use-campaign-mutations.ts`, matching
the other wrappers: `trpc.voipCampaignsRouter.setCampaignSmsCadence
.mutationOptions({ onSuccess: invalidateVoipCampaigns + toast.success, onError:
toast.error })`.

### 5.3 UI — see §7.

`listCampaigns` already returns the full `VoipCampaign` row (so `smsCadence` is in
the payload) to seed the form. No new read.

## 6. Merge-token expansion ⚠️ touches runtime declared "already verified"

The supported token set is **not** enforced in the UI — it is hardcoded in two
runtime files the parent spec scoped as out-of-scope/verified:

- `services/voip/campaigns/lib/render-sms-template.ts` — only knows
  `first_name`, `city`, `primary_trade`.
- `findSmsCadenceContextByCtContactId`
  (`voip-campaign-contacts/dal/server/queries.ts`) — only SELECTs `name`,
  `city`, and `leadMetaJSON.interestedTradesRaw`. Address, zip, state, email are
  never fetched.

Expanding tokens therefore changes runtime code (renderer + context query +
var-passing in `sms-cadence.service.ts`) — net-new and **not** covered by the
parent spec's "runtime is verified." Re-verify the renderer after the change.

**Decision: add the "core set" (no email/address).** Final tokens:

| Token | Source (customers table) |
|---|---|
| `{{first_name}}` | first word of `customers.name` |
| `{{full_name}}` | `customers.name` |
| `{{city}}` | `customers.city` |
| `{{state}}` | `customers.state` |
| `{{zip}}` | `customers.zip` |
| `{{primary_trade}}` | `pickPrimaryTrade(interestedTradesRaw)` (existing) |
| `{{all_trades}}` | `interestedTradesRaw` joined `, ` |

Email + address deliberately omitted (PII-heavier, rarely useful in an SMS).
Deeper profile JSONB (property/financial) deferred.

**Single source of truth — token registry.** Create
`entities/voip-campaigns/lib/sms-merge-tokens.ts`: one array of
`{ token, label, sample, resolve(ctx) }`. The authoring chips, the optional
preview, and the renderer all derive from this list so the UI can never advertise
a token the renderer silently ignores (unknown tokens render literal). The
context query is extended to fetch the fields these resolvers need
(`state`, `zip` added to the existing `name`/`city`/`interestedTradesRaw`).

## 7. UI components (one component per file, named exports)

### 7.1 `SyncedCampaignsCard` (edit existing)

`src/features/campaigns-admin/ui/components/setup/synced-campaigns-card.tsx`.
Add two cells per row:

- **Cadence** summary cell (scenario D): `3 msgs · on` (foreground + quiet success
  dot) when enabled with messages; `— off` (muted) otherwise. Quiet dot, **not**
  a primary badge — preserves the table's restraint.
- **"Edit cadence"** `Button variant="outline" size="sm"` opening the dialog for
  that campaign.

### 7.2 `CampaignCadenceDialog` (new — the *view*: owns state + data)

- Owns dialog open state + a local **draft** copy of the cadence, seeded from the
  campaign row (`campaign.smsCadence ?? smsCadenceSchema.parse({})` for defaults).
- Header: `SMS cadence — {campaignName}`.
- Body: `enabled` Switch, `oneSmsPerDay` Switch, then the ladder (§7.3 rows).
- Footer: **Cancel** + **Save cadence** (`dirty`-gated; stays enabled until the
  request starts, then spinner + "Saving…").
- Closing while `dirty` → confirm (unsaved-changes guard).
- On Save success → call the hook → close.

### 7.3 `CadenceMessageRow` (new — dumb, props-driven)

Props: `message`, `index`, `onChange`, `onRemove` (prop interface stays in-file).

- Leading **rung number** (1–5) as the structural device — muted, `tabular-nums`.
- `afterAttempts` number input (`type="number" inputMode="numeric" min={1}`,
  `tabular-nums`, `aria-label="Send after N dial attempts"`).
- `body` Textarea (`aria-label="Message N body"`, `break-words`, parent flex
  children `min-w-0`; spellCheck on, `autoComplete="off"`).
- **Merge-token chips** beneath the textarea: real `<button type="button">`,
  `aria-label="Insert {{first_name}}"`, insert the token at the cursor. Quiet
  `ghost`/`secondary` style. Derived from the §6 registry.
- **Live char/segment counter** (`tabular-nums`, muted): `142 chars · 1 segment`
  (GSM-7: 160/segment, 153 multi-part). Warns by **icon + color + text** past ~3
  segments.
- Icon-only **remove** button (`aria-label="Remove message N"`).

### 7.4 Ladder footer

`+ Add message` button (`disabled` at 5) with a `3 / 5` counter
(`tabular-nums`, non-breaking spaces). Empty state when 0 messages: "No messages
yet. Add an opener — it sends after the first dial attempt."

### 7.5 Non-decreasing-threshold warning

If any row's `afterAttempts` is less than the row above it, show an inline
non-blocking line (icon + text: "Thresholds usually increase down the ladder.")
in an `aria-live="polite"` region. **Warn, never disable Save** (parent spec:
recommend, don't hard-block). No colored border stripe.

## 8. Aesthetic & creative direction (impeccable)

The **ladder is the object** — a vertical, rung-numbered sequence, not repeated
cards. Anchored to the existing `campaigns-admin` restraint
([docs/ui-design-playbook.md](../../ui-design-playbook.md)):

- **Flatten, don't nest** — messages separated by `gap` + hairline divider; the
  dialog is the only container (no card-in-card).
- **One primary moment: Save.** Chips, switches, rung numbers all quiet.
- **AI-slop bans:** no left/right border accent stripe (rows, warning, counter);
  no gradient text; no glow/glass.
- **Motion:** dialog scale+fade; add-row reveal via `grid-template-rows`
  `0fr→1fr` (never animate height); remove = fade+collapse; all gated by
  `prefers-reduced-motion`; no bounce.

## 9. Accessibility & forms punch list (ui-ux-pro-max + Vercel WIG)

- shadcn `Dialog` provides focus-trap + Esc + return-focus — keep; don't override
  `onEscapeKeyDown`.
- All controls labelled (switches, number input, textarea, remove, chips).
- Non-decreasing warning + segment counter in `aria-live="polite"`; meaning via
  icon + text, never color alone.
- Token chips are keyboard-operable `<button>`s with `focus-visible` rings (never
  bare `outline-none`).
- `tabular-nums` on attempts, segment counter, the `N / 5` counter.
- Save stays enabled until request starts → spinner + "Saving…"; specific label
  "Save cadence" (not "Continue"/"Save").
- Unsaved-changes confirm on dialog dismiss.
- Curly quotes + `…` in copy; non-breaking spaces in "1 SMS/day",
  "{{first_name}}", "3 / 5".
- `overscroll-behavior: contain` on the dialog scroll region.

## 10. Conventions (enforced)

- One React component per file; named exports only; prop interfaces in-file.
- No file-level consts/utility fns in component files → `constants/` / `lib/`
  (the token registry lives in `entities/voip-campaigns/lib/`).
- No barrels in `ui/` / `hooks/` / `lib/`.
- Views own data-fetching + layout; components are props-driven.
- `voipCampaignCrud.update` for the write; no manual `updatedAt` (schema-helper
  `$onUpdate` handles it). Resync-safe by construction (writes only `sms_cadence`).

## 11. Verification (no test framework — deliberate)

- `pnpm tsc && pnpm lint` clean.
- Manual: open Setup as super-admin → edit a campaign's cadence (toggle enabled,
  add 2 messages with thresholds + a `{{first_name}}` and a `{{all_trades}}`
  token), save, reopen → values round-trip. Spot-check `voip_campaigns.sms_cadence`
  JSONB in the DB.
- Token-set runtime check: confirm the new tokens (`full_name`, `state`, `zip`,
  `all_trades`) render correctly via `renderSmsTemplate` (re-verify — new code).

## 12. Open questions for the implementation plan

1. **Segment-count helper** — GSM-7 vs UCS-2 detection (an emoji or `{{token}}`
   that resolves to non-GSM chars flips the limit to 70/segment). v1 may
   approximate (assume GSM-7, count `{{tokens}}` as their literal length) — the
   plan decides how precise to be.
2. **Chip cursor-insert** — needs a ref to the active textarea + `selectionStart`;
   confirm the shadcn `Textarea` forwards a ref cleanly.
3. **Where `CampaignCadenceDialog` mounts** — per-row (one dialog instance per
   row) vs a single hoisted dialog driven by an "editing campaign" state in
   `SyncedCampaignsCard`. Lean single-hoisted to avoid N mounted dialogs.
