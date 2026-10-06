# Customers Entity Table Implementation Plan (R2, part 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers get their entity table hook, `useCustomersTable`; the customers records page and the two lead-sources customers tables are table views of it; one lead source's pane reads the shared customers list with its source pinned, and `leadSourcesRouter.getCustomers` goes.

**Architecture:** `useCustomersTable(tableView, { fixed? })` owns the read, the created-date mutation, the action configs, the meta, the profile-modal row click and the delete dialog, on the shared `useEntityTable`; it returns `{ query, visibility, dataTableProps, dialogs }`. The records page renders it through `EntityRecordsTable`; the lead-sources sections keep their own layout around it. The pane passes `fixed: { leadSource: [leadSourceId] }`, which part 1's `useDataViewQuery` merges into the read's filters. Components under `entities/customers/components/lists/` move to the entity whose tree they render.

**Tech Stack:** Next.js 15 App Router, tRPC v11, TanStack Query and Table, nuqs, Zod 4, CASL, shadcn/ui, pnpm, `tsx`, Playwright (read-only checks).

**Spec:** `docs/superpowers/specs/2026-10-05-customers-entity-table-and-fixed-filters-design.md` §5, §7, §8, §11 (approved by the owner 2026-10-05), under the records tracker `docs/plans/2026-09-26-records-management-epic.md` **D11, D25, D45, D48, D51, D60, D62**, open item **O3**, ledger §3.1.

**Requires:** part 1, `docs/superpowers/plans/2026-10-05-customers-entity-table-and-fixed-filters.md`, Tasks 1 and 2 (the `fixed` argument of `useDataViewQuery` and `loadDataViewQueryInput`, and `staticDataViewInput`). Confirm before starting: `grep -n "fixed?: FilterValues<F>" src/shared/dal/client/hooks/use-data-view-query.ts` prints one line.

## Owner confirms

Each is isolated so a different answer is a small change.

