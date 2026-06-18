# Source-anchored Setup + auto-enroll-on-ingest — design

**Date:** 2026-06-17
**Status:** Approved, pending implementation plan
**Builds on:** the per-customer-membership + canonical-status refactors (`source_slug` removed from `voip_campaigns`; campaigns are pools, not source-owned — `src/shared/entities/voip-campaigns/DOCS.md#admin-binding`).

## Problem

Two gaps left after the per-customer-membership redesign:

1. **Auto-enroll is unwired.** `lead_sources.voipConfigJSON.campaigns.autoEnroll` is stored and preserved but read nowhere. `customerIntakeService.ingestLead` (the shared chokepoint behind both the Bina/GoHighLevel webhook and the public intake form) never enrolls. So no new lead is ever auto-enrolled, regardless of policy. There is also no write path to *set* `autoEnroll` or `enabled` — only `defaultCampaignId` is settable (`setVoipDefaultCampaign`).

2. **The Setup tab is oriented backwards.** The "CloudTalk Sync & Campaigns" card renders one row **per campaign** with a "Source (for default)" picker *inside* each campaign row — implying a source *owns* a campaign, the exact framing the pool-model refactor removed. To set a source's default you hunt for the right campaign row. You can't see at a glance what each source's default is, and `enabled`/`autoEnroll` aren't editable at all.

## Model invariant (load-bearing)

Campaigns are **pools**, not source-owned. Every field added here lives on the **source** (`lead_sources.voipConfigJSON.campaigns`), never on `voip_campaigns`:

- `enabled` — per-source master kill switch for VoIP campaigns.
- `autoEnroll` — auto-enroll new leads from this source.
- `defaultCampaignId` — a one-directional source→campaign **reference** (holds a `voip_campaigns.id`). Many-to-one: one campaign can be the default for zero/one/many sources; the campaign has no back-reference.

No column is added to `voip_campaigns`. The catch-all ("General Reaching Out") belongs to no source yet can be any number of sources' default.

## Design decisions (grilled + approved)

| # | Decision | Choice |
|---|---|---|
| 1 | **Trigger** | Wire into `ingestLead` (one chokepoint → covers Bina webhook + public intake form), gated per-source. No source special-cased. |
| 2 | **Gate** | `enabled && autoEnroll` (master switch + auto behavior, both required). |
| 3 | **Execution** | Background QStash job, fire-and-forget. |
| 4 | **Retroactive** | New leads only. Existing eligible pool stays manual via the existing "Enroll all". |

## Where each flag is checked

| Path | `enabled` | `autoEnroll` | gate chain (lead/DNC/phone/dup) |
|---|---|---|---|
| **Auto-enroll** (new) | required (at dispatch) | required (at dispatch) | runs in `enroll()` |
| **Manual enroll / Enroll-all** (today) | ignored | ignored | runs in `enroll()` |

`enabled && autoEnroll` is checked **only in the new auto-enroll dispatch**. `enroll()` is unchanged — manual enroll keeps working even when a source is `enabled: false` (per the existing reservation comment at `enrollment.service.ts:94-99`). This gives `enabled` its first real job without touching the manual path.

## Part A — auto-enroll-on-ingest (backend)

### Flow

```
ingestLead (after customerCrud.create succeeds)
  → leadSource + policy already loaded (no extra read; existing line ~40)
  → if policy.enabled && policy.autoEnroll && policy.defaultCampaignId:
        void enrollLeadJob.dispatch({ customerId })   ← best-effort
  → return as normal (enroll never blocks/breaks ingest)

enrollLeadJob (new QStash job; mirrors graduate-from-campaign.ts)
  → campaignEnrollmentService.enroll(SYSTEM_CONTEXT, { customerId })
      (no campaignId → enroll() resolves policy.defaultCampaignId at run time;
       full gate chain runs: is-a-lead passes for a fresh ingest, DNC/phone/dup protect)
```

### Deliberate calls

1. **Gate at dispatch, not in the job.** `ingestLead` already holds source+policy; it decides whether to dispatch. The job is a dumb executor. A toggle flipped off in the seconds between dispatch and run still enrolls — negligible race for fire-and-forget.
2. **`enrollLeadJob` payload is `{ customerId }` only** — no `campaignId`, no `requestedByUserId`. `enroll()` resolves the *current* `defaultCampaignId` at run time (`enrollment.service.ts:102`), so a default changed between ingest and run uses the new one. System action → no requesting user.
3. **No new gate code in `enroll()`.** `enabled`/`autoEnroll` are checked only at dispatch; the manual-enroll path is untouched.
4. **Dispatch with `dispatch` (best-effort), NOT `dispatchOrThrow`.** Key divergence from `graduateFromCampaignJob` (which is strict because a dropped enqueue leaves a booked customer being dialed — a safety bug). Auto-enroll is the opposite: a dropped enqueue just means the lead isn't auto-dialed, and the admin can still "Enroll all" — recoverable. Best-effort `dispatch` swallows QStash errors, so a CloudTalk/QStash problem can never break the Bina webhook or intake form.
5. **Handler throws only on retryable failures.** Mirror the batch's reason classification (`enroll-source-batch.ts:54-61`): swallow + log precondition rejects (`dnc_match`, `invalid_phone`, `already_enrolled` — won't change on retry, so don't spin QStash); `throw` on `ct_api_failure`/unknown so QStash retries a transient CloudTalk outage.

### Files (Part A)

