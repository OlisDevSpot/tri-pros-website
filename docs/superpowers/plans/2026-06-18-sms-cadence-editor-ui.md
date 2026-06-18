# SMS Cadence Editor UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give super-admins a per-campaign UI to view and edit a campaign's automated SMS cadence (`voip_campaigns.sms_cadence`), replacing raw SQL.

**Architecture:** A Dialog launched from a per-row "Edit cadence" button on the existing `SyncedCampaignsCard` (Setup tab). The dialog holds a local draft of the cadence and persists it through the existing standardized CRUD DAL (`voipCampaignCrud.update`) behind a new super-admin tRPC procedure + a mutation hook wrapper. A shared, client-safe merge-token registry feeds both the authoring chips and the runtime renderer (expanded to a 7-token core set).

**Tech Stack:** Next.js 15, tRPC, Drizzle, Zod, shadcn/ui, Tailwind v4, motion/react, TanStack Query.

## Global Constraints

- **No test framework (deliberate).** Verification gate per task = `pnpm tsc` clean + `pnpm lint` clean, plus manual round-trip for UI tasks. There is no unit-test step.
- **Never run `pnpm build`** (use `pnpm tsc`). Never run `pnpm db:push` (no schema change here anyway).
- One React component per file; **named exports only**; prop interfaces stay in the component file.
- No file-level consts or utility functions in component files → `constants/` or `lib/`. No barrels in `ui/` / `hooks/` / `lib/`.
- Views own data-fetching + layout; components are props-driven.
- Write through `voipCampaignCrud.update`; never a bespoke DAL mutation. Never set `updatedAt` manually (`$onUpdate` handles it).
- Copy rules: curly quotes `“ ”`, ellipsis `…` (not `...`), non-breaking spaces in `1 SMS/day`, `{{first_name}}`, `3 / 5`. Loading states end with `…` ("Saving…").
- Merge tokens are exactly: `{{first_name}}`, `{{full_name}}`, `{{city}}`, `{{state}}`, `{{zip}}`, `{{primary_trade}}`, `{{all_trades}}`. Unknown tokens render literal.
- AI-slop bans: no left/right colored border accent stripe (rows, warnings, counters); no gradient text; no glow/glass. One primary-color moment per surface (the Save button).

---

### Task 1: Shared merge-token registry

**Files:**
- Create: `src/shared/entities/voip-campaigns/lib/sms-merge-tokens.ts`

**Interfaces:**
- Produces:
  - `interface SmsMergeVars { name: string; city: string; state: string; zip: string; interestedTradesRaw: string[] }`
  - `interface SmsMergeToken { token: string; label: string; sample: string; resolve: (vars: SmsMergeVars) => string }`
  - `const SMS_MERGE_TOKENS: readonly SmsMergeToken[]`

This module is **client-safe** — pure functions over a plain `SmsMergeVars` object, no DB/server imports — so the renderer (server) and the chips (client) import the same list.

- [ ] **Step 1: Create the registry module**

