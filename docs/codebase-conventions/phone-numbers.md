# Phone Numbers — Convention

How phone numbers are stored, displayed, validated, and sent to external systems. **One module owns every phone transform; one canonical storage shape; normalization is enforced at the lowest write layer so no caller can persist a non-canonical value.**

> The business is Southern-California-only, so every real number is a US 10-digit local number. The rules below assume US numbers.

> Reference impl: [`src/shared/lib/phone.ts`](../../src/shared/lib/phone.ts). Companion: [database-schema.md](./database-schema.md) (the customer insert schema), [dal-conventions.md](./dal-conventions.md) (createCrudDal parses the schema on every write).

---

## The two shapes

A phone number is only ever in one of two shapes. Never invent a third (no formatted strings in storage, no E.164 in storage).

| Shape | Looks like | Where it lives |
|---|---|---|
| **National (canonical storage)** | `8186511445` — bare 10 digits | `customers.phone` and any other persisted phone column. The DB invariant. |
| **E.164 (external boundary)** | `+18186511445` | Produced *only* at the moment of an external API call that requires it (Twilio, CloudTalk). Never stored. |

Display is always derived (`(818) 651-1445`), never stored.

---

## `phone.ts` is the only home

Every phone transform lives in [`src/shared/lib/phone.ts`](../../src/shared/lib/phone.ts). Do not re-implement digit-stripping, formatting, or `+1` prefixing anywhere else — import from here.

| Helper | Use for |
|---|---|
| `toNationalDigits(input)` → `string \| null` | The primitive. Any input → canonical 10 digits, or `null` if not a plausible US number. Everything else delegates to it. |
| `toDigits(input)` → `string` | Raw digit-strip (no validation). For **fuzzy phone search** against the canonical store only. |
| `toE164(input)` → `string \| null` | At external-API boundaries (Twilio/CloudTalk) that require E.164. |
| `formatPhone(input)` → `string` | **All display.** `(xxx) xxx-xxxx`; defensive — renders any stored shape correctly, falls back to the raw value, returns `''` for null. |
| `toDialString(input)` → `string` | The value after `tel:` / `sms:` in an href (E.164, raw fallback). |
| `optionalPhoneSchema` | Zod **storage** transform (→ 10-digit or null). See Rule 2. |
| `requiredPhoneSchema` / `optionalPhoneInputSchema` | Zod **form-input** validation (refine only, no transform — keeps RHF field types `string`). See Rule 4. |

---

## Rule 1 — Storage is bare 10-digit national

Persist `toNationalDigits(...)` output. No `+1`, no formatting, no whitespace. Reads stay simple, and every external integration computes the shape it needs (`toE164` for dialers, `formatPhone` for documents) at its own boundary.

## Rule 2 — Normalize at the lowest write layer, not at call sites

The customer insert/update schema carries the transform, and `createCrudDal` parses it on **every** write — so the funnel (E.164), agent edit (`(818)…`), intake, and webhook paths all normalize automatically. Adding a new write path requires zero phone-handling code.

```ts
// src/shared/db/schema/customers.ts
export const insertCustomerSchema = createInsertSchema(customers, {
  // …
  phone: optionalPhoneSchema, // → bare 10-digit (or null), regardless of caller
}).omit({ id: true, createdAt: true, updatedAt: true })
```

**Do not** sprinkle `toNationalDigits` at write call sites. If a new persisted phone column appears on another entity, put `optionalPhoneSchema` on *that* entity's insert schema — same chokepoint, one layer down.

## Rule 3 — Display via `formatPhone`, dial links via `toDialString`

Never render `customer.phone` raw and never hand-roll `(xxx) xxx-xxxx`. Every user-facing surface (profiles, tables, cards, emails, PDFs, calendar descriptions) calls `formatPhone`. Every `tel:`/`sms:` href uses `toDialString` — never interpolate a formatted value into a dial link.

## Rule 4 — Forms validate, the DB normalizes

Form schemas use `requiredPhoneSchema` / `optionalPhoneInputSchema` (refine, **no** transform) so the field stays a `string` for react-hook-form and the user gets immediate "enter a valid US phone" feedback. The actual normalization still happens once, at the DB boundary (Rule 2) — don't transform in form schemas.

## Rule 5 — `toE164` only at the external boundary

Twilio and CloudTalk require E.164. Call `toE164(phone)` **at the call site**, guard the `null`, and pass the result. Storage and everything internal stays 10-digit.

```ts
const toNumber = toE164(ctx.customerPhone)
if (!toNumber) return // not a dialable US number
await cloudtalkClient.sendSms({ fromE164, toE164: toNumber, text })
```

## Rule 6 — Phone lookups normalize the query

Any query that **matches** on `customers.phone` must normalize its input to the canonical shape first, or an E.164 / formatted argument silently fails to match. Exact-match lookups (`findCustomerByPhone`, DNC `canOutboundTo`) use `toNationalDigits`; fuzzy search (`ILIKE`) strips the term with `toDigits` and matches the digit substring.

---

## Backfilling legacy rows

Pre-canonical data is normalized by [`scripts/normalize-customer-phones.ts`](../../scripts/normalize-customer-phones.ts) — dry-run by default, `--apply` to write:

```bash
pnpm backfill:phones:dev               # preview dev
pnpm backfill:phones:dev -- --apply    # write dev
pnpm backfill:phones                    # preview PROD
pnpm backfill:phones -- --apply         # write PROD
```

Idempotent: skips already-canonical rows, leaves genuinely unparseable values untouched and reports them.

---

## Why one chokepoint instead of normalizing everywhere

We considered normalizing at each write call site (funnel, intake, edit, webhooks). Rejected: phone columns drift the moment one path forgets. Putting the transform on the entity insert schema means the DB invariant holds by construction — the only way to write a customer is through `createCrudDal`, which always parses the schema. New callers inherit correctness for free; the rule can't rot per-path.