1. **Spec §5.5: Edit Profile and Schedule Meeting open the customer profile modal** (the spec's proposal; the owner said "proceed" without choosing). Edit Profile opens it as View Profile does; Schedule Meeting opens it with the Add meeting dialog already up. All of it is Task 3, one commit. To pick the alternative (hide both actions in tables until they have a real target), drop Task 3 and say so; hiding needs a `hidden` rule on those two configs instead.
2. **`defaultMeetingOpen`** is the new optional prop on `CustomerProfileModal` that Task 3 needs: the modal has no way today to open on its Add meeting dialog (its props are `customerId`, `defaultTab`, `highlightMeetingId`). The name follows `defaultTab` and the `meetingOpen` state it seeds.
3. **File names for the two lead-sources table views:** `all-customers-table-view.ts` and `lead-source-customers-table-view.ts` in `features/lead-sources-admin/constants/`, one constant per file as records-management does; `lead-sources-table-query-configs.ts` is deleted. The options type is `UseCustomersTableOptions`, as `UseMeetingsTableOptions` and `UseProjectsTableOptions`.
4. **`CustomerTableRow` becomes the list read's row type** (`AppRouterOutputs['customersRouter']['business']['list']['rows'][number]`), as `MeetingRow` and `ProjectRow` are. Today it is a hand-written interface with a nullable `pipeline` and optional lead-source fields, which `useEntityTable` rejects against the read's rows. The name stays.
5. **What refreshes the one-source pane changes slightly.** It read `leadSourcesRouter.getCustomers`, which every proposal and project change invalidates (for the signed counts). It will read `customersRouter.business.list`, which those changes do not invalidate, as the other two customers tables never were; customer edits, which did not refresh the pane before, now do. A Pipeline badge in the pane can therefore lag a proposal or project change until the next refetch (30 s stale time, window focus, or Refresh). To keep the old behaviour, add `trpc.customersRouter.business.list.queryFilter()` to `invalidateProposal` and `invalidateProject` in `use-invalidation.ts`. Not planned: the tracker's A7 wants those invalidations narrower, not wider.
6. **The pane loses the Source cell's reassign picker with the column** (the spec drops the column because its value is constant there). A super-admin reassigns a customer's lead source from the "All customers" pane or the customers records page.

## Global Constraints

- Verification per task: `pnpm tsc` and `pnpm lint`. **Never `pnpm build`.**
- **No database writes for testing** (dev included). Browser checks read and open UI only: never submit the Add meeting form, never confirm a delete, never pick a created date. A write check runs only on a customer the owner names, or is verified by code read.
- **No schema change.** If a step seems to need one, stop and report it.
- No unit runner in the repo: pure functions are checked with throwaway `node:test` files under `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/` (git-ignored; the same workspace as part 1), run from the repo root with `pnpm exec tsx --test <file>`. A file that imports a `server-only` module runs with `NODE_OPTIONS=--conditions=react-server`. Never commit them.
- Work on `main`; other sessions commit concurrently and the index can hold their staged work. Add only new files with `git add -- <path>`, then **commit with an explicit pathspec** (`git commit -m "…" -- <paths>`, as every commit block below does) so nothing already staged rides along; confirm with `git show --stat HEAD`. Never `git add -A`, `git stash`, `checkout`, `reset`, `restore`, `clean` or `commit --amend`. Before editing, moving or deleting any file this plan touches, run `git status --short <file>`: if it shows changes you didn't make, stop and ask. The #285 permissions worktree and the profile modal's polish pass both touch customer files. Message shape `type(scope): subject`, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Edits are given as exact "replace this with that" pairs or whole files. If the text to replace is not in the file as written, stop and re-read the file: another session changed it. Do not guess.
- Never start, stop or restart a dev server; never touch `.next`. Run `ss -ltnp | grep :3000` and reuse the running one.
- Browser checks: the local Playwright script (Task 1 Step 1; memory `reference-playwright-auth.md`, `/api/dev/playwright-session`, roles via `&role=super-admin|agent`), desktop and 390px wide, light and dark; screenshots and reports land under `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/` and are listed in the task report. Never print `.env.local`, `DEV_LOGIN_SECRET` or a URL containing `secret=`. The script is a tool: if one of its selectors misses, fix the script, never the app, and say so in the report.
- `tableId`s and URL prefixes do not change: `customers` · `pc`, `all-customers` · `all`, `lead-source-customers` · `src`. Saved column layouts and bookmarked URLs must keep working.
- A fixed filter narrows what a view asks for; **it is not access control** (spec §2). Who sees which customers is decided by `customerProcedure`'s scope alone.
- Layout stays the callsite's (D45): the hook returns wiring, never markup beyond its dialogs. No customer expanded row (spec non-goal); a row click opens the profile modal.
- Non-defensive migrations: a step that moves a consumer deletes the old path in the same task. No shims, no re-exports.
- Names: the spec's (`useCustomersTable`, `CUSTOMERS_RECORDS_TABLE_VIEW`, `ALL_CUSTOMERS_TABLE_VIEW`, `LEAD_SOURCE_CUSTOMERS_TABLE_VIEW`, `CustomersRecordsTable`, `CustomerColumnKey`). Do not coin others; the unavoidable ones are under "Owner confirms".
- Code conventions (memory `coding-conventions.md`): one component per file, named exports, constants in `constants/`, only DAL files import `db`. Comments say why, never what; no plan, spec or tracker citations in code.
- Render rules (`data-table.tsx` meta doc): meta function entries are event callbacks; action config arrays come from `useStableCallbacks` (inside `useCustomerActionConfigs`), never `useMemo` over mutation objects.
- Action labels stay as they are ("View Profile", "Edit Profile", "Schedule Meeting", "Delete").

## Review Focus

1. **Switching lead sources in the pane shows the new source's customers, never the previous one's.** The pin changes while the table is mounted; the table must ask once for the new source and show its skeleton meanwhile, and an inline `fixed` object must not refetch on every render. Pinned by Task 2 Step 8 (browser: page 1 is read once per source, each read with its own `filters.leadSource`, and `readCount` stays small).
2. **A saved column layout that names the removed Source column still loads.** A viewer who resized or hid Source in the pane has `leadSourceName` in the `dt.lead-source-customers` cookie; the table must load, ignore it, and keep the rest of the layout. Pinned by Task 2 Step 8 (browser, cookie preset through `TABLE_PREFS`).
3. **An agent sees the same customers as before, and the pane's read cannot widen that.** The records page for an agent shows the baseline's rows; `/dashboard/lead-sources` still sends an agent to the dashboard. Pinned by Task 1 Step 8 and Task 2 Step 8 (browser, agent session).
4. **An old pane URL keeps its page and filters, and a key that tries to name another source is ignored.** `?src_p=2&src_pipeline=fresh` still applies; `src_leadSource` or `src_sourceId` in the URL never changes whose customers show. Pinned by Task 2 Step 1 (test) and Step 8 (browser).
5. **Schedule Meeting on a phone, and for a profile that fails to load.** At 390px the profile opens full screen with the Add meeting dialog above it and usable; closing the dialog leaves the profile; if the profile read fails, the error state shows and no dialog floats over it. Pinned by Task 3 Step 4 (browser, nothing submitted) and Step 3 (code read).

## File map

| Task | Files |
|---|---|
| 1 The hook and the records page | `src/shared/entities/customers/lib/columns-registry.tsx` · `src/shared/entities/customers/components/customers-table/use-customers-table.tsx` (new) · `src/features/records-management/constants/customers-records-table-view.ts` (new) · `src/features/records-management/ui/components/customers-records-table.tsx` (new) · `src/app/(frontend)/dashboard/(records)/customers/page.tsx` · `src/features/agent-dashboard/ui/components/customers-route-pending-view.tsx` · deleted: `src/shared/entities/customers/components/customers-table.tsx`, `src/shared/entities/customers/constants/customers-table-query-config.ts` |
| 2 The lead-sources tables | `src/features/lead-sources-admin/constants/{all-customers-table-view,lead-source-customers-table-view}.ts` (new) · `src/features/lead-sources-admin/ui/components/{all-customers-section,lead-source-customers-section}.tsx` · `src/app/(frontend)/dashboard/lead-sources/page.tsx` · `src/trpc/routers/lead-sources.router.ts` · `src/shared/entities/customers/dal/customer-fields.ts` · `src/shared/entities/customers/dal/server/{customer-field-sql,queries}.ts` · deleted: `src/features/lead-sources-admin/constants/lead-sources-table-query-configs.ts` |
| 3 The two row actions | `src/shared/entities/customers/hooks/use-profile-commands.ts` · `src/shared/entities/customers/components/profile/{customer-profile-modal,customer-profile-modal-content}.tsx` · `src/shared/entities/customers/components/customers-table/use-customers-table.tsx` |
| 4 Ownership moves | `src/shared/entities/customers/components/lists/*` → `src/shared/entities/meetings/components/`, `src/shared/modules/projects/core/components/` · `src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx` |
| 5 Hand-off | `docs/plans/2026-09-26-records-management-epic.md` · `docs/superpowers/specs/2026-10-05-customers-entity-table-and-fixed-filters-design.md` · `src/shared/entities/customers/DOCS.md` · `docs/ubiquitous-language.md` · `docs/codebase-conventions/query-toolkit.md` |

None of these source files carried another session's uncommitted edits on 2026-10-05. `src/features/lead-sources-admin/ui/views/lead-sources-view.tsx` and `src/shared/components/records-page-shell.tsx` did (theme work); this plan does not edit them.

---

### Task 1: `useCustomersTable` and the customers records page

**Files:**
- Modify: `src/shared/entities/customers/lib/columns-registry.tsx`
- Create: `src/shared/entities/customers/components/customers-table/use-customers-table.tsx`
- Create: `src/features/records-management/constants/customers-records-table-view.ts`
- Create: `src/features/records-management/ui/components/customers-records-table.tsx`
- Modify: `src/app/(frontend)/dashboard/(records)/customers/page.tsx`
- Modify: `src/features/agent-dashboard/ui/components/customers-route-pending-view.tsx`
- Delete: `src/shared/entities/customers/components/customers-table.tsx`
- Delete: `src/shared/entities/customers/constants/customers-table-query-config.ts`
- Tool (throwaway): `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts`

**Interfaces:**
- Consumes: `useDataViewQuery(procedure, extra, config, fixed?)` (part 1); `useEntityTable`, `EntityRecordsTable`, `EntityTableView` (built with the projects table); `useCustomerActionConfigs<T>({ onView?, onEdit?, onScheduleMeeting?, onDeleted? })`.
- Produces:
  - `CustomerTableRow` = the row type of `customersRouter.business.list`; `CustomerColumnKey = keyof typeof CUSTOMER_COLUMNS`
  - `UseCustomersTableOptions { fixed?: FilterValues<typeof CUSTOMER_FIELDS> }`
  - `useCustomersTable(tableView: EntityTableView<CustomerColumnKey, typeof CUSTOMER_FIELDS>, options?: UseCustomersTableOptions)` → `{ query, visibility, dataTableProps, dialogs }`
  - `CUSTOMERS_RECORDS_TABLE_VIEW` (`tableId: 'customers'`, prefix `pc`); `CustomersRecordsTable()` (no props)

- [ ] **Step 1: Baseline, before any edit**

If `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts` is still there from part 1, keep it. Otherwise create it (type-checked when this plan was written; if part 1 ran it, it is proven):

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

import { chromium } from 'playwright'

// Usage: pnpm exec tsx <this file> <label> <role> <path> [<path>…]
// Reads only: signs in, opens each path at two widths in both schemes, presses each table's Refresh, and writes
// screenshots plus one JSON report. It never submits a form.
//   TABLE_PREFS='{"<tableId>":{…}}'  loads with saved table layouts, in the cookie format DataTable writes
//   THEN_CLICK='<selector>'          clicks one element after the page settles (e.g. another lead source)
const DIR = '.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters'
const BASE = process.env.BASE ?? 'http://localhost:3000'
const [label, role, ...paths] = process.argv.slice(2)
const secret = readFileSync('.env.local', 'utf8').match(/^DEV_LOGIN_SECRET=(.*)$/m)![1].replace(/"/g, '').trim()
const tablePrefs: Record<string, unknown> = JSON.parse(process.env.TABLE_PREFS ?? '{}')
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const
const LIST_READS = ['customersRouter.business.list', 'leadSourcesRouter.getCustomers', 'meetingsRouter.reads.list', 'projectsRouter.crud.list', 'scheduleRouter.activities.list', 'customerPipelinesRouter.getCustomerPipelineItems']

interface ListRead { procedure: string, input: unknown, ids: string[], total: number }

const slug = (path: string) => path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root'
const readKey = (read: ListRead) => JSON.stringify([read.procedure, read.input])
const textOf = (els: Element[]) => els.map(el => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim())

mkdirSync(DIR, { recursive: true })
const browser = await chromium.launch()
const report: Record<string, unknown> = {}

try {
  for (const path of paths) {
    for (const [width, viewport] of Object.entries(VIEWPORTS)) {
      for (const colorScheme of ['light', 'dark'] as const) {
        const ctx = await browser.newContext({ viewport, colorScheme, isMobile: width === 'phone', hasTouch: width === 'phone' })
        await ctx.addCookies(Object.entries(tablePrefs).map(([tableId, prefs]) => ({
          name: `dt.${tableId}`,
          value: encodeURIComponent(JSON.stringify(prefs)),
          domain: new URL(BASE).hostname,
          path: '/dashboard',
        })))
        const page = await ctx.newPage()
        const errors: string[] = []
        const reads: ListRead[] = []
        page.on('pageerror', error => errors.push(error.message.slice(0, 400)))
        page.on('console', (message) => {
          if (message.type() === 'error') {
            errors.push(message.text().slice(0, 400))
          }
        })
        // A batched GET names its procedures in the path and carries their inputs, by position, in `input`.
        page.on('response', async (response) => {
          const url = new URL(response.url())
          if (!url.pathname.startsWith('/api/trpc/')) {
            return
          }
          const procedures = url.pathname.slice('/api/trpc/'.length).split(',')
          const inputs = JSON.parse(url.searchParams.get('input') ?? '{}')
          const body = await response.json().catch(() => null)
          procedures.forEach((procedure, i) => {
            const data = body?.[i]?.result?.data?.json
            if (LIST_READS.includes(procedure) && Array.isArray(data?.rows)) {
              reads.push({ procedure, input: inputs[i]?.json, ids: data.rows.map((row: { id: string }) => row.id), total: data.total })
            }
          })
        })

        await page.goto(`${BASE}/api/dev/playwright-session?secret=${secret}&role=${role}&redirect=/api/auth/get-session`, { waitUntil: 'load', timeout: 120_000 })
        await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 120_000 })
        await page.waitForFunction(() => document.querySelectorAll('[data-slot=data-view-pending]').length === 0, undefined, { timeout: 60_000 })
        await page.waitForTimeout(1500)
        if (process.env.THEN_CLICK) {
          // A target one width doesn't show (the phone layout hides the source list behind a pane) is recorded, not fatal.
          await page.locator(process.env.THEN_CLICK).first().click({ timeout: 5000 }).catch(() => errors.push('THEN_CLICK: target not found at this width'))
          await page.waitForTimeout(2500)
        }
        await page.screenshot({ path: `${DIR}/${label}-${role}-${slug(path)}-${width}-${colorScheme}.png` })

        // A document load streams its rows inside the HTML. Refresh makes the table ask over HTTP, where its ids can be read.
        for (const refresh of await page.locator('main button[aria-label="Refresh"]').all()) {
          if (await refresh.isVisible()) {
            await refresh.click()
            await page.waitForTimeout(2000)
          }
        }

        report[`${path} ${width} ${colorScheme}`] = {
          url: page.url(),
          columns: await page.locator('main thead th').evaluateAll(textOf),
          rows: await page.locator('main tbody tr:not([aria-hidden]):not([data-expanded-row])').evaluateAll(textOf),
          chips: await page.locator('main a[href^="#"]').evaluateAll(textOf),
          sections: await page.locator('#meetings, #proposals, #projects').evaluateAll(textOf),
          // One entry per distinct request, sorted, so two runs diff cleanly; `readCount` keeps how many responses arrived.
          reads: [...new Map(reads.map(read => [readKey(read), read])).values()].sort((a, b) => readKey(a).localeCompare(readKey(b))),
          readCount: reads.length,
          errors,
        }
        await ctx.close()
      }
    }
  }
}
finally {
  await browser.close()
}

