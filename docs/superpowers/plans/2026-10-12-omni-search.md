# Omni Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A ⌘K / dock-button search that finds customers (ranked by similarity) plus their meetings, proposals and projects, and reaches every dashboard page, deep link and global action.

**Architecture:** One tRPC query (`searchRouter.omni`) calls `searchService.omni`, which orchestrates a pg_trgm-ranked customer matcher in the customers DAL and three permission-scoped "related records" readers in the meetings, proposals and projects DALs. The features side is a pure client registry built from the existing nav config and each feature's own URL parsers, ranked with cmdk's `defaultFilter`. A zustand store holds the search and Action Center open state so the sidebar button, ⌘K, the phone dock and the palette's own actions share one dialog and one sheet.

**Tech Stack:** Next.js 15, tRPC 11 + TanStack Query, Drizzle 0.45 on node-postgres (Neon), Postgres `pg_trgm` 1.6, cmdk 1.1, nuqs 2, zustand 5, Tailwind v4 semantic tokens.

**Spec:** `docs/superpowers/specs/2026-10-12-omni-search-design.md`

## Global Constraints

- Package manager `pnpm`; path alias `@/` → `src/`.
- Gates per task: `pnpm lint` and `pnpm tsc` clean. Never run `pnpm build`.
- The repo has no test runner. Tests are throwaway `tsx` scripts under `scripts/` built from `node:assert/strict`, written first and run to watch them fail, then deleted in Task 7. DB scripts: first line `import './lib/load-env'` (with the eslint-disable block other scripts use for the import sorter), run as `NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/<file>.ts`, read-only against dev.
- No DB writes for testing, dev included. Do not submit the meeting form during UI checks.
- Work on `main`; stage and commit by explicit path only (`git commit -m … -- <paths>`); never `git add -A`, stash, checkout or reset. The pre-commit hook takes ~110 s: run commits with a 300000 ms Bash timeout.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Internal navigation is `router.push` / `Link` only, with hrefs from `ROOTS` (`src/shared/config/roots.ts`); lint rejects raw `/dashboard/...` literals in `href` and `push`.
- Colours are semantic tokens only (`bg-primary`, `text-muted-foreground`, …); type sizes are Tailwind steps with `text-xs` as the floor. Lint enforces both.
- One component per file, named exports, constants in `constants/`, pure helpers in `lib/`.
- Comments say why, never what; no citations of this plan or the spec from code.
- `CREATE EXTENSION pg_trgm` is already done on dev (owner, 2026-10-12). Prod gets the extension and `db:push:prod` from the owner at ship; never push to prod.
- Limits (spec): term 2–80 characters after trim; up to 5 customers; related records for the top 3 customers; up to 5 rows per related group; 150 ms debounce; `staleTime` 30 s.

## Review Focus

1. **Punctuation inside names and addresses** ("Smith, John", "O'Brien", "Elm St.") — a person expects the same hits as without the punctuation. Pinned in Task 1's token test.
2. **LIKE metacharacters in a term** (`j_doe@`, `100%`) — `_` and `%` must match literally, never as wildcards. Pinned in Task 2's test (`escapeLike` plus a term made of metacharacters returning nothing).
3. **A role without Project access (dispatcher) or a context with no user** — search still works for that role, the projects group is simply empty, and no FORBIDDEN error is raised. Pinned in Task 3's service test.
4. **Terms over 80 characters, or pasted with newlines and tabs** — the client clamps and collapses before querying, so the server never rejects the input. Pinned in Task 3's `toOmniTerm` test.
5. **Typing faster than responses arrive** — the list always reflects the last term typed, never a stale response. React Query keys by term; pinned by the Playwright fast-typing check in Task 7.

---

## File Map

| File | Status | Responsibility |
|---|---|---|
| `src/shared/entities/customers/lib/customer-search-tokens.ts` | create | Pure term → tokens / whole-phone classifier |
| `src/shared/db/schema/customers.ts` | modify | Two GIN trigram indexes |
| `src/shared/entities/customers/dal/server/customer-search-rank-sql.ts` | create | Token → SQL fragments, hybrid score, `matchedOn` |
| `src/shared/entities/customers/dal/server/search-customers-ranked.ts` | create | Ranked, permission-scoped customer read |
| `src/shared/entities/meetings/dal/server/queries.ts` | modify | `listMeetingsForCustomers` |
| `src/shared/modules/proposals/core/dal/server/queries.ts` | modify | `listProposalsForCustomers` |
| `src/shared/modules/projects/core/dal/server/queries.ts` | modify | `listProjectsForCustomers` |
| `src/shared/domains/omni-search/schemas.ts` | create | Input schema, target schema, limits, `toOmniTerm` (shared client/server) |
| `src/shared/services/search.service.ts` | create | `searchService.omni` orchestration |
| `src/trpc/routers/search.router.ts` | create | `omni` query |
| `src/trpc/routers/app.ts` | modify | Register `searchRouter` |
| `src/shared/components/ui/command.tsx` | modify | `CommandDialog` gains `commandProps` (the one shared-UI edit; needed for `shouldFilter={false}`) |
| `src/features/agent-dashboard/hooks/use-dashboard-overlays.ts` | create | zustand: `searchOpen`, `actionCenterOpen` |
| `src/features/agent-dashboard/ui/components/dashboard-overlays.tsx` | create | Mounts the Action Center sheet and the search dialog once |
| `src/features/agent-dashboard/ui/components/dashboard-session-overlays.tsx` | create | Server wrapper: session + `AbilityProvider` |
| `src/app/(frontend)/dashboard/layout.tsx` | modify | Mount `DashboardSessionOverlays` |
| `src/features/agent-dashboard/ui/components/app-sidebar.tsx` | modify | Action Center button → store; drop local sheet |
| `src/features/agent-dashboard/ui/components/dashboard-mobile-nav.tsx` | modify | Drop local sheet |
| `src/features/agent-dashboard/ui/components/mobile-dock.tsx` | modify | No props; search opens store |
| `src/features/agent-dashboard/ui/components/mobile-dock-capsule.tsx` | modify | Rightmost button = Search |
| `src/features/agent-dashboard/ui/components/sidebar-search-bar.tsx` | modify | Button opens store; dialog and listener move out |
| `src/features/omni-search/constants/copy.ts` | create | User-facing strings |
| `src/features/omni-search/constants/omni-search.ts` | create | Debounce, group caps, record icons |
| `src/features/omni-search/ui/components/omni-search-dialog.tsx` | create | Dialog host, ⌘K, close on navigation, meeting modal |
| `src/features/calculators/constants/calculator-tab-meta.ts` | create | Calculator labels, aliases, deep-link href |
| `src/features/calculators/ui/views/calculators-view.tsx` | modify | Tab labels from the meta |
| `src/features/agent-dashboard/lib/get-sidebar-nav.ts` | modify | Optional `aliases` on nav items |
| `src/features/omni-search/types.ts` | create | `OmniEntry`, `OmniActionId`, `OmniMode`, recent item |
| `src/features/omni-search/lib/build-omni-registry.ts` | create | Pure registry from ability |
| `src/features/omni-search/lib/rank-omni-entries.ts` | create | cmdk-scored ranking |
| `src/features/omni-search/lib/recent-omni-items.ts` | create | localStorage recent list (validated, try/catch) |
| `src/features/omni-search/hooks/use-omni-search-query.ts` | create | Debounced tRPC query |
| `src/features/omni-search/hooks/use-open-omni-target.ts` | create | Target → profile modal or route |
| `src/features/omni-search/hooks/use-omni-actions.ts` | create | Theme, Action Center, sign out |
| `src/features/omni-search/ui/components/omni-search-panel.tsx` | create | Input + mode state (resets on close) |
| `src/features/omni-search/ui/components/omni-search-results.tsx` | create | Group order, states |
| `src/features/omni-search/ui/components/omni-customer-item.tsx` | create | Customer row |
| `src/features/omni-search/ui/components/omni-meeting-item.tsx` | create | Meeting row |
| `src/features/omni-search/ui/components/omni-proposal-item.tsx` | create | Proposal row |
| `src/features/omni-search/ui/components/omni-project-item.tsx` | create | Project row |
| `src/features/omni-search/ui/components/omni-record-groups.tsx` | create | Customers/Meetings/Proposals/Projects + see-all |
| `src/features/omni-search/ui/components/omni-entry-groups.tsx` | create | Go to / Actions |
| `src/features/omni-search/ui/components/omni-recent-group.tsx` | create | Empty-query recents |

---

### Task 1: Term tokenizer

**Files:**
- Create: `src/shared/entities/customers/lib/customer-search-tokens.ts`
- Test: `scripts/tmp-omni-tokens.ts`

**Interfaces:**
- Produces: `parseCustomerSearch(term: string): CustomerSearchQuery`; types `CustomerSearchToken = { kind: 'text' | 'number' | 'email', value: string }`, `CustomerSearchQuery = { tokens: CustomerSearchToken[], phoneDigits: string | null }`.

- [ ] **Step 1: Write the failing test**

```ts
// scripts/tmp-omni-tokens.ts
import assert from 'node:assert/strict'

import { parseCustomerSearch } from '@/shared/entities/customers/lib/customer-search-tokens'

const text = (value: string) => ({ kind: 'text', value }) as const
const num = (value: string) => ({ kind: 'number', value }) as const

const cases: [string, ReturnType<typeof parseCustomerSearch>][] = [
  ['  John   Smith ', { phoneDigits: null, tokens: [text('john'), text('smith')] }],
  ['(714) 555-4471', { phoneDigits: '7145554471', tokens: [] }],
  ['+1 714 555 4471', { phoneDigits: '7145554471', tokens: [] }],
  ['555-4471', { phoneDigits: '5554471', tokens: [] }],
  ['4471', { phoneDigits: null, tokens: [num('4471')] }],
  ['9140 elm', { phoneDigits: null, tokens: [num('9140'), text('elm')] }],
  ['Jane.Doe@Example.com', { phoneDigits: null, tokens: [{ kind: 'email', value: 'jane.doe@example.com' }] }],
  ['Smith, John', { phoneDigits: null, tokens: [text('smith'), text('john')] }],
  ['Elm St., Anaheim', { phoneDigits: null, tokens: [text('elm'), text('st'), text('anaheim')] }],
  ['O\'Brien', { phoneDigits: null, tokens: [text('o\'brien')] }],
  ['José', { phoneDigits: null, tokens: [text('josé')] }],
  ['%% __', { phoneDigits: null, tokens: [] }],
  ['a b c d e f g h', { phoneDigits: null, tokens: ['a', 'b', 'c', 'd', 'e', 'f'].map(text) }],
]

for (const [input, expected] of cases) {
  assert.deepEqual(parseCustomerSearch(input), expected, `parseCustomerSearch(${JSON.stringify(input)})`)
}
console.log(`✓ ${cases.length} tokenizer cases`)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm tsx scripts/tmp-omni-tokens.ts`
Expected: FAIL, cannot resolve `customer-search-tokens`.

- [ ] **Step 3: Implement**

```ts
// src/shared/entities/customers/lib/customer-search-tokens.ts
import { toPhoneSearchDigits } from '@/shared/lib/phone'

export type CustomerSearchToken
  = | { kind: 'text', value: string }
    | { kind: 'number', value: string }
    | { kind: 'email', value: string }

export interface CustomerSearchQuery {
  tokens: CustomerSearchToken[]
  /** The whole term read as a phone number, when it is one. Takes over from the tokens. */
  phoneDigits: string | null
}

// Fewer digits than this is more likely a house number or zip than a phone fragment.
const PHONE_MIN_DIGITS = 7
const MAX_TOKENS = 6
const EDGE_PUNCTUATION = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu

export function parseCustomerSearch(term: string): CustomerSearchQuery {
  const normalized = term.trim().replace(/\s+/g, ' ').toLowerCase()
  const digits = toPhoneSearchDigits(normalized)
  if (digits && digits.length >= PHONE_MIN_DIGITS) {
    return { tokens: [], phoneDigits: digits }
  }
  const tokens = normalized
    .split(' ')
    .map(classifyToken)
    .filter((token): token is CustomerSearchToken => token !== null)
    .slice(0, MAX_TOKENS)
  return { tokens, phoneDigits: null }
}

function classifyToken(raw: string): CustomerSearchToken | null {
  if (raw.includes('@')) {
    return { kind: 'email', value: raw }
  }
  const value = raw.replace(EDGE_PUNCTUATION, '')
  if (!value) {
    return null
  }
  return /^\d+$/.test(value) ? { kind: 'number', value } : { kind: 'text', value }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm tsx scripts/tmp-omni-tokens.ts`
