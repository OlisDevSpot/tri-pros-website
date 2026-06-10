# Bina Trade Derivation + Lead Note (→ CloudTalk Activity) — Design

**Date:** 2026-06-09
**Status:** Design approved (brainstorm). Ready to implement.
**Builds on:** `docs/superpowers/specs/2026-06-07-bina-contacts-csv-seeder-design.md` (the CSV seeder).
**Context:** Kitchen/bath Bina leads enroll into CloudTalk with NO `primary_trade`/`trades_interested` because Bina's second (kitchen/bath) campaign leaves `Product` empty and puts detail in `kitchen*`/`bathroom*` fields instead. Root cause is Bina's data shape, not our code (bridge + client verified correct in prod). Fix: normalize further instead of relying on Bina's raw structure.

## Goal

1. Give kitchen/bath leads real trades by **deriving** `Kitchen Renovation` / `Bathroom Renovation` from `kitchen*`/`bathroom*` presence.
2. Build a coherent **lead note** per lead, stored in `customer_notes` and (Part 2) pushed to CloudTalk as a **contact Activity** so agents see the detail.
3. Rewrite the seeder so every existing lead gets derived trades (where missing) + a note.

## Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Kitchen/bath trades | Derive `Kitchen Renovation` (any `kitchen*` set) / `Bathroom Renovation` (any `bathroom*` set); appended to `Product`-derived trades. Lives in `normalizeBinaLead()` so webhook + seeder both get it. |
| 2 | Trades write policy (existing leads) | **Set only if empty.** Derive+set for leads with no trades (kitchen/bath); never touch leads that already have trades (energy). |
| 3 | Energy-lead note content | Trades + appointment (drops `other` trade + `energy`/tag noise). |
| 4 | Kitchen/bath note content | The `kitchen*` / `bathroom*` fields, one per line. |
| 5 | Note storage | `customer_notes` (existing table). No new `customers` column — note is fully derivable from `leadMetaJSON`. |
| 6 | CT note delivery | **Activities API**: `PUT /activity/add/{contactId}.json` (name + description). Pushed at **enrollment** (only point we have a CT `contactId`). Exact body schema **verified by a live probe** before wiring (codebase precedent: hand-typed schemas verified live). |

## Part 1 — Data normalization (DB-only)

### `buildLeadNote(leadMeta): string | null` — NEW, `src/shared/entities/customers/lib/build-lead-note.ts`
Pure. Single source of truth for the note, used by both the normalizer and (Part 2) enrollment.
- Header line: `📋 Lead details`.
- `Trades: <list>` — from `interestedTradesRaw`, **excluding** the derived `Kitchen Renovation`/`Bathroom Renovation` tokens (their detail prints below) and the `other` token. Omitted if empty.
- `Appointment: <scheduledFor>` — if present.
- `Kitchen size/scope/age:` lines — each `source.kitchen*` that's set.
- `Bathroom size/scope/age:` lines — each `source.bathroom*` that's set.
- `Budget solution:` / `Rebate: $…` — if present (webhook energy fields; absent in CSV).
- Returns `null` if only the header would print.

### `normalizeBinaLead()` — MODIFY
- `interestedTradesRaw` = `Product`-split trades **+** `Kitchen Renovation` (if any `kitchen*` set) **+** `Bathroom Renovation` (if any `bathroom*` set), de-duped.
- `note` = `buildLeadNote(leadMeta)` (replaces the old `formatBinaNote(payload)`; delete `formatBinaNote`).

### `seed-bina-contacts.ts` — REWRITE the match branch
Per matched lead (still match by normalized phone):
- **leadMetaJSON:**
  - existing `== null` → set full `leadMeta`.
  - existing present but `interestedTradesRaw` empty AND new is non-empty → merge: `{ ...existing, interestedTradesRaw: <new>, source: existing.source ?? new.source }`.
  - else leave (never overwrite existing trades).
- **address/email:** fill-gap only (unchanged).
- **note:** if the customer has no lead note yet (no `customer_notes` row whose content starts with `📋 Lead details` or the legacy `📋 Lead from Bina`), insert the `buildLeadNote` note. Dedupe so re-runs don't duplicate.
- no-op if nothing to write.
Inserts (new leads): full `leadMeta` (with derived trades) + note (unchanged behavior, now using the new builder).
Dry-run by default; `--commit` to write. Idempotent. Summary gains `tradesAdded` + `notesAdded` counters.

## Part 2 — CloudTalk contact Activity (provider + enrollment)

### `cloudtalkClient.addContactActivity(...)` — NEW
- `PUT /activity/add/{contactId}.json`, body `{ name, description, ... }`.
- **Live probe first** (`scripts/verify-ct-activity.ts`, run against one real CT contact) to confirm required fields (name/description + any `type`/`external_id`), then hand-type the request + response zod schema in `cloudtalk/schemas/contact.ts` to match.

### `enrollment.service.ts` — MODIFY
After `upsertContact` + `addTags`, push the activity: `addContactActivity({ contactId, name: 'Lead details', description: buildLeadNote(customer.leadMetaJSON) })`. Skip when the note is null. Failure is logged but **non-fatal** to enrollment (the lead is still enrolled; the note is supplementary). ~0 Bina leads enrolled today → no live re-push of existing CT contacts needed; corrected trades (attributes) + note (activity) land on next enroll.

## Out of scope
- No `lead_notes` custom attribute (Activities API supersedes it).
- No recompute of energy-lead trades (set-if-empty only); `other` stays in the trades attribute (only filtered from the note).
- No re-push of the ~1 already-enrolled CT contact (manual if needed).

## Acceptance criteria
- Kitchen/bath leads: `interestedTradesRaw` includes `Kitchen Renovation`/`Bathroom Renovation`; energy leads unchanged.
- Every matched lead ends with a `customer_notes` lead note; re-run adds none (deduped).
- `normalizeBinaLead` change means future kitchen/bath webhooks self-derive.
- Live probe confirms the `/activity/add` body; `addContactActivity` + enrollment wiring compile, lint, tsc clean.
- Prod seeder dry-run reviewed before `--commit`.
