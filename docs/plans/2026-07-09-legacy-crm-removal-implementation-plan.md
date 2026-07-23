# Legacy CRM Removal Implementation Plan (Notion-customers + Monday + DocuSign)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the Notion-as-CRM customer sync surface (the app is now the source of truth for customers) and finish scrubbing dead Monday.com / DocuSign remnants — while leaving the Notion trades/scopes/SOW/pain-points integration fully intact.

**Architecture:** The Notion provider (`src/shared/services/providers/notion/`) serves two concerns through one shared client/registry. The customer concern is a self-contained slice: one DAL sync pair → one QStash job → one registry entry, plus a one-time migration script, a `contacts` provider sub-domain, and one DB column (`customers.notion_contact_id`). We delete leaf-first (job → DAL → provider modules → script → column) so `pnpm tsc` stays green after every task. Monday/DocuSign are already dead code — deps, env declarations, and stale UI copy only.

**Tech Stack:** Next.js 15, tRPC, Drizzle (Postgres/Neon, `db:push` workflow — no migration files), QStash jobs, pnpm.

**Investigation provenance:** 3-agent parallel research on 2026-07-09; every file/line below was re-verified against the working tree before this plan was written.

## Global Constraints

- Work directly on `main`. Stage files **explicitly by path** — never `git add -A` / `git add .`.
- Verification = `pnpm tsc` + `pnpm lint` only. **NEVER run `pnpm build`.**
- Database: **NEVER `pnpm db:push`** (prod). Dev schema changes go through `pnpm db:push:dev`.
- There is no unit-test suite yet; each task's "test" is the tsc/lint/grep verification steps with expected output.
- Commit after every task with a conventional message ending in:
  `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`
- **Do not touch anything in the KEEP inventory below.**

---

## Inventory: what is REMOVED vs what REMAINS

### REMOVED (this plan)

| Layer | Item |
|---|---|
| Cron/job | `src/shared/services/providers/upstash/jobs/sync-customers.ts` + its registration in `src/app/api/qstash-jobs/route.ts` (external QStash schedule disabled first) |
| DAL | `syncAllCustomers`, `upsertCustomerFromNotion` in `src/shared/entities/customers/dal/server/queries.ts` |
| Provider | `notion/lib/contacts/` (adapter, properties-map, schema), `notion/lib/meetings/` (orphaned), `notion/lib/projects/` (orphaned), `notion/dal/query-contacts.ts` (dead), `notion/dal/update-page-property.ts` (dead) |
| Registry | `contacts`/`meetings`/`projects` entries in `notion/constants/databases.ts`; same members of `NotionDatabaseName` in `notion/types.ts` |
| Script | `scripts/migrate-notion-contacts.ts` + `migrate:notion` / `migrate:notion:dev` package.json scripts |
| Schema | `customers.notionContactId` column (+ unique constraint) via `db:push:dev`; hand-mirrored field in `MeetingCustomer` interface |
| Docs | `### notion-contact-link` section in `src/shared/entities/customers/DOCS.md` |
| Monday | `@mondaydotcomorg/api` dep (zero imports), `MONDAY_API_TOKEN` in `server-env.ts` (required-but-unread), `.env.ci` placeholder, Monday.com link in agent-settings UI |
| DocuSign | `docusign-esign` + `@types/docusign-esign` deps (zero imports), `DS_*` placeholders in `.env.ci`, stale "via DocuSign" copy in `fresh-pipeline.ts` |
| Stale ops docs | DocuSign/Monday operational instructions in `docs/sales/` + `docs/proposal/` |

### REMAINS (do not touch)