Expected: `✓ 13 tokenizer cases`

- [ ] **Step 5: Lint, type-check, commit**

```bash
pnpm lint && pnpm tsc
git commit -m "feat(search): tokenize omni search terms into text, number, email and whole-phone parts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/entities/customers/lib/customer-search-tokens.ts
```
(The `scripts/tmp-*` files stay uncommitted; Task 7 deletes them.)

---

### Task 2: Ranked customer matcher and trigram indexes

**Files:**
- Modify: `src/shared/db/schema/customers.ts` (imports, table third argument)
- Create: `src/shared/entities/customers/dal/server/customer-search-rank-sql.ts`
- Create: `src/shared/entities/customers/dal/server/search-customers-ranked.ts`
- Test: `scripts/tmp-omni-search.ts`

**Interfaces:**
- Consumes: `parseCustomerSearch` (Task 1).
- Produces:
  - `type CustomerMatchField = 'name' | 'phone' | 'address' | 'email'`
  - `escapeLike(value: string): string`
  - `interface RankedCustomer { id: string, name: string, city: string, address: string | null, zip: string, email: string | null, phone: string | null /* gated */, pipeline: Pipeline, score: number, matchedOn: CustomerMatchField }`
  - `searchCustomersRanked(ctx: ScopedContext, term: string, limit: number): Promise<DalReturn<RankedCustomer[]>>`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/tmp-omni-search.ts
/* eslint-disable perfectionist/sort-imports */
import './lib/load-env'

import type { ScopedContext } from '@/shared/dal/server/types'

import assert from 'node:assert/strict'

import { and, eq, isNotNull, sql } from 'drizzle-orm'

import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { db } from '@/shared/db'
import { customers, meetingParticipants, meetings, proposals, user } from '@/shared/db/schema'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { escapeLike } from '@/shared/entities/customers/dal/server/customer-search-rank-sql'
import { searchCustomersRanked } from '@/shared/entities/customers/dal/server/search-customers-ranked'
/* eslint-enable perfectionist/sort-imports */