writeFileSync(`${DIR}/${label}-${role}.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(`wrote ${DIR}/${label}-${role}.json`)
```

Confirm a dev server is up (`ss -ltnp | grep :3000`; if none, stop and ask the owner). Pick two lead sources that have customers, A and B (their names and counts are in the left list on `/dashboard/lead-sources`). Learn each one's id by clicking it and reading the URL the click writes:

```bash
THEN_CLICK='nav[aria-label="Lead sources"] >> text="<name of A>"' pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts find-a super-admin /dashboard/lead-sources
```

The desktop entries' `url` in `find-a-super-admin.json` ends with `?id=<uuid of A>`. Repeat for B (`find-b`). Then capture the baseline:

```bash
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-baseline super-admin /dashboard/customers /dashboard/lead-sources "/dashboard/lead-sources?id=<A>" "/dashboard/lead-sources?id=<B>"
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-baseline agent /dashboard/customers /dashboard/lead-sources
```

Expected in `p2-baseline-super-admin.json`: for each table, `columns` (Customer, Source, Pipeline, Created), `rows` (page 1 as text) and, under `reads`, each distinct list request with its `input`, row `ids` and `total` (`customersRouter.business.list` for the records page and the All pane, `leadSourcesRouter.getCustomers` for A and B). The entry with `pagination.offset` 0 is page 1; an entry with offset 20 is the next page's prefetch. `readCount` is how many list responses arrived. For the agent, `/dashboard/lead-sources` lands on `/dashboard` (`url`). Record the A and B ids in the task report. Note any `errors` already present; they are the baseline, not this plan's.

- [ ] **Step 2: The registry's row and key types**

In `src/shared/entities/customers/lib/columns-registry.tsx`:

Replace the type imports at the top (drop `Pipeline`, add `AppRouterOutputs`):

```ts
import type { ColumnRegistry } from '@/shared/components/data-table/lib/use-entity-columns'
import type { EntityTableMeta } from '@/shared/components/data-table/types/entity-table-meta'
import type { SortId } from '@/shared/dal/lib/query/field-list'
import type { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'
import type { AppRouterOutputs } from '@/trpc/routers/app'
```

Replace the `CustomerTableRow` interface and the doc comment above it with:

```ts
/** `pipeline` is the derived five-bucket classification, not the stored three-bucket column. */
export type CustomerTableRow = AppRouterOutputs['customersRouter']['business']['list']['rows'][number]
```

Every customers table reads that one list, so the row is the read's row; `useEntityTable` takes one row type for the registry and the query, and the hand-written interface (nullable `pipeline`, optional lead-source fields) does not match the read's.

After the closing `} as const satisfies ColumnRegistry<CustomerTableRow, SortId<typeof CUSTOMER_FIELDS>>` line, add:

```ts

export type CustomerColumnKey = keyof typeof CUSTOMER_COLUMNS
```

- [ ] **Step 3: The entity table hook**

Create `src/shared/entities/customers/components/customers-table/use-customers-table.tsx`:

```tsx
'use client'

import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { FilterValues } from '@/shared/dal/lib/query/field-list'
import type { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'
import type { CustomerColumnKey, CustomerTableMeta, CustomerTableRow } from '@/shared/entities/customers/lib/columns-registry'

import { useMutation } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import { toast } from 'sonner'

import { useEntityTable } from '@/shared/components/data-table/lib/use-entity-table'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { useCustomerActionConfigs } from '@/shared/entities/customers/hooks/use-customer-action-configs'
import { CUSTOMER_COLUMNS } from '@/shared/entities/customers/lib/columns-registry'
import { openModal } from '@/shared/lib/open-modal'
import { useTRPC } from '@/trpc/helpers'

export interface UseCustomersTableOptions {
  /** Filter values only this callsite knows (one lead source's id). A pin that never changes belongs in the table view's `query.fixed`. */
  fixed?: FilterValues<typeof CUSTOMER_FIELDS>
}

export function useCustomersTable(
  tableView: EntityTableView<CustomerColumnKey, typeof CUSTOMER_FIELDS>,
  { fixed }: UseCustomersTableOptions = {},
) {
  const trpc = useTRPC()
  const { invalidateCustomer, invalidateLeadSource } = useInvalidation()

  const query = useDataViewQuery(trpc.customersRouter.business.list, {}, tableView.query, fixed)

  const { mutate: updateCreatedAt } = useMutation(
    trpc.customersRouter.crud.update.mutationOptions({
      onSuccess: () => {
        toast.success('Created date updated')
        invalidateCustomer()
        // A lead source's figures are counted over its customers' created dates.
        invalidateLeadSource()
      },
      onError: err => toast.error(err.message),
    }),
  )

  const openProfile = useCallback((row: CustomerTableRow) => {
    openModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props: { customerId: row.id } })
  }, [])

  const { actions, DeleteConfirmDialog } = useCustomerActionConfigs<CustomerTableRow>({ onView: openProfile })

  const meta = useMemo(() => ({
    onUpdateCreatedAt: (customerId: string, date: Date) =>
      updateCreatedAt({ id: customerId, data: { createdAt: date.toISOString() } }),
  }) satisfies Omit<CustomerTableMeta, 'rowActions'>, [updateCreatedAt])

  const table = useEntityTable({
    tableView,
    registry: CUSTOMER_COLUMNS,
    query,
    actions,
    meta,
    onRowClick: openProfile,
    entityName: 'customer',
    rowDataAttribute: 'data-customer-row',
  })

  return { ...table, dialogs: <DeleteConfirmDialog /> }
}
```

Edit Profile and Schedule Meeting keep today's fallback in this task (they open the pipeline board); Task 3 gives them their target.

- [ ] **Step 4: The table view**

Create `src/features/records-management/constants/customers-records-table-view.ts`:

```ts
import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { CustomerColumnKey } from '@/shared/entities/customers/lib/columns-registry'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'

export const CUSTOMERS_RECORDS_TABLE_VIEW = {
  tableId: 'customers',
  query: {
    fields: CUSTOMER_FIELDS,
    paramPrefix: 'pc',
    toolbar: ['pipeline', 'createdAt'],
    defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
    window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
  },
  columns: ['name', 'leadSourceName', 'pipeline', 'createdAt'],
} as const satisfies EntityTableView<CustomerColumnKey, typeof CUSTOMER_FIELDS>
```

- [ ] **Step 5: The records table**

Create `src/features/records-management/ui/components/customers-records-table.tsx`:

```tsx
'use client'

import { CUSTOMERS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/customers-records-table-view'
import { EntityRecordsTable } from '@/shared/components/entity-records-table'
import { useCustomersTable } from '@/shared/entities/customers/components/customers-table/use-customers-table'

export function CustomersRecordsTable() {
  const table = useCustomersTable(CUSTOMERS_RECORDS_TABLE_VIEW)
  return <EntityRecordsTable title="Customers" entityName="customers" searchPlaceholder="Search by name or email…" table={table} />
}
```

`EntityRecordsTable` draws what `CustomersTable` drew by hand: `RecordsPageShell` with the header and its count, `QueryToolbar.Standard` and the `DataTable`.

- [ ] **Step 6: The page, its pending view, and the old table**

In `src/app/(frontend)/dashboard/(records)/customers/page.tsx`: delete the two imports of `CustomersTable` and `CUSTOMERS_TABLE_QUERY_CONFIG`; add, as the first two `@/` imports,

```ts
import { CUSTOMERS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/customers-records-table-view'
import { CustomersRecordsTable } from '@/features/records-management/ui/components/customers-records-table'
```

change the loader call to

```ts
    const input = await loadDataViewQueryInput(searchParams, CUSTOMERS_RECORDS_TABLE_VIEW.query)
```

and `<CustomersTable />` to `<CustomersRecordsTable />`. The `RecordsPageFrame` and `DataViewBoundary` around it stay.

Replace `src/features/agent-dashboard/ui/components/customers-route-pending-view.tsx` with:

```tsx
'use client'

import { CustomersRecordsTable } from '@/features/records-management/ui/components/customers-records-table'
import { RecordsPageFrame } from '@/shared/components/records-page-frame'

// The page's own composition, drawn in the pending context as the layout's loading state.
export function CustomersRoutePendingView() {
  return (
    <RecordsPageFrame>
      <CustomersRecordsTable />
    </RecordsPageFrame>
  )
}
```

Delete the old table and its config:

```bash
git rm -- src/shared/entities/customers/components/customers-table.tsx src/shared/entities/customers/constants/customers-table-query-config.ts
```

- [ ] **Step 7: Type-check, lint, greps**

Run: `pnpm tsc && pnpm lint`
Expected: clean. The two lead-sources sections still compile untouched: they use `CustomerTableRow` and `CUSTOMER_COLUMNS`, and their reads return the same row shape.

Run: `grep -rnw "CUSTOMERS_TABLE_QUERY_CONFIG\|CUSTOMERS_TABLE_SHOW_COLUMNS" src; grep -rn "customers/components/customers-table'\|customers-table-query-config" src`
Expected: no output (`-w` keeps the lead-sources configs, which go in Task 2, out of the match).

- [ ] **Step 8: Browser read check**

```bash
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-task1 super-admin /dashboard/customers "/dashboard/customers?pc_p=2&pc_pipeline=fresh&pc_sort=name&pc_dir=asc"
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-task1 agent /dashboard/customers
```

Against `p2-baseline-*.json` and its screenshots, for both roles, both widths and both schemes:
- `/dashboard/customers`: the same `columns`, `rows`, `reads[].input` and `reads[].ids` (compare the `pagination.offset` 0 entries); the header reads "Customers" with the same count; the toolbar has search, the Pipeline and Created filters, Columns, Refresh and page size;
- the bookmarked URL loads page 2 of the Fresh pipeline sorted by name ascending, with a Pipeline chip, and its `reads[].input` holds `pagination.offset: 20`, `filters.pipeline: ["fresh"]`, `sort: { sortBy: "name", sortDir: "asc" }` (if Fresh has a single page, the page clamps back to 1, as it does today);
- `errors` holds no `[prefetch drift]`, no `[data-view]` and no hydration error the baseline did not have;
- for the agent, the rows equal the agent baseline's (Review Focus 3), and the Source cell is plain text (no picker).

By hand, as a super-admin on desktop: a row click opens that customer's profile modal; the row menu ("Actions") lists View Profile, Edit Profile, Schedule Meeting and Delete; clicking a Created cell opens the date picker (close it without picking); clicking a Source cell opens the lead-source picker (close it without picking). A hard reload shows the page's skeleton, then the rows, with no jump (the pending view draws the same table).

- [ ] **Step 9: Commit**

```bash
git add -- src/shared/entities/customers/components/customers-table/use-customers-table.tsx src/features/records-management/constants/customers-records-table-view.ts src/features/records-management/ui/components/customers-records-table.tsx
git commit -m "feat(customers): customers entity table hook; the records page is a table view of it

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/entities/customers/lib/columns-registry.tsx src/shared/entities/customers/components/customers-table/use-customers-table.tsx src/features/records-management/constants/customers-records-table-view.ts src/features/records-management/ui/components/customers-records-table.tsx "src/app/(frontend)/dashboard/(records)/customers/page.tsx" src/features/agent-dashboard/ui/components/customers-route-pending-view.tsx src/shared/entities/customers/components/customers-table.tsx src/shared/entities/customers/constants/customers-table-query-config.ts
git show --stat HEAD
```

---

### Task 2: The lead-sources tables on the hook; the pane reads the shared list

**Files:**
- Create: `src/features/lead-sources-admin/constants/all-customers-table-view.ts`
- Create: `src/features/lead-sources-admin/constants/lead-source-customers-table-view.ts`
- Delete: `src/features/lead-sources-admin/constants/lead-sources-table-query-configs.ts`
- Modify: `src/features/lead-sources-admin/ui/components/all-customers-section.tsx`
- Modify: `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx`
- Modify: `src/app/(frontend)/dashboard/lead-sources/page.tsx`
- Modify: `src/trpc/routers/lead-sources.router.ts` (`getCustomers` and two imports)
- Modify: `src/shared/entities/customers/dal/customer-fields.ts`
- Modify: `src/shared/entities/customers/dal/server/customer-field-sql.ts`
- Modify: `src/shared/entities/customers/dal/server/queries.ts` (one doc comment)
- Test (throwaway): `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/customers-table-views.test.ts`

**Interfaces:**
- Consumes: `useCustomersTable(tableView, { fixed })` and `CustomerColumnKey` (Task 1); `CUSTOMERS_RECORDS_TABLE_VIEW` (Task 1, in the test); `staticDataViewInput`, `loadDataViewQueryInput(searchParams, config, extra?, fixed?)` (part 1).
- Produces: `ALL_CUSTOMERS_TABLE_VIEW` (`all-customers` · `all`, four columns); `LEAD_SOURCE_CUSTOMERS_TABLE_VIEW` (`lead-source-customers` · `src`, no Source column). Removed: `leadSourcesRouter.getCustomers`; `CUSTOMER_FIELDS.sourceId` and `.segment` with their SQL; `ALL_CUSTOMERS_TABLE_QUERY_CONFIG`, `LEAD_SOURCE_CUSTOMERS_TABLE_QUERY_CONFIG`.

- [ ] **Step 1: Write the failing test**

Create `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/customers-table-views.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { ALL_CUSTOMERS_TABLE_VIEW } from '@/features/lead-sources-admin/constants/all-customers-table-view'
import { LEAD_SOURCE_CUSTOMERS_TABLE_VIEW } from '@/features/lead-sources-admin/constants/lead-source-customers-table-view'
import { CUSTOMERS_RECORDS_TABLE_VIEW } from '@/features/records-management/constants/customers-records-table-view'
import { staticDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'
import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'

const SOURCE = '11111111-1111-4111-8111-111111111111'
const OTHER_SOURCE = '22222222-2222-4222-8222-222222222222'

test('saved column layouts and bookmarked URLs keep their keys', () => {
  assert.deepEqual(
    [CUSTOMERS_RECORDS_TABLE_VIEW, ALL_CUSTOMERS_TABLE_VIEW, LEAD_SOURCE_CUSTOMERS_TABLE_VIEW].map(view => [view.tableId, view.query.paramPrefix]),
    [['customers', 'pc'], ['all-customers', 'all'], ['lead-source-customers', 'src']],
  )
})

test('only the one-source pane drops the Source column', () => {
  assert.deepEqual(CUSTOMERS_RECORDS_TABLE_VIEW.columns, ['name', 'leadSourceName', 'pipeline', 'createdAt'])
  assert.deepEqual(ALL_CUSTOMERS_TABLE_VIEW.columns, ['name', 'leadSourceName', 'pipeline', 'createdAt'])
  assert.deepEqual(LEAD_SOURCE_CUSTOMERS_TABLE_VIEW.columns, ['name', 'pipeline', 'createdAt'])
})

test('with no URL state every table asks for the newest twenty customers', () => {
  const expected = { pagination: { limit: 20, offset: 0 }, sort: { sortBy: 'createdAt', sortDir: 'desc' }, search: undefined, filters: undefined }
  assert.deepEqual(staticDataViewInput(CUSTOMERS_RECORDS_TABLE_VIEW.query), expected)
  assert.deepEqual(staticDataViewInput(ALL_CUSTOMERS_TABLE_VIEW.query), expected)
  assert.deepEqual(staticDataViewInput(LEAD_SOURCE_CUSTOMERS_TABLE_VIEW.query, { leadSource: [SOURCE] }), { ...expected, filters: { leadSource: [SOURCE] } })
})

test('the pane keeps its page and toolbar filters from the URL, and its source from the pin alone', async () => {
  const input = await loadDataViewQueryInput(
    { src_p: '2', src_pipeline: 'fresh,rehash', src_leadSource: OTHER_SOURCE, src_sourceId: OTHER_SOURCE },
    LEAD_SOURCE_CUSTOMERS_TABLE_VIEW.query,
    undefined,
    { leadSource: [SOURCE] },
  )
  assert.deepEqual(input.pagination, { limit: 20, offset: 20 })
  assert.deepEqual(input.filters, { pipeline: ['fresh', 'rehash'], leadSource: [SOURCE] })
})
```

Run: `NODE_OPTIONS=--conditions=react-server pnpm exec tsx --test .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/customers-table-views.test.ts`
Expected: FAIL, the module `@/features/lead-sources-admin/constants/all-customers-table-view` is not found.

- [ ] **Step 2: The two table views**

Create `src/features/lead-sources-admin/constants/all-customers-table-view.ts`:

```ts
import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { CustomerColumnKey } from '@/shared/entities/customers/lib/columns-registry'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'

/** The "All customers" pane. */
export const ALL_CUSTOMERS_TABLE_VIEW = {
  tableId: 'all-customers',
  query: {
    fields: CUSTOMER_FIELDS,
    paramPrefix: 'all',
    toolbar: ['pipeline', 'createdAt'],
    defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
    window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
  },
  columns: ['name', 'leadSourceName', 'pipeline', 'createdAt'],
} as const satisfies EntityTableView<CustomerColumnKey, typeof CUSTOMER_FIELDS>
```

Create `src/features/lead-sources-admin/constants/lead-source-customers-table-view.ts`:

```ts
import type { EntityTableView } from '@/shared/components/data-table/types/entity-table-view'
import type { CustomerColumnKey } from '@/shared/entities/customers/lib/columns-registry'

import { DEFAULT_RECORDS_PAGE_SIZE_OPTIONS } from '@/shared/dal/client/lib/constants'
import { CUSTOMER_FIELDS } from '@/shared/entities/customers/dal/customer-fields'

/** The "Customers from this source" pane. The pane pins its source when it calls the hook, so there is no Source column: it would repeat one value. */
export const LEAD_SOURCE_CUSTOMERS_TABLE_VIEW = {
  tableId: 'lead-source-customers',
  query: {
    fields: CUSTOMER_FIELDS,
    paramPrefix: 'src',
    toolbar: ['pipeline', 'createdAt'],
    defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
    window: { kind: 'page', pageSize: 20, pageSizeOptions: DEFAULT_RECORDS_PAGE_SIZE_OPTIONS },
  },
  columns: ['name', 'pipeline', 'createdAt'],
} as const satisfies EntityTableView<CustomerColumnKey, typeof CUSTOMER_FIELDS>
```

Delete the old configs: `git rm -- src/features/lead-sources-admin/constants/lead-sources-table-query-configs.ts`

Run the test again. Expected: 4 pass.

- [ ] **Step 3: The "All customers" section**

Replace `src/features/lead-sources-admin/ui/components/all-customers-section.tsx` with (the markup is today's; the read, mutation, actions, columns and meta now come from the hook):

```tsx
'use client'

import { ALL_CUSTOMERS_TABLE_VIEW } from '@/features/lead-sources-admin/constants/all-customers-table-view'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { useCustomersTable } from '@/shared/entities/customers/components/customers-table/use-customers-table'

export function AllCustomersSection() {
  const { query, visibility, dataTableProps, dialogs } = useCustomersTable(ALL_CUSTOMERS_TABLE_VIEW)

  return (
    <section aria-label="All customers" className="flex min-h-0 flex-1 flex-col gap-3">
      {dialogs}

      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            All customers
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {query.isPending ? 'Loading…' : `${query.total.toLocaleString()} total`}
          </span>
        </div>

        <QueryToolbar query={query} entityName="customers">
          <QueryToolbar.Bar>
            <QueryToolbar.Search placeholder="Filter by name or email…" />
            <QueryToolbar.FilterTrigger />
            <QueryToolbar.ColumnsTrigger visibility={visibility} />
            <QueryToolbar.RefreshButton />
            <QueryToolbar.PageSize />
          </QueryToolbar.Bar>
          <QueryToolbar.ChipRail />
          <QueryToolbar.LiveStatus />
        </QueryToolbar>
      </div>

      {/* DataTable sizes itself with `h-full`; this cell gives it a height, so the pagination bar pins to the bottom and the rows scroll. */}
      <div className="min-h-0 flex-1">
        <DataTable {...dataTableProps} />
      </div>
    </section>
  )
}
```

- [ ] **Step 4: The one-source section**

Replace `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx` with:

```tsx
'use client'

import { LEAD_SOURCE_CUSTOMERS_TABLE_VIEW } from '@/features/lead-sources-admin/constants/lead-source-customers-table-view'
import { DataTable } from '@/shared/components/data-table/ui/data-table'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { useCustomersTable } from '@/shared/entities/customers/components/customers-table/use-customers-table'

interface LeadSourceCustomersSectionProps {
  leadSourceId: string
}

export function LeadSourceCustomersSection({ leadSourceId }: LeadSourceCustomersSectionProps) {
  const { query, visibility, dataTableProps, dialogs } = useCustomersTable(LEAD_SOURCE_CUSTOMERS_TABLE_VIEW, {
    fixed: { leadSource: [leadSourceId] },
  })

  return (
    <section
      aria-label="Customers from this lead source"
      className="flex min-h-0 flex-1 flex-col gap-3"
    >
      {dialogs}

      <div className="flex shrink-0 flex-col gap-2">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Customers from this source
          </h3>
          <span className="text-xs text-muted-foreground tabular-nums">
            {query.isPending ? 'Loading…' : `${query.total.toLocaleString()} total`}
          </span>
        </div>

        <QueryToolbar query={query} entityName="customers">
          <QueryToolbar.Bar>
            <QueryToolbar.Search placeholder="Filter by name or email…" />
            <QueryToolbar.FilterTrigger />
            <QueryToolbar.ColumnsTrigger visibility={visibility} />
            <QueryToolbar.RefreshButton />
            <QueryToolbar.PageSize />
          </QueryToolbar.Bar>
          <QueryToolbar.ChipRail />
          <QueryToolbar.LiveStatus />
        </QueryToolbar>
      </div>

      {/* DataTable sizes itself with `h-full`; this cell gives it a height, so the pagination bar pins to the bottom and the rows scroll. */}
      <div className="min-h-0 flex-1">
        <DataTable {...dataTableProps} />
      </div>
    </section>
  )
}
```

The pane is mounted only in the browser, after the source's own read, so it has no server prefetch and the page passes no `fixed` to a loader.

- [ ] **Step 5: The page's prefetch**

In `src/app/(frontend)/dashboard/lead-sources/page.tsx`, replace the `lead-sources-table-query-configs` import with

```ts
import { ALL_CUSTOMERS_TABLE_VIEW } from '@/features/lead-sources-admin/constants/all-customers-table-view'
```

and the loader call with

```ts
      const input = await loadDataViewQueryInput(params, ALL_CUSTOMERS_TABLE_VIEW.query)
```

- [ ] **Step 6: `getCustomers` and its two fixed-only fields go**

First confirm nothing else uses them:

Run: `grep -rn "getCustomers" src`
Expected: only the procedure itself in `src/trpc/routers/lead-sources.router.ts`.

Run: `grep -rnw "sourceId\|segment" src/features/lead-sources-admin src/features/customer-pipelines src/shared/entities/customers src/shared/entities/lead-sources src/trpc/routers/lead-sources.router.ts src/trpc/routers/customer-pipelines.router.ts --include=*.ts --include=*.tsx`
Expected: only `customer-fields.ts` (the two entries), `customer-field-sql.ts` (the two entries and the `segment-sql` import), the doc comment in `customers/dal/server/queries.ts`, the `getCustomers` lines and the `segment-sql` import in `lead-sources.router.ts`, and `lead-sources/lib/segment-sql.ts` (`buildSegmentWhere`, which stays: `getStatusCounts` calls it directly). The pipeline board's config (`src/features/customer-pipelines/constants/customer-pipeline-query.ts`) lists `rep`, `leadSource` and `createdAt`: neither field. If anything else shows, stop and report it.

`src/trpc/routers/lead-sources.router.ts`: delete the whole `getCustomers` procedure with the comment line above it, and the two imports only it used:

```ts
import { customerListInputSchema, listCustomers } from '@/shared/entities/customers/dal/server/queries'
```

```ts
import { customerSegments } from '@/shared/entities/lead-sources/constants/customer-segments'
```

`TRPCError`, `dalToTrpc`, `db`, `eq`, `leadSourcesTable` and `buildSegmentWhere` are still used by other procedures.

`src/shared/entities/customers/dal/customer-fields.ts`: delete the `sourceId` and `segment` entries and the `customerSegments` import, and drop `fixedOnly` from the `field-list` import:

```ts
import { dateRange, defineFieldList, multiSelect } from '@/shared/dal/lib/query/field-list'
```

`src/shared/entities/customers/dal/server/customer-field-sql.ts`: delete the `sourceId` and `segment` entries of `filter` and the `buildSegmentWhere` import, and drop `eq` from the `drizzle-orm` import:

```ts
import { desc, inArray, sql } from 'drizzle-orm'
```

`src/shared/entities/customers/dal/server/queries.ts`: the doc comment above `listCustomers` becomes

```ts
/** One customers list for every table: `ctx.scope` decides who sees what; a table narrows it with filters, pinned ones included. */
```

- [ ] **Step 7: Tests, type-check, lint, greps**

Run: `NODE_OPTIONS=--conditions=react-server pnpm exec tsx --test .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/customers-table-views.test.ts`
Expected: 4 pass.

Run: `pnpm tsc && pnpm lint`
Expected: clean. (`defineFieldSql` fails `pnpm tsc` if a filter id and its SQL entry disagree, so the two removals are checked against each other.)

Run: `grep -rn "getCustomers\|CUSTOMERS_TABLE_QUERY_CONFIG\|lead-sources-table-query-configs" src`
Expected: no output.

Code read for Review Focus 3, with line numbers in the task report: `customersRouter.business.list` is `customerProcedure` (scope from customer visibility, none for a viewer who can `manage all`); `src/app/(frontend)/dashboard/lead-sources/page.tsx` still redirects a viewer who cannot `manage all`. And for spec §8: with a deleted source the list returns no rows, and the pane's parent (`source-detail.tsx`) reads the source itself and reports it missing.

- [ ] **Step 8: Browser read check (Review Focus 1–4)**

```bash
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-task2 super-admin /dashboard/lead-sources "/dashboard/lead-sources?id=<A>" "/dashboard/lead-sources?id=<B>" "/dashboard/lead-sources?id=<A>&src_p=2&src_leadSource=<B>&src_sourceId=<B>"
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-task2 agent /dashboard/lead-sources
THEN_CLICK='nav[aria-label="Lead sources"] >> text="<name of B>"' pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-task2-switch super-admin "/dashboard/lead-sources?id=<A>"
TABLE_PREFS='{"lead-source-customers":{"sizes":{"name":320,"leadSourceName":240},"visibility":{"leadSourceName":false,"pipeline":false}}}' pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts p2-task2-prefs super-admin "/dashboard/lead-sources?id=<A>"
```

Against `p2-baseline-super-admin.json` and its screenshots, at both widths and in both schemes:
- **All customers pane** (`/dashboard/lead-sources`): the same `columns`, `rows`, `reads[].input` and `reads[].ids`; the section title and "N total" are unchanged;
- **one source's pane** (A, then B): `columns` are Customer, Pipeline, Created (Source is gone, and is not in the Columns menu); `reads` holds only `customersRouter.business.list` entries, each with `input.filters.leadSource` equal to `[<that source's id>]`, and their `ids` and `total` equal the baseline's `leadSourcesRouter.getCustomers` entries for the same source; no entry is a `leadSourcesRouter.getCustomers` read; `url` holds no `src_leadSource` key; the pane's count badge and performance strip above it are unchanged;
- **the old bookmark**: `?id=<A>&src_p=2&src_leadSource=<B>&src_sourceId=<B>` shows page 2 of A's customers (or A's last page if A has one page; the clamp is today's), `input.filters.leadSource` is `[<A>]`, and no chip mentions a source (Review Focus 4);
- **switching** (`p2-task2-switch`, desktop entries): `reads` holds page 1 for A (asked at load) and page 1 for B (asked after the click), each with its own `filters.leadSource`; the final `rows` are B's baseline rows; `readCount` is under ten (A, B, B's Refresh and their next-page prefetches), where a pin that refetched on every render would show dozens (Review Focus 1);
- **the saved layout** (`p2-task2-prefs`): the table loads with no error; `columns` are Customer and Created (Pipeline hidden by the saved layout, Source absent); the Customer column is visibly wider than in `p2-task2` (Review Focus 2);
- `errors` holds no `[prefetch drift]`, no `[data-view]` and no hydration error the baseline did not have;
- the agent's `url` for `/dashboard/lead-sources` is `/dashboard` (Review Focus 3).

By hand, as a super-admin on desktop, in A's pane: a row click opens the profile modal; a Created cell opens its date picker (close it without picking); the toolbar's Pipeline filter narrows the rows and its chip clears.

- [ ] **Step 9: Commit**

```bash
git add -- src/features/lead-sources-admin/constants/all-customers-table-view.ts src/features/lead-sources-admin/constants/lead-source-customers-table-view.ts
git commit -m "refactor(lead-sources): both customers tables are table views of the customers entity table; one source's pane reads the shared list with its source pinned, and getCustomers goes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/features/lead-sources-admin/constants/all-customers-table-view.ts src/features/lead-sources-admin/constants/lead-source-customers-table-view.ts src/features/lead-sources-admin/constants/lead-sources-table-query-configs.ts src/features/lead-sources-admin/ui/components/all-customers-section.tsx src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx "src/app/(frontend)/dashboard/lead-sources/page.tsx" src/trpc/routers/lead-sources.router.ts src/shared/entities/customers/dal/customer-fields.ts src/shared/entities/customers/dal/server/customer-field-sql.ts src/shared/entities/customers/dal/server/queries.ts
git show --stat HEAD
```

---

### Task 3: Edit Profile and Schedule Meeting open the profile modal (Owner confirms 1 and 2)

**Files:**
- Modify: `src/shared/entities/customers/hooks/use-profile-commands.ts`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-modal-content.tsx`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-modal.tsx`
- Modify: `src/shared/entities/customers/components/customers-table/use-customers-table.tsx`

**Interfaces:**
- Consumes: `useCustomersTable` (Task 1); `useCustomerActionConfigs`'s `onEdit` and `onScheduleMeeting` overrides (existing).
- Produces: `CustomerProfileModal` prop `defaultMeetingOpen?: boolean`; `useProfileCommands(defaultMeetingOpen = false)`. In every customers table, Edit Profile opens the profile modal and Schedule Meeting opens it with the Add meeting dialog up. Other callers of `useCustomerActionConfigs` (the pipeline card) are untouched.

Today both actions fall through to `router.push(ROOTS.dashboard.pipeline())` in every customers table, because no table passes `onEdit` or `onScheduleMeeting` (`use-customer-action-configs.ts`, `defaultNavigate`).

- [ ] **Step 1: The modal can open on its Add meeting dialog**

`src/shared/entities/customers/hooks/use-profile-commands.ts`: replace

```ts
export function useProfileCommands(): ProfileCommands {
  const ability = useAbility()
  const [meetingOpen, setMeetingOpen] = useState(false)
```

with

```ts
export function useProfileCommands(defaultMeetingOpen = false): ProfileCommands {
  const ability = useAbility()
  const [meetingOpen, setMeetingOpen] = useState(defaultMeetingOpen)
```

`src/shared/entities/customers/components/profile/customer-profile-modal-content.tsx`: in `Props`, add `defaultMeetingOpen?: boolean` above `defaultTab?: CustomerProfileTab`; add `defaultMeetingOpen` to the destructured props (after `data`); and change `const commands = useProfileCommands()` to

```ts
  const commands = useProfileCommands(defaultMeetingOpen)
```

`src/shared/entities/customers/components/profile/customer-profile-modal.tsx`: replace the `Props` interface and the function's signature line with

```tsx
interface Props {
  customerId: string
  /** Opens with the Add meeting dialog already up, for a caller whose action was "schedule a meeting". */
  defaultMeetingOpen?: boolean
  defaultTab?: CustomerProfileTab
  highlightMeetingId?: string
}

export function CustomerProfileModal({ customerId, defaultMeetingOpen, defaultTab, highlightMeetingId }: Props) {
```

and pass it down: in the `<CustomerProfileModalContent …>` element, add `defaultMeetingOpen={defaultMeetingOpen}` above `defaultTab={defaultTab}`.

The content mounts only once the profile has loaded (it is keyed by the customer's id), so the dialog opens with the customer's name in hand and never over the loading skeleton or the error state.

- [ ] **Step 2: The hook passes both handlers**

In `src/shared/entities/customers/components/customers-table/use-customers-table.tsx`, replace

```tsx
  const { actions, DeleteConfirmDialog } = useCustomerActionConfigs<CustomerTableRow>({ onView: openProfile })
```

with

```tsx
  const scheduleMeeting = useCallback((row: CustomerTableRow) => {
    openModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props: { customerId: row.id, defaultMeetingOpen: true } })
  }, [])

  // Without these two, Edit Profile and Schedule Meeting fall back to opening the pipeline board.
  const { actions, DeleteConfirmDialog } = useCustomerActionConfigs<CustomerTableRow>({
    onView: openProfile,
    onEdit: openProfile,
    onScheduleMeeting: scheduleMeeting,
  })
```

- [ ] **Step 3: Type-check, lint, code read**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

Code read for Review Focus 5, with line numbers in the task report: in `customer-profile-modal.tsx`, `CustomerProfileModalContent` renders only inside `{profileQuery.data && …}`, so a failed or pending profile never mounts the dialog; `CUSTOMER_ACTIONS.scheduleMeeting` carries `permission: ['create', 'Meeting']`, so a viewer who cannot book never sees the action that sets `defaultMeetingOpen`. List the other `CustomerProfileModal` callers (`grep -rn "Component: CustomerProfileModal" src`) and confirm none passes the new prop, so they open as before.

- [ ] **Step 4: Browser read check (nothing submitted)**

With the Playwright MCP browser, or a short script beside `capture.ts` that signs in the same way, as a super-admin and then as an agent, on `/dashboard/customers`, at 1440px and at 390px, light and dark:
- open the first row's menu (the button named "Actions") and choose **Edit Profile**: the customer's profile modal opens (title "<name>'s Profile"); the URL is still `/dashboard/customers`. Close it.
- choose **Schedule Meeting**: the profile opens and the "Add meeting" dialog is up above it, with its form usable and fully on screen at 390px (Review Focus 5). Press Cancel (or Escape): the dialog closes and the profile stays. Close the profile. **Do not submit the form.**
- choose **View Profile** and click a row: the profile opens with no dialog, as before.
- repeat Edit Profile and Schedule Meeting once in `/dashboard/lead-sources` (All pane) and in one source's pane as a super-admin: the same.
- on `/dashboard/pipeline/fresh`, a card's Schedule Meeting still opens the pipeline's own new-meeting modal (that caller passes its own handler).

Screenshots of the Schedule Meeting state at both widths and in both schemes go in the task report.

- [ ] **Step 5: Commit**

```bash
git commit -m "fix(customers): Edit Profile and Schedule Meeting in a customers table open the customer's profile, not the pipeline board

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/entities/customers/hooks/use-profile-commands.ts src/shared/entities/customers/components/profile/customer-profile-modal-content.tsx src/shared/entities/customers/components/profile/customer-profile-modal.tsx src/shared/entities/customers/components/customers-table/use-customers-table.tsx
git show --stat HEAD
```

---

### Task 4: Components move to the entity whose tree they render (O3)

**Files:**
- Move: `src/shared/entities/customers/components/lists/customer-meetings-list.tsx` → `src/shared/entities/meetings/components/customer-meetings-list.tsx`
- Move: `src/shared/entities/customers/components/lists/customer-projects-list.tsx` → `src/shared/modules/projects/core/components/customer-projects-list.tsx`
- Move: `src/shared/entities/customers/components/lists/project-entity-card.tsx` → `src/shared/modules/projects/core/components/project-entity-card.tsx`
- Delete: `src/shared/entities/customers/components/lists/proposal-row.tsx`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx`

**Interfaces:**
- Produces: the same three components at their new paths, markup unchanged; `components/lists/` no longer exists. `ProposalRow` is gone (no importer; `MeetingProposalRow` replaced it).

Path-only. The green left border on `project-entity-card.tsx` is a known design finding left for the profile modal's polish pass: do not touch it.

- [ ] **Step 1: Confirm nobody else holds these files**

Run: `git status --short src/shared/entities/customers/components/lists src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx`
Expected: no output. If any of the five files shows a change (the profile modal's polish pass edits here), stop and ask.

Run: `grep -rn "lists/proposal-row" src`
Expected: no output: nothing imports it (`MeetingProposalRow` replaced it; the `ProposalRow` type in the proposals registry is a different thing).

- [ ] **Step 2: Move and delete**

```bash
git mv src/shared/entities/customers/components/lists/customer-meetings-list.tsx src/shared/entities/meetings/components/customer-meetings-list.tsx
git mv src/shared/entities/customers/components/lists/customer-projects-list.tsx src/shared/modules/projects/core/components/customer-projects-list.tsx
git mv src/shared/entities/customers/components/lists/project-entity-card.tsx src/shared/modules/projects/core/components/project-entity-card.tsx
git rm -- src/shared/entities/customers/components/lists/proposal-row.tsx
```

`customer-projects-list.tsx` imports `./project-entity-card`, which moves with it; every other import in the three files is an `@/` alias. No edit inside them.

- [ ] **Step 3: The one importer**

In `src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx`, replace

```ts
import { CustomerMeetingsList } from '../lists/customer-meetings-list'
import { CustomerProjectsList } from '../lists/customer-projects-list'
```

with

```ts
import { CustomerMeetingsList } from '@/shared/entities/meetings/components/customer-meetings-list'
import { CustomerProjectsList } from '@/shared/modules/projects/core/components/customer-projects-list'
```

- [ ] **Step 4: Type-check, lint, read check**

Run: `pnpm tsc && pnpm lint`
Expected: clean.

Run: `ls src/shared/entities/customers/components/lists 2>/dev/null; grep -rn "components/lists\|\.\./lists/" src --include=*.ts --include=*.tsx`
Expected: no directory, no output.

Browser, super-admin, desktop and 390px: open a customer profile that has meetings and a project (from `/dashboard/customers`); the Meetings tab lists the meeting cards and the Projects tab the project card with its meetings, as before. No screenshot comparison is needed beyond one of each tab.

- [ ] **Step 5: Commit**

```bash
git commit -m "refactor(customers): the profile's meeting and project lists live with the entity whose tree they render; the unused proposal row goes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/entities/customers/components/lists/customer-meetings-list.tsx src/shared/entities/customers/components/lists/customer-projects-list.tsx src/shared/entities/customers/components/lists/project-entity-card.tsx src/shared/entities/customers/components/lists/proposal-row.tsx src/shared/entities/meetings/components/customer-meetings-list.tsx src/shared/modules/projects/core/components/customer-projects-list.tsx src/shared/modules/projects/core/components/project-entity-card.tsx src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx
git show --stat HEAD
```

---

### Task 5: Hand-off: tracker, spec, notes

**Files:**
- Modify: `docs/plans/2026-09-26-records-management-epic.md`
- Modify: `docs/superpowers/specs/2026-10-05-customers-entity-table-and-fixed-filters-design.md`
- Modify: `src/shared/entities/customers/DOCS.md`
- Modify: `docs/ubiquitous-language.md`
- Modify: `docs/codebase-conventions/query-toolkit.md`

Re-read each file first; edit only what this plan built. If a file carries uncommitted hunks you didn't make, do not commit it: report the edit for the owner.

- [ ] **Step 1: The tracker**

In `docs/plans/2026-09-26-records-management-epic.md`:
- the **Status** line at the top: where it lists the order, mark R2 as built ("R2 customers with fixed filters: built") and leave the rest;
- §3, row **R2**, status cell: `[x] built on local main <first-sha>..<last-sha> (part 1: fixed filters, the first-rows window, dashboard reads; part 2: \`useCustomersTable\`, three table views, the one-source pane on the shared list, \`getCustomers\` gone, the \`lists/\` components moved)`, with both parts' first and last commit hashes;
- §3.1 ledger: the **Customers records** row's file becomes `features/records-management/ui/components/customers-records-table.tsx` with every column `[x]`; the two **Lead sources** rows read `[x]` under "Field-list read" and "Shared hook" (through `useCustomersTable`);
- §4, row **O3**: append "Audited and moved in R2: `customer-meetings-list` → meetings, `customer-projects-list` and `project-entity-card` → projects, `proposal-row` deleted. The green border on `project-entity-card` stays for the profile modal's polish pass; the `text-[10px]` finding was already gone."

- [ ] **Step 2: The spec's status**

In the spec, replace the **Status** line with `> **Status:** approved by the owner 2026-10-05; built (plans: \`docs/superpowers/plans/2026-10-05-customers-entity-table-and-fixed-filters.md\` and \`…-part-2.md\`).` If the owner chose differently on §5.5, say what was built in one sentence under §5.5.

- [ ] **Step 3: Notes that name moved or deleted paths**

- `src/shared/entities/customers/DOCS.md`, the "This directory holds" line: replace "components grouped by surface (`components/profile/`, `components/lists/`, `components/timeline/`)" with "components grouped by surface (`components/profile/`, `components/timeline/`) and the entity table hook (`components/customers-table/`)".
- `docs/ubiquitous-language.md`, the action-surface table: the `Profile/Projects/Project` row's file becomes `shared/modules/projects/core/components/project-entity-card.tsx`; the `Profile/Projects/Project/Meeting/Proposal` row's file becomes `shared/entities/meetings/components/meeting-proposal-row.tsx` (it already lived there; the row was stale).
- `docs/codebase-conventions/query-toolkit.md`, section "shared-table-config": its **Reference impl** line names the deleted `src/shared/entities/customers/constants/customers-table-query-config.ts`; point it at `src/features/records-management/constants/customers-records-table-view.ts` (the `query` of a table view). The section's text still describes the legacy `PaginatedQueryConfig` names; leave that and name it in the report.

- [ ] **Step 4: Report what this plan leaves stale elsewhere**

Do not edit these; list them in the task report for the owner:
- `docs/superpowers/specs/2026-09-29-customers-module-design.md` (lines naming `core/components/lists/project-entity-card.tsx` as moving with customers, and `lists/proposal-row.tsx` as a Phase 1 deletion): both already happened here.
- `docs/superpowers/specs/2026-10-01-customer-profile-modal-design.md` and its plan name `components/lists/customer-meetings-list.tsx`, now `src/shared/entities/meetings/components/customer-meetings-list.tsx`.

- [ ] **Step 5: Session memory (not in git)**

In `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/project-records-table-enrichment.md` and `project-data-view-filtering.md`, record: R2 built (both parts, commit range); the data view has `fixed` (config and runtime) and a `first` window; the three customers tables are table views of `useCustomersTable`; next is R3 proposals. Update the two matching lines in `MEMORY.md`.

- [ ] **Step 6: Commit**

```bash
git commit -m "docs(records): R2 is built; the tracker, the spec and the notes that named moved files follow

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- docs/plans/2026-09-26-records-management-epic.md docs/superpowers/specs/2026-10-05-customers-entity-table-and-fixed-filters-design.md src/shared/entities/customers/DOCS.md docs/ubiquitous-language.md docs/codebase-conventions/query-toolkit.md
git show --stat HEAD
```

---

## Self-review notes (kept for the executor)

- **Spec coverage.** §5.2 (the hook) → Task 1 Step 3; §5.3 (three table views, the records table, old files deleted) → Task 1 Steps 4–6, Task 2 Steps 2–5; §5.4 (the pane's read, `getCustomers`, `sourceId`, `segment`) → Task 2 Steps 4 and 6; §5.5 → Task 3; §7 (ownership moves) → Task 4; §8 (deleted source, old bookmark, two prefixes) → Task 2 Steps 1, 7 and 8; §10 (tracker) → Task 5, with H2 and O9 done in part 1; §11 (baseline, URL keys, saved layout, one request, console) → Task 1 Steps 1 and 8, Task 2 Step 8. Success criteria: the `getCustomers` grep is Task 2 Step 7; the `liveOnly` grep is part 1.
- **Type consistency.** `CustomerTableRow` (Task 1 Step 2) types the registry, `useCustomerActionConfigs<CustomerTableRow>`, `openProfile`, `scheduleMeeting` (Task 3) and the query rows. `CustomerColumnKey` types all three table view constants. `UseCustomersTableOptions.fixed` is `FilterValues<typeof CUSTOMER_FIELDS>`, the type of `useDataViewQuery`'s fourth argument; the pane's `{ leadSource: [leadSourceId] }` matches the field's `string[]` value. `defaultMeetingOpen` is the same name in the modal, its content and the hook's `openModal` props.
- **Order.** Task 2 needs Task 1's hook and types. Task 3 edits the hook from Task 1. Task 4 is independent and may run any time after Task 1. Task 5 is last.
- **Checked while writing (2026-10-05, on a scratch copy of the tree at `834614d7` with part 1 applied).** Every code block here was applied in task order, and `tsc --noEmit` and ESLint passed after Tasks 1, 2, 3 and 4; the table views test passed (4). The capture script was type-checked only; no browser step was run.
