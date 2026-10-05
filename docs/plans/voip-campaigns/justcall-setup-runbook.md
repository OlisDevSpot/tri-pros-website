# JustCall Setup Runbook

The end-to-end, do-this-then-this guide for linking our app to JustCall — from a
cold JustCall account to a live, dialing Bina campaign. Every API fact here is
verified against developer.justcall.io (2026-08-19); see the
[API research](./justcall-api-research.md) for sources. Companion to the
[migration plan](../../superpowers/plans/2026-08-19-justcall-dialer-migration.md)
(Task 17).

> **What the codebase already does.** The app is fully migrated off CloudTalk:
> auto-dialing is abstracted behind a neutral `DialerProvider` seam, JustCall is
> the only implementation, and the client + webhook handler are written to
> JustCall's verified API. Nothing below touches code — this is dashboard +
> environment work to bring the integration online. The one code lever you may
> flip is `dialer_mode` per campaign (data, not code).

---

## 0. Prerequisites & plan choice (READ FIRST — this is the money decision)

JustCall gates the dialer by plan. The facts that matter for us:

| Capability | Plans | Our use |
|---|---|---|
| **API access** (keys, webhooks) | Team and up | Required — all integration |
| **Power Dialer** (single-agent, API type `Autodial`) | Pro / Pro Plus / Business — **unlimited** | Every non-Bina source (`dialer_mode='autodial'`) |
| **Dynamic Dialer** (multi-agent shared pool) | **SalesPro — unlimited**; Pro/Business only from a limited **balance** | Bina (`dialer_mode='dynamic'`) |
| **Predictive Dialer** | SalesPro only | Not used |

**The decision:** Bina is our high-volume source and the reason we want a
multi-agent pool. That's the **Dynamic Dialer**, which is only unlimited on
**SalesPro** (~$229–249/user/mo). On Pro/Business you can *create* Dynamic
campaigns only while a limited balance lasts.

⚠️ **Open question to ask JustCall sales at signup:** once the Pro/Business
Dynamic *balance* is exhausted, does an **already-running** Dynamic campaign keep
dialing, or does it stop? The docs say you can't *create* more once the balance
is gone, but are silent on whether existing ones keep running. Bina's whole model
hinges on this. Two safe outcomes:
- **Answer = keeps running, or you buy SalesPro** → run Bina as `dialer_mode='dynamic'`.
- **Answer = stops / too costly** → run Bina as `dialer_mode='autodial'` (Power
  Dialer, unlimited on Pro/Business). This is a per-campaign config change only —
  no code, no redeploy — because the whole system is mode-agnostic.

**Also needed:** deploy access to set env vars (Vercel), and a local `.env.local`
for the go-live smoke test.

---

## 1. API credentials → environment variables

1. In the JustCall web portal, click your **profile icon → APIs and Webhooks**.
2. Copy the **API Key** and **API Secret** (use the copy buttons).
3. Set both in the deploy env **and** local `.env.local`:

   | Env var | Value | Notes |
   |---|---|---|
   | `JUSTCALL_API_KEY` | the API Key | |
   | `JUSTCALL_API_SECRET` | the API Secret | **Also the webhook HMAC key** — there is no separate webhook secret |

   These are the only two JustCall env vars. Both are optional at the config
   layer (`isJustcallConfigured` gates the integration off when unset), so the
   app boots fine before you set them.

4. **Auth is already correct** — the client sends raw `Authorization:
   api_key:api_secret` (verified against the official v2.1 docs). No probe, no
   code change.

> Security: regenerate the key/secret periodically from this same screen. The
> secret is the webhook HMAC key, so rotating it means re-saving it in the env
> **and** the webhook will keep working (JustCall re-signs with the current
> secret) — just redeploy so the app has the new value.

---

## 2. Create the 4 custom contact fields

Enrollment pushes four custom fields with every contact. They must exist in the
Sales Dialer **before** you sync, and the **labels must match exactly** (the sync
maps label → app_key via `mapFieldLabelToAppKey`, case-insensitive, trimmed).

In the Sales Dialer contact-field settings, create these four (type **Text**):

| Dashboard label (exact) | Maps to app_key | Carries |
|---|---|---|
| `Lead Source` | `lead_source` | the source slug (segmentation/templating) |
| `Primary Trade` | `primary_trade` | the lead's first interested trade |
| `Trades Interested` | `trades_interested` | alpha-sorted, deduped interested trades |
| `Lead Created At` | `lead_created_at` | when the lead entered our system (PST) |

Each field gets a numeric `key` assigned by JustCall; the Resync in step 5 reads
those and stores them in `voip_contact_fields.provider_field_id`. You never type
those ids anywhere.

> If you rename a field later, update the label here **and** in
> `services/voip/campaigns/lib/field-label-map.ts`, or the sync silently skips it.

---

## 3. Create the campaigns

For **each lead source that should dial**, create one Sales Dialer campaign.
Left sidebar → **Create Campaign**.

### 3a. Bina — the multi-agent campaign
1. Name it clearly (e.g. `Bina — Dispatchers`).
2. Dialing mode: **Dynamic Dialer** ("One at a Time", shared by multiple agents)
   — *but only if the step-0 question resolved in favor of Dynamic._ Otherwise
   pick **Power Dialer** and set `dialer_mode='autodial'` later.