```ts
// src/shared/entities/voip-campaigns/lib/sms-merge-tokens.ts
import { pickPrimaryTrade } from '@/shared/services/voip/campaigns/lib/pick-primary-trade'

// Single source of truth for SMS merge tokens. The authoring chips (client) and
// renderSmsTemplate (server) both derive from this list, so the UI can never
// advertise a token the renderer ignores. Pure — no I/O. Unknown tokens render
// literal (see render-sms-template.ts).
// see docs/superpowers/specs/2026-06-18-sms-cadence-editor-ui-design.md §6

export interface SmsMergeVars {
  name: string
  city: string
  state: string
  zip: string
  interestedTradesRaw: string[]
}

export interface SmsMergeToken {
  /** The literal token as typed in a body, e.g. "first_name" (no braces). */
  token: string
  /** Human label for the chip, e.g. "First name". */
  label: string
  /** Example value shown in tooltips/preview, e.g. "Maria". */
  sample: string
  resolve: (vars: SmsMergeVars) => string
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ''

export const SMS_MERGE_TOKENS: readonly SmsMergeToken[] = [
  { token: 'first_name', label: 'First name', sample: 'Maria', resolve: v => firstName(v.name) },
  { token: 'full_name', label: 'Full name', sample: 'Maria Lopez', resolve: v => v.name },
  { token: 'city', label: 'City', sample: 'Pasadena', resolve: v => v.city },
  { token: 'state', label: 'State', sample: 'CA', resolve: v => v.state },
  { token: 'zip', label: 'ZIP', sample: '91101', resolve: v => v.zip },
  { token: 'primary_trade', label: 'Primary trade', sample: 'Roofing', resolve: v => pickPrimaryTrade(v.interestedTradesRaw) },
  { token: 'all_trades', label: 'All trades', sample: 'Roofing, Solar', resolve: v => v.interestedTradesRaw.join(', ') },
]
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc` → Expected: clean. Run: `pnpm lint` → Expected: clean (check import sort order).

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/voip-campaigns/lib/sms-merge-tokens.ts
git commit -m "feat(voip): shared SMS merge-token registry"
```

---

### Task 2: Runtime token expansion (renderer + context query + service)

⚠️ Touches runtime declared "verified" in the parent spec — these three change together and must be re-verified after. Landing one without the others leaves a broken path.

**Files:**
- Modify: `src/shared/services/voip/campaigns/lib/render-sms-template.ts`
- Modify: `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts` (`findSmsCadenceContextByCtContactId` + the `SmsCadenceContext` type)
- Modify: `src/shared/services/voip/campaigns/sms-cadence.service.ts:64-68`

**Interfaces:**
- Consumes: `SMS_MERGE_TOKENS`, `SmsMergeVars` from Task 1.
- Produces: `renderSmsTemplate(body: string, vars: SmsMergeVars): string`; `SmsCadenceContext` now carries `customerState: string`, `customerZip: string`.

- [ ] **Step 1: Rewrite the renderer to use the registry**

```ts
// src/shared/services/voip/campaigns/lib/render-sms-template.ts
import type { SmsMergeVars } from '@/shared/entities/voip-campaigns/lib/sms-merge-tokens'
import { SMS_MERGE_TOKENS } from '@/shared/entities/voip-campaigns/lib/sms-merge-tokens'

// Pure {{token}} substitution for campaign SMS bodies. Renders in-app because
// CloudTalk's /sms/send takes a literal body (no contact merge). Tokens come
// from the shared registry; unknown tokens are left untouched. No I/O.

const RESOLVERS = new Map(SMS_MERGE_TOKENS.map(t => [t.token, t.resolve]))

export function renderSmsTemplate(body: string, vars: SmsMergeVars): string {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (match, key: string) => {
    const resolve = RESOLVERS.get(key)
    return resolve ? resolve(vars) : match
  })
}
```

- [ ] **Step 2: Extend the context query to fetch `state` + `zip`**

In `findSmsCadenceContextByCtContactId` add to the `.select({...})`:
```ts
        customerState: customers.state,
        customerZip: customers.zip,
```
and to the returned object:
```ts
      customerState: row.customerState ?? 'CA',
      customerZip: row.customerZip,
```
Add `customerState: string` and `customerZip: string` to the `SmsCadenceContext` interface (find it in the same file or its `types`).

- [ ] **Step 3: Pass the new vars from the service**

In `src/shared/services/voip/campaigns/sms-cadence.service.ts`, update the `renderSmsTemplate` call (currently lines 64-68):
```ts
      const text = renderSmsTemplate(decision.message.body, {
        name: ctx.customerName,
        city: ctx.customerCity,
        state: ctx.customerState,
        zip: ctx.customerZip,
        interestedTradesRaw: ctx.interestedTradesRaw,
      })
