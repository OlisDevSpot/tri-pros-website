# Intake Form Universal Overhaul — Design Spec

**Date:** 2026-03-31
**Issue:** TBD (create new issue)
**Depends on:** None (builds on completed #9, #11, #56)

## Problem

The intake form currently uses unguessable tokens for per-lead-source access (`/(site)/intake/[token]/`). This approach doesn't scale:

- Adding a new lead source requires generating a token and sharing a cryptic URL
- Super-admins have no dashboard access to the intake form (sidebar item is disabled, page shows "Coming Soon")
- The form config uses flat booleans (`showMeetingScheduler`, `showMp3Upload`, etc.) with no structured grouping — adding new field groups means adding more booleans
- No way for super-admins to do manual entry (customer-only vs customer+meeting) from a single form

## Solution

Migrate to a **universal intake form** with two entry points, a discriminated-union schema, and DB-driven lead-source configuration.

---

## Route Architecture

### Two routes, one shared form

| Route | Layout | Who | Access |
|---|---|---|---|
| `/dashboard/intake` | Dashboard shell (sidebar + nav) | Super-admins only | Sidebar nav item, `protectDashboardPage()` + super-admin role check |
| `/intake?source={slug}` | Standalone branded page (no dashboard chrome) | 3rd party users | `source` param validated against `lead_sources.slug` in DB |

### Access control matrix

| URL | Auth state | Result |
|---|---|---|
| `/dashboard/intake` | Super-admin | Full form, mode toggle, all fields |
| `/dashboard/intake` | Agent/user | 403 forbidden |
| `/dashboard/intake` | Not authenticated | Redirect to login |
| `/intake?source=tpr-telemarketing-leads` | Any (no auth required) | Standalone form, fields per lead source config |
| `/intake` (no param) | Not authenticated | Redirect to `/` |
| `/intake` (no param) | Super-admin | Redirect to `/dashboard/intake` |

### Deletions

- Delete `src/app/(frontend)/(site)/intake/[token]/page.tsx` — replaced by `/intake?source={slug}`
- The `token` column on `lead_sources` table becomes unused (keep for now, drop in future migration)

---

## Schema Redesign — Discriminated Union

### Form schema (`src/features/intake/schemas/intake-form-schema.ts`)

Replace the flat schema with a discriminated union on `mode`:

```typescript
import z from 'zod'

export const tradeRowSchema = z.object({
  tradeId: z.string().min(1, 'Trade is required'),
  scopeIds: z.array(z.string()),
})

export type TradeRow = z.infer<typeof tradeRowSchema>

// Shared base fields — always present in both modes
const baseFields = {
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(7, 'Phone is required'),
  city: z.string().min(1, 'City is required'),
  zip: z.string().min(3, 'ZIP is required'),
  address: z.string().optional(),
  state: z.string().length(2).optional(),
  tradeRows: z.array(tradeRowSchema).min(1, 'At least one trade is required'),
  notes: z.string().min(1, 'Notes are required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  _honeypot: z.string().max(0, 'Bot detected').optional(),
}

// Customer + Meeting mode
const customerAndMeetingSchema = z.object({
  ...baseFields,
  mode: z.literal('customer_and_meeting'),
  scheduledFor: z.string().optional(),
  closedBy: z.string().optional(),
  mp3Key: z.string().optional(),
})

// Customer-only mode
const customerOnlySchema = z.object({
  ...baseFields,
  mode: z.literal('customer_only'),
})

export const intakeFormSchema = z.discriminatedUnion('mode', [
  customerAndMeetingSchema,
  customerOnlySchema,
])

export type IntakeFormData = z.infer<typeof intakeFormSchema>

export const intakeModes = ['customer_only', 'customer_and_meeting'] as const
export type IntakeMode = (typeof intakeModes)[number]
```

### Lead source form config (`src/shared/entities/lead-sources/schemas.ts`)

Update to reference the mode and provide field-level toggles within each mode:

```typescript
export const leadSourceFormConfigSchema = z.object({
  // Which mode this lead source operates in
  mode: z.enum(['customer_only', 'customer_and_meeting']),

  // Field visibility (within the active mode)
  showEmail: z.boolean(),
  requireEmail: z.boolean(),
  showNotes: z.boolean(),

  // Meeting-mode-specific (ignored in customer_only mode)
  showMeetingScheduler: z.boolean().optional(),
  requireMeetingScheduler: z.boolean().optional(),
  showMp3Upload: z.boolean().optional(),
  closedByOptions: z.array(z.string()).optional(),
})
```

---

## Shared Form Component

### `IntakeFormView` props

```typescript
interface IntakeFormProps {
  /** Which mode the form operates in */
  mode: IntakeMode
  /** Lead source form config — controls field visibility within the mode */
  formConfig: LeadSourceFormConfig
  /** Lead source slug — undefined means super-admin manual entry */
  leadSourceSlug?: string
  /** Super-admin mode toggle callback — only provided on dashboard page */
  onModeChange?: (mode: IntakeMode) => void
}
```

### Rendering logic

1. **Base fields** always render: name, phone, address (autocomplete → city/state/zip), tradeRows, notes
2. **Email** renders if `formConfig.showEmail`
3. **Meeting fields** (scheduledFor, closedBy, mp3Upload) render only when `mode === 'customer_and_meeting'` AND the corresponding `formConfig` flag is true
4. **Mode toggle** renders only when `onModeChange` is provided (super-admin dashboard page)

### Consumer pages

**Dashboard page** (`src/app/(frontend)/dashboard/intake/page.tsx`):
- Server component: `protectDashboardPage()` + super-admin role check
- Client component wrapper manages mode state via `useState`
- Passes `onModeChange` to `IntakeFormView` for the toggle
- Creates a "super-admin" form config with all fields enabled
- `leadSourceSlug` is undefined (manual entry → stored as `leadSource: 'other'`, matching the existing const array value)

**Public page** (`src/app/(frontend)/intake/page.tsx`):
- Reads `source` nuqs param from searchParams
- Fetches lead source from DB by slug (new tRPC procedure: `intakeRouter.getBySlug`)
- 404 if slug invalid or lead source inactive
- Passes mode from `formConfig.mode`, no `onModeChange` (3rd party can't toggle)
- Standalone layout — no sidebar, centered card with Tri Pros branding

---

## Sidebar Changes

In `src/features/agent-dashboard/lib/get-sidebar-nav.ts`:

```diff
- { href: ROOTS.dashboard.intake(), icon: ClipboardListIcon, label: 'Intake Form', enabled: false },
+ { href: ROOTS.dashboard.intake(), icon: ClipboardListIcon, label: 'Intake Form', enabled: true },
```

No permission changes needed — already gated behind `ability.can('manage', 'all')`.

---

## tRPC Changes

### New procedure: `intakeRouter.getBySlug`

```typescript
getBySlug: baseProcedure
  .input(z.object({ slug: z.string().min(1) }))
  .query(async ({ input }) => {
    const [row] = await db
      .select()
      .from(leadSourcesTable)
      .where(eq(leadSourcesTable.slug, input.slug))
      .limit(1)

    if (!row || !row.isActive) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'This intake form is no longer active.' })
    }

    return {
      leadSourceSlug: row.slug,
      leadSourceName: row.name,
      formConfig: leadSourceFormConfigSchema.parse(row.formConfigJSON),
    }
  }),
```

### Update `customersRouter.createFromIntake`

- Accept `mode` field to differentiate customer-only vs customer+meeting submissions
- When `mode === 'customer_only'`, skip meeting-related fields in `leadMetaJSON`
- When `mode === 'customer_and_meeting'`, include `scheduledFor`, `closedBy`, `requestedTrades` in `leadMetaJSON`

---

## File Changes Summary

### New files
- `src/app/(frontend)/intake/page.tsx` — public standalone intake page with nuqs `source` param

### Modified files
- `src/features/intake/schemas/intake-form-schema.ts` — discriminated union schema
- `src/shared/entities/lead-sources/schemas.ts` — add `mode` to form config
- `src/features/intake/ui/views/intake-form-view.tsx` — new props, conditional mode rendering, mode toggle
- `src/app/(frontend)/dashboard/intake/page.tsx` — replace "Coming Soon" with real form + super-admin wrapper
- `src/features/agent-dashboard/lib/get-sidebar-nav.ts` — enable intake nav item
- `src/trpc/routers/intake.router.ts` — add `getBySlug` procedure
- `src/trpc/routers/customers.router.ts` — update `createFromIntake` to accept `mode`

### Deleted files
- `src/app/(frontend)/(site)/intake/[token]/page.tsx` — replaced by `/intake?source={slug}`

### DB changes
- Update existing `lead_sources` rows: add `mode` field to `formConfigJSON`
- No schema migration needed (JSONB is flexible)

---

## Verification Plan

1. **Super-admin dashboard**: Log in as super-admin → sidebar shows "Intake Form" → click → full form renders with mode toggle → submit in both modes → verify customer created in DB
2. **3rd party access**: Visit `/intake?source=telemarketing_leads_philippines` (unauthenticated) → standalone form renders with correct fields per config → submit → verify customer created
3. **Access control**: Visit `/intake` with no param (unauthenticated) → redirects to `/` ; visit `/dashboard/intake` as agent → 403
4. **Old route deleted**: Visit `/(site)/intake/[token]` → 404
5. **Lint + typecheck**: `pnpm lint` + `pnpm tsc` pass