- **NEW** `src/shared/services/providers/upstash/jobs/enroll-lead.ts` — `enrollLeadJob = createJob('enroll-lead', async ({ customerId }) => …)`. Structurally `graduate-from-campaign.ts` but calling `enroll` with the reason classification from `enroll-source-batch.ts`.
- `src/app/api/qstash-jobs/route.ts` — import + register `enrollLeadJob` (else its key won't route).
- `src/shared/services/customer-intake.service.ts` — after `customerCrud.create` succeeds, read `sourceResult.data.voipConfigJSON?.campaigns` and `void enrollLeadJob.dispatch({ customerId })` when `enabled && autoEnroll && defaultCampaignId`. Coupling note: `ingestLead` (generic intake) gains a `void` fire-and-forget reference to the voip job. Accepted: it's the only shared chokepoint for both channels; a `customerCrud.create` hook would wrongly fire for agent-manual creates and conversions.

## Part B — write path + source-anchored Setup UI

### Mutation: generalize to a partial patch

`setVoipDefaultCampaign` already read-modify-write-merges into `voipConfigJSON.campaigns` (`mutations.ts:21-55`). Generalize to:

```ts
setVoipCampaignsPolicy(sourceSlug, patch: {
  enabled?: boolean
  autoEnroll?: boolean
  defaultCampaignId?: string | null   // omit = leave; null = clear; uuid = set
})
```

Omitted field = untouched, `null` = clear, uuid = set — one write path for all three. Retire `setVoipDefaultCampaign` and fold its `setDefaultCampaign` proc/hook into one `setSourcePolicy` super-admin proc taking `{ sourceSlug, patch }` (`patch.defaultCampaignId: z.string().uuid().nullable().optional()`).

### Query: surface the two flags

`getSourceCampaignSummaries` already returns per-source `name / defaultCampaignId / eligible / enrolled / dnc`. Add `enabled` and `autoEnroll` from `voipConfigJSON.campaigns` to each summary row.

### UI: two tables in the one card

`cloudtalk-sync-card.tsx` keeps the **Resync** button up top, then renders:

**1. Synced campaigns (read-only)** — preserves the observability the old table gave; no source column (campaigns are pools):

```
Campaign            | Status   | Membership tag
General Reaching Out  Active     Campaign-General
Converting Meta Ads   Active     Campaign-MetaAds
```

**2. Per-source policy (editable)** — the source-anchored flip; NEW `source-policy-row.tsx`, deletes `campaign-binding-row.tsx`:

```
Source         | Default campaign ▼   | Enabled | Auto-enroll | Eligible / Enrolled
Meta Ads         [Converting Meta Ads]    [✓]        [✓]            12 / 40
Telemarketing    [General Reaching Out]   [✓]        [ ]            68 / 75
Home Depot       [— none —]               [ ]        [ ]            3 / 0
```

Default-campaign dropdown options come from `listCampaigns` (id → name). Each control fires `setSourcePolicy.mutate({ sourceSlug, patch: { … } })`; `invalidateVoipCampaigns` refetches summaries.

**Disable logic** (makes the `enabled && autoEnroll && defaultCampaignId` gate legible):

- **Auto-enroll** switch disabled unless `enabled === true` **and** `defaultCampaignId` is set — auto-enroll with no master switch / no default is inert (`enroll()` would reject `no_dialable_campaign`). Tooltip: "Set a default campaign and enable the source first."
- Turning **Enabled** off visually greys auto-enroll (the gate already makes it a no-op).

### Files (Part B)

- `src/shared/entities/lead-sources/dal/server/mutations.ts` — replace `setVoipDefaultCampaign` with `setVoipCampaignsPolicy(sourceSlug, patch)`.
- `src/trpc/routers/voip-campaigns.router.ts` — replace `setDefaultCampaign` proc with `setSourcePolicy`; add `enabled`/`autoEnroll` to `getSourceCampaignSummaries`.
- `src/features/campaigns-admin/hooks/use-campaign-mutations.ts` — replace `setDefaultCampaign` with `setSourcePolicy` (same invalidate + toast convention).
- `src/features/campaigns-admin/ui/components/setup/cloudtalk-sync-card.tsx` — two-table layout (read-only campaigns + editable source policy).
- **NEW** `src/features/campaigns-admin/ui/components/setup/source-policy-row.tsx` — one source row, three controls + counts.
- **DELETE** `src/features/campaigns-admin/ui/components/setup/campaign-binding-row.tsx`.

## Non-goals (YAGNI)

- No retroactive sweep on toggle (decision #4).
- No `dailyDialVolumeCap` / `messageTemplateOverrides` editing in this UI.
- No per-source calling-hours.
- No column on `voip_campaigns` (model invariant).

## Verification (no test framework — CLAUDE.md discipline)

- `pnpm tsc` + `pnpm lint` clean.
- Read-only DB probe: confirm a source with `enabled && autoEnroll && defaultCampaignId` exists; trace that `ingestLead` would dispatch (logic inspection, not a live webhook).
- Manual: flip each Setup control, confirm `voipConfigJSON.campaigns` persists; confirm a new Bina lead for an auto-enroll source lands enrolled (prod observation post-deploy).

## Docs to update

- `src/shared/entities/voip-campaigns/DOCS.md#admin-binding` — note auto-enroll is now wired (was "future auto-enroll-on-ingest flow").
- `src/shared/entities/lead-sources/` DOCS (if present) — the `enabled`/`autoEnroll`/`defaultCampaignId` policy semantics + where each is enforced.