```

- [ ] **Step 4: Verify**

Run: `pnpm tsc` → Expected: clean (the `SmsMergeVars` shape forces all three call sites to agree). Run: `pnpm lint` → Expected: clean.

- [ ] **Step 5: Re-verify the renderer behavior (manual, since it's new code)**

In a scratch `tsx` REPL or a temporary script, confirm:
`renderSmsTemplate('Hi {{first_name}} in {{city}}, {{state}} {{zip}} — {{all_trades}}. {{unknown}}', { name: 'Maria Lopez', city: 'Pasadena', state: 'CA', zip: '91101', interestedTradesRaw: ['Roofing', 'Solar'] })`
→ `Hi Maria in Pasadena, CA 91101 — Roofing, Solar. {{unknown}}`. Delete the scratch file.

- [ ] **Step 6: Commit**

```bash
git add src/shared/services/voip/campaigns/lib/render-sms-template.ts src/shared/entities/voip-campaign-contacts/dal/server/queries.ts src/shared/services/voip/campaigns/sms-cadence.service.ts
git commit -m "feat(voip): expand SMS merge tokens to core set (full_name/state/zip/all_trades)"
```

---

### Task 3: tRPC procedure `setCampaignSmsCadence`

**Files:**
- Modify: `src/trpc/routers/voip-campaigns.router.ts`

**Interfaces:**
- Consumes: `voipCampaignCrud.update(ctx, { id, data })`; `smsCadenceSchema`.
- Produces: `voipCampaignsRouter.setCampaignSmsCadence` mutation, input `{ campaignId: string (uuid), smsCadence: SmsCadence }`.

- [ ] **Step 1: Add imports**

Add to the top of the router file:
```ts
import { voipCampaignCrud } from '@/shared/entities/voip-campaigns/dal/server/crud'
import { smsCadenceSchema } from '@/shared/entities/voip-campaigns/schemas/sms-cadence'
```

- [ ] **Step 2: Add the procedure** (place after `setSourcePolicy`)

```ts
  /**
   * Set a campaign's automated SMS cadence config. Full-replace of the
   * `sms_cadence` JSONB (the spec defines no jsonbMergeColumns, so the messages
   * array is replaced, not merged). Resync-safe — upsertCampaignByCtId never
   * writes this column. see src/shared/entities/voip-campaigns/DOCS.md#sms-cadence
   */
  setCampaignSmsCadence: superAdminProcedure
    .input(z.object({
      campaignId: z.string().uuid(),
      smsCadence: smsCadenceSchema,
    }))
    .mutation(async ({ ctx, input }) => {
      return dalToTrpc(await voipCampaignCrud.update(ctx, {
        id: input.campaignId,
        data: { smsCadence: input.smsCadence },
      }))
    }),
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc` → Expected: clean. Run: `pnpm lint` → Expected: clean.
Confirm `voipCampaignServerSpec` still has **no** `update.jsonbMergeColumns` (grep) — otherwise the array would deep-merge. If present, that's a bug to flag, not work around.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/voip-campaigns.router.ts
git commit -m "feat(voip): setCampaignSmsCadence super-admin procedure"
```

---

### Task 4: Mutation hook wrapper

**Files:**
- Modify: `src/features/campaigns-admin/hooks/use-campaign-mutations.ts`

**Interfaces:**
- Consumes: `voipCampaignsRouter.setCampaignSmsCadence`.
- Produces: `setCampaignSmsCadence` mutation in the object returned by `useCampaignMutations()`.

- [ ] **Step 1: Add the wrapper** (alongside `setSourcePolicy`)

```ts
  const setCampaignSmsCadence = useMutation(
    trpc.voipCampaignsRouter.setCampaignSmsCadence.mutationOptions({
      onSuccess: () => {
        invalidateVoipCampaigns()
        toast.success('Cadence saved')
      },
      onError: err => toast.error(err.message || 'Failed to save cadence'),
    }),
  )
```
Add `setCampaignSmsCadence,` to the returned object.