3. Assign the **dispatcher agents** who work Bina leads.

### 3b. Every other source — single-agent
1. Name it after the source.
2. Dialing mode: **Power Dialer** ("One at a Time", single agent).
3. Assign the one agent for that source.

### 3c. Dispositions — the exit contract (do this on every campaign)
Terminal dispositions are how JustCall tells us to stop dialing a lead. The
disposition **names** you configure MUST match the keys the app recognizes
(`justcallDispositionToUnenrollReason` in `providers/justcall/constants/index.ts`):

| JustCall disposition name | App reaction |
|---|---|
| `DNC` **or** `Do Not Call` | unenroll → `opted_out` **+ write DNC** |
| `Not Interested` | unenroll → `disqualified` |
| `Wrong Number` | unenroll → `disqualified` |
| `Meeting Booked` | unenroll → `graduated` |

Any other disposition = non-terminal → the lead keeps dialing. If your dashboard
uses different strings, either rename them here to match, or edit the map in
`constants/index.ts` (data-shaped — a one-object change).

> Note the label nuance: the dashboard calls single-agent mode "Power Dialer",
> but the API's campaign `type` comes back as `Autodial` — the app normalizes
> both (and anything non-Dynamic/Predictive) to `dialer_mode='autodial'`.

---

## 4. Register the webhook

1. In **APIs and Webhooks → Webhooks**, add a webhook pointing at:
   `https://voip.triprosremodeling.com/api/webhooks/justcall`
2. Subscribe it to exactly these three events:
   - `sd.call_completed` — drives the SMS cadence (attempt counting)
   - `sd.call_updated` — carries the final disposition → unenroll
   - `sms.received` — STOP-keyword opt-out + agent notify
3. **Signature is automatic** — JustCall signs every delivery HMAC-SHA256 with
   your API secret (recipe: `secret|urlencoded(webhook_url)|type|timestamp`,
   headers `x-justcall-signature` / `-signature-version` / `-request-timestamp`).
   The route already verifies this. Nothing to configure beyond having
   `JUSTCALL_API_SECRET` set.

> The webhook URL you register here is the exact string JustCall signs (it sends
> it back as `webhook_url` in the body), so it must match character-for-character
> what's registered. Register the production URL; don't append query strings.

---

## 5. Sync JustCall → our DB, then bind sources

1. Admin UI → **Campaigns → Setup → Resync** (calls `resyncDialer`).
2. Verify the pull populated our tables:
   - `voip_campaigns`: one row per campaign, correct `provider_campaign_id`,
     `provider_campaign_name`, `status='active'`, and `dialer_mode`
     (`dynamic` for Bina if you chose Dynamic, else `autodial`).
   - `voip_contact_fields`: **all 4 rows**, each with a numeric
     `provider_field_id`. If a field is missing, its dashboard label didn't match
     step 2 — fix the label and Resync again.
3. **Bind** each campaign to its lead source via the source's Setup tab
   (`lead_sources.default_campaign_id`). This is what "Enroll all" and
   auto-enroll-on-ingest use.

---

## 6. Go live — one source at a time

1. **Bina first, alone.** Bind Bina's default campaign, then flip
   `voipCampaignsEnabled` + `voipAutoEnroll` for Bina only. Leave every other
   source disabled.
2. **Live smoke** — this needs the tunnel (`pnpm dev:mobile`), because the QStash
   enroll/cadence jobs silently no-op without it:
   - Ingest a Bina **test lead** (your own phone). Confirm a
     `voip_campaign_contacts` row appears with a `provider_contact_id`.
   - Confirm the contact shows up in the JustCall campaign, carrying the 4
     custom fields.
   - Place/receive a real dial on the test lead. Confirm the `sd.call_completed`
     webhook lands (200, not 401/400) and, if a cadence message is armed, an SMS
     sends from the dialer number.
   - Set a terminal disposition (e.g. `Meeting Booked`) and confirm the lead
     unenrolls (`unenrolled_at` set, reason `graduated`).
   - Text `STOP` from the test phone and confirm DNC + `opted_out` unenroll.
3. **Roll the rest.** Once Bina is clean, enable the remaining sources one at a
   time, repeating the smoke per source.

---

## Appendix — quick reference

**Env vars**

```
JUSTCALL_API_KEY=...       # profile → APIs and Webhooks
JUSTCALL_API_SECRET=...    # same screen; doubles as the webhook HMAC key
```

**What each piece maps to in our schema**

| JustCall thing | Our column |
|---|---|
| Campaign id | `voip_campaigns.provider_campaign_id` |
| Campaign type (`Autodial`/`Dynamic`/`Predictive`) | `voip_campaigns.dialer_mode` (normalized) |
| Custom field `key` | `voip_contact_fields.provider_field_id` |
| Contact id (from enroll `data.id`) | `voip_campaign_contacts.provider_contact_id` |

**The one open commercial question:** Dynamic-campaign persistence past the
Pro/Business balance (step 0). Resolve at signup; it decides Bina's `dialer_mode`.
