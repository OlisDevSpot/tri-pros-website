# ATTOM property data: handoff to a fresh session (2026-10-16)

> **Updated 2026-11-05. Do not paste this prompt as it stands.** The address lookup is now being designed elsewhere, and ATTOM is not the first provider.
> - **Where the lookup is designed:** TS4's first design, "the home on file", in the trade-scenes tracker (branch `feat/trade-scenes-foundation`, `docs/plans/2026-10-16-trade-scenes-epic.md`, rows R237–R246 and R253 onward).
> - **Owner rulings there that replace parts of §3 here:** the provider is swappable, RentCast first, and the stored fields are ours and never change (R245); a paid lookup runs only on request (R244); the free address facts (map point, utility, climate) run by themselves (R254); the budget is $1 per address (R241); a fetch overrides only the facts it returned (R258); storage is under design (R246).
> - **ATTOM itself:** its pricing page showed "Starting at $500/month" on 2026-11-05, over that budget at our volume. §2 stays as reference in case ATTOM is added as a provider later.
> - **Still only in this file:** the uses that design does not cover: owner names and the owner match (§3.7), value and equity, permit history, where reps and the dispatcher see the data (§3.8), and the outreach initiative reading it (§4). Carry these into the home-on-file spec or brainstorm them after it, then delete this file.
> - **Research across providers, with costs and terms:** `docs/plans/2026-11-05-property-data-sources-research.md` (same branch).

**Paste the prompt below into a new session.** It was written by the lead-to-meeting-set brainstorm session from its own reads of the tree and one web-research pass on ATTOM's docs. Nothing was built or written to any database.

Delete this file once the ATTOM spec carries what it says.

---

## The prompt

You are setting up an integration with the **ATTOM property data API** (attomdata.com; the owner sometimes writes it "ATOM"). For every new lead, the app should look up the lead's home and store what ATTOM knows about the property: building facts, ownership, value and equity, and permit history. The data has two uses:

1. Reps and the dispatcher see a sharper picture of the home before the first call and before the visit.
2. A later initiative will automate lead-to-meeting-set outreach (texts, emails, calls). It will choose its angle from this data, e.g. a 1962 home with no permits on file versus a buyer from two years ago. Build the data so that initiative can read it. Do **not** build the outreach.

**Process.** Start with `superpowers:brainstorming` and work through the owner decisions in §3 with the owner. Then write a spec under `docs/superpowers/specs/`, run `/stress-test-plan` on it, and write the plan. Do not write product code until the owner explicitly says build, execute or run; "go ahead" is not enough (memory: `feedback-go-ahead-is-not-execute.md`). Before you assert any fact below, check it against the code. If the code differs, stop and flag it: "⚠️ Stale ref".

### 1. Facts from the code (verify each before relying on it)

