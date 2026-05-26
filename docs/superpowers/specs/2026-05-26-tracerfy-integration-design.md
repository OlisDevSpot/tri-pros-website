# Tracerfy Integration — V1 Design

**Goal**: enrich Customer records with property data + skip-traced person data via [Tracerfy](https://tracerfy.com) as a single-vendor v1. RentCast + Trestle deferred until Tracerfy gaps are observed.

**Scope**: provider + internal service + write-through to Customer JSONB profiles + tRPC mutation. No auto-triggers, no background jobs, no UI surface beyond a temporary test button. Phone/email NOT auto-promoted to top-level Customer columns.

## Architecture (four-tier compliance — ADR-0003)

| Tier | New file(s) | Purpose |
|---|---|---|
| Provider | `src/shared/services/providers/tracerfy/` | Raw HTTP, auth, types, translators |
| Internal service | `src/shared/services/customer-enrichment.service.ts` | Orchestrates: load customer → call provider → merge → persist |
| Sync service | (none in v1) | Single domain op; threshold not met. Add later if DNC/batch land. |
| Shared lib | (none) | All work crosses external HTTP. |

**Dependency direction**: `customer-enrichment.service` → `tracerfyClient` + `customerCrud` (DAL). Provider is a leaf — never imports domain types, never touches DAL.

## Provider shape — `src/shared/services/providers/tracerfy/`

```
tracerfy/
  client.ts                createTracerfyClient() + tracerfyClient singleton
  types.ts                 TracerfyLeadBuilderLookupResponse, TracerfyTraceLookupResponse,
                           TracerfyAutocompleteResponse, TracerfyAnalyticsResponse,
                           TracerfyPerson, TracerfyProperty, TracerfyPhone, TracerfyEmail
  constants.ts             TRACERFY_BASE_URL = 'https://tracerfy.com/v1/api'
                           plus endpoint path constants
  lib/
    map-from-tracerfy.ts   mapLeadBuilderHitToProfileUpdates(response) → {
                             customerProfilePatch, propertyProfilePatch,
                             financialProfilePatch, contactSuggestions
                           }
```

**Client methods** (all sync — Tracerfy lookup endpoints are 500/min, no queue needed):

```ts
tracerfyClient.leadBuilderLookup({ address, city, state, zip? })
  → TracerfyLeadBuilderLookupResponse    // 10 credits on hit, 0 on miss
tracerfyClient.traceLookup({ address, city, state, zip?, findOwner? })
  → TracerfyTraceLookupResponse          // 5 credits on hit, 0 on miss (fallback)
tracerfyClient.autocompleteAddress(query)
  → TracerfyAutocompleteResponse         // free
tracerfyClient.getAccountAnalytics()
  → TracerfyAnalyticsResponse            // free (balance check)
```

**Auth**: `Authorization: Bearer ${env.TRACERFY_API_KEY}`. Added to `src/shared/config/server-env.ts` following the existing Zod-schema pattern: `TRACERFY_API_KEY: z.string()`.

**Error handling**: HTTP non-2xx throws `Error('Tracerfy ${endpoint} failed (${status}): ${body}')`. Miss responses (`hit: false`) return successfully — they're not errors.

**No official SDK** (confirmed in docs). Plain `fetch`.

## Internal service — `customer-enrichment.service.ts`

Single exported function in v1:

```ts
export async function enrichCustomerFromTracerfy(
  ctx: ScopedContext,
  customerId: string,
  opts?: { force?: boolean },
): Promise<{
  status: 'enriched' | 'skipped-fresh' | 'miss' | 'invalid-address'
  creditsDeducted: number
}>
```

Flow:
1. `customerCrud.getById(ctx, { id: customerId })` — loads with caller's scope.
2. **Cooldown gate**: if `customer.tracerfyEnrichedAt` is within 30 days and `!opts.force` → return `{ status: 'skipped-fresh', creditsDeducted: 0 }`.
3. **Address gate**: if `address`, `city`, or `state` missing → return `{ status: 'invalid-address', creditsDeducted: 0 }`.
4. Call `tracerfyClient.leadBuilderLookup({ address, city, state, zip: zip || undefined })`.
5. On miss: `customerCrud.update(ctx, { id, data: { tracerfyEnrichedAt: new Date().toISOString(), tracerfyEnrichmentJSON: response } })` → return `{ status: 'miss', creditsDeducted: 0 }`.
6. On hit:
   - Translate via `mapLeadBuilderHitToProfileUpdates(response)`.
   - Merge patches into existing profile JSONBs (rules in §Translation contract).
   - `customerCrud.update(ctx, { id, data: { customerProfileJSON, propertyProfileJSON, financialProfileJSON, tracerfyEnrichmentJSON: response, tracerfyEnrichedAt: ... } })`.
   - Return `{ status: 'enriched', creditsDeducted: response.credits_deducted }`.

**Conventions**:
- Receives `ScopedContext`, forwards to DAL.
- Never imports `db`.
- No raw HTTP (all goes through `tracerfyClient`).

## Schema additions

**`src/shared/db/schema/customers.ts`** — two new nullable columns:

```ts
tracerfyEnrichmentJSON: jsonb('tracerfy_enrichment_json').$type<TracerfyLeadBuilderLookupResponse | null>(),
tracerfyEnrichedAt: timestamp('tracerfy_enriched_at', { mode: 'string', withTimezone: true }),
```

The raw response is stored so we can re-translate without re-paying Tracerfy if mapping logic evolves.

**`src/shared/entities/customers/schemas/`** — extend three existing Zod schemas with optional fields. All `.optional()` → backwards compatible.

- `propertyProfileSchema` adds:
  `beds`, `baths`, `buildingSizeSqft`, `lotSizeSqft`, `stories`, `propertyType`, `estimatedValue`, `estimatedEquity`, `equityPercent`, `lastSaleDate`, `lastSalePrice`, `yearsOwned`, `ownerOccupied`, `absenteeOwner`, `propensityScores` (nested object: `{ sell, refi, roof, hvac, solar }`, each `{ score: number, category: 'Low' | 'Medium' | 'High' }`)

- `customerProfileSchema` adds:
  `dob` (string YYYY-MM-DD), `isPropertyOwner` (boolean), `isDeceased` (boolean), `isLitigator` (boolean)

- `financialProfileSchema` adds:
  `openMortgageBalance` (number), `estimatedMortgagePayment` (number), `lenderName` (string)

Migration: `pnpm db:push:dev` (verified safe per `memory/feedback-db-push-dev-only.md` and `memory/reference-neon-branching.md`).

## Translation contract

Merge rules applied per-field by `mapLeadBuilderHitToProfileUpdates`:

| Tracerfy source | Customer destination | Merge rule | Rationale |
|---|---|---|---|
| `property.year_built`, `beds`, `baths`, `building_size_sqft`, `lot_size_sqft`, `stories`, `property_type` | `propertyProfileJSON.*` | Fill if currently null/undefined | Never overwrite agent-entered structural data |
| `property.estimated_value`, `estimated_equity`, `equity_percent`, `last_sale_date`, `last_sale_price`, `years_owned`, `owner_occupied`, `absentee_owner` | `propertyProfileJSON.*` | Always overwrite | Objective market data; latest is best |
| `property.*_propensity_score` + `*_propensity_category` (sell/refi/roof/hvac/solar) | `propertyProfileJSON.propensityScores` | Always overwrite | Refreshed signals from latest snapshot |
| `property.open_mortgage_balance`, `lender_name`, `estimated_mortgage_payment` | `financialProfileJSON.*` | Always overwrite | Same |
| `persons[0].dob`, `age`, `property_owner`, `deceased`, `litigator` | `customerProfileJSON.{dob, age, isPropertyOwner, isDeceased, isLitigator}` | Fill if null (except `isDeceased` / `isLitigator` — always overwrite, since they're risk flags) | Don't overwrite agent-curated age |
| `contacts.phones[]`, `contacts.emails[]`, `mailing_address` | **Stored in `tracerfyEnrichmentJSON` only** | Not promoted | Agent-curated `customer.phone/email/address` is high-confidence (from meetings); skip-trace contacts are candidate suggestions for a future v2 UI |
| Full raw response | `tracerfyEnrichmentJSON` | Always overwrite | Latest snapshot is canonical |

**Field-presence rule**: a Tracerfy field that is `null`, `""`, `0` (for non-zero-meaningful fields like `years_owned`), or missing is treated as "no signal" and is NOT written. Translator returns sparse patches.

## tRPC surface

Added to `src/trpc/routers/customers.router/business.router.ts` (entity-owns-its-mutations rule):

```ts
enrichFromTracerfy: agentProcedure
  .input(z.object({
    customerId: z.string().uuid(),
    force: z.boolean().optional(),
  }))
  .mutation(async ({ ctx, input }) =>
    enrichCustomerFromTracerfy(ctx.scopedContext, input.customerId, { force: input.force }),
  ),
```

CASL gate: requires `update:Customer` (already granted to agents). No additional permission machinery needed.

## Test plan ("running some tests")

1. **Provider smoke test** — `scripts/tracerfy/test-lookup.ts`. Takes address-args (`pnpm tsx scripts/tracerfy/test-lookup.ts "1234 Main St" "Los Angeles" "CA" "90001"`), calls `tracerfyClient.leadBuilderLookup`, pretty-prints response. Validates auth, base URL, response shape. Uses `import './lib/load-env'` per `memory/feedback-scripts-load-env.md`.

2. **Service-level test** — same script with `--customerId <uuid>` flag. Calls `enrichCustomerFromTracerfy(SYSTEM_CONTEXT, customerId)`. Runs against dev DB (Neon branch — safe per `memory/reference-neon-branching.md`). Reports status + credits.

3. **tRPC test via agent dashboard** — temporary "Enrich (Tracerfy)" dev-only button on the customer profile card calling `useTRPC().customers.business.enrichFromTracerfy.useMutation()`. Hidden behind `NODE_ENV !== 'production'` for v1.

4. **Quality eval (manual)** — run on 10 known SoCal customers. Compare `tracerfyEnrichmentJSON` against ground-truth knowledge. Outcomes inform v2:
   - Are propensity scores meaningful?
   - Do skip-trace contacts match reality?
   - Are property values accurate?
   - Which fields to actually surface in the UI?

## Out of scope (deferred)

- Auto-enrich on customer create (QStash job)
- Background sweep for legacy customers
- Batch endpoints (`/trace/`, `/trace/parcel/`, `/lead-builder/execute/`)
- DNC scrubbing — belongs in a separate `dnc.service.ts` workflow tied to outbound dialing
- Webhook handler — Tracerfy webhooks only fire for async/batch ops, we're sync-only in v1
- UI for autocomplete — provider method exists, UI consumes later
- Promotion of phone/email/mailing-address to top-level Customer columns — requires a "suggestions" UX
- RentCast / Trestle — defer until we observe Tracerfy data quality gaps
- A `tracerfy-sync.service.ts` — single-op threshold not met yet

## Conventions checklist (verified against canonical docs)

- [x] Four-tier split — ADR-0003 / `docs/codebase-conventions/service-architecture.md`
- [x] Provider directory shape (`client.ts`, `types.ts`, `constants.ts`, `lib/`) — `service-architecture.md#provider-directory-shape`
- [x] Service receives `ScopedContext`, never imports `db` — `service-architecture.md#services-never-import-db`
- [x] Provider signatures use provider-native types only — `service-architecture.md#providers-have-no-domain-types-in-signatures`
- [x] tRPC procedure lives on customers router (entity owns its mutations) — `memory/feedback-entity-owns-its-mutations.md`
- [x] DAL access via `customerCrud.getById/update` factory singleton — ADR-0002
- [x] Env var declared via existing Zod schema in `server-env.ts`
- [x] Drizzle column: camelCase TS name, snake_case DB name, `jsonb` + `$type<>()` — `memory/MEMORY.md#schema-conventions`
- [x] Zod schema extensions all `.optional()` — backwards compatible
- [x] CASL ability — `update:Customer` already granted to agents
- [x] One component/function per file applies to backend too — service has one exported function in v1
- [x] Named exports only — no `export default`
- [x] Script uses `import './lib/load-env'` not `'dotenv/config'` — `memory/feedback-scripts-load-env.md`

## Acceptance criteria

1. `pnpm tsc` and `pnpm lint` clean on the new code.
2. Provider smoke test returns a parsed `TracerfyLeadBuilderLookupResponse` for a known SoCal address with `hit: true`.
3. `enrichCustomerFromTracerfy(SYSTEM_CONTEXT, <real-dev-customer-id>)` returns `status: 'enriched'`, mutates the customer's JSONB profiles, persists `tracerfyEnrichmentJSON` + `tracerfyEnrichedAt`.
4. Re-running within 30 days returns `status: 'skipped-fresh'`. With `force: true`, re-enriches.
5. Calling with a customer missing address fields returns `status: 'invalid-address'` and does NOT call Tracerfy (verified via no credit deduction in account analytics).
6. Existing customer flows (intake form, customer profile views, proposal builder) render unchanged — new fields are all optional.