| Concern | Items |
|---|---|
| Notion shared plumbing | `notion/client.ts`, `notion/lib/config.ts` (**`NOTION_API_KEY` stays** — sole Notion env var), `notion/dal/query-notion-database.ts`, `notion/lib/property-filter.ts`, `notion/lib/extractors.ts`, `notion/types.ts` (trimmed, not deleted) |
| Trades/scopes/SOW | `notion/lib/{trades,scopes,sows}/*`, `page-to-tiptap-json.ts`, `blocks-to-tiptap-json.ts`, `page-to-html.ts`, `blocks-to-html.ts`, `construction-data.service.ts`, `src/trpc/routers/notion.router/{index,trades.router,scopes.router}.ts`, all landing/meeting-flow/project-management/proposal-flow consumers, `notion-refresh-button.tsx` |
| Pain-points (meeting-flow personas) | `notion/lib/pain-points/*`, `src/features/meeting-flow/lib/get-cached-pain-points.ts`, `build-persona-profile.ts`, the `notion-pain-points` revalidate tag |
| Cross-link trap | `src/trpc/routers/customers.router/business.router.ts:202` calls `constructionDataService.getTrades()` — a customers-router file importing the KEEP service. Leave it. |
| Repurposed column | `customers.syncedAt` — born for Notion sync but now `.notNull()` with default, written by funnel/homeowner insert paths. **Keep.** |
| Non-Notion DAL fn | `findOrCreateCustomerFromHomeowner` in customers `queries.ts` — funnel homeowner→customer, unrelated to Notion. **Keep.** |
| Portfolio scraper | `scripts/portfolio-scraper/*` — standalone Notion client for scope-matching tooling, reads `NOTION_API_KEY` directly. Untouched. |
| Immutable history | `src/shared/db/migrations/*` (incl. `docusign_envelope_id` / `notion_contact_id` in `0000_*.sql` + snapshots) — historical, never edit. See "Out of scope" note. |

---

### Task 0: Manual pre-flight (user actions — gate for everything below)

**Files:** none (external systems)