- [ ] **Step 2: Verify** — `pnpm tsc` clean, `pnpm lint` clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/campaigns-admin/hooks/use-campaign-mutations.ts
git commit -m "feat(voip): useCampaignMutations.setCampaignSmsCadence wrapper"
```

---

### Task 5: SMS-segment + cursor-insert helpers

**Files:**
- Create: `src/features/campaigns-admin/lib/sms-segments.ts`
- Create: `src/features/campaigns-admin/lib/insert-at-cursor.ts`

**Interfaces:**
- Produces:
  - `countSmsSegments(body: string): { chars: number; segments: number }`
  - `insertAtCursor(el: HTMLTextAreaElement, text: string): { value: string; caret: number }`

- [ ] **Step 1: Segment counter (v1 GSM-7 approximation)**

```ts
// src/features/campaigns-admin/lib/sms-segments.ts
// v1 approximation: assume GSM-7 (160 chars / segment, 153 for multi-part).
// {{tokens}} are counted at their literal length — see plan §12 q1 for the
// known imprecision (a token resolving to UCS-2 chars would flip the limit).

export function countSmsSegments(body: string): { chars: number; segments: number } {
  const chars = body.length
  if (chars === 0) {
    return { chars: 0, segments: 0 }
  }
  const segments = chars <= 160 ? 1 : Math.ceil(chars / 153)
  return { chars, segments }
}
```

- [ ] **Step 2: Cursor-insert helper**

```ts
// src/features/campaigns-admin/lib/insert-at-cursor.ts
// Inserts text at a textarea's selection, returning the new value + caret
// position so the caller can setState then restore the caret. Pure given the
// element's current selection.

export function insertAtCursor(
  el: HTMLTextAreaElement,
  text: string,
): { value: string; caret: number } {
  const start = el.selectionStart ?? el.value.length
  const end = el.selectionEnd ?? el.value.length
  const value = el.value.slice(0, start) + text + el.value.slice(end)
  return { value, caret: start + text.length }
}
```

- [ ] **Step 3: Verify** — `pnpm tsc` clean, `pnpm lint` clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/campaigns-admin/lib/sms-segments.ts src/features/campaigns-admin/lib/insert-at-cursor.ts
git commit -m "feat(voip): sms segment + cursor-insert helpers"
```

---

### Task 6: `CadenceMessageRow` component

**Files:**
- Create: `src/features/campaigns-admin/ui/components/setup/cadence-message-row.tsx`

**Interfaces:**
- Consumes: `SmsCadenceMessage` (from `entities/voip-campaigns/schemas/sms-cadence`), `SMS_MERGE_TOKENS` (Task 1), `countSmsSegments` + `insertAtCursor` (Task 5).
- Produces: `CadenceMessageRow` with props:
  ```ts
  interface CadenceMessageRowProps {
    message: SmsCadenceMessage
    index: number              // 0-based; render index + 1 as the rung number
    showThresholdWarning: boolean
    onChange: (patch: Partial<SmsCadenceMessage>) => void
    onRemove: () => void
  }
  ```

- [ ] **Step 1: Build the component**

Structure (dumb, props-driven; prop interface in-file). Key behaviors, with the punch list baked in:

- Leading **rung number** `index + 1`, muted, `tabular-nums`. No card wrapper — the row is `gap`-separated with a hairline divider, not nested in a card.
- `afterAttempts`: `<Input type="number" inputMode="numeric" min={1}>` with `tabular-nums`; `aria-label={\`Send after dial attempt for message ${index + 1}\`}`; `onChange` clamps to `>= 1`.
- `body`: `<Textarea ref={textareaRef}>` with `aria-label={\`Message ${index + 1} body\`}`, `autoComplete="off"`, `break-words`; parent flex children get `min-w-0`.
- **Token chips**: `SMS_MERGE_TOKENS.map(...)` → `<button type="button" aria-label={\`Insert {{${t.token}}}\`}>` rendering `{{token}}`, quiet `ghost` style, `focus-visible:ring`. On click: `const { value, caret } = insertAtCursor(textareaRef.current!, \`{{${t.token}}}\`); onChange({ body: value })` then restore caret in a `requestAnimationFrame`.
- **Segment counter**: `const { chars, segments } = countSmsSegments(message.body)`; render `{chars} chars · {segments} segment(s)` muted `tabular-nums` in an `aria-live="polite"` span; if `segments > 3`, add a warning icon + amber text (color **and** icon + text, never color alone).
- **Threshold warning** (driven by `showThresholdWarning`): inline icon + text "Thresholds usually increase down the ladder." in an `aria-live="polite"` region. **No border stripe.**
- **Remove**: icon-only `<Button variant="ghost" size="icon" aria-label={\`Remove message ${index + 1}\`}>` calling `onRemove`.

