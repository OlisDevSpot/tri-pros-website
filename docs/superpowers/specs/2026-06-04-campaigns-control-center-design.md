# Campaigns Control Center — Ring-1 admin UI (design)

> **Status:** approved 2026-06-04. Backend (steps 1–9) already shipped + tsc/lint clean.
> This spec covers ONLY the UI (step 10) + its two supporting read procedures.
> Canonical design record: voip-campaigns `EPIC.md` decisions 2026-06-04 (#1–#19) + W8.

## Goal

A standalone super-admin **Campaigns Control Center** at `/dashboard/campaigns` for the
three ring-1 surfaces: (1) Resync + campaign→source binding, (2) per-source enroll-all
+ counts, (3) disqualify enrolled leads (single + bulk). Separate from lead-sources
(user decision 2026-06-04 — campaigns are their own nav item, directly under Lead Sources).

## Placement

- **Nav**: new `Campaigns` item in `get-sidebar-nav.ts` `adminItems` (super-admin only),
  directly after `Lead Sources`. Icon `MegaphoneIcon`.
- **Route**: `ROOTS.dashboard.campaigns()` → `/dashboard/campaigns`.
  Page `src/app/(frontend)/dashboard/campaigns/page.tsx` mirrors the lead-sources page
  guard (super-admin; agents redirected to `/dashboard`).
- **Feature**: `src/features/campaigns-admin/`.

## Layout (`CampaignsView`)

1. **Header** — title + subtitle + **Resync from CloudTalk** button (top-right).
2. **CloudTalk Sync & Binding** card (full-width) — table of synced `voip_campaigns`
   (incl. unbound): CT name · status · membership tag · bind→source (`Select`) ·
   set-default (`Switch`). Empty → "Run Resync to pull campaigns from CloudTalk."
3. **Per-source enrollment** (master-detail) — left rail: lead sources w/ enrolled +
   eligible badges; right pane (selected source): campaign picker (`Select`, default
   pre-selected) · Enroll all · Unenroll all · enrolled-leads list w/ Disqualify
   (row + bulk multi-select via `Checkbox`).

## Components (one per file, named exports, no default)

```
features/campaigns-admin/
  ui/views/campaigns-view.tsx
  ui/components/cloudtalk-sync-card.tsx
  ui/components/campaign-binding-row.tsx
  ui/components/campaign-source-list.tsx        ← left rail
  ui/components/source-enrollment-panel.tsx     ← right pane
  ui/components/enrolled-leads-list.tsx
  ui/components/enrolled-lead-row.tsx
  hooks/use-campaign-mutations.ts               ← mutationOptions + invalidation + toast
```

## Conventions reused (no hand-rolling)

- Reads: `useTRPC()` + `useQuery(trpc.voipCampaignsRouter.*.queryOptions())`,
  `placeholderData: keepPreviousData` where keys change.
- Mutations: a `use-campaign-mutations` hook wrapping `*.mutationOptions({ onSuccess, onError })`
  with `useInvalidation().invalidateVoipCampaigns()` + sonner `toast` (mirrors
  `use-lead-source-actions.ts`).
- Invalidation: add `invalidateVoipCampaigns()` to `useInvalidation` (router-level
  `voipCampaignsRouter.pathFilter()`, self-healing).
- Destructive confirms (Unenroll all, bulk Disqualify): `useConfirm`.
- Master-detail selection: `nuqs` `useQueryState('source', …)`.
- Primitives: shadcn `Card`, `Table`, `Select`, `Switch`, `Badge`, `Button`,
  `Checkbox`, `Skeleton`, `Tooltip`.

## Supporting backend (additive, on the existing router)

- DAL: `listLeadSources()` (lead-sources), `countEligibleLeadsBySource()` (customers),
  `listEnrolledLeadsBySource(sourceSlug)` (voip-campaign-contacts join customers + campaign).
- Router (`superAdminProcedure` + `dalToTrpc`):
  - `getSourceCampaignSummaries` → `[{ sourceSlug, name, defaultCampaignId, eligibleCount, enrolledCount }]`
  - `listEnrolledLeads({ sourceSlug })` → `[{ customerId, name, enrolledAt, campaignName }]`

## Edge / empty states

CloudTalk-not-configured (resync errors → toast), no synced campaigns (binding empty
state), source with no bound campaign (panel prompts to bind), no enrolled leads
(list empty state), enroll-all queued (async job → toast "queued", refetch summaries).

## Testing

Manual smoke per EPIC ring-1 plan (resync → bind → set default → enroll all →
disqualify). No unit tests — consistent with this feature area's UI norms.