const failures: string[] = []
function check(name: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${name}${ok ? '' : ` ${detail}`}`)
  if (!ok) {
    failures.push(name)
  }
}

function ctxFor(userId: string, role: 'agent' | 'dispatcher'): ScopedContext {
  return { actor: { ability: defineAbilitiesFor({ id: userId, role }), userId }, scope: null }
}

async function ids(ctx: ScopedContext, term: string) {
  const result = await searchCustomersRanked(ctx, term, 5)
  assert.ok(result.success, `search failed for ${JSON.stringify(term)}`)
  return result.data
}

// Task 2: ranked matcher
const indexes = await db.execute(sql`SELECT indexname FROM pg_indexes WHERE tablename = 'customers' AND indexname IN ('customers_name_trgm_idx', 'customers_address_trgm_idx')`)
check('both trigram indexes exist', indexes.rows.length === 2, JSON.stringify(indexes.rows))

assert.equal(escapeLike('a_b%c\\'), 'a\\_b\\%c\\\\')
check('escapeLike escapes _ % \\', true)

const [fixture] = await db
  .select({ id: customers.id, name: customers.name, phone: customers.phone, address: customers.address, zip: customers.zip })
  .from(customers)
  .where(and(
    isNotNull(customers.phone),
    sql`${customers.address} ~ '^[0-9]+ [A-Za-z]{3,}'`,
    sql`${customers.name} ~ '^[A-Za-z]{4,} [A-Za-z]{3,}$'`,
  ))
  .orderBy(customers.createdAt)
  .limit(1)
assert.ok(fixture, 'no fixture customer with phone, numbered address and two-word name on dev')

const [first, last] = fixture.name.split(' ')
const typo = `${first[0]}${first[2]}${first[1]}${first.slice(3)} ${last}`
const [houseNumber, streetWord] = fixture.address!.split(' ')
const p = fixture.phone!
const has = (rows: { id: string }[]) => rows.some(r => r.id === fixture.id)

check('exact name in top 5', has(await ids(SYSTEM_CONTEXT, fixture.name)))
check(`typo "${typo}" in top 5`, has(await ids(SYSTEM_CONTEXT, typo)))
const byPhone = await ids(SYSTEM_CONTEXT, `(${p.slice(0, 3)}) ${p.slice(3, 6)}-${p.slice(6)}`)
check('formatted phone ranks the customer first, matched on phone', byPhone[0]?.id === fixture.id && byPhone[0]?.matchedOn === 'phone', JSON.stringify(byPhone[0]))
check('house number + street word in top 5', has(await ids(SYSTEM_CONTEXT, `${houseNumber} ${streetWord}`)))
const crossField = await ids(SYSTEM_CONTEXT, `${last} ${streetWord}`)
check('last name + street word in top 5', has(crossField))
check('zip + last name in top 5', has(await ids(SYSTEM_CONTEXT, `${fixture.zip} ${last}`)))
check('metacharacter-only term returns nothing', (await ids(SYSTEM_CONTEXT, '%% __')).length === 0)
check('scores are numbers, best first', crossField.every((r, i) => typeof r.score === 'number' && (i === 0 || crossField[i - 1].score >= r.score)))

const nobody = ctxFor('00000000-0000-4000-8000-000000000000', 'agent')
check('agent with no meetings sees no customers', (await ids(nobody, fixture.name)).length === 0)

// An agent on a meeting whose customer has no sent proposal: finds the customer by name, not by phone digits.
const [gated] = await db
  .select({ userId: meetingParticipants.userId, customerId: customers.id, name: customers.name, phone: customers.phone })
  .from(meetingParticipants)
  .innerJoin(meetings, eq(meetings.id, meetingParticipants.meetingId))
  .innerJoin(customers, eq(customers.id, meetings.customerId))
  .innerJoin(user, eq(user.id, meetingParticipants.userId))
  .where(and(
    eq(user.role, 'agent'),
    isNotNull(customers.phone),
    // Raw, with its own aliases: the outer query already joins `meetings`.
    sql`NOT EXISTS (SELECT 1 FROM proposals p JOIN meetings m2 ON m2.id = p.meeting_id WHERE m2.customer_id = "customers"."id" AND p.status IN ('sent', 'approved'))`,
  ))
  .limit(1)
if (gated) {
  const agent = ctxFor(gated.userId, 'agent')
  check('gated agent finds own customer by name', (await ids(agent, gated.name)).some(r => r.id === gated.customerId))
  check('gated agent cannot find that customer by phone digits', !(await ids(agent, gated.phone!)).some(r => r.id === gated.customerId))
}
else {
  console.log('- SKIP gated-phone case: no agent on a meeting whose customer lacks a sent proposal')
}

if (failures.length > 0) {
  console.error(`\n${failures.length} failing`)
  process.exit(1)
}
console.log('\nall passing')
process.exit(0)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-omni-search.ts`
Expected: FAIL, cannot resolve `customer-search-rank-sql`.

- [ ] **Step 3: Add the indexes to the schema**

In `src/shared/db/schema/customers.ts`, add `index` to the `drizzle-orm/pg-core` import, add `import { sql } from 'drizzle-orm'`, and give `pgTable` a third argument (same object form as `meetings.ts`):

```ts
  createdAt,
  updatedAt,
}, table => ({
  nameTrgmIdx: index('customers_name_trgm_idx').using('gin', sql`${table.name} gin_trgm_ops`),
  // Must match `customerAddressDocSql` exactly, or the planner can't use it.
  addressTrgmIdx: index('customers_address_trgm_idx').using('gin', sql`(coalesce(${table.address}, '') || ' ' || ${table.city}) gin_trgm_ops`),
}))
```

- [ ] **Step 4: Push to dev and confirm the diff**

Run: `pnpm db:push:dev`
Expected: the only statements are two `CREATE INDEX … USING gin` on `customers`. If drizzle-kit lists anything else (drops, alters, other tables), answer no, stop, and report the full diff to the owner.

- [ ] **Step 5: Write the SQL fragments**

```ts
// src/shared/entities/customers/dal/server/customer-search-rank-sql.ts
import type { SQL } from 'drizzle-orm'

import type { CustomerSearchQuery, CustomerSearchToken } from '@/shared/entities/customers/lib/customer-search-tokens'

import { sql } from 'drizzle-orm'

import { customers } from '@/shared/db/schema/customers'
import 'server-only'

export type CustomerMatchField = 'name' | 'phone' | 'address' | 'email'

/** Below this `word_similarity` a text token is not a hit. */
export const WORD_SIMILARITY_THRESHOLD = 0.4

// Must stay identical to `customers_address_trgm_idx` in the schema, or the planner skips the index.
export const customerAddressDocSql = sql`(coalesce(${customers.address}, '') || ' ' || ${customers.city})`

interface TokenSql {
  match: SQL
  score: SQL
  nameScore: SQL
  addressScore: SQL
  phoneHit: SQL
  emailHit: SQL
}

export interface CustomerSearchSql {
  where: SQL
  score: SQL<number>
  matchedOn: SQL<CustomerMatchField>
}

const ZERO = sql`0`
const FALSE = sql`false`

export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, m => `\\${m}`)
}

function textTokenSql(value: string): TokenSql {
  const escaped = escapeLike(value)
  const nameScore = sql`word_similarity(${value}, ${customers.name})`
  const addressScore = sql`word_similarity(${value}, ${customerAddressDocSql})`
  const namePrefix = sql`(${customers.name} ILIKE ${`${escaped}%`} OR ${customers.name} ILIKE ${`% ${escaped}%`})`
  return {
    // Trigrams of a one- or two-letter token match almost anything; short tokens count only as a name-word prefix.
    match: value.length < 3
      ? namePrefix
      : sql`(${value} <% ${customers.name} OR ${value} <% ${customerAddressDocSql})`,
    score: sql`(greatest(${nameScore}, 0.9 * ${addressScore}) + CASE WHEN ${namePrefix} THEN 0.1 ELSE 0 END)`,
    nameScore,
    addressScore,
    phoneHit: FALSE,
    emailHit: FALSE,
  }
}

function numberTokenSql(value: string, gatedPhone: SQL): TokenSql {
  const houseNumber = sql`(${customers.address} ILIKE ${`${value} %`})`
  const zip = sql`(${customers.zip} LIKE ${`${value}%`})`
  const inAddress = sql`(${customers.address} ILIKE ${`%${value}%`})`
  // Phones are stored as bare digits, so a digit run matches the gated value directly.
  const phone = sql`(coalesce(${gatedPhone}, '') LIKE ${`%${value}%`})`
  const onAddress = sql`(${zip} OR ${inAddress})`
  return {
    match: sql`(${onAddress} OR ${phone})`,
    score: sql`CASE WHEN ${houseNumber} THEN 0.85 WHEN ${zip} THEN 0.8 WHEN ${phone} THEN 0.75 WHEN ${inAddress} THEN 0.6 ELSE 0 END`,
    nameScore: ZERO,
    addressScore: sql`CASE WHEN ${onAddress} THEN 1 ELSE 0 END`,
    phoneHit: sql`(${phone} AND NOT ${onAddress})`,
    emailHit: FALSE,
  }
}

function emailTokenSql(value: string): TokenSql {
  const hit = sql`(${customers.email} ILIKE ${`${escapeLike(value)}%`})`
  return { match: hit, score: sql`CASE WHEN ${hit} THEN 1 ELSE 0 END`, nameScore: ZERO, addressScore: ZERO, phoneHit: FALSE, emailHit: hit }
}

function tokenSql(token: CustomerSearchToken, gatedPhone: SQL): TokenSql {
  switch (token.kind) {
    case 'text': return textTokenSql(token.value)
    case 'number': return numberTokenSql(token.value, gatedPhone)
    case 'email': return emailTokenSql(token.value)
  }
}

/** `null` when the term has nothing to match on. `gatedPhone` must be the expression the caller renders. */
export function customerSearchSql(query: CustomerSearchQuery, gatedPhone: SQL): CustomerSearchSql | null {
  if (query.phoneDigits) {
    return {
      where: sql`(coalesce(${gatedPhone}, '') LIKE ${`%${query.phoneDigits}%`})`,
      score: sql<number>`1::float8`.mapWith(Number),
      matchedOn: sql<CustomerMatchField>`'phone'`,
    }
  }
  if (query.tokens.length === 0) {
    return null
  }
  const parts = query.tokens.map(token => tokenSql(token, gatedPhone))
  const joined = (key: keyof TokenSql, op: 'AND' | 'OR' | '+') => sql.join(parts.map(part => part[key]), sql.raw(` ${op} `))
  return {
    where: sql`(${joined('match', 'AND')})`,
    score: sql<number>`((${joined('score', '+')}) / ${sql.raw(String(parts.length))})::float8`.mapWith(Number),
    matchedOn: sql<CustomerMatchField>`CASE
      WHEN ${joined('phoneHit', 'OR')} THEN 'phone'
      WHEN ${joined('emailHit', 'OR')} THEN 'email'
      WHEN (${joined('nameScore', '+')}) >= (${joined('addressScore', '+')}) THEN 'name'
      ELSE 'address' END`,
  }
}
```

- [ ] **Step 6: Write the DAL read**

```ts
// src/shared/entities/customers/dal/server/search-customers-ranked.ts
// LAZY: customers is still a plain entity; this moves to modules/customers/core/dal/server with the promotion.
import type { Pipeline } from '@/shared/constants/enums/pipelines'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { CustomerMatchField } from '@/shared/entities/customers/dal/server/customer-search-rank-sql'

import { and, desc, sql } from 'drizzle-orm'

import { dalDbOperation } from '@/shared/dal/server/lib/helpers'
import { permit } from '@/shared/dal/server/lib/permissions/permit'
import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema/customers'
import { customerSearchSql, WORD_SIMILARITY_THRESHOLD } from '@/shared/entities/customers/dal/server/customer-search-rank-sql'
import { parseCustomerSearch } from '@/shared/entities/customers/lib/customer-search-tokens'
import { derivedPipelineSql } from '@/shared/entities/customers/lib/derived-pipeline-sql'
import { canSeeUngatedPhone, gatedPhoneSql } from '@/shared/entities/customers/lib/phone-gating-sql'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import 'server-only'

export interface RankedCustomer {
  id: string
  name: string
  city: string
  address: string | null
  zip: string
  email: string | null
  /** Gated: null when the caller may not see it. */
  phone: string | null
  pipeline: Pipeline
  score: number
  matchedOn: CustomerMatchField
}

/** Customers the caller can read, best match first. Phone matching uses the gated value, so it can't reveal a hidden number. */
export async function searchCustomersRanked(ctx: ScopedContext, term: string, limit: number): Promise<DalReturn<RankedCustomer[]>> {
  return dalDbOperation(async () => {
    const gatedPhone = gatedPhoneSql(canSeeUngatedPhone(ctx.actor.ability))
    const rank = customerSearchSql(parseCustomerSearch(term), gatedPhone)
    if (!rank) {
      return []
    }
    return db.transaction(async (tx) => {
      // `<%` reads its threshold from this setting; `true` scopes it to this transaction.
      await tx.execute(sql`SELECT set_config('pg_trgm.word_similarity_threshold', ${String(WORD_SIMILARITY_THRESHOLD)}, true)`)
      return tx
        .select({
          id: customers.id,
          name: customers.name,
          city: customers.city,
          address: customers.address,
          zip: customers.zip,
          email: customers.email,
          phone: gatedPhone,
          pipeline: derivedPipelineSql(),
          score: rank.score,
          matchedOn: rank.matchedOn,
        })
        .from(customers)
        .where(and(permit(ctx, 'read', customerServerSpec).sql, rank.where))
        .orderBy(desc(rank.score), desc(customers.updatedAt))
        .limit(limit)
    })
  })
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-omni-search.ts`
Expected: every line `✓` (the gated case may print `SKIP`), ending `all passing`.
If the typo or cross-field case fails, tune `WORD_SIMILARITY_THRESHOLD` between 0.3 and 0.5 and re-run. Record the chosen value and the reason in the commit message. Do not loosen the test.

- [ ] **Step 8: Lint, type-check, commit**

```bash
pnpm lint && pnpm tsc
git commit -m "feat(search): rank customers by trigram similarity with exact phone, email, house-number and zip signals

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/db/schema/customers.ts src/shared/entities/customers/dal/server/customer-search-rank-sql.ts src/shared/entities/customers/dal/server/search-customers-ranked.ts
```

---

### Task 3: Related readers, search service and router

**Files:**
- Modify: `src/shared/entities/meetings/dal/server/queries.ts` (append; add `desc`, `inArray` to the drizzle import, plus type imports)
- Modify: `src/shared/modules/proposals/core/dal/server/queries.ts` (append; add `desc` to the drizzle import)
- Modify: `src/shared/modules/projects/core/dal/server/queries.ts` (append; import `projectParticipationScope`)
- Create: `src/shared/domains/omni-search/schemas.ts`
- Create: `src/shared/services/search.service.ts`
- Create: `src/trpc/routers/search.router.ts`
- Modify: `src/trpc/routers/app.ts`
- Test: `scripts/tmp-omni-search.ts` (append a section before the summary lines)

**Interfaces:**
- Consumes: `searchCustomersRanked`, `RankedCustomer` (Task 2).
- Produces:
  - `listMeetingsForCustomers(ctx, customerIds: string[], limit: number): Promise<DalReturn<MeetingSearchRow[]>>`, where `MeetingSearchRow = { id, customerId, scheduledFor: string, meetingOutcome: MeetingOutcome, meetingType: MeetingType }`
  - `listProposalsForCustomers(ctx, customerIds, limit): Promise<DalReturn<ProposalSearchRow[]>>`, where `ProposalSearchRow = { id, customerId, label: string, status: ProposalStatus, finalTcpCents: number | null }`
  - `listProjectsForCustomers(ctx, customerIds, limit): Promise<DalReturn<ProjectSearchRow[]>>`, where `ProjectSearchRow = { id, customerId, title: string, address: string | null, city: string }`
  - From `@/shared/domains/omni-search/schemas`: `OMNI_TERM_MIN = 2`, `OMNI_TERM_MAX = 80`, `OMNI_LIMITS = { customers: 5, relatedCustomers: 3, related: 5 }`, `toOmniTerm(raw: string): string | null`, `omniSearchInputSchema`, `omniTargetSchema`, `type OmniTarget`
  - `searchService.omni(ctx, { term }): Promise<DalReturn<OmniSearchResult>>`, where `OmniSearchResult = { customers: (RankedCustomer & { target })[], meetings: (MeetingSearchRow & { customerName, target })[], proposals: (ProposalSearchRow & { customerName, target })[], projects: (ProjectSearchRow & { customerName, target })[], seeAllHref: string }`
  - tRPC: `trpc.searchRouter.omni.queryOptions({ term })`; client type `AppRouterOutputs['searchRouter']['omni']`

- [ ] **Step 1: Write the failing test** — append before the `if (failures.length > 0)` block of `scripts/tmp-omni-search.ts`, and add these imports to the top block:

```ts
import { ROOTS } from '@/shared/config/roots'
import { toOmniTerm } from '@/shared/domains/omni-search/schemas'
import { listProjectsForCustomers } from '@/shared/modules/projects/core/dal/server/queries'
import { searchService } from '@/shared/services/search.service'
```

```ts
// Task 3: term clamp, service, related records
assert.equal(toOmniTerm(' a '), null)
assert.equal(toOmniTerm('  jo\n\tsmith  '), 'jo smith')
assert.equal(toOmniTerm('x'.repeat(200))?.length, 80)
check('toOmniTerm trims, collapses, clamps', true)

const [withRecords] = await db
  .select({ id: customers.id, name: customers.name })
  .from(customers)
  .innerJoin(meetings, eq(meetings.customerId, customers.id))
  .innerJoin(proposals, eq(proposals.meetingId, meetings.id))
  .limit(1)
assert.ok(withRecords, 'no customer with a meeting and a proposal on dev')

const omni = await searchService.omni(SYSTEM_CONTEXT, { term: withRecords.name })
assert.ok(omni.success, 'searchService.omni failed')
const topIds = omni.data.customers.slice(0, 3).map(c => c.id)
check('service returns the customer', omni.data.customers.some(c => c.id === withRecords.id))
check('customer target opens the profile', omni.data.customers.every(c => c.target.kind === 'profile' && c.target.customerId === c.id))
check('meetings found for top customers', omni.data.meetings.length > 0 && omni.data.meetings.every(m => topIds.includes(m.customerId)))
check('meeting target highlights the meeting', omni.data.meetings.every(m => m.target.kind === 'profile' && m.target.defaultTab === 'meetings' && m.target.highlightMeetingId === m.id))
check('proposals found and routed to their page', omni.data.proposals.length > 0 && omni.data.proposals.every(pr => pr.target.kind === 'route' && pr.target.href === ROOTS.dashboard.proposals.byId(pr.id)))
check('related groups capped at 5', [omni.data.meetings, omni.data.proposals, omni.data.projects].every(group => group.length <= 5))
check('see-all link carries the term', omni.data.seeAllHref.includes('pc_q='))

const nobodyOmni = await searchService.omni(nobody, { term: withRecords.name })
check('agent with no meetings gets empty groups', nobodyOmni.success && Object.entries(nobodyOmni.data).every(([key, value]) => key === 'seeAllHref' || (value as unknown[]).length === 0))

const dispatcherOmni = await searchService.omni(ctxFor('00000000-0000-4000-8000-000000000001', 'dispatcher'), { term: withRecords.name })
check('dispatcher search succeeds with no projects', dispatcherOmni.success && dispatcherOmni.data.projects.length === 0)

const userless: ScopedContext = { actor: { ability: defineAbilitiesFor({ id: '00000000-0000-4000-8000-000000000002', role: 'agent' }), userId: null }, scope: null }
const userlessProjects = await listProjectsForCustomers(userless, [withRecords.id], 5)
check('a non-omni context with no user gets no projects', userlessProjects.success && userlessProjects.data.length === 0)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-omni-search.ts`
Expected: FAIL, cannot resolve `@/shared/domains/omni-search/schemas`.

- [ ] **Step 3: Shared contract**

```ts
// src/shared/domains/omni-search/schemas.ts
import type { CustomerProfileTab } from '@/shared/entities/customers/types/profile-modal'

import z from 'zod'

import { PROFILE_TAB_LABELS } from '@/shared/entities/customers/constants/profile-modal'

export const OMNI_TERM_MIN = 2
export const OMNI_TERM_MAX = 80
export const OMNI_LIMITS = { customers: 5, relatedCustomers: 3, related: 5 } as const

/** The term the server sees: trimmed, whitespace collapsed, clamped. `null` when too short to search. */
export function toOmniTerm(raw: string): string | null {
  const term = raw.trim().replace(/\s+/g, ' ').slice(0, OMNI_TERM_MAX).trim()
  return term.length >= OMNI_TERM_MIN ? term : null
}

export const omniSearchInputSchema = z.object({
  term: z.string().trim().min(OMNI_TERM_MIN).max(OMNI_TERM_MAX),
})
export type OmniSearchInput = z.infer<typeof omniSearchInputSchema>

const profileTabs = Object.keys(PROFILE_TAB_LABELS) as [CustomerProfileTab, ...CustomerProfileTab[]]

export const omniTargetSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('profile'),
    customerId: z.string(),
    defaultTab: z.enum(profileTabs).optional(),
    highlightMeetingId: z.string().optional(),
  }),
  z.object({ kind: z.literal('route'), href: z.string().startsWith('/') }),
])
export type OmniTarget = z.infer<typeof omniTargetSchema>
```

- [ ] **Step 4: Meetings reader** — append to `src/shared/entities/meetings/dal/server/queries.ts`; add `desc` and `inArray` to its `drizzle-orm` import, and `import type { MeetingOutcome, MeetingType } from '@/shared/constants/enums/meetings'`. The file already imports `permit` and `db`; import `meetingServerSpec` from `@/shared/entities/meetings/lib/server-spec` if it isn't already imported.

```ts
export interface MeetingSearchRow {
  id: string
  customerId: string
  scheduledFor: string
  meetingOutcome: MeetingOutcome
  meetingType: MeetingType
}

/** The meetings omni search lists under the customers it matched, newest first. */
export async function listMeetingsForCustomers(ctx: ScopedContext, customerIds: string[], limit: number): Promise<DalReturn<MeetingSearchRow[]>> {
  return dalDbOperation(async () => {
    if (customerIds.length === 0) {
      return []
    }
    return db
      .select({
        id: meetings.id,
        customerId: sql<string>`${meetings.customerId}`,
        scheduledFor: meetings.scheduledFor,
        meetingOutcome: meetings.meetingOutcome,
        meetingType: meetings.meetingType,
      })
      .from(meetings)
      .where(and(inArray(meetings.customerId, customerIds), permit(ctx, 'read', meetingServerSpec).sql))
      .orderBy(desc(meetings.scheduledFor))
      .limit(limit)
  })
}
```

- [ ] **Step 5: Proposals reader** — append to `src/shared/modules/proposals/core/dal/server/queries.ts`; add `desc` to its `drizzle-orm` import and `import type { ProposalStatus } from '@/shared/constants/enums/proposals'`.

```ts
export interface ProposalSearchRow {
  id: string
  customerId: string
  label: string
  status: ProposalStatus
  finalTcpCents: number | null
}

/** The proposals omni search lists under the customers it matched, most recently sent first. */
export async function listProposalsForCustomers(ctx: ScopedContext, customerIds: string[], limit: number): Promise<DalReturn<ProposalSearchRow[]>> {
  return dalDbOperation(async () => {
    if (customerIds.length === 0) {
      return []
    }
    return db
      .select({
        id: proposals.id,
        customerId: sql<string>`${meetings.customerId}`,
        label: proposals.label,
        status: proposals.status,
        finalTcpCents: proposals.finalTcpCents,
      })
      .from(proposals)
      .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
      // Joined like listProposals, so the read rules can reach the customer row.
      .leftJoin(customers, eq(customers.id, meetings.customerId))
      .where(and(inArray(meetings.customerId, customerIds), permit(ctx, 'read', proposalServerSpec).sql))
      .orderBy(desc(sql`coalesce(${proposals.sentAt}, ${proposals.createdAt})`))
      .limit(limit)
  })
}
```

- [ ] **Step 6: Projects reader** — append to `src/shared/modules/projects/core/dal/server/queries.ts`; change its visibility import to `import { hasAssociatedMeeting, projectParticipationScope } from '@/shared/modules/projects/core/lib/visibility'`.

```ts
export interface ProjectSearchRow {
  id: string
  customerId: string
  title: string
  address: string | null
  city: string
}

/** The projects omni search lists under the customers it matched. Portfolio-only projects (no meeting) are left out. */
export async function listProjectsForCustomers(ctx: ScopedContext, customerIds: string[], limit: number): Promise<DalReturn<ProjectSearchRow[]>> {
  return dalDbOperation(async () => {
    const { ability, userId } = ctx.actor
    if (customerIds.length === 0 || ability.cannot('read', 'Project')) {
      return []
    }
    const isOmni = ability.can('manage', 'all')
    // Projects are not on compiled rules yet: a non-omni caller is scoped by meeting participation, as projectProcedure does.
    if (!isOmni && !userId) {
      return []
    }
    return db
      .select({
        id: projects.id,
        customerId: sql<string>`${projects.customerId}`,
        title: projects.title,
        address: projects.address,
        city: projects.city,
      })
      .from(projects)
      .where(and(
        inArray(projects.customerId, customerIds),
        hasAssociatedMeeting(),
        isOmni ? undefined : projectParticipationScope(userId!),
      ))
      .orderBy(desc(projects.updatedAt))
      .limit(limit)
  })
}
```

- [ ] **Step 7: Service**

```ts
// src/shared/services/search.service.ts
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { OmniSearchInput, OmniTarget } from '@/shared/domains/omni-search/schemas'
import type { RankedCustomer } from '@/shared/entities/customers/dal/server/search-customers-ranked'
import type { MeetingSearchRow } from '@/shared/entities/meetings/dal/server/queries'
import type { ProjectSearchRow } from '@/shared/modules/projects/core/dal/server/queries'
import type { ProposalSearchRow } from '@/shared/modules/proposals/core/dal/server/queries'

import { ROOTS } from '@/shared/config/roots'
import { makeQueryParsers } from '@/shared/dal/lib/query/url-state'
import { dalSuccess } from '@/shared/dal/server/types'
import { OMNI_LIMITS } from '@/shared/domains/omni-search/schemas'
import { CUSTOMERS_TABLE_QUERY_CONFIG } from '@/shared/entities/customers/constants/customers-table-query-config'
import { searchCustomersRanked } from '@/shared/entities/customers/dal/server/search-customers-ranked'
import { listMeetingsForCustomers } from '@/shared/entities/meetings/dal/server/queries'
import { listProjectsForCustomers } from '@/shared/modules/projects/core/dal/server/queries'
import { listProposalsForCustomers } from '@/shared/modules/proposals/core/dal/server/queries'
import 'server-only'

interface Targeted { target: OmniTarget }
interface WithCustomer { customerName: string }

export interface OmniSearchResult {
  customers: (RankedCustomer & Targeted)[]
  meetings: (MeetingSearchRow & WithCustomer & Targeted)[]
  proposals: (ProposalSearchRow & WithCustomer & Targeted)[]
  projects: (ProjectSearchRow & WithCustomer & Targeted)[]
  /** The customers records page, filtered to the same term. */
  seeAllHref: string
}

function customersPageHref(term: string): string {
  const { searchKey } = makeQueryParsers(CUSTOMERS_TABLE_QUERY_CONFIG.paramPrefix)
  return `${ROOTS.dashboard.customers.root()}?${searchKey}=${encodeURIComponent(term)}`
}

export const searchService = {
  /** Customer-anchored: related records come from the top matches, each read under its own entity's rules. */
  async omni(ctx: ScopedContext, input: OmniSearchInput): Promise<DalReturn<OmniSearchResult>> {
    const ranked = await searchCustomersRanked(ctx, input.term, OMNI_LIMITS.customers)
    if (!ranked.success) {
      return ranked
    }
    const relatedIds = ranked.data.slice(0, OMNI_LIMITS.relatedCustomers).map(customer => customer.id)
    const [meetingRows, proposalRows, projectRows] = await Promise.all([
      listMeetingsForCustomers(ctx, relatedIds, OMNI_LIMITS.related),
      listProposalsForCustomers(ctx, relatedIds, OMNI_LIMITS.related),
      listProjectsForCustomers(ctx, relatedIds, OMNI_LIMITS.related),
    ])
    if (!meetingRows.success) {
      return meetingRows
    }
    if (!proposalRows.success) {
      return proposalRows
    }
    if (!projectRows.success) {
      return projectRows
    }

    const nameById = new Map(ranked.data.map(customer => [customer.id, customer.name]))
    const customerName = (id: string) => nameById.get(id) ?? ''

    return dalSuccess({
      customers: ranked.data.map(customer => ({ ...customer, target: { kind: 'profile', customerId: customer.id } })),
      meetings: meetingRows.data.map(meeting => ({
        ...meeting,
        customerName: customerName(meeting.customerId),
        target: { kind: 'profile', customerId: meeting.customerId, defaultTab: 'meetings', highlightMeetingId: meeting.id },
      })),
      proposals: proposalRows.data.map(proposal => ({
        ...proposal,
        customerName: customerName(proposal.customerId),
        target: { kind: 'route', href: ROOTS.dashboard.proposals.byId(proposal.id) },
      })),
      projects: projectRows.data.map(project => ({
        ...project,
        customerName: customerName(project.customerId),
        target: { kind: 'route', href: ROOTS.dashboard.projects.byId(project.id) },
      })),
      seeAllHref: customersPageHref(input.term),
    })
  },
}
```

- [ ] **Step 8: Router and registration**

```ts
// src/trpc/routers/search.router.ts
import { omniSearchInputSchema } from '@/shared/domains/omni-search/schemas'
import { searchService } from '@/shared/services/search.service'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { agentProcedure, createTRPCRouter } from '../init'

export const searchRouter = createTRPCRouter({
  omni: agentProcedure
    .input(omniSearchInputSchema)
    .query(async ({ ctx, input }) => dalToTrpc(await searchService.omni(ctx, input))),
})
```

In `src/trpc/routers/app.ts`: add `import { searchRouter } from './search.router'` after the `scheduleRouter` import, and `searchRouter,` after `scheduleRouter,` in `createTRPCRouter({ … })`.

- [ ] **Step 9: Run the test to verify it passes**

Run: `NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-omni-search.ts`
Expected: all Task 2 and Task 3 lines `✓`, ending `all passing`.

- [ ] **Step 10: Lint, type-check, commit**

```bash
pnpm lint && pnpm tsc
git commit -m "feat(search): searchRouter.omni — ranked customers plus their meetings, proposals and projects, each under its own read rules

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/entities/meetings/dal/server/queries.ts src/shared/modules/proposals/core/dal/server/queries.ts src/shared/modules/projects/core/dal/server/queries.ts src/shared/domains/omni-search/schemas.ts src/shared/services/search.service.ts src/trpc/routers/search.router.ts src/trpc/routers/app.ts
```

---

### Task 4: One dialog, three entry points, one Action Center

**Files:**
- Modify: `src/shared/components/ui/command.tsx` (`CommandDialog`)
- Create: `src/features/agent-dashboard/hooks/use-dashboard-overlays.ts`
- Create: `src/features/omni-search/constants/copy.ts`
- Create: `src/features/omni-search/ui/components/omni-search-dialog.tsx` (shell; Task 6 fills it)
- Create: `src/features/agent-dashboard/ui/components/dashboard-overlays.tsx`
- Create: `src/features/agent-dashboard/ui/components/dashboard-session-overlays.tsx`
- Modify: `src/app/(frontend)/dashboard/layout.tsx`
- Modify: `src/features/agent-dashboard/ui/components/app-sidebar.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-mobile-nav.tsx`
- Modify: `src/features/agent-dashboard/ui/components/mobile-dock.tsx`
- Modify: `src/features/agent-dashboard/ui/components/mobile-dock-capsule.tsx`
- Modify: `src/features/agent-dashboard/ui/components/sidebar-search-bar.tsx`

**Interfaces:**
- Produces: `useDashboardOverlays` (zustand) with `searchOpen`, `actionCenterOpen`, `setSearchOpen(open)`, `toggleSearch()`, `setActionCenterOpen(open)`; `OmniSearchDialog` (no props); `CommandDialog` accepts `commandProps?: React.ComponentProps<typeof CommandPrimitive>`; `OMNI_COPY`.

- [ ] **Step 1: `CommandDialog` passthrough** — in `src/shared/components/ui/command.tsx`, add `commandProps` to the props type and destructuring, and spread it onto the inner `<Command>`:

```tsx
function CommandDialog({
  title = 'Command Palette',
  description = 'Search for a command to run...',
  children,
  className,
  showCloseButton = true,
  commandProps,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
  commandProps?: React.ComponentProps<typeof CommandPrimitive>
}) {
```
and change the inner element to `<Command {...commandProps} className="…existing classes unchanged…">`.

- [ ] **Step 2: Overlay store**

```ts
// src/features/agent-dashboard/hooks/use-dashboard-overlays.ts
import { create } from 'zustand'

interface DashboardOverlays {
  searchOpen: boolean
  actionCenterOpen: boolean
  setSearchOpen: (open: boolean) => void
  toggleSearch: () => void
  setActionCenterOpen: (open: boolean) => void
}

// The sidebar, the phone dock, ⌘K and the palette's own actions all open these, so the state lives above every one of them.
export const useDashboardOverlays = create<DashboardOverlays>()(set => ({
  searchOpen: false,
  actionCenterOpen: false,
  setSearchOpen: open => set({ searchOpen: open }),
  toggleSearch: () => set(state => ({ searchOpen: !state.searchOpen })),
  setActionCenterOpen: open => set({ actionCenterOpen: open }),
}))
```

- [ ] **Step 3: Copy and dialog shell**

```ts
// src/features/omni-search/constants/copy.ts
export const OMNI_COPY = {
  title: 'Search',
  description: 'Find customers, their records, pages and actions',
  placeholder: 'Search customers, phone, address, pages…',
  pickCustomerPlaceholder: 'Which customer?',
  scheduleMeetingHeading: 'Schedule meeting for…',
  recent: 'Recent',
  goTo: 'Go to',
  actions: 'Actions',
  customers: 'Customers',
  meetings: 'Meetings',
  proposals: 'Proposals',
  projects: 'Projects',
  seeAllCustomers: 'See all in Customers',
  unavailable: 'Search is unavailable, try again',
  noRecords: (term: string) => `No records match “${term}”`,
  comingSoon: 'Results land here in the next step.',
} as const
```

```tsx
// src/features/omni-search/ui/components/omni-search-dialog.tsx
'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import { useDashboardOverlays } from '@/features/agent-dashboard/hooks/use-dashboard-overlays'
import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { CommandDialog, CommandEmpty, CommandInput, CommandList } from '@/shared/components/ui/command'

export function OmniSearchDialog() {
  const open = useDashboardOverlays(state => state.searchOpen)
  const setSearchOpen = useDashboardOverlays(state => state.setSearchOpen)
  const toggleSearch = useDashboardOverlays(state => state.toggleSearch)
  const pathname = usePathname()

  useEffect(() => {
    function onKeydown(event: KeyboardEvent) {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        toggleSearch()
      }
    }
    document.addEventListener('keydown', onKeydown)
    return () => document.removeEventListener('keydown', onKeydown)
  }, [toggleSearch])

  // The store outlives navigation, so Back with the dialog open would otherwise carry it to the next page.
  useEffect(() => {
    useDashboardOverlays.getState().setSearchOpen(false)
  }, [pathname])

  return (
    <CommandDialog
      open={open}
      onOpenChange={setSearchOpen}
      title={OMNI_COPY.title}
      description={OMNI_COPY.description}
      showCloseButton={false}
      commandProps={{ shouldFilter: false, loop: true }}
    >
      <CommandInput placeholder={OMNI_COPY.placeholder} />
      <CommandList>
        <CommandEmpty>{OMNI_COPY.comingSoon}</CommandEmpty>
      </CommandList>
    </CommandDialog>
  )
}
```

- [ ] **Step 4: Overlay host and session wrapper**

```tsx
// src/features/agent-dashboard/ui/components/dashboard-overlays.tsx
'use client'

import { useDashboardOverlays } from '@/features/agent-dashboard/hooks/use-dashboard-overlays'
import { ActionCenterSheet } from '@/features/agent-dashboard/ui/components/action-center-sheet'
import { OmniSearchDialog } from '@/features/omni-search/ui/components/omni-search-dialog'

export function DashboardOverlays() {
  const actionCenterOpen = useDashboardOverlays(state => state.actionCenterOpen)
  const setActionCenterOpen = useDashboardOverlays(state => state.setActionCenterOpen)

  return (
    <>
      <ActionCenterSheet isOpen={actionCenterOpen} onClose={() => setActionCenterOpen(false)} />
      <OmniSearchDialog />
    </>
  )
}
```

```tsx
// src/features/agent-dashboard/ui/components/dashboard-session-overlays.tsx
import { packRules } from '@casl/ability/extra'

import { DashboardOverlays } from '@/features/agent-dashboard/ui/components/dashboard-overlays'
import { AbilityProvider } from '@/shared/domains/permissions/client'
import { getRequestActor } from '@/shared/domains/permissions/server/get-request-actor'

// Mounted once for desktop and phone, so the search dialog and the Action Center have one home whichever control opens them.
export async function DashboardSessionOverlays() {
  const { session, actor } = await getRequestActor()
  if (!session) {
    return null
  }
  return (
    <AbilityProvider user={{ id: session.user.id, role: session.user.role }} rules={packRules(actor.ability.rules)}>
      <DashboardOverlays />
    </AbilityProvider>
  )
}
```

In `src/app/(frontend)/dashboard/layout.tsx`, import `DashboardSessionOverlays` and add, directly after the `DashboardSessionMobileNav` Suspense block:

```tsx
            {hasSessionCookie && (
              <Suspense>
                <DashboardSessionOverlays />
              </Suspense>
            )}
```

- [ ] **Step 5: Move the Action Center to the store**

`app-sidebar.tsx`:
- delete `const [isActionCenterOpen, setIsActionCenterOpen] = useState(false)`, the `<ActionCenterSheet … />` element, and the `ActionCenterSheet` import;
- add `import { useDashboardOverlays } from '@/features/agent-dashboard/hooks/use-dashboard-overlays'` and `const setActionCenterOpen = useDashboardOverlays(state => state.setActionCenterOpen)`;
- the footer button becomes `onClick={() => setActionCenterOpen(true)}`.

`dashboard-mobile-nav.tsx` becomes:

```tsx
'use client'

import { MobileDock } from '@/features/agent-dashboard/ui/components/mobile-dock'

export function DashboardMobileNav() {
  return <MobileDock />
}
```

`mobile-dock.tsx`: remove `MobileDockProps` and the parameter; add the store hook; pass `onSearchClick` to the capsule:

```tsx
export function MobileDock() {
  const ability = useAbility()
  const tabs = useMemo(() => getMobileDockTabs(getSidebarNav(ability)), [ability])
  const isTyping = useIsTyping()
  const { setOpenMobile } = useSidebar()
  const setSearchOpen = useDashboardOverlays(state => state.setSearchOpen)
  …
      <MobileDockCapsule
        tabs={tabs}
        onSearchClick={() => {
          setOpenMobile(false)
          setSearchOpen(true)
        }}
        className="min-w-0 flex-1"
      />
```

`mobile-dock-capsule.tsx`: rename the prop `onActionCenterClick` → `onSearchClick` (interface and destructuring), swap `ZapIcon` for `SearchIcon` in the `lucide-react` import, and change the button to `aria-label="Search"`, `onClick={onSearchClick}`, `<SearchIcon aria-hidden className="size-5" />`. Classes are unchanged.

- [ ] **Step 6: Sidebar search button opens the store** — `sidebar-search-bar.tsx` keeps its button markup exactly; delete the `useState`, the keydown `useEffect`, the `CommandDialog` block and the `command` imports; the button becomes:

```tsx
export function SidebarSearchBar() {
  const setSearchOpen = useDashboardOverlays(state => state.setSearchOpen)
  const { isMobile, setOpenMobile } = useSidebar()

  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <button
          type="button"
          onClick={() => {
            if (isMobile) {
              setOpenMobile(false)
            }
            setSearchOpen(true)
          }}
          aria-label="Search"
          className="…unchanged…"
        >
          …unchanged children…
        </button>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
```
(Add `useSidebar` to the existing `@/shared/components/ui/sidebar` import and import `useDashboardOverlays`.)

- [ ] **Step 7: Verify**

Run `pnpm lint && pnpm tsc` (clean). Then, with the dev server running (check `ss -ltnp` for its port and do not restart someone else's server), sign in through `/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>` and confirm with screenshots:
- 1440×900: ⌘K opens the dialog showing `comingSoon`, and ⌘K again closes it; the sidebar Search button opens it; the sidebar footer Action Center opens the sheet.
- 390×844: the dock's rightmost button shows the search icon and opens the dialog; menu sheet → Action Center opens the sheet.
- Only one Action Center sheet is in the DOM (`document.querySelectorAll('[role="dialog"]').length` with the sheet open is 1).

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(search): one search dialog behind ⌘K, the sidebar button and the dock's right button; Action Center opens from one store

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/components/ui/command.tsx src/features/agent-dashboard/hooks/use-dashboard-overlays.ts src/features/omni-search/constants/copy.ts src/features/omni-search/ui/components/omni-search-dialog.tsx src/features/agent-dashboard/ui/components/dashboard-overlays.tsx src/features/agent-dashboard/ui/components/dashboard-session-overlays.tsx "src/app/(frontend)/dashboard/layout.tsx" src/features/agent-dashboard/ui/components/app-sidebar.tsx src/features/agent-dashboard/ui/components/dashboard-mobile-nav.tsx src/features/agent-dashboard/ui/components/mobile-dock.tsx src/features/agent-dashboard/ui/components/mobile-dock-capsule.tsx src/features/agent-dashboard/ui/components/sidebar-search-bar.tsx
```

---

### Task 5: Features registry

**Files:**
- Create: `src/features/calculators/constants/calculator-tab-meta.ts`
- Modify: `src/features/calculators/ui/views/calculators-view.tsx` (trigger labels)
- Modify: `src/features/agent-dashboard/lib/get-sidebar-nav.ts` (`aliases`)
- Create: `src/features/omni-search/types.ts`
- Create: `src/features/omni-search/lib/build-omni-registry.ts`
- Create: `src/features/omni-search/lib/rank-omni-entries.ts`
- Test: `scripts/tmp-omni-registry.ts`

**Interfaces:**
- Consumes: `getSidebarNav(ability)`, `calculatorTabParser`/`CALCULATOR_TABS`, `analyticsSearchParams.tab`/`ANALYTICS_TABS`/`TAB_LABELS`, `scheduleShowParser`/`SCHEDULE_SHOW_VALUES`/`SCHEDULE_SHOW_LABELS`, `ROOTS`.
- Produces:
  - `type OmniActionId = 'toggle-theme' | 'action-center' | 'sign-out' | 'schedule-meeting'`
  - `type OmniMode = 'root' | 'schedule-meeting'`
  - `type OmniEntry = { id: string, label: string, parent?: string, aliases: readonly string[], icon: LucideIcon, group: 'go-to' | 'actions', featured?: boolean } & ({ href: string } | { action: OmniActionId })`
  - `buildOmniRegistry(ability: AppAbility): OmniEntry[]`
  - `rankOmniEntries(entries: OmniEntry[], search: string): { entry: OmniEntry, score: number }[]` (empty search → featured entries, score 0)
  - `CALCULATOR_TAB_META: Record<CalculatorTab, { label: string, aliases: readonly string[] }>`, `calculatorTabHref(tab): string`

- [ ] **Step 1: Write the failing test**

```ts
// scripts/tmp-omni-registry.ts
import assert from 'node:assert/strict'

import { buildOmniRegistry } from '@/features/omni-search/lib/build-omni-registry'
import { rankOmniEntries } from '@/features/omni-search/lib/rank-omni-entries'
import { ROOTS } from '@/shared/config/roots'
import { userRoles } from '@/shared/constants/enums/user'
import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'

const ability = (role: (typeof userRoles)[number]) => defineAbilitiesFor({ id: '00000000-0000-4000-8000-000000000000', role })
const top = (role: (typeof userRoles)[number], search: string) => rankOmniEntries(buildOmniRegistry(ability(role)), search)[0]?.entry.id

assert.equal(top('super-admin', 'roi'), 'calculator:remodel-roi')
assert.equal(top('super-admin', 'scope pricing'), 'calculator:scope-pricing')
assert.equal(top('super-admin', 'calendar'), `page:${ROOTS.dashboard.schedule()}`)
assert.equal(top('super-admin', 'dark'), 'action:toggle-theme')
assert.equal(top('super-admin', 'logout'), 'action:sign-out')
assert.equal(top('super-admin', 'sales analytics'), 'analytics:sales')

const agentEntries = buildOmniRegistry(ability('agent'))
assert.ok(!agentEntries.some(e => e.id.startsWith('analytics:') || ('href' in e && e.href === ROOTS.dashboard.analytics())), 'agent sees analytics')

for (const role of ['super-admin', 'agent', 'dispatcher'] as const) {
  const entries = buildOmniRegistry(ability(role))
  const can = ability(role)
  assert.equal(new Set(entries.map(e => e.id)).size, entries.length, `${role}: duplicate ids`)
  assert.ok(entries.every(e => !('href' in e) || e.href.startsWith(ROOTS.dashboard.root)), `${role}: href outside the dashboard`)
  assert.equal(entries.some(e => e.id === 'action:new-proposal'), can.can('create', 'Proposal'), `${role}: new proposal gating`)
  assert.equal(entries.some(e => e.id === 'action:new-project'), can.can('create', 'Project'), `${role}: new project gating`)
  assert.equal(entries.some(e => e.id === 'action:schedule-meeting'), can.can('create', 'Meeting'), `${role}: schedule gating`)
  assert.ok(rankOmniEntries(entries, '').every(r => r.entry.featured), `${role}: empty search shows only featured`)
}
console.log('✓ registry cases')
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm tsx scripts/tmp-omni-registry.ts`
Expected: FAIL, cannot resolve `build-omni-registry`.

- [ ] **Step 3: Calculator meta and view**

```ts
// src/features/calculators/constants/calculator-tab-meta.ts
import type { CalculatorTab } from '@/features/calculators/constants/query-parsers'

import { createSerializer } from 'nuqs'

import { calculatorTabParser } from '@/features/calculators/constants/query-parsers'
import { ROOTS } from '@/shared/config/roots'

export const CALCULATOR_TAB_META: Record<CalculatorTab, { label: string, aliases: readonly string[] }> = {
  'remodel-roi': { label: 'Remodel ROI', aliases: ['roi', 'return', 'payback', 'resale value', 'home value'] },
  'scope-pricing': { label: 'Scope Pricing', aliases: ['price', 'pricing', 'estimate', 'quote', 'cost'] },
}

const serializeCalculatorUrl = createSerializer({ tab: calculatorTabParser })

export function calculatorTabHref(tab: CalculatorTab): string {
  return serializeCalculatorUrl(ROOTS.dashboard.calculators(), { tab })
}
```

In `calculators-view.tsx`, import `CALCULATOR_TAB_META` and replace the two trigger texts with `{CALCULATOR_TAB_META['remodel-roi'].label}` and `{CALCULATOR_TAB_META['scope-pricing'].label}`.

- [ ] **Step 4: Nav aliases** — in `get-sidebar-nav.ts`, add `aliases?: readonly string[]` to `SidebarNavItem` and set:

| Item | aliases |
|---|---|
| Dashboard | `['home', 'today']` |
| Pipeline | `['board', 'kanban', 'leads', 'deals']` |
| Schedule | `['calendar', 'appointments', 'agenda']` |
| Calculators | `['calc', 'calculator']` |
| Customers | `['clients', 'homeowners', 'contacts']` |
| Meetings | `['visits', 'appointments']` |
| Proposals | `['quotes', 'estimates', 'bids']` |
| Projects | `['jobs', 'portfolio']` |
| Lead Sources | `['sources', 'marketing']` |
| Campaigns | `['dialer', 'voip', 'calls']` |
| Analytics | `['reports', 'stats', 'metrics']` |
| Settings | `['preferences', 'account', 'profile']` |

- [ ] **Step 5: Types**

```ts
// src/features/omni-search/types.ts
import type { LucideIcon } from 'lucide-react'

import type { OmniTarget } from '@/shared/domains/omni-search/schemas'

export type OmniActionId = 'toggle-theme' | 'action-center' | 'sign-out' | 'schedule-meeting'
export type OmniMode = 'root' | 'schedule-meeting'
export type OmniEntryGroup = 'go-to' | 'actions'

interface OmniEntryBase {
  id: string
  label: string
  /** Shown beside the label and matched like an alias, e.g. "Calculators". */
  parent?: string
  aliases: readonly string[]
  icon: LucideIcon
  group: OmniEntryGroup
  /** Listed before anything is typed. */
  featured?: boolean
}

export type OmniEntry = OmniEntryBase & ({ href: string } | { action: OmniActionId })

export interface RankedOmniEntry {
  entry: OmniEntry
  score: number
}

export type OmniRecordKind = 'customer' | 'meeting' | 'proposal' | 'project'

export interface RecentOmniItem {
  key: string
  kind: OmniRecordKind
  label: string
  sublabel?: string
  target: OmniTarget
}

export interface OmniPickedCustomer {
  id: string
  name: string
}
```

- [ ] **Step 6: Registry**

```ts
// src/features/omni-search/lib/build-omni-registry.ts
import type { SidebarNavItem } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import type { OmniEntry } from '@/features/omni-search/types'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { CalendarPlusIcon, FilePlusIcon, FolderPlusIcon, LogOutIcon, MoonIcon, ZapIcon } from 'lucide-react'
import { createSerializer } from 'nuqs'

import { getSidebarNav } from '@/features/agent-dashboard/lib/get-sidebar-nav'
import { analyticsSearchParams } from '@/features/analytics/constants/query-parsers'
import { ANALYTICS_TABS, TAB_LABELS } from '@/features/analytics/constants/tabs'
import { CALCULATOR_TAB_META, calculatorTabHref } from '@/features/calculators/constants/calculator-tab-meta'
import { CALCULATOR_TABS } from '@/features/calculators/constants/query-parsers'
import { scheduleShowParser } from '@/features/schedule-management/constants/query-parsers'
import { SCHEDULE_SHOW_LABELS, SCHEDULE_SHOW_VALUES } from '@/features/schedule-management/constants/schedule-queries'
import { ROOTS } from '@/shared/config/roots'

const serializeAnalyticsUrl = createSerializer({ tab: analyticsSearchParams.tab })
const serializeScheduleUrl = createSerializer({ show: scheduleShowParser })

const FEATURED_PAGES = new Set<string>([
  ROOTS.dashboard.root,
  ROOTS.dashboard.pipeline(),
  ROOTS.dashboard.schedule(),
  ROOTS.dashboard.customers.root(),
  ROOTS.dashboard.calculators(),
])

function pageEntry(item: SidebarNavItem): OmniEntry {
  return {
    id: `page:${item.href}`,
    label: item.label,
    aliases: item.aliases ?? [],
    icon: item.icon,
    group: 'go-to',
    href: item.href,
    featured: FEATURED_PAGES.has(item.href),
  }
}

/** Every destination and action this user may reach, from the same nav config and URL parsers the pages use. */
export function buildOmniRegistry(ability: AppAbility): OmniEntry[] {
  const nav = getSidebarNav(ability)
  const pages = [nav.dashboardItem, ...nav.mainItems, ...nav.recordsItems, ...nav.adminItems, nav.settingsItem].filter(item => item.enabled)
  const entries: OmniEntry[] = pages.map(pageEntry)

  const pipeline = pages.find(item => item.href === ROOTS.dashboard.pipeline())
  if (pipeline) {
    for (const child of pipeline.children ?? []) {
      entries.push({ id: `pipeline:${child.key}`, label: `${child.label} pipeline`, parent: pipeline.label, aliases: ['board'], icon: pipeline.icon, group: 'go-to', href: child.href })
    }
  }

  const calculators = pages.find(item => item.href === ROOTS.dashboard.calculators())
  if (calculators) {
    for (const tab of CALCULATOR_TABS) {
      const meta = CALCULATOR_TAB_META[tab]
      entries.push({ id: `calculator:${tab}`, label: `${meta.label} calculator`, parent: calculators.label, aliases: meta.aliases, icon: calculators.icon, group: 'go-to', href: calculatorTabHref(tab) })
    }
  }

  const analytics = pages.find(item => item.href === ROOTS.dashboard.analytics())
  if (analytics) {
    for (const tab of ANALYTICS_TABS) {
      entries.push({ id: `analytics:${tab}`, label: `${TAB_LABELS[tab]} analytics`, parent: analytics.label, aliases: [], icon: analytics.icon, group: 'go-to', href: serializeAnalyticsUrl(ROOTS.dashboard.analytics(), { tab }) })
    }
  }

  const schedule = pages.find(item => item.href === ROOTS.dashboard.schedule())
  if (schedule) {
    for (const show of SCHEDULE_SHOW_VALUES) {
      entries.push({ id: `schedule:${show}`, label: `Schedule · ${SCHEDULE_SHOW_LABELS[show]}`, parent: schedule.label, aliases: [], icon: schedule.icon, group: 'go-to', href: serializeScheduleUrl(ROOTS.dashboard.schedule(), { show }) })
    }
  }

  if (ability.can('create', 'Meeting')) {
    entries.push({ id: 'action:schedule-meeting', label: 'Schedule meeting…', aliases: ['book', 'appointment', 'new meeting'], icon: CalendarPlusIcon, group: 'actions', action: 'schedule-meeting', featured: true })
  }
  if (ability.can('create', 'Proposal')) {
    entries.push({ id: 'action:new-proposal', label: 'New proposal', aliases: ['create proposal', 'quote', 'estimate'], icon: FilePlusIcon, group: 'actions', href: ROOTS.dashboard.proposals.new() })
  }
  if (ability.can('create', 'Project')) {
    entries.push({ id: 'action:new-project', label: 'New project', aliases: ['create project', 'job'], icon: FolderPlusIcon, group: 'actions', href: ROOTS.dashboard.projects.new() })
  }
  entries.push(
    { id: 'action:toggle-theme', label: 'Toggle dark mode', aliases: ['theme', 'dark', 'light', 'night'], icon: MoonIcon, group: 'actions', action: 'toggle-theme' },
    { id: 'action:action-center', label: 'Open Action Center', aliases: ['tasks', 'follow ups', 'queue'], icon: ZapIcon, group: 'actions', action: 'action-center' },
    { id: 'action:sign-out', label: 'Sign out', aliases: ['log out', 'logout'], icon: LogOutIcon, group: 'actions', action: 'sign-out' },
  )
  return entries
}
```

- [ ] **Step 7: Ranking**

```ts
// src/features/omni-search/lib/rank-omni-entries.ts
import type { OmniEntry, RankedOmniEntry } from '@/features/omni-search/types'

import { defaultFilter } from 'cmdk'

export function rankOmniEntries(entries: OmniEntry[], search: string): RankedOmniEntry[] {
  const term = search.trim()
  if (!term) {
    return entries.filter(entry => entry.featured).map(entry => ({ entry, score: 0 }))
  }
  return entries
    .map(entry => ({ entry, score: defaultFilter(entry.label, term, [...entry.aliases, ...(entry.parent ? [entry.parent] : [])]) }))
    .filter(ranked => ranked.score > 0)
    .sort((a, b) => b.score - a.score)
}
```

- [ ] **Step 8: Run the test to verify it passes**

Run: `pnpm tsx scripts/tmp-omni-registry.ts`
Expected: `✓ registry cases`. If a "top" assertion picks a near neighbour (e.g. "calendar" ranks "Schedule · Meetings" first), fix it with aliases, not by loosening the assertion.

- [ ] **Step 9: Lint, type-check, commit**

```bash
pnpm lint && pnpm tsc
git commit -m "feat(search): omni registry — pages, pipelines, calculator, analytics and schedule deep links, and gated global actions

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/calculators/constants/calculator-tab-meta.ts src/features/calculators/ui/views/calculators-view.tsx src/features/agent-dashboard/lib/get-sidebar-nav.ts src/features/omni-search/types.ts src/features/omni-search/lib/build-omni-registry.ts src/features/omni-search/lib/rank-omni-entries.ts
```

---

### Task 6: Results, recents, actions and pick-then-act

**Files:**
- Create: `src/features/omni-search/constants/omni-search.ts`
- Create: `src/features/omni-search/lib/recent-omni-items.ts`
- Create: `src/features/omni-search/hooks/use-omni-search-query.ts`
- Create: `src/features/omni-search/hooks/use-open-omni-target.ts`
- Create: `src/features/omni-search/hooks/use-omni-actions.ts`
- Create: `src/features/omni-search/ui/components/omni-customer-item.tsx`, `omni-meeting-item.tsx`, `omni-proposal-item.tsx`, `omni-project-item.tsx`
- Create: `src/features/omni-search/ui/components/omni-record-groups.tsx`, `omni-entry-groups.tsx`, `omni-recent-group.tsx`
- Create: `src/features/omni-search/ui/components/omni-search-results.tsx`, `omni-search-panel.tsx`
- Modify: `src/features/omni-search/ui/components/omni-search-dialog.tsx`
- Modify: `src/features/omni-search/constants/copy.ts` (drop `comingSoon`)

**Interfaces:**
- Consumes: `trpc.searchRouter.omni` and `AppRouterOutputs['searchRouter']['omni']` (Task 3); `buildOmniRegistry`, `rankOmniEntries`, types (Task 5); `useDashboardOverlays`, `OMNI_COPY` (Task 4); `toOmniTerm`, `omniTargetSchema`, `OMNI_TERM_MAX`, `OMNI_LIMITS` (Task 3).
- Produces: the finished dialog. No exports consumed elsewhere.

- [ ] **Step 1: Constants and recents**

```ts
// src/features/omni-search/constants/omni-search.ts
import { FileTextIcon, HandshakeIcon, ImageIcon, UsersRoundIcon } from 'lucide-react'

export const OMNI_DEBOUNCE_MS = 150
export const OMNI_STALE_MS = 30_000
export const OMNI_ENTRY_CAP = 6

// Same icons as the sidebar's records group, so a result reads as the page it belongs to.
export const OMNI_RECORD_ICONS = {
  customer: UsersRoundIcon,
  meeting: HandshakeIcon,
  proposal: FileTextIcon,
  project: ImageIcon,
} as const
```

```ts
// src/features/omni-search/lib/recent-omni-items.ts
import type { RecentOmniItem } from '@/features/omni-search/types'

import z from 'zod'

import { omniTargetSchema } from '@/shared/domains/omni-search/schemas'

const STORAGE_KEY = 'omni-search.recent'
const MAX_RECENT = 5

const recentSchema = z.array(z.object({
  key: z.string(),
  kind: z.enum(['customer', 'meeting', 'proposal', 'project']),
  label: z.string(),
  sublabel: z.string().optional(),
  target: omniTargetSchema,
})).catch([])

// Storage can be missing or throw (private window, blocked site data); losing the list costs nothing.
export function readRecentOmniItems(): RecentOmniItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? recentSchema.parse(JSON.parse(raw)).slice(0, MAX_RECENT) : []
  }
  catch {
    return []
  }
}