Use a `useRef<HTMLTextAreaElement>(null)`. Confirm shadcn `Textarea` forwards refs (it does in this repo — verify by import).

- [ ] **Step 2: Verify** — `pnpm tsc` clean, `pnpm lint` clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/campaigns-admin/ui/components/setup/cadence-message-row.tsx
git commit -m "feat(voip): CadenceMessageRow editor component"
```

---

### Task 7: `CampaignCadenceDialog` component

**Files:**
- Create: `src/features/campaigns-admin/ui/components/setup/campaign-cadence-dialog.tsx`

**Interfaces:**
- Consumes: `VoipCampaign` (db schema type), `smsCadenceSchema` + `SmsCadence` + `SmsCadenceMessage`, `useCampaignMutations` (Task 4), `CadenceMessageRow` (Task 6).
- Produces: `CampaignCadenceDialog` with props:
  ```ts
  interface CampaignCadenceDialogProps {
    campaign: VoipCampaign | null   // the campaign being edited; null = closed
    open: boolean
    onOpenChange: (open: boolean) => void
  }
  ```

- [ ] **Step 1: Build the dialog (view: owns draft state)**

Behaviors:
- Seed draft on open: `const [draft, setDraft] = useState<SmsCadence>(() => campaign?.smsCadence ?? smsCadenceSchema.parse({}))`. Re-seed in a `useEffect` keyed on `campaign?.id` so reopening a different campaign resets the draft.
- `dirty` = `JSON.stringify(draft) !== JSON.stringify(campaign?.smsCadence ?? smsCadenceSchema.parse({}))`.
- Header: `SMS cadence — {campaign?.ctCampaignName}`.
- Two switches: `enabled` and `oneSmsPerDay` (`aria-label`ed), bound to draft.
- Ladder: `draft.messages.map((m, i) => <CadenceMessageRow ... showThresholdWarning={i > 0 && m.afterAttempts < draft.messages[i-1].afterAttempts} onChange={patch => updateMessage(i, patch)} onRemove={() => removeMessage(i)} />)`.
- Empty state when `messages.length === 0`: "No messages yet. Add an opener — it sends after the first dial attempt."
- `+ Add message`: `disabled={draft.messages.length >= 5}`, appends `{ afterAttempts: lastThreshold || 1, body: '' }`; counter `{draft.messages.length} / 5` (`tabular-nums`, non-breaking spaces around `/`).
- Footer: **Cancel** + **Save cadence**. Save: `disabled={!dirty}` only — stays enabled while valid; on click sets a local `saving` true, calls `setCampaignSmsCadence.mutate({ campaignId, smsCadence: draft })`, shows spinner + "Saving…", closes `onSuccess`.
- **Unsaved-changes guard**: intercept `onOpenChange(false)` — if `dirty && !saving`, `window.confirm('Discard unsaved cadence changes?')` (or an AlertDialog) before closing. Keep shadcn `Dialog`'s Esc/overlay/return-focus intact (route them through the same guard).
- `overscroll-behavior: contain` on the scrollable ladder region.
- Motion: rely on shadcn Dialog's scale+fade; for add/remove row use `motion/react` with `grid-template-rows` `0fr→1fr` (never animate height), gated by `prefers-reduced-motion`.

Save the mutation as `const { setCampaignSmsCadence } = useCampaignMutations()`.

- [ ] **Step 2: Verify** — `pnpm tsc` clean, `pnpm lint` clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/campaigns-admin/ui/components/setup/campaign-cadence-dialog.tsx
git commit -m "feat(voip): CampaignCadenceDialog authoring surface"
```

---

### Task 8: Wire into `SyncedCampaignsCard` + manual verification

**Files:**
- Modify: `src/features/campaigns-admin/ui/components/setup/synced-campaigns-card.tsx`

**Interfaces:**
- Consumes: `CampaignCadenceDialog` (Task 7), `VoipCampaign`.