- [ ] **Step 1: Disable the QStash schedule.** In the Upstash QStash console, delete/pause the schedule that publishes `job=sync-customers` to `/api/qstash-jobs`. (It is configured externally — not in the repo.) Without this, QStash will POST a job key that no longer exists after Task 1; the route returns 200 for unknown keys, so nothing breaks, but the schedule is noise.
- [ ] **Step 2: No dev backup needed before the Task 5 column drop.** (An earlier draft recommended `pnpm db:snapshot` here, but that command is a prod→dev copier, not a backup. Dev data is re-derivable from prod at any time, and prod keeps `notion_contact_id` until the user's deliberate prod push — so the dev drop is safely recoverable by nature.)

- [ ] **Step 3: Revoke dead credentials at the provider side** (deleting lines doesn't un-issue them):
  - Monday.com admin → revoke the API token currently in local `.env` (`MONDAY_API_TOKEN`, line ~25).
  - DocuSign admin → deactivate the integration key / RSA keypair currently in local `.env` (`DS_*`, lines ~32–38).
  - Then delete those lines from local `.env` (gitignored — they were **not** committed; no git-history leak).

---

### Task 1: Remove the QStash sync job + registration

**Files:**
- Delete: `src/shared/services/providers/upstash/jobs/sync-customers.ts`
- Modify: `src/app/api/qstash-jobs/route.ts:20,35`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `syncAllCustomers` in the customers DAL loses its only caller (Task 2 deletes it).

- [ ] **Step 1: Delete the job file**

```bash
rm src/shared/services/providers/upstash/jobs/sync-customers.ts
```

- [ ] **Step 2: Remove the two references in the route.** In `src/app/api/qstash-jobs/route.ts`, delete line 20:

```ts
import { syncCustomersJob } from '@/shared/services/providers/upstash/jobs/sync-customers'
```

and delete line 35 inside the `jobs` array:

```ts
  syncCustomersJob,
```

- [ ] **Step 3: Verify**

```bash
pnpm tsc
grep -rn "syncCustomersJob\|sync-customers" src/ --include='*.ts' --include='*.tsx'
```

Expected: tsc exits 0; grep returns no matches.

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/providers/upstash/jobs/sync-customers.ts src/app/api/qstash-jobs/route.ts
git commit -m "refactor(notion): remove sync-customers QStash job — app is customer source of truth

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Remove the Notion sync functions from the customers DAL

**Files:**
- Modify: `src/shared/entities/customers/dal/server/queries.ts` (imports at lines 1, 4, 14, 15; section comment 128–132; `upsertCustomerFromNotion` 134–170; `syncAllCustomers` 213–238)

**Interfaces:**
- Consumes: Task 1 removed the only caller of `syncAllCustomers`.
- Produces: `notion/lib/contacts/*` and the `'contacts'` registry entry lose their last live consumer (Tasks 3–4 delete them). `findOrCreateCustomerFromNotion` does not exist; **`findOrCreateCustomerFromHomeowner` (lines 182–211) stays untouched.**

- [ ] **Step 1: Delete the four Notion-related imports** (lines 1, 4, 14, 15):

```ts
import type { PageObjectResponse } from '@notionhq/client/build/src/api-endpoints'
import type { Contact } from '@/shared/services/providers/notion/lib/contacts/schema'
import { queryNotionDatabase } from '@/shared/services/providers/notion/dal/query-notion-database'
import { pageToContact } from '@/shared/services/providers/notion/lib/contacts/adapter'
```

- [ ] **Step 2: Replace the system-upserts section comment** (lines 128–132) — it currently explains both functions; only the homeowner one remains:

Old:

```ts
// ── System-level upserts ──────────────────────────────────────────────────────
// These run under SYSTEM_CONTEXT (Notion sync, webhook ingestion). They write
// the customers table directly because they predate the entity-server pattern
// and are scheduled for migration to customerCrud.create in a follow-up. For
// now, signature-standardize them.
```

New:

```ts
// ── System-level upserts ──────────────────────────────────────────────────────
// Runs under SYSTEM_CONTEXT (funnel/webhook ingestion). Writes the customers
// table directly because it predates the entity-server pattern and is
// scheduled for migration to customerCrud.create in a follow-up.
```

- [ ] **Step 3: Delete `upsertCustomerFromNotion`** — the entire function, lines 134–170 (starts `export async function upsertCustomerFromNotion(`, ends with its closing `}` before `interface HomeownerData`).

- [ ] **Step 4: Delete the full-sync section** — lines 213–238: the `// ── Notion full sync ──…` banner comment and the entire `syncAllCustomers` function to end of file.

- [ ] **Step 5: Verify**

```bash
pnpm tsc
grep -rn "syncAllCustomers\|upsertCustomerFromNotion" src/ --include='*.ts' --include='*.tsx'
grep -c "findOrCreateCustomerFromHomeowner" src/shared/entities/customers/dal/server/queries.ts
```

Expected: tsc exits 0; first grep empty; last grep returns `1` (the keeper survived).

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/customers/dal/server/queries.ts
git commit -m "refactor(customers): remove Notion contact sync from DAL

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Remove the one-time migration script + package.json entries

**Files:**
- Delete: `scripts/migrate-notion-contacts.ts`
- Modify: `package.json:30-31`

**Interfaces:**
- Consumes: nothing (script is never imported; it already served its one-time purpose — the Notion→PG contact migration is complete).
- Produces: `notion/lib/contacts/adapter.ts` and the `contacts`/`meetings` registry entries lose their last references (Task 4 deletes them).

- [ ] **Step 1: Delete the script**

```bash
rm scripts/migrate-notion-contacts.ts
```

- [ ] **Step 2: Remove the two package.json script entries** (lines 30–31):

```json
    "migrate:notion": "tsx scripts/migrate-notion-contacts.ts",
    "migrate:notion:dev": "DRIZZLE_TARGET=dev tsx scripts/migrate-notion-contacts.ts",
```

- [ ] **Step 3: Verify**

```bash
pnpm tsc
grep -n "migrate:notion\|migrate-notion" package.json scripts/ -r
```

Expected: tsc exits 0; grep empty.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-notion-contacts.ts package.json
git commit -m "chore(scripts): remove one-time notion contact migration script

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Delete the customer-side Notion provider modules; trim registry + types

**Files:**
- Delete: `src/shared/services/providers/notion/lib/contacts/` (adapter.ts, properties-map.ts, schema.ts)
- Delete: `src/shared/services/providers/notion/lib/meetings/` (adapter.ts, properties-map.ts, schema.ts — orphaned, zero external importers)
- Delete: `src/shared/services/providers/notion/lib/projects/` (properties-map.ts, schema.ts — orphaned)
- Delete: `src/shared/services/providers/notion/dal/query-contacts.ts` (dead, zero importers)
- Delete: `src/shared/services/providers/notion/dal/update-page-property.ts` (dead, zero importers — verified even inside the provider dir)
- Modify: `src/shared/services/providers/notion/constants/databases.ts`
- Modify: `src/shared/services/providers/notion/types.ts:6`

**Interfaces:**
- Consumes: Tasks 2–3 removed the last external importers of `lib/contacts/*`.
- Produces: `notionDatabasesMeta` keeps exactly four entries: `painPoints`, `trades`, `scopes`, `sows`. `NotionDatabaseName` narrows to `'painPoints' | 'trades' | 'scopes' | 'sows'`. All KEEP consumers (`construction-data.service.ts`, `get-cached-pain-points.ts`) use only those keys — no change needed there.

- [ ] **Step 1: Delete the dead modules**

```bash
rm -r src/shared/services/providers/notion/lib/contacts \
      src/shared/services/providers/notion/lib/meetings \
      src/shared/services/providers/notion/lib/projects \
      src/shared/services/providers/notion/dal/query-contacts.ts \
      src/shared/services/providers/notion/dal/update-page-property.ts
```

- [ ] **Step 2: Rewrite `constants/databases.ts`** to exactly this (removes contacts/meetings/projects imports, union members, and entries; keeps everything else byte-identical):

```ts
import type { ZodRawShape } from 'zod'
import type { NotionPainPoint } from '../lib/pain-points/schema'
import type { ScopeOrAddon } from '../lib/scopes/schema'
import type { SOW } from '../lib/sows/schema'
import type { Trade } from '../lib/trades/schema'
import type { NotionDatabaseName, RawPropertyMap } from '../types'
import { PAIN_POINT_PROPERTIES_MAP } from '../lib/pain-points/properties-map'
import { notionPainPointSchema } from '../lib/pain-points/schema'
import { SCOPE_OR_ADDON_PROPERTIES_MAP } from '../lib/scopes/properties-map'
import { scopeOrAddonSchema } from '../lib/scopes/schema'
import { SOW_PROPERTIES_MAP } from '../lib/sows/properties-map'
import { sowSchema } from '../lib/sows/schema'
import { TRADE_PROPERTIES_MAP } from '../lib/trades/properties-map'
import { tradeSchema } from '../lib/trades/schema'

type RawDatbaseMap = {
  [K in NotionDatabaseName]: {
    id: string
    name: K
    propertiesMap:
      | RawPropertyMap<Omit<NotionPainPoint, 'id'>>
      | RawPropertyMap<Omit<Trade, 'slug' | 'coverImageUrl'>>
      | RawPropertyMap<Omit<ScopeOrAddon, 'coverImageUrl'>>
      | RawPropertyMap<SOW>
    properties: ZodRawShape
  }
}

export const notionDatabasesMeta = {
  painPoints: {
    id: '31f0ca1b-548b-8014-8a18-000b60a42c1e',
    name: 'painPoints',
    propertiesMap: PAIN_POINT_PROPERTIES_MAP,
    properties: notionPainPointSchema.omit({ id: true }).shape,
  },
  trades: {
    id: '6f00ca1b-548b-8279-9f2d-87f649413084',
    name: 'trades',
    propertiesMap: TRADE_PROPERTIES_MAP,
    properties: tradeSchema.shape,
  },
  scopes: {
    id: 'ef70ca1b-548b-8226-b680-07fe8f00a91f',
    name: 'scopes',
    propertiesMap: SCOPE_OR_ADDON_PROPERTIES_MAP,
    properties: scopeOrAddonSchema.omit({ coverImageUrl: true }).shape,
  },
  sows: {
    id: '53e0ca1b-548b-83e3-8cd9-87067f43457a',
    name: 'sows',
    propertiesMap: SOW_PROPERTIES_MAP,
    properties: sowSchema.shape,
  },
} as const satisfies RawDatbaseMap

export type NotionDatabaseMap = typeof notionDatabasesMeta
```

- [ ] **Step 3: Trim the union in `types.ts`** — line 6, old:

```ts
export type NotionDatabaseName = 'contacts' | 'meetings' | 'painPoints' | 'projects' | 'trades' | 'scopes' | 'sows'
```

New:

```ts
export type NotionDatabaseName = 'painPoints' | 'trades' | 'scopes' | 'sows'
```

- [ ] **Step 4: Verify**

```bash
pnpm tsc
pnpm lint
grep -rn "lib/contacts\|lib/meetings\|lib/projects\|query-contacts\|update-page-property" src/ scripts/ --include='*.ts' --include='*.tsx' | grep -v cloudtalk
```

Expected: tsc + lint exit 0; grep returns no matches. (The `grep -v cloudtalk` excludes an unrelated comment in `providers/cloudtalk/client.ts:49` that mentions a hypothetical `lib/contacts` path — leave that file alone.)

- [ ] **Step 5: Sanity-check the KEEP side compiled against the narrowed union** — these are the four KEEP call sites of `queryNotionDatabase`:

```bash
grep -rn "queryNotionDatabase(" src/ --include='*.ts' | grep -v "dal/query-notion-database"
```

Expected: matches only in `construction-data.service.ts` (with `'trades'`/`'scopes'`/`'sows'`) and `src/features/meeting-flow/lib/get-cached-pain-points.ts` (with `'painPoints'`).

- [ ] **Step 6: Commit**

```bash
git add -u src/shared/services/providers/notion/
git commit -m "refactor(notion): remove customer/meeting/project sub-domains — keep trades, scopes, sows, pain-points

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Drop the `notion_contact_id` column

**Files:**
- Modify: `src/shared/db/schema/customers.ts:14`
- Modify: `src/shared/entities/meetings/dal/server/queries.ts:99`
- Modify: `src/shared/entities/customers/DOCS.md:118-124,142`

**Interfaces:**
- Consumes: Task 2 removed the only code writing the column (`upsertCustomerFromNotion` used it as its on-conflict target); Task 3 removed the only other reader (migration script).
- Produces: `Customer` / `selectCustomerSchema` / `insertCustomerSchema` regenerate without the field automatically (drizzle-zod). `customerSelectWithGate` spreads `getTableColumns(customers)` — auto-adjusts.

⚠️ **Data destruction:** the column's data (Notion page IDs from the one-time migration) is dropped. This is intentional — the migration is complete and the app is the source of truth. Task 0 Step 2 snapshotted dev.

- [ ] **Step 1: Remove the column from the schema.** In `src/shared/db/schema/customers.ts`, delete line 14:

```ts
  notionContactId: text('notion_contact_id').unique(),
```

(Do NOT touch `syncedAt` on line 55 — repurposed, `.notNull()`, written by non-Notion insert paths.)

- [ ] **Step 2: Remove the mirrored interface field.** In `src/shared/entities/meetings/dal/server/queries.ts`, delete line 99 inside `interface MeetingCustomer`:

```ts
  notionContactId: string | null
```

- [ ] **Step 3: Update the entity DOCS.** In `src/shared/entities/customers/DOCS.md`:
  - Delete the whole `### notion-contact-link` section (lines 118–124, from the heading through `**Enforced by**: DB unique constraint; will become irrelevant once Notion CRM migration ships`).
  - Delete the See-also line 142: `` - `docs/plans/notion-crm-migration-design.md` — context for `notionContactId` ``

- [ ] **Step 4: Verify types compile**

```bash
pnpm tsc
grep -rn "notionContactId\|notion_contact_id" src/ scripts/ --include='*.ts' --include='*.tsx'
```

Expected: tsc exits 0; grep empty (migration files under `src/shared/db/migrations/` are excluded by the ts/tsx filter and stay as immutable history).

- [ ] **Step 5: Push the schema to the dev DB** (drops the column + its unique constraint):

```bash
pnpm db:push:dev
```

Expected: drizzle-kit reports dropping `notion_contact_id` from `customers` and completes. Review the printed statement before confirming — it should ONLY drop that column/constraint. **Prod push is a deliberate separate step performed by the user at deploy time — never run `pnpm db:push` from this plan.**

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/schema/customers.ts src/shared/entities/meetings/dal/server/queries.ts src/shared/entities/customers/DOCS.md
git commit -m "refactor(customers)!: drop notion_contact_id — Notion CRM bridge retired

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Monday.com scrub

**Files:**
- Modify: `package.json:59` (via pnpm)
- Modify: `src/shared/config/server-env.ts:55-56`
- Modify: `.env.ci:25-26`
- Modify: `src/features/agent-settings/constants/company-info.ts:13`

**Interfaces:**
- Consumes: nothing. `@mondaydotcomorg/api` has zero imports; `MONDAY_API_TOKEN` is validated by Zod but read nowhere.
- Produces: environments no longer need to define `MONDAY_API_TOKEN` (it was a **required** Zod string — removing it relaxes boot requirements everywhere, incl. Vercel).

- [ ] **Step 1: Remove the dead dependency**

```bash
pnpm remove @mondaydotcomorg/api
```

- [ ] **Step 2: Remove the env declaration.** In `src/shared/config/server-env.ts`, delete lines 55–56:

```ts
  // MONDAY
  MONDAY_API_TOKEN: z.string(),
```

- [ ] **Step 3: Remove the CI placeholder.** In `.env.ci`, delete the block (lines 25–26):

```
# Monday
MONDAY_API_TOKEN=ci_placeholder
```

- [ ] **Step 4: Remove the UI link.** In `src/features/agent-settings/constants/company-info.ts`, delete line 13:

```ts
  { label: 'Monday.com', href: 'https://app.monday.com', external: true },
```

(`USEFUL_LINKS` keeps the Company Website entry; the consuming `company-info-section.tsx` maps the array — no change needed there.)

- [ ] **Step 5: Verify**

```bash
pnpm tsc && pnpm lint
grep -rni "monday" src/ package.json .env.ci --include='*.ts' --include='*.tsx' | grep -vi "day-of\|weekday\|monday morning\|on monday"
```

Expected: tsc + lint exit 0. Remaining grep hits are only day-of-week usages (e.g. `formatters.ts`, `lead-sources.router.ts`, voip greeting) — those are the weekday, not the service; leave them.

- [ ] **Step 6: Reminder (manual, from Task 0):** delete `MONDAY_API_TOKEN=…` from local `.env` and any Vercel env config, and revoke the token in Monday admin.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/shared/config/server-env.ts .env.ci src/features/agent-settings/constants/company-info.ts
git commit -m "chore: scrub Monday.com — dead dep, unread required env var, stale UI link

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: DocuSign scrub

**Files:**
- Modify: `package.json:120,170` (via pnpm)
- Modify: `.env.ci:28-33`
- Modify: `src/shared/domains/pipelines/constants/fresh-pipeline.ts:48-49`

**Interfaces:**
- Consumes: nothing. `docusign-esign` has zero imports; the live e-sign provider is Zoho Sign (`src/shared/services/providers/zoho-sign/`, `proposals.signingRequestId`).
- Produces: user-facing pipeline copy becomes factually correct (Zoho Sign, not DocuSign).

- [ ] **Step 1: Remove the dead dependencies**

```bash
pnpm remove docusign-esign @types/docusign-esign
```

- [ ] **Step 2: Remove the CI placeholders.** In `.env.ci`, delete the block (lines 28–33):

```
# DocuSign
DS_USER_ID=ci_placeholder
DS_ACCOUNT_ID=ci_placeholder
DS_INTEGRATION_KEY=ci_placeholder
DS_JWT_PRIVATE_KEY_PATH=ci_placeholder
DS_JWT_PRIVATE_KEY=ci_placeholder
```

(Note: `DS_*` was never declared in `server-env.ts` — nothing validates it; nothing to remove there.)

- [ ] **Step 3: Fix the stale pipeline copy.** In `src/shared/domains/pipelines/constants/fresh-pipeline.ts`, lines 48–49, old:

```ts
  'proposal_sent->contract_sent': 'Contracts are sent via DocuSign',
  'contract_sent->approved': 'Approval happens when the customer signs via DocuSign',
```

New:

```ts
  'proposal_sent->contract_sent': 'Contracts are sent via Zoho Sign',
  'contract_sent->approved': 'Approval happens when the customer signs via Zoho Sign',
```

- [ ] **Step 4: Verify**

```bash
pnpm tsc && pnpm lint
grep -rni "docusign\|DS_JWT\|DS_USER_ID" src/ package.json .env.ci --include='*.ts' --include='*.tsx'
```

Expected: tsc + lint exit 0; grep returns no matches.

- [ ] **Step 5: Reminder (manual, from Task 0):** delete `DS_*` lines from local `.env` and revoke the DocuSign integration key/RSA keypair.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml .env.ci src/shared/domains/pipelines/constants/fresh-pipeline.ts
git commit -m "chore: scrub DocuSign — dead deps, CI placeholders, stale pipeline copy (Zoho Sign is live)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Update stale operational docs (sales/proposal playbooks)

**Files:**
- Modify: `docs/proposal/creation-guide.md:41,136,142`
- Modify: `docs/sales/follow-up-cadence.md:21,27,135-137,140`
- Modify: `docs/sales/revenue-model.md:20,28,86,109,111,121,146-147`
- Modify: `docs/sales/in-home-meeting-playbook.md:26,321` (added during execution — missed by the original scan)
- Modify: `docs/sales/closing-strategies.md:48,126,133,137,159` (added during execution — missed by the original scan)

These playbooks still instruct agents to use DocuSign and Monday.com. Rule: **"DocuSign" → "Zoho Sign"** everywhere it names the live e-sign step; **Monday.com task references → the app** (follow-up tasks and project tracking live in the TPR app now).

- [ ] **Step 1: `docs/proposal/creation-guide.md`** — replace the word `DocuSign` with `Zoho Sign` at lines 41, 136, 142 (sentence structure unchanged, e.g. line 41: "…both people receive the Zoho Sign request and can review it together." — adjust "the DocuSign" → "the Zoho Sign request" where the article requires it).

- [ ] **Step 2: `docs/sales/follow-up-cadence.md`**
  - Line 21: `**Action**: Send proposal via DocuSign / proposal system` → `**Action**: Send proposal via Zoho Sign / proposal system`
  - Line 27: `Create Monday follow-up task for Day 1.` → `Create a follow-up task in the app for Day 1.`
  - Lines 135–137, 140 (table cells): replace each `Monday: …` cell with `App: …` keeping the described action (e.g. `Monday: create follow-up task` → `App: create follow-up task`).

- [ ] **Step 3: `docs/sales/revenue-model.md`**
  - Lines 20, 28, 86, 109, 111: replace `DocuSign` with `Zoho Sign` (line 86 "DocuSign envelope" → "Zoho Sign request").
  - Line 121: `**Tracking**: Monday.com items updated; project status visible to team` → `**Tracking**: project status tracked in the app, visible to team`
  - Lines 146–147 (tools table): replace the `Monday.com` row's purpose with the app (`| TPR app | Task management, project tracking, lead follow-up |`) and the `DocuSign` row with `| Zoho Sign | E-signature for contracts |`.

- [ ] **Step 4: Verify**

```bash
grep -rni "docusign" docs/sales/ docs/proposal/
grep -rn "Monday.com\|Monday:" docs/sales/ docs/proposal/
```

Expected: both empty. (Other `docs/` mentions — `docs/README.md:159` "legacy", ADR-0003, plans/handoffs — are deliberate historical records; leave them.)

- [ ] **Step 5: Commit**

```bash
git add docs/proposal/creation-guide.md docs/sales/follow-up-cadence.md docs/sales/revenue-model.md
git commit -m "docs(sales): replace DocuSign/Monday operational instructions with Zoho Sign / app

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: Final sweep + preflight

**Files:** none (verification only)

- [ ] **Step 1: Full reference sweep** — every removal target must be gone:

```bash
grep -rn "syncAllCustomers\|upsertCustomerFromNotion\|pageToContact\|syncCustomersJob\|notionContactId\|CONTACT_PROPERTIES_MAP\|MEETING_PROPERTIES_MAP\|PROJECT_PROPERTIES_MAP" src/ scripts/ --include='*.ts' --include='*.tsx'
grep -rn "'contacts'\|'meetings'\|'projects'" src/shared/services/providers/notion/ --include='*.ts'
```

Expected: both empty.

- [ ] **Step 2: KEEP-side smoke check** — the surviving Notion surface still resolves:

```bash
grep -rn "notionDatabasesMeta" src/ --include='*.ts' | grep -v worktree
```

Expected: matches only in `notion/constants/databases.ts`, `notion/types.ts`, `notion/dal/query-notion-database.ts`.

- [ ] **Step 3: PR preflight**

```bash
pnpm lint && pnpm tsc
```

Expected: both exit 0.

- [ ] **Step 4: Runtime smoke (manual):** `pnpm dev`, then load a landing services page (trades/scopes render from Notion) and open the meeting-flow persona step (pain-points load) — confirms the KEEP boundary held at runtime, not just at compile time.

---

## Out of scope (documented deliberately)

1. **`docusign_envelope_id` in `src/shared/db/migrations/0000_*.sql` + snapshots** — immutable history; never edit. The repo uses the `db:push` workflow, so the migrations folder is not what shapes the live DB. **One-time check recommended:** confirm the prod DB no longer carries `docusign_envelope_id` on `proposals` (and does carry `signing_request_id`); if the old column is still live, the next user-run prod push will surface/drop it — review that diff when it appears.
2. **`docs/plans/notion-crm-migration-{plan,design}.md`, `docs/tasks/notion-crm-migration.md`** — historical planning records of the migration this plan completes. Keep as history; optionally add a one-line "✅ completed 2026-07-09, cleanup: this plan" banner at the top of each.
3. **Local `.env` secret lines + provider-side revocation** — manual user actions (Task 0 Step 3). Not committed to git (`.env` is gitignored), so no history scrubbing needed.
4. **`NOTION_API_KEY`** — stays. It powers trades/scopes/SOW/pain-points and the portfolio-scraper tooling.
5. **Post-merge memory updates** — update `memory/project-notion-crm-migration.md` and `memory/project-legacy-services.md` to record completion (done by the executing session after the final commit).