| Fact | Where |
|---|---|
| Most leads enter through `customerIntakeService.ingestLead`. It creates the customer via `customerCrud.create`, writes attribution, then fires `void enrollLeadJob.dispatch({ customerId })` when the lead source auto-enrolls in a VoIP campaign. That is the existing precedent for a side effect after create. | `src/shared/services/customer-intake.service.ts:46-82` |
| Callers of `ingestLead`: the Bina/GoHighLevel webhook (address, city and zip come in the payload; state defaults to CA), and the lead-source intake form | `src/app/api/webhooks/bina/route.ts`, `src/shared/services/providers/gohighlevel/lib/normalize-bina-lead.ts:55-62`, `src/trpc/routers/customers.router/business.router.ts:80` |
| Paths that skip `ingestLead`: funnels create the customer with `address: null` and set the street later through `setFunnelLeadAddress`. `ingestWebsiteLead` and the generic crud router call `customerCrud.create` directly. | `src/trpc/routers/funnels.router.ts:121,228`, `src/trpc/routers/landing.router/index.tsx:103`, `src/trpc/routers/customers.router/crud.router.ts` |
| `customerCrud` has `hooks.update.before/after` but no `hooks.create`. The engine supports `hooks.create.after`, which would cover every create path. `hooks.update.before` already detects address/city/state/zip changes (it nulls lat/lng), and `hooks.update.after` already dispatches a job. | `src/shared/entities/customers/dal/server/crud.ts:27-46`, `src/shared/dal/server/lib/create-crud-dal.ts:170-188` |
| The customer address is structured: `address` (street, nullable), `city`, `state` (default CA), `zip`, plus `latitude`/`longitude`/`geocodedAt`. **Nothing ever writes lat/lng.** Google Places autocomplete returns a `location` that is thrown away. | `src/shared/db/schema/customers.ts:18-24`, `src/shared/lib/google-maps-helpers.ts:48` |
| **Name collision:** the table `customer_enrichment` already exists and holds *funnel answers* (step id, label, value). Do not name the ATTOM data "enrichment" without the owner agreeing to a term. CONTEXT.md:124 uses "property profile" for rep-entered existing conditions. | `src/shared/db/schema/customer-enrichment.ts`, `CONTEXT.md` |
| `customer_profiles` holds rep-entered discovery data. Its property section partly overlaps ATTOM: `yearBuilt` (a range enum), `roofType`, `foundationType`, `hvacType`, `hvacComponents`, `windowsType`, `insulationLevel`, `hoa`, and `timeInHome` (a range). | `src/shared/db/schema/customer-profiles.ts:52-60`, `src/shared/entities/customers/constants/property-profile-fields.ts` |
| Provider pattern: `src/shared/services/providers/<name>/` holds `client.ts`, `types.ts`, `lib/config.ts` (built with `createProviderConfig`) and `schemas/`. The env fragment is spread into `server-env.ts`. Providers are leaves. Translators from vendor shape to domain shape live in the module or service, **not** in the provider's `lib/`. | `docs/adr/0003-service-provider-architecture.md`, `docs/codebase-conventions/provider-boundaries.md`, `docs/codebase-conventions/service-architecture.md`. Examples: `providers/notion/`, `providers/quickbooks/client.ts` |
| Jobs: `createJob(key, handler)` publishes to `/api/qstash-jobs?job=<key>`. `dispatch` is best effort and `dispatchOrThrow` is strict. Register each new job in the route's `jobs` array. Payloads carry ids only. Handlers are idempotent: they swallow terminal failures and throw transient ones so QStash retries. | `src/shared/services/providers/upstash/lib/create-job.ts`, `src/app/api/qstash-jobs/route.ts`, `service-architecture.md:317-372`, example `providers/upstash/jobs/enroll-lead.ts` |
| Customers core still lives in `src/shared/entities/customers/`. New customer code goes toward `src/shared/modules/customers/` (memory: `feedback-code-lives-where-its-module-will-be.md`, `project-modules-consolidation.md`). The precedent for a child unit is `src/shared/modules/meetings/service.ts`. There is no customers `service.ts` yet. | read those files |
| Storage rule for JSONB vs typed columns vs a child table | `docs/adr/0005-jsonb-vs-column-vs-child-table.md` |
| No test runner. Service wiring is checked with tsx smoke scripts that intercept `QstashClient.prototype.publishJSON`. | `scripts/smoke-visit-flow.ts:92-110`, memory `reference-service-wiring-tests.md` |
| Prior art, **partly stale**: an unbuilt Tracerfy design from 2026-05. It writes to customer JSONB profiles that no longer exist and puts translators in the provider's `lib/`. Read it for its ideas: address gate, cooldown, no auto-promotion of contact data. Do not copy its shape. | `docs/superpowers/specs/2026-05-26-tracerfy-integration-design.md`, `docs/superpowers/plans/2026-05-26-tracerfy-integration.md` |

### 2. ATTOM facts (from its docs on 2026-10-16; confirm against one live trial response before coding field paths)