- [ ] **Step 1: Add cadence summary + edit trigger + hoisted dialog**

- Add a single hoisted dialog state: `const [editing, setEditing] = useState<VoipCampaign | null>(null)` (one dialog instance, per §12 q3 — not one per row).
- Add a **Cadence** column header + per-row cell: derive `const c = campaign.smsCadence; const on = Boolean(c?.enabled); const n = c?.messages.length ?? 0;` render `{n} msgs · on` (foreground + quiet `bg-success` dot) when `on && n > 0`, else `— off` (muted). Quiet dot, **not** a primary badge.
- Add an **Edit cadence** cell: `<Button variant="outline" size="sm" onClick={() => setEditing(campaign)}>Edit cadence</Button>`.
- Render once below the table: `<CampaignCadenceDialog campaign={editing} open={editing !== null} onOpenChange={open => { if (!open) setEditing(null) }} />`.

- [ ] **Step 2: Verify build** — `pnpm tsc` clean, `pnpm lint` clean.

- [ ] **Step 3: Manual round-trip (the real acceptance test)**

Run `pnpm dev`, sign in as super-admin, open the Campaigns Control Center → Setup tab:
1. A campaign row shows `— off`. Click **Edit cadence**.
2. Toggle **Enabled** on, add 2 messages: msg 1 `afterAttempts 1` body "Hi {{first_name}}, …" (insert via chip); msg 2 `afterAttempts 3` body "Following up on your {{all_trades}} project in {{city}}, {{state}}."
3. Confirm the segment counter updates, the `2 / 5` counter shows, and setting msg 2's threshold below msg 1's surfaces the non-decreasing warning (Save still enabled).
4. **Save cadence** → toast "Cadence saved", dialog closes, row now shows `2 msgs · on`.
5. Reopen → values round-trip exactly.
6. Edit something, press Esc → unsaved-changes confirm fires.
7. Spot-check DB: `SELECT sms_cadence FROM voip_campaigns WHERE ct_campaign_name = '<name>';` matches the authored JSON.

- [ ] **Step 4: Commit**

```bash
git add src/features/campaigns-admin/ui/components/setup/synced-campaigns-card.tsx
git commit -m "feat(voip): surface SMS cadence editor on SyncedCampaignsCard"
```

---

## Self-Review

**Spec coverage:** §3.1 surface (Task 8 dialog trigger), §3.2 CRUD reuse (Task 3), §3.3 maxMessages-hidden (Task 7 sends full draft incl. schema default 5 via `smsCadenceSchema.parse`), §3.4 empty-cadence-valid (Task 7 allows 0 messages; Save gated on dirty not validity), §3.5 invalidate-on-settled (Task 4), §5.1-5.3 data flow (Tasks 3/4/8), §6 tokens + registry + runtime (Tasks 1/2), §7 components (Tasks 6/7/8), §8 aesthetic (Tasks 6/7), §9 a11y/forms (Tasks 6/7), §11 verification (Task 8 step 3). All covered.

**Placeholder scan:** No TBD/TODO; UI tasks give code skeletons + explicit behavior lists rather than full JSX — acceptable because the punch-list constraints (§8/§9) are enumerated and the non-presentational logic (state, dirty, insert-at-cursor, segment count, aria) is spelled out. Tailwind class-by-class markup is intentionally left to the implementer within the stated constraints.

**Type consistency:** `SmsMergeVars` (Task 1) is the single renderer arg used in Task 2 (renderer + service). `SmsCadence` / `SmsCadenceMessage` flow from schema → Task 6 props → Task 7 draft. `voipCampaignCrud.update(ctx, { id, data })` shape matches Task 3 usage and the confirmed signature. Hook name `setCampaignSmsCadence` consistent across Tasks 3/4/7.

## Open questions (carried from spec §12)

1. Segment counter is a GSM-7 approximation (Task 5) — UCS-2 detection deferred.
2. Chip cursor-insert needs a forwarded textarea ref (Task 6) — verify shadcn `Textarea` forwards it.
3. Single hoisted dialog chosen over per-row (Task 8).
