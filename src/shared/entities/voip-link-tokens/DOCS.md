# voip-link-tokens

Short-lived signed URLs delivered via SMS for customer-side actions. Phase 1
ships only `l_doc` (document review/upload links). The enum framework supports
future types (`l_pay`, `l_cal`, `l_esign`) without a migration when those use
cases land.

## Invariants

### Immutable except `usedAt`

A minted token row is immutable. The ONLY field that ever changes after insert
is `used_at`, set on first consume. Subsequent visits to the URL return
"already used" — single-use semantics enforced at the consume route, not the
DB (the column has no UNIQUE constraint on it).

There's intentionally no `updatedAt` on this table — write-once.

### 48-hour hard expiry

`expires_at` is mint_time + 48h per [EPIC](../../../../docs/plans/voip-in-house/EPIC.md).
A cleanup cron purges expired+unused tokens (Phase 1 task). Consume route MUST
check `NOW() < expires_at AND used_at IS NULL` before honoring the token.

### Captured phone, captured payload

`phone_e164` is captured at mint time — immune to subsequent `customers.phone`
edits. Same idea as `voip_calls.remote_e164` / `voip_messages.remote_e164` —
event time is the source of truth.

`payload_json` is type-specific. For `l_doc`: `{ slotId: uuid, instructions?: string }`.
Validated by per-type Zod schemas at both mint and consume.

### Shareable via token column

Spec field `shareable: { tokenColumn: 'token' }` registers this entity with the
shareable middleware. Customer consumption at `/api/voip/links/[token]`
authenticates via the URL path token, not a session.

### Visibility via creator

Agents see only tokens they minted (`created_by_user_id` matches the session).
Token rows aren't shared cross-agent — each agent owns the trail of links they
sent.

## Forward references

- `services/voip/voip-link-tokens.service.ts` (Task 25) — mint + consume
  service surface; per-type payload Zod schemas live in `lib/payload-schemas/`
  when those land
- `/api/voip/links/[token]/route.ts` (Task 29) — consume + redirect
- Cleanup cron — purges expired+unused tokens (lands as part of the link-tokens
  service task)