export function pushRecentOmniItem(item: RecentOmniItem): void {
  try {
    const next = [item, ...readRecentOmniItems().filter(existing => existing.key !== item.key)].slice(0, MAX_RECENT)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }
  catch {}
}
```

- [ ] **Step 2: Hooks**

```ts
// src/features/omni-search/hooks/use-omni-search-query.ts
import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { OMNI_DEBOUNCE_MS, OMNI_STALE_MS } from '@/features/omni-search/constants/omni-search'
import { toOmniTerm } from '@/shared/domains/omni-search/schemas'
import { useDebounce } from '@/shared/hooks/use-debounce'
import { useTRPC } from '@/trpc/helpers'

export function useOmniSearchQuery(search: string) {
  const trpc = useTRPC()
  const term = toOmniTerm(useDebounce(search, OMNI_DEBOUNCE_MS))
  return useQuery({
    ...trpc.searchRouter.omni.queryOptions({ term: term ?? '' }),
    enabled: term !== null,
    staleTime: OMNI_STALE_MS,
    placeholderData: keepPreviousData,
  })
}
```

```ts
// src/features/omni-search/hooks/use-open-omni-target.ts
import type { OmniTarget } from '@/shared/domains/omni-search/schemas'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { openModal } from '@/shared/lib/open-modal'

