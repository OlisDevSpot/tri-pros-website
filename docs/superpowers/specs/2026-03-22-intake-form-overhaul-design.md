# Intake Form Overhaul — Design Spec

**Date:** 2026-03-22
**Branch:** `migrating-notion`
**Tasks:** #18 (Intake Form UX Overhaul)

---

## Problem Statement

The intake form (`/intake/[token]`) has four issues:

1. **Layout:** Hero is too close to navbar — doesn't use `ViewportHero` + `TopSpacer` like all other pages
2. **Missing trade/scope selection:** No way to record which trades the lead is interested in
3. **"Closed By" dropdown shows internal users:** Should show 3rd-party telemarketer names configured per lead source, not Tri Pros agents. "Closed By" here means which remote telemarketer generated the lead, NOT who closes the sale internally.
4. **Form architecture:** Built with raw `useState` instead of RHF + Zod (violates form convention). An existing `src/features/intake/schemas/intake-form-schema.ts` was started but never wired into the view.

---

## Design

### 1. Form Config Schema Change

**File:** `src/shared/entities/lead-sources/schemas.ts`

Add `closedByOptions` to `leadSourceFormConfigSchema`:

```ts
closedByOptions: z.array(z.string()).optional()
```

- **Present** (e.g. `["Austin", "Rico", "Mei Ann", "Angelica"]`) -> render a "Closed By" `Select` dropdown with those names as options
- **Absent/undefined** -> don't render the "Closed By" field at all
- Fully decoupled from `showMeetingScheduler` — they control different fields independently

**DB update:** Update the telemarketing lead source record's `formConfigJSON` to include `closedByOptions: ["Austin", "Rico", "Mei Ann", "Angelica"]`.

### 2. Form Refactor: RHF + Zod

**Replace:** `src/features/intake/schemas/intake-form-schema.ts` (existing but incomplete)

The existing file has `closedById: z.string().optional()` (a user ID FK) which is wrong — `closedBy` is a telemarketer name string, not linked to the `user` table. The schema also lacks `tradeRows`.

New schema at `src/features/intake/schemas/intake-form-schema.ts`:

```ts
export const tradeRowSchema = z.object({
  tradeId: z.string().min(1),
  scopeIds: z.array(z.string()),
})

export const intakeFormSchema = z.object({
  // Required
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(7, 'Phone is required'),
  city: z.string().min(1, 'City is required'),
  zip: z.string().min(3, 'ZIP is required'),
  tradeRows: z.array(tradeRowSchema).min(1, 'At least one trade is required'),

  // Optional (toggled by formConfig)
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  address: z.string().optional(),
  state: z.string().length(2).optional(),
  notes: z.string().optional(),
  scheduledFor: z.string().optional(),
  closedBy: z.string().optional(),     // Telemarketer name string, NOT a user ID
  mp3Key: z.string().optional(),        // R2 object key after upload

  // Bot protection
  _honeypot: z.string().max(0, 'Bot detected').optional(),
})

export type IntakeFormData = z.infer<typeof intakeFormSchema>

export const intakeFormDefaultValues: IntakeFormData = {
  name: '',
  phone: '',
  city: '',
  zip: '',
  tradeRows: [{ tradeId: '', scopeIds: [] }],
  email: '',
  address: '',
  state: '',
  notes: '',
  scheduledFor: '',
  closedBy: '',
  mp3Key: '',
  _honeypot: '',
}
```

**Schema location note:** This stays in `src/features/intake/schemas/` (not `shared/entities/`) because it's a UI form schema, not a business entity JSONB schema. The JSONB sub-schema changes go in `src/shared/entities/customers/schemas.ts` (see section 7).

### 3. Trade/Scope Picker

**New file:** `src/features/intake/ui/components/intake-trade-scope-picker.tsx`

Manages the `tradeRows` field array via `useFieldArray({ name: 'tradeRows' })` from `useFormContext<IntakeFormData>`. Each row renders a `TradeScopeRow` (trade `Select` + scope `MultiSelect` + delete button).