- **Base URL:** `https://api.gateway.attomdata.com/propertyapi/v1.0.0/{resource}/{package}`. Newer APIs live under `/v4/...`.
- **Auth:** an `APIKey` header and `Accept: application/json`.
- **Lookup:** by `address1` (street) + `address2` ("City, ST" or zip), by `attomId`, or by `fips` + `APN`. Match once by address, store the `attomId`, and key every later call on it.
- **Envelope:** `status{code,msg,total,...}` + `property[]`. Body code 0 means a match; code 400 means no match. The docs say only HTTP 200 calls count toward the allowance. Unconfirmed: whether a no-match comes back as HTTP 400 and is therefore free.
- **Trial:** 30 days, about **1,000 lifetime calls**. When the cap is hit, calls return HTTP 401. Pricing: the pricing page showed "Starting at $500/month" on 2026-11-05 (https://www.attomdata.com/solutions/delivery/property-data-api/pricing/); on 2026-10-16 it was a custom annual quote, not published.
- **Smallest useful set: three calls per lead.**
  1. `/property/expandedprofile` (by address). Returns the attomId, building facts (`roofCover`, heating, pool, size, year built, beds/baths), owner names, `absenteeInd` (owner-occupied or not), last sale date and price, assessed values, and the first mortgage amount.
  2. `/valuation/homeequity/?attomId=`. Returns the AVM value with high, low and score, LTV, estimated loan balance, and available equity.
  3. `/property/buildingpermits?attomId=`. Returns `buildingPermits[]` with effectiveDate, type/subType, description, jobValue and businessName. Southern California coverage is unconfirmed.
- **Other endpoints, if needed:** `/property/detailmortgageowner`, `/attomavm/detail`, `/saleshistory/expandedhistory`, `/allevents/detail`, and `/v4/neighborhood/community` (area hazard and demographic indexes, keyed by `geoIdV4`).
- **Quirks:**
  - Condo and unit addresses often match the wrong unit or miss. Disambiguate by unit, APN or owner name.
  - ATTOM uses the assessor's address, which may differ from the USPS or Google spelling.
  - Prop 13 makes assessed values understate long-held homes; use the AVM for value.
  - Expect many nulls in California construction fields (roof, HVAC); measure the fill rate on real leads.
  - The docs contain field-name typos and inconsistent casing. Validate responses with a lenient Zod schema.
- **License:** API use falls under a separate agreement that is not public. The owner must get written answers from ATTOM sales on: showing value or equity to the homeowner, permanent storage versus caching, keeping data after the contract ends, and the FCRA "not a consumer report" clause. Until then, treat the data as **internal only**: show it to reps, never to homeowners.

### 3. Owner decisions the session must settle

*2026-11-05: items 2, 3, 5, 6 and 9 are being settled in the home-on-file design (see the note at the top). Items 1, 4, 7 and 8 are still open.*

1. **The term.** What the data is called, given that `customer_enrichment` is taken: property record, property facts, or something else. Agree the term with the owner and add it to CONTEXT.md (memory: `feedback-domain-vocabulary-before-naming.md`).
2. **The trigger.** Options:
   - automatic on create when the street address is present, plus on address change;
   - manual "Look up property" only;
   - automatic for chosen lead sources only.

   Also decide the cooldown and whether a re-lookup ever happens without an address change.
3. **Cost guard.** Trial calls are scarce (1,000 lifetime), and dev and prod must not both burn them. Options include a per-environment switch (compare memory `project-prod-visit-sends-gate.md`), recorded fixtures for dev, and a monthly cap. Prod must not call ATTOM until the owner turns it on.
4. **Which calls.** All three endpoints from §2 for every lead, or a cheaper first call with the rest on demand (e.g. equity and permits only once a meeting is set).
5. **Storage shape under ADR 0005.** One proposal to test with the owner:
   - a 1:1 table keyed by customer, with typed columns for the fields that are shown or filtered (attomId, match status, fetchedAt, exact year built, living sq ft, beds, baths, stories, lot size, roof cover, heating, cooling, pool, owner-occupied, owner names, last sale date and price, AVM value/low/high/score, estimated equity, LTV);
   - a child table for permits;
   - possibly the raw response kept for re-mapping, if ADR 0005 sanctions it.

   The record belongs to the customer's current address. Decide what happens to it when the address changes.
6. **ATTOM versus the rep's own entries.** ATTOM data is observed; `customer_profiles` data is what the rep confirmed. Decide whether ATTOM pre-fills empty profile fields, only appears beside them as a hint, or never touches them. Default suggestion: never overwrite; show it beside the field.
7. **Owner match.** Compare the lead's name with ATTOM's owner names and flag "lead may not be the owner". Whether to flag, and where the flag shows, is the owner's call. It matters because renters cannot sign.
8. **Where reps see it.** The customer profile (find the property section beside `funnel-intake-panel.tsx`), the visit sheet, or both. Run the repo's UI methodology for any surface (memory: `feedback-ui-work-methodology.md`).
9. **Geocoding.** ATTOM returns lat/lng. Decide whether it fills the never-written `customers.latitude/longitude`. The outreach initiative wants that, for "we just finished a job 0.8 miles from you".

### 4. Out of scope

- The lead-to-meeting-set outreach automation (its own brainstorm).
- Showing any ATTOM data to homeowners.
- Skip tracing or finding new phones and emails.
- Solar anything: Tri Pros does not sell solar.