export function useOpenOmniTarget() {
  const router = useRouter()
  return useCallback((target: OmniTarget) => {
    if (target.kind === 'route') {
      router.push(target.href)
      return
    }
    openModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId: target.customerId, defaultTab: target.defaultTab, highlightMeetingId: target.highlightMeetingId },
    })
  }, [router])
}
```

```ts
// src/features/omni-search/hooks/use-omni-actions.ts
import type { OmniActionId } from '@/features/omni-search/types'

import { useCallback } from 'react'

import { useDashboardOverlays } from '@/features/agent-dashboard/hooks/use-dashboard-overlays'
import { useThemeTransition } from '@/features/agent-dashboard/hooks/use-theme-transition'
import { signOut } from '@/shared/domains/auth/client'

/** Actions that finish in one step. `schedule-meeting` is a mode, handled by the results. */
export function useOmniActions() {
  const { isDark, switchTheme } = useThemeTransition()
  const setActionCenterOpen = useDashboardOverlays(state => state.setActionCenterOpen)

  return useCallback((action: Exclude<OmniActionId, 'schedule-meeting'>) => {
    switch (action) {
      case 'toggle-theme':
        switchTheme(isDark ? 'light' : 'dark', null)
        return
      case 'action-center':
        setActionCenterOpen(true)
        return
      case 'sign-out':
        void signOut({ fetchOptions: { onSuccess: () => window.location.assign('/') } })
    }
  }, [isDark, switchTheme, setActionCenterOpen])
}
```

- [ ] **Step 3: Row components** — each row is a `CommandItem` whose `onSelect` hands back the recent-item form of itself.

```tsx
// src/features/omni-search/ui/components/omni-customer-item.tsx
'use client'