**Architectural note:** The existing `TradeScopePickerFields` in showroom uses a custom `useReducer` because it must sync a flat `scopeIds: string[]` array (the project schema's data model). The intake form uses a structured `tradeRows` array, so `useFieldArray` is the correct RHF-native approach here. This is an intentional divergence — different data shapes warrant different state management.

**Import directionality:** `TradeScopeRow` lives in `features/showroom/`. Its imports are all from `shared/` (`@/shared/services/notion/...`, `@/shared/components/ui/...`), so moving it to `src/shared/components/trade-scope-row.tsx` is safe. This makes it available to both showroom and intake without cross-feature imports.

After the move, update the import in `src/features/showroom/ui/components/form/trade-scope-picker-fields.tsx` to point to the new shared location.

### 4. Page Layout

**File:** `src/app/(frontend)/(site)/intake/[token]/page.tsx`

Wrap in `ViewportHero` + `TopSpacer` for proper navbar spacing. Minimal hero:
- No background image
- Lead source name as heading
- Clean, modern, minimal — functional internal tool aesthetic
- Form renders in a centered card below the heading

### 5. "Closed By" and Meeting Date Fields

**Delete:** `src/features/intake/ui/components/meeting-scheduler-field.tsx`

Replace with two independent components:

- **`src/features/intake/ui/components/meeting-date-field.tsx`** — date/time picker, shown when `formConfig.showMeetingScheduler` is true. Uses `useFormContext<IntakeFormData>` to write `scheduledFor`.
- **`src/features/intake/ui/components/closed-by-field.tsx`** — simple `Select` with string values from `formConfig.closedByOptions`. Shown only when `closedByOptions` is present. Uses `useFormContext<IntakeFormData>` to write `closedBy`.

### 6. Customer Record Storage

**File:** `src/shared/entities/customers/schemas.ts`

Extend `leadMetaSchema` to include the new fields:

```ts
export const leadMetaSchema = z.object({
  mp3RecordingKey: z.string().optional(),
  closedBy: z.string().optional(),           // 3rd-party telemarketer name
  scheduledFor: z.string().optional(),       // appointment date/time (stored here because meetings.ownerId is NOT NULL)
  requestedTrades: z.array(z.object({
    tradeId: z.string(),
    scopeIds: z.array(z.string()),
  })).optional(),
})
```

**File:** `src/trpc/routers/customers.router.ts`

The `createFromIntake` mutation currently has `closedById: z.string().optional()` which it uses as `ownerId` on the meeting insert (line 142-148). Changes:

1. **Remove `closedById` from input** — the telemarketer name is no longer a user FK
2. **Remove `scheduledFor` from input** — it now lives in `leadMetaJSON`
3. **Add `closedBy`, `scheduledFor`, and `requestedTrades` to `leadMetaJSON`** input
4. **Remove meeting creation logic entirely** — the `meetings.ownerId` column is `NOT NULL` with a FK to `user.id`, so we cannot insert a meeting without an owner. The `scheduledFor` value is stored in `leadMetaJSON` on the customer record. A super-admin creates the meeting later when they assign an owner via Task #17.
5. **Submit handler mapping:** `mp3Key` from the form maps to `mp3RecordingKey` in `leadMetaJSON` (preserving the existing naming convention).

### 7. Task #17 (Super-Admin User Assignment — scoped out)

The `InternalUserSelect` component with profile cards (avatar + email) is a separate task. It will be used for super-admin assignment of `ownerId` on meetings/proposals. Not part of this intake form overhaul.

The existing `getInternalUsers` procedure stays in `intake.router.ts` — it will be consumed by Task #17.

---

## File Changes Summary

| Action | File | What |
|--------|------|------|
| **Rewrite** | `src/features/intake/schemas/intake-form-schema.ts` | New `intakeFormSchema` with `tradeRows`, `closedBy` (string), `_honeypot`, defaults |
| **Create** | `src/features/intake/ui/components/intake-trade-scope-picker.tsx` | RHF `useFieldArray` wrapper using `TradeScopeRow` |
| **Create** | `src/features/intake/ui/components/meeting-date-field.tsx` | Date/time picker (extracted from `MeetingSchedulerField`) |
| **Create** | `src/features/intake/ui/components/closed-by-field.tsx` | Simple string `Select` from `closedByOptions` |
| **Move** | `src/features/showroom/.../trade-scope-row.tsx` -> `src/shared/components/trade-scope-row.tsx` | Shared across features |
| **Modify** | `src/features/showroom/.../trade-scope-picker-fields.tsx` | Update import path for moved `TradeScopeRow` |
| **Modify** | `src/shared/entities/lead-sources/schemas.ts` | Add `closedByOptions: z.array(z.string()).optional()` |
| **Modify** | `src/shared/entities/customers/schemas.ts` | Extend `leadMetaSchema` with `closedBy`, `requestedTrades` |
| **Refactor** | `src/features/intake/ui/views/intake-form-view.tsx` | RHF + zodResolver, use new components, proper submit mapping |
| **Refactor** | `src/app/(frontend)/(site)/intake/[token]/page.tsx` | `ViewportHero` + `TopSpacer` layout |
| **Modify** | `src/trpc/routers/customers.router.ts` | Remove `closedById`, accept `closedBy`+`requestedTrades` via `leadMetaJSON`, meeting with `ownerId: null` |
| **Delete** | `src/features/intake/ui/components/meeting-scheduler-field.tsx` | Replaced by `meeting-date-field.tsx` + `closed-by-field.tsx` |
| **DB update** | Telemarketing lead source record | Set `closedByOptions: ["Austin", "Rico", "Mei Ann", "Angelica"]` in `formConfigJSON` |

---

## UI/UX Notes

- Hero: minimal, no images, just heading + subtitle. Modern and clean.
- Form: single-column card layout, centered, responsive
- Trade picker: starts with 1 empty row, "Add Trade" button below, at least 1 trade required for submit
- Scopes per trade: optional multi-select, disabled until trade is selected
- "Closed By": simple dropdown with telemarketer names, only visible when configured for this lead source
- Date picker: independent from "Closed By", controlled by `showMeetingScheduler`
- Validation: Zod errors displayed via FormField/FormMessage pattern (shadcn)
- Submit button: full-width, loading state during mutation
- Honeypot: inside Zod schema (`_honeypot` field, max 0 chars), rendered as hidden input outside FormField

---

## Out of Scope

- Task #17 (Super-Admin User Assignment / `InternalUserSelect` with profile cards) — separate implementation
- Lead source admin UI for editing `closedByOptions` — managed via DB for now
- nuqs state preservation — not needed for a single-step intake form (no multi-step flow)
