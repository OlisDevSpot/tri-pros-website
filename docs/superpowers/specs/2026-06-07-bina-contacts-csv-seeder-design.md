# Bina Contacts CSV Seeder — Design

**Date:** 2026-06-07
**Status:** Design approved (brainstorm). Ready to implement.
**Artifact:** `scripts/seed-bina-contacts.ts` (new, one-shot, prod-safe).
**Context:** Backfills `leadMetaJSON` (Bina trade/kitchen/bathroom detail) onto existing Bina leads and inserts any genuinely-new ones, from the REAL Bina export CSV. Replaces an earlier "funky" session's attempt — built clean from scratch. Related memory: [[project-bina-leads-no-trade-data]].

## Goal

Take a Bina contacts CSV and bring our prod `customers` rows up to date the same way a Bina webhook would — **in bulk, idempotently, with zero data loss**. Mirrors the prod-safe pattern of `scripts/backfill-interested-trades-raw.ts`.

## Non-negotiable safety model

- **Dry-run by DEFAULT.** No writes unless `--commit` is passed. Dry-run is read-only and prints a per-row decision log + summary.
- Target DB selected by `NODE_ENV` (the runtime db client reads `DATABASE_URL` vs `DATABASE_DEV_URL` by `NODE_ENV` — see [[feedback-runtime-db-env]]). Prod = `NODE_ENV=production`.
- **Never DELETE. Never overwrite a non-null value. Never set `createdAt`/`updatedAt` on UPDATE** (`updatedAt` auto-bumps via schema-helper `$onUpdate`).
- `--file=<path>` is required (no hardcoded path).
- Idempotent + re-runnable: a second run no-ops (matched leads already have meta; inserted leads now match by phone).

## Input

CSV columns: `Contact Id, First Name, Last Name, Phone, Created, Tags, Street Address, City, Postal Code, Product, Type of Job, Appointment Date, Appointment Time, Kitchen Size, Kitchen Renovation Scope, Kitchen Age, Bathroom Size, Bathroom Renovation Scope, Bathroom Age`.

Parsing concerns (handled in-script):
- UTF-8 **BOM** on the header → stripped.
- **Mojibake**: mis-encoded en/em dashes appear as `â€“` / `â€”` (e.g. `4:00 PM â€“ 6:00 PM`) → sanitized to `-`; `â€™` → `'`.
- **Quoted fields** contain commas (trade lists, addresses) → a small quote-aware CSV parser (no dependency available).

## Field mapping (per row)

Reuses the REAL webhook normalizer `normalizeBinaLead(payload)` (`src/shared/services/providers/gohighlevel/lib/normalize-bina-lead.ts`) for parity — the script constructs a `BinaContactPayload` and runs it through, getting `{ core, leadMeta, note }`. No mapping drift from the webhook.

| Target | Source |
|---|---|
| `name` | `${First} ${Last}`.trim() |
| `phone` | `Phone` (raw) |
| `email` | none in CSV → null |
| `address` | `Street Address` or null |
| `city` | `City` |
| `state` | `'CA'` (webhook parity; only out-of-state row is nameless/skipped) |
| `zip` | `Postal Code` |
| `leadMetaJSON.interestedTradesRaw` | **`Product`** split on commas (CORRECTED: `Product`, not `Type of Job` — Product holds the trade list for ~all rows; Type of Job is empty for most or a "Kitchen/Bathroom Renovation" category) |
| `leadMetaJSON.source.{kitchen,bathroom}{Size,Scope,Age}` | `Kitchen/Bathroom Size·Scope·Age` columns |
| `leadMetaJSON.source.{budgetSolution,rebateAmount}` | not in CSV → null |
| `leadMetaJSON.scheduledFor` | `Appointment Date` + start of `Appointment Time` → ISO `YYYY-MM-DDTHH:mm:00-07:00` (America/Los_Angeles; all rows are PDT). Window end dropped. Absent → omitted. |
| `createdAt` (NEW inserts only) | CSV `Created` (already ISO `…-07:00`) |
| `Contact Id`, `Tags` | not stored (no schema change) |

`leadMetaJSON` is validated with `leadMetaSchema.parse()` before any write.

## Matching

By **phone, normalized to last-10 digits** (`phone.replace(/\D/g,'').slice(-10)`) — CSV phones are 11-digit `1XXXXXXXXXX`; prod may store E.164 `+1…`. `findCustomerByPhone` does exact-string equality, so we do our own normalized match across all customers (loaded once into a `Map<last10, Customer[]>`, customers with null phone excluded).

## Per-row decision

- **Exactly 1 match → fill-gaps UPDATE.** Set `leadMetaJSON` **only if currently null**; fill `address`/`email` **only if currently null/blank**; never overwrite. If nothing to fill → **no-op** (counts as `noop`). One `db.update(...).set({...})`, no manual `updatedAt`.
- **0 matches + has non-empty name + city + zip → INSERT** via direct `db.insert(customers)` (direct insert so `createdAt` can be set from CSV) with `leadSourceId` = bina source, `state='CA'`, `pipeline='active'`, `leadMetaJSON`, `createdAt`. Then insert the Bina `note` into `customer_notes` (`authorId: null`).
- **0 matches + missing a NOT NULL field (name/city/zip) → SKIP + report** (contact id + phone). `customers.name`, `city`, `zip` are `NOT NULL`; inserting would violate constraints / create junk.
- **>1 match → SKIP + report as ambiguous** (no dupes expected; this is a guard — never guesses which row to write).

## Explicitly NOT done

- No `bina_webhook_logs` rows (that table audits inbound HTTP, not a CSV import).
- No campaign enrollment (webhook doesn't enroll either — enrollment is separate/manual).
- No DELETE, no dedupe/cleanup of any pre-existing rows (report-only if anomalies surface).
- No schema change (Contact Id / Tags dropped).

## Output

Per-row line: `[would-insert | inserted | would-update <fields> | updated <fields> | noop | skip:incomplete | skip:ambiguous]` with name + phone-tail. Summary object: `{ scanned, matched, wouldUpdate|updated, noop, wouldInsert|inserted, skippedIncomplete, skippedAmbiguous }`. Dry-run reports `would*`; `--commit` reports actuals.

## package.json scripts

```
"seed:bina-contacts":     "NODE_ENV=production tsx scripts/seed-bina-contacts.ts",
"seed:bina-contacts:dev": "tsx scripts/seed-bina-contacts.ts",
```

Run order: build → `pnpm tsc && pnpm lint` → dry-run on **dev** (validate parse/map, no crash) → dry-run on **prod** (read-only diagnostic; review report together) → only then `--commit` on prod.

## Acceptance criteria

- Dry-run is the default; writes require `--commit`.
- Parses all 120 rows without error (BOM, mojibake, quoted commas handled).
- Matched leads with null `leadMetaJSON` are reported as `would-update`; matched leads with existing meta are `noop` (never overwritten).
- Unmatched complete rows are `would-insert`; unmatched incomplete rows are `skip:incomplete` with reason.
- `pnpm tsc` + `pnpm lint` clean.
- Re-running after a committed run reports all `noop`/already-present (idempotent).