import type { RecentOmniItem } from '@/features/omni-search/types'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { OMNI_RECORD_ICONS } from '@/features/omni-search/constants/omni-search'
import { CommandItem } from '@/shared/components/ui/command'
import { PIPELINE_LABELS } from '@/shared/domains/pipelines/constants/pipeline-registry'

type OmniCustomer = AppRouterOutputs['searchRouter']['omni']['customers'][number]

function matchExcerpt(customer: OmniCustomer): string | null {
  switch (customer.matchedOn) {
    case 'phone': return customer.phone ? `···${customer.phone.slice(-4)}` : null
    case 'address': return customer.address ?? customer.zip
    case 'email': return customer.email
    case 'name': return null
  }
}

interface Props {
  customer: OmniCustomer
  onSelect: (item: RecentOmniItem) => void
}

export function OmniCustomerItem({ customer, onSelect }: Props) {
  const Icon = OMNI_RECORD_ICONS.customer
  const excerpt = matchExcerpt(customer)
  return (
    <CommandItem
      value={`customer:${customer.id}`}
      onSelect={() => onSelect({ key: `customer:${customer.id}`, kind: 'customer', label: customer.name, sublabel: customer.city, target: customer.target })}
    >
      <Icon aria-hidden className="text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-foreground">{customer.name}</span>
        <span className="text-muted-foreground">{` · ${customer.city}`}</span>
      </span>
      {excerpt && <span className="shrink-0 rounded border border-border px-1.5 text-xs text-muted-foreground">{excerpt}</span>}
      <span className="shrink-0 text-xs text-muted-foreground">{PIPELINE_LABELS[customer.pipeline]}</span>
    </CommandItem>
  )
}
```

```tsx
// src/features/omni-search/ui/components/omni-meeting-item.tsx
'use client'

import type { RecentOmniItem } from '@/features/omni-search/types'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { OMNI_RECORD_ICONS } from '@/features/omni-search/constants/omni-search'
import { CommandItem } from '@/shared/components/ui/command'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { formatMeetingShortStamp } from '@/shared/lib/formatters'

type OmniMeeting = AppRouterOutputs['searchRouter']['omni']['meetings'][number]

interface Props {
  meeting: OmniMeeting
  onSelect: (item: RecentOmniItem) => void
}

export function OmniMeetingItem({ meeting, onSelect }: Props) {
  const Icon = OMNI_RECORD_ICONS.meeting
  const when = formatMeetingShortStamp(meeting.scheduledFor)
  return (
    <CommandItem
      value={`meeting:${meeting.id}`}
      onSelect={() => onSelect({ key: `meeting:${meeting.id}`, kind: 'meeting', label: meeting.customerName, sublabel: when, target: meeting.target })}
    >
      <Icon aria-hidden className="text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        <span className="text-foreground">{meeting.customerName}</span>
        <span className="text-muted-foreground">{` · ${when}`}</span>
      </span>
      <span className="shrink-0 text-xs text-muted-foreground">{MEETING_OUTCOME_LABELS[meeting.meetingOutcome]}</span>
    </CommandItem>
  )
}
```

```tsx
// src/features/omni-search/ui/components/omni-proposal-item.tsx
'use client'

import type { RecentOmniItem } from '@/features/omni-search/types'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { OMNI_RECORD_ICONS } from '@/features/omni-search/constants/omni-search'
import { CommandItem } from '@/shared/components/ui/command'
import { formatAsDollars } from '@/shared/lib/formatters'

type OmniProposal = AppRouterOutputs['searchRouter']['omni']['proposals'][number]

interface Props {
  proposal: OmniProposal
  onSelect: (item: RecentOmniItem) => void
}

export function OmniProposalItem({ proposal, onSelect }: Props) {
  const Icon = OMNI_RECORD_ICONS.proposal
  return (
    <CommandItem
      value={`proposal:${proposal.id}`}
      onSelect={() => onSelect({ key: `proposal:${proposal.id}`, kind: 'proposal', label: proposal.label, sublabel: proposal.customerName, target: proposal.target })}
    >
      <Icon aria-hidden className="text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        <span className="text-foreground">{proposal.label}</span>
        <span className="text-muted-foreground">{` · ${proposal.customerName}`}</span>
      </span>
      {proposal.finalTcpCents !== null && <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{formatAsDollars(proposal.finalTcpCents / 100)}</span>}
      <span className="shrink-0 text-xs text-muted-foreground capitalize">{proposal.status}</span>
    </CommandItem>
  )
}
```

```tsx
// src/features/omni-search/ui/components/omni-project-item.tsx
'use client'

import type { RecentOmniItem } from '@/features/omni-search/types'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { OMNI_RECORD_ICONS } from '@/features/omni-search/constants/omni-search'
import { CommandItem } from '@/shared/components/ui/command'

type OmniProject = AppRouterOutputs['searchRouter']['omni']['projects'][number]

interface Props {
  project: OmniProject
  onSelect: (item: RecentOmniItem) => void
}

export function OmniProjectItem({ project, onSelect }: Props) {
  const Icon = OMNI_RECORD_ICONS.project
  return (
    <CommandItem
      value={`project:${project.id}`}
      onSelect={() => onSelect({ key: `project:${project.id}`, kind: 'project', label: project.title, sublabel: project.customerName, target: project.target })}
    >
      <Icon aria-hidden className="text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        <span className="text-foreground">{project.title}</span>
        <span className="text-muted-foreground">{` · ${project.customerName}`}</span>
      </span>
      <span className="shrink-0 truncate text-xs text-muted-foreground">{project.address ?? project.city}</span>
    </CommandItem>
  )
}
```

- [ ] **Step 4: Groups**

```tsx
// src/features/omni-search/ui/components/omni-record-groups.tsx
'use client'

import type { RecentOmniItem } from '@/features/omni-search/types'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { ArrowRightIcon } from 'lucide-react'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OmniCustomerItem } from '@/features/omni-search/ui/components/omni-customer-item'
import { OmniMeetingItem } from '@/features/omni-search/ui/components/omni-meeting-item'
import { OmniProjectItem } from '@/features/omni-search/ui/components/omni-project-item'
import { OmniProposalItem } from '@/features/omni-search/ui/components/omni-proposal-item'
import { CommandGroup, CommandItem } from '@/shared/components/ui/command'
import { OMNI_LIMITS } from '@/shared/domains/omni-search/schemas'

interface Props {
  data: AppRouterOutputs['searchRouter']['omni']
  onSelectRecord: (item: RecentOmniItem) => void
  onSeeAll: (href: string) => void
}

export function OmniRecordGroups({ data, onSelectRecord, onSeeAll }: Props) {
  return (
    <>
      {data.customers.length > 0 && (
        <CommandGroup heading={OMNI_COPY.customers}>
          {data.customers.map(customer => <OmniCustomerItem key={customer.id} customer={customer} onSelect={onSelectRecord} />)}
          {data.customers.length >= OMNI_LIMITS.customers && (
            <CommandItem value="customers:see-all" onSelect={() => onSeeAll(data.seeAllHref)}>
              <ArrowRightIcon aria-hidden className="text-muted-foreground" />
              <span className="text-muted-foreground">{OMNI_COPY.seeAllCustomers}</span>
            </CommandItem>
          )}
        </CommandGroup>
      )}
      {data.meetings.length > 0 && (
        <CommandGroup heading={OMNI_COPY.meetings}>
          {data.meetings.map(meeting => <OmniMeetingItem key={meeting.id} meeting={meeting} onSelect={onSelectRecord} />)}
        </CommandGroup>
      )}
      {data.proposals.length > 0 && (
        <CommandGroup heading={OMNI_COPY.proposals}>
          {data.proposals.map(proposal => <OmniProposalItem key={proposal.id} proposal={proposal} onSelect={onSelectRecord} />)}
        </CommandGroup>
      )}
      {data.projects.length > 0 && (
        <CommandGroup heading={OMNI_COPY.projects}>
          {data.projects.map(project => <OmniProjectItem key={project.id} project={project} onSelect={onSelectRecord} />)}
        </CommandGroup>
      )}
    </>
  )
}
```

```tsx
// src/features/omni-search/ui/components/omni-entry-groups.tsx
'use client'

import type { OmniEntry, RankedOmniEntry } from '@/features/omni-search/types'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_ENTRY_CAP } from '@/features/omni-search/constants/omni-search'
import { CommandGroup, CommandItem } from '@/shared/components/ui/command'

interface Props {
  ranked: RankedOmniEntry[]
  onSelect: (entry: OmniEntry) => void
}

export function OmniEntryGroups({ ranked, onSelect }: Props) {
  const groups = [
    { heading: OMNI_COPY.goTo, entries: ranked.filter(r => r.entry.group === 'go-to') },
    { heading: OMNI_COPY.actions, entries: ranked.filter(r => r.entry.group === 'actions') },
  ]
  return groups.map(group => group.entries.length > 0 && (
    <CommandGroup key={group.heading} heading={group.heading}>
      {group.entries.slice(0, OMNI_ENTRY_CAP).map(({ entry }) => (
        <CommandItem key={entry.id} value={entry.id} onSelect={() => onSelect(entry)}>
          <entry.icon aria-hidden className="text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-foreground">{entry.label}</span>
          {entry.parent && <span className="shrink-0 text-xs text-muted-foreground">{entry.parent}</span>}
        </CommandItem>
      ))}
    </CommandGroup>
  ))
}
```

```tsx
// src/features/omni-search/ui/components/omni-recent-group.tsx
'use client'

import type { RecentOmniItem } from '@/features/omni-search/types'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_RECORD_ICONS } from '@/features/omni-search/constants/omni-search'
import { CommandGroup, CommandItem } from '@/shared/components/ui/command'

interface Props {
  items: RecentOmniItem[]
  onSelect: (item: RecentOmniItem) => void
}

export function OmniRecentGroup({ items, onSelect }: Props) {
  if (items.length === 0) {
    return null
  }
  return (
    <CommandGroup heading={OMNI_COPY.recent}>
      {items.map((item) => {
        const Icon = OMNI_RECORD_ICONS[item.kind]
        return (
          <CommandItem key={item.key} value={`recent:${item.key}`} onSelect={() => onSelect(item)}>
            <Icon aria-hidden className="text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate text-foreground">{item.label}</span>
            {item.sublabel && <span className="shrink-0 text-xs text-muted-foreground">{item.sublabel}</span>}
          </CommandItem>
        )
      })}
    </CommandGroup>
  )
}
```

- [ ] **Step 5: Results (order and states)**

```tsx
// src/features/omni-search/ui/components/omni-search-results.tsx
'use client'

import type { OmniEntry, OmniMode, OmniPickedCustomer, RecentOmniItem } from '@/features/omni-search/types'

import { useMemo, useState } from 'react'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { useOmniActions } from '@/features/omni-search/hooks/use-omni-actions'
import { useOmniSearchQuery } from '@/features/omni-search/hooks/use-omni-search-query'
import { useOpenOmniTarget } from '@/features/omni-search/hooks/use-open-omni-target'
import { buildOmniRegistry } from '@/features/omni-search/lib/build-omni-registry'
import { rankOmniEntries } from '@/features/omni-search/lib/rank-omni-entries'
import { pushRecentOmniItem, readRecentOmniItems } from '@/features/omni-search/lib/recent-omni-items'
import { OmniCustomerItem } from '@/features/omni-search/ui/components/omni-customer-item'
import { OmniEntryGroups } from '@/features/omni-search/ui/components/omni-entry-groups'
import { OmniRecentGroup } from '@/features/omni-search/ui/components/omni-recent-group'
import { OmniRecordGroups } from '@/features/omni-search/ui/components/omni-record-groups'
import { CommandGroup, CommandItem } from '@/shared/components/ui/command'
import { toOmniTerm } from '@/shared/domains/omni-search/schemas'
import { useAbility } from '@/shared/domains/permissions/client'

interface Props {
  search: string
  mode: OmniMode
  onDone: () => void
  onEnterMode: (mode: OmniMode) => void
  onPickCustomer: (customer: OmniPickedCustomer) => void
}

export function OmniSearchResults({ search, mode, onDone, onEnterMode, onPickCustomer }: Props) {
  const ability = useAbility()
  const registry = useMemo(() => buildOmniRegistry(ability), [ability])
  const [recent] = useState(readRecentOmniItems)
  const query = useOmniSearchQuery(search)
  const openTarget = useOpenOmniTarget()
  const runAction = useOmniActions()

  // The instant term, not the debounced one, decides visibility, so clearing the input hides stale records at once.
  const term = toOmniTerm(search)
  const data = term ? query.data : undefined
  const isEmpty = !!data && data.customers.length + data.meetings.length + data.proposals.length + data.projects.length === 0
  const progress = term && query.isFetching && <div aria-hidden className="h-0.5 w-full animate-pulse bg-primary/60" />
  const failed = term && query.isError && !data && (
    <CommandGroup>
      <CommandItem value="search:unavailable" disabled>{OMNI_COPY.unavailable}</CommandItem>
    </CommandGroup>
  )

  if (mode === 'schedule-meeting') {
    return (
      <>
        {progress}
        {failed}
        <CommandGroup heading={OMNI_COPY.scheduleMeetingHeading}>
          {(data?.customers ?? []).map(customer => (
            <OmniCustomerItem key={customer.id} customer={customer} onSelect={() => onPickCustomer({ id: customer.id, name: customer.name })} />
          ))}
        </CommandGroup>
      </>
    )
  }

  function selectRecord(item: RecentOmniItem) {
    pushRecentOmniItem(item)
    onDone()
    openTarget(item.target)
  }

  function selectEntry(entry: OmniEntry) {
    if ('href' in entry) {
      onDone()
      openTarget({ kind: 'route', href: entry.href })
      return
    }
    if (entry.action === 'schedule-meeting') {
      onEnterMode('schedule-meeting')
      return
    }
    onDone()
    runAction(entry.action)
  }

  function seeAll(href: string) {
    onDone()
    openTarget({ kind: 'route', href })
  }

  const ranked = rankOmniEntries(registry, search)
  const entries = <OmniEntryGroups ranked={ranked} onSelect={selectEntry} />
  const records = data && <OmniRecordGroups data={data} onSelectRecord={selectRecord} onSeeAll={seeAll} />
  const entriesFirst = (ranked[0]?.score ?? 0) > (data?.customers[0]?.score ?? 0)

  return (
    <>
      {progress}
      {!search.trim() && <OmniRecentGroup items={recent} onSelect={selectRecord} />}
      {failed}
      {isEmpty && !query.isFetching && term && <p className="px-3 py-2 text-sm text-muted-foreground">{OMNI_COPY.noRecords(term)}</p>}
      {entriesFirst ? <>{entries}{records}</> : <>{records}{entries}</>}
    </>
  )
}
```

- [ ] **Step 6: Panel and dialog**

```tsx
// src/features/omni-search/ui/components/omni-search-panel.tsx
'use client'

import type { OmniMode, OmniPickedCustomer } from '@/features/omni-search/types'

import { useState } from 'react'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OmniSearchResults } from '@/features/omni-search/ui/components/omni-search-results'
import { CommandInput, CommandList } from '@/shared/components/ui/command'
import { OMNI_TERM_MAX } from '@/shared/domains/omni-search/schemas'

interface Props {
  onDone: () => void
  onPickCustomer: (customer: OmniPickedCustomer) => void
}

// Lives inside the dialog content, which unmounts on close, so every open starts with an empty term at the root.
export function OmniSearchPanel({ onDone, onPickCustomer }: Props) {
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<OmniMode>('root')

  return (
    <>
      <CommandInput
        value={search}
        onValueChange={setSearch}
        maxLength={OMNI_TERM_MAX}
        placeholder={mode === 'schedule-meeting' ? OMNI_COPY.pickCustomerPlaceholder : OMNI_COPY.placeholder}
        onKeyDown={(event) => {
          if (mode !== 'root' && event.key === 'Backspace' && search === '') {
            event.preventDefault()
            setMode('root')
          }
        }}
      />
      <CommandList>
        <OmniSearchResults
          search={search}
          mode={mode}
          onDone={onDone}
          onEnterMode={(next) => {
            setMode(next)
            setSearch('')
          }}
          onPickCustomer={onPickCustomer}
        />
      </CommandList>
    </>
  )
}
```

In `omni-search-dialog.tsx`:
- add `const [scheduleFor, setScheduleFor] = useState<OmniPickedCustomer | null>(null)`;
- replace the `CommandInput` + `CommandList` children with `<OmniSearchPanel onDone={() => setSearchOpen(false)} onPickCustomer={(customer) => { setSearchOpen(false); setScheduleFor(customer) }} />`;
- wrap the return in a fragment and add after `CommandDialog`:

```tsx
      {scheduleFor && (
        <CreateMeetingModal
          isOpen
          onClose={() => setScheduleFor(null)}
          customerId={scheduleFor.id}
          customerName={scheduleFor.name}
        />
      )}
```
- update imports (`useState`, `OmniPickedCustomer`, `OmniSearchPanel`, `CreateMeetingModal` from `@/shared/entities/meetings/components/create-meeting-modal`; drop `CommandEmpty`, `CommandInput`, `CommandList`), and delete `comingSoon` from `OMNI_COPY`.

- [ ] **Step 7: Verify**

Run `pnpm lint && pnpm tsc` (clean). With the dev server, signed in through the playwright-session route as super-admin, take screenshots at 1440×900 of:
- the empty query (Recent after one prior selection; Go to; Actions);
- the fixture customer's name (Customers with a `matchedOn` chip, Meetings, Proposals);
- a phone fragment (chip `···NNNN`);
- `roi` (Go to above records, Remodel ROI calculator first, and Enter lands on `/dashboard/calculators`, which shows the Remodel ROI tab);
- Schedule meeting… → type a name → pick → `CreateMeetingModal` titled for that customer. Close it without submitting.

Then sign in again as `role=agent` and confirm that the same customer name returns only that agent's customers and that Analytics entries are absent.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(search): omni results — ranked customers with match chips, related records, recents, go-to and actions, schedule-meeting picker

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/omni-search
```

---

### Task 7: Full verification and cleanup

**Files:**
- Delete: `scripts/tmp-omni-tokens.ts`, `scripts/tmp-omni-search.ts`, `scripts/tmp-omni-registry.ts`
- Create (throwaway, scratchpad, never committed): a Playwright script for the checks the MCP browser can't do

- [ ] **Step 1: Re-run every test script**

```bash
pnpm tsx scripts/tmp-omni-tokens.ts
NODE_OPTIONS=--conditions=react-server pnpm tsx scripts/tmp-omni-search.ts
pnpm tsx scripts/tmp-omni-registry.ts
```
Expected: all passing.

- [ ] **Step 2: Browser checks** (local Playwright script in the scratchpad; sign in through `/api/dev/playwright-session`)
- **Fast typing (Review Focus 5):** type `smi` then immediately `th` with a 20 ms gap; after the network goes idle, the first customer row contains "Smith" (or the fixture's last name) and no row from a `smi`-only response remains.
- **Error state:** `page.route('**/api/trpc/searchRouter.omni**', route => route.abort())`, type a name, and confirm the "Search is unavailable" row shows while Go to and Actions still list.
- **Over-long input (Review Focus 4):** paste 200 characters and confirm the input holds 80 and no error row appears.
- **Screenshots in light and dark** (toggle through the palette's own "Toggle dark mode"): desktop empty / results / no-match / pick mode; phone 390×844 dock button → results.

- [ ] **Step 3: Gates**

Run: `pnpm lint && pnpm tsc`
Expected: clean.

- [ ] **Step 4: Delete the throwaway scripts** (never committed, so a plain delete)

```bash
rm scripts/tmp-omni-tokens.ts scripts/tmp-omni-search.ts scripts/tmp-omni-registry.ts
git status --short scripts/
```
Expected: no `tmp-omni` entries.

- [ ] **Step 5: Report to the owner** — the screenshots, the chosen `WORD_SIMILARITY_THRESHOLD`, and the ship-time steps: `CREATE EXTENSION IF NOT EXISTS pg_trgm;` on prod, then the owner's `pnpm db:push:prod` (two indexes), before the code reaches prod.
