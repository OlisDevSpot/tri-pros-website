# Production stress audit: drift ledger (2026-10-14)

> **Status:** OPEN. Findings recorded, nothing fixed. Treat each theme at its root (design first, then code). Do not patch findings one by one.
> **Audited code:** `origin/main` = `eff6ff23f` (prod on 2026-10-14). Local `main` has moved since (e.g. `84adb9f0b` put the VoIP lines on the compiler), so **re-verify every file:line against the current code before acting**. Line numbers drift.
> **Evidence (local, gitignored):** `.superpowers/stress-2026-10-14/{perm,ui,prod,data,perf,arch}/FINDINGS.md`, with each audit's scripts, raw JSON and screenshots beside it. The scripts re-run against any dev server (see "How this was measured").
> **Legend:** ✔ = re-verified by the coordinating session in code, a live call or a screenshot; unmarked = reported by one audit with evidence in its FINDINGS file, not independently re-checked.

## Why this document exists

The findings below are not mainly a list of bugs. They mostly show **drift**: places where the codebase has two or more ways of doing one thing, and the older way has no guard. Patching each finding would leave the old way in place, and it would produce the next one. Each theme names the root, the evidence, and the decision it needs. Severity is about exposure on prod today.

### Live exposure: decide first whether to contain it before the root fix

Two items leak or allow writes on prod right now. The owner chooses: contain them now with a narrow fix and do the root work after, or do the root work first.

- **B1:** homeowner personal data is served to anyone through the portfolio endpoints.
- **C1:** the QuickBooks OAuth callback accepts any caller.

---

## Theme A: two permission engines, and the legacy one fails open

**Root:**
- Compiled CASL rules (Customer, CustomerNote, Meeting, Proposal, and on local main VoIP lines/texts) live beside a legacy path: `ctx.scope`, `resolveVisibilityScope`, `legacyScoping`, `spec.visibility`.
- In the legacy path `scope: null` means *no filter*: `create-http-context.ts:9,18` seeds it, and `create-crud-dal.ts:53-62` makes every check a no-op.
- A forgotten line therefore fails **open**.
- Role checks use `manage all` as a stand-in for "is super-admin" (about 20 sites), so a new role falls into the permissive `else`.

**Evidence:**
- ✔ **Project family is open to every agent:** read, edit or delete any project, set `isPublic`, all media operations, and drag any project's stage with an unvalidated `toStage`.
  - Files: `projects.router/crud.router.ts:13-56`, `media.router.ts`, `move-customer-pipeline-item.ts:60-80`.
  - `projectAccessProcedure` only keeps dispatchers out.
  - Delete is gated only in the client (`projects/core/constants/actions.ts:42`).
  - Live probe: an agent passes the delete gate.
- **Converting a family unscopes its hand-written readers.**
  - `scope-middleware.ts:22` returns `null` once a spec is compiled. Every `ctx.scope ?? undefined` reader then loses its filter silently.
  - Readers: `projects/core/dal/server/queries.ts:195`, `meetings/dal/server/queries.ts:288-290`, `projects/media/dal/server/mutations.ts:26,48,54`, `projects/media/service.ts:56,61`.
  - **This is the trap part 4 (Project family) walks into.**
- **Activities:** `scheduleRouter.activities.getById` returns another user's activity to agents and dispatchers, and `complete` has no owner check (`activities.router.ts`). Dispatchers hold no Activity rule yet pass. Probed live.
- ✔ **Meeting `ownerId` change skips the `assign Meeting` check.** The update hook guards only `setBy` (`entities/meetings/dal/server/crud.ts:100-113`), which bypasses the super-admin-only participant management.
- ✔ **`voipCampaignsRouter.listEnrolledLeads`** is on bare `agentProcedure` and returns every enrolled lead's id and name (`voip-campaign-contacts/.../queries.ts:147`).
- **Meeting create, update and `assignToProject` check `customerId`, never `projectId`** (`crud.ts:56,103`, `customer-pipelines.router.ts:125-136`). Once Project rules use `$participatesViaMeeting` via `projectId`, linking a meeting to a project *grants* reach to it. — update no longer accepts customerId (2026-10-14); create and assignToProject remain.
- **Meeting hooks treat `ctx.actor.userId === null` as trusted** (`crud.ts:56,61,103`). Share-link actors also have `userId: null` (`contexts.ts:41`). — update no longer accepts customerId (2026-10-14); create and assignToProject remain.
- **Defaults favour new roles:** `get-accessible-pipelines.ts:14-22` falls through to the agent's pipelines, and there are about 20 `can('manage','all')` role checks (`pipeline-items.ts:62`, `get-action-queue.ts:125,162`, `phone-gating-sql.ts:41`, …).
- `getCustomerProjects` (`customer-pipelines.router.ts:102-115`) gives dispatchers project titles and stages, bypassing `projectAccessProcedure`.
- `getSourceCampaignSummaries` gives agents and dispatchers all lead sources, although they hold no lead-source rule.
- `applications`: an agent can create one on a meeting they don't reach, and dispatchers pass `draft.*`. Empty on prod.
- `createCrudRouter`'s `assertCan` / `assertCanUpdateFields` duplicate the DAL for compiled specs and are the only check for legacy ones.

**Inventory (arch audit):**

| Bypass | Count |
|---|---|
| Raw `db` outside `/dal/` | 18 files |
| DAL files reading compiled tables with no reach check | customers 7, meetings 10, proposals 4 |
| Functions that take a context and ignore it | 17 |
| Legacy `ctx.scope` readers | 17 |
| `{...ctx, scope: null}` stamps | 11 router sites |
| Row-touching routes with no reach check | ~40 |
| Bare `SYSTEM_CONTEXT` with no reason | 14 |
| `systemContext(reason)` | 27, 2 of them client-driven |
| Legacy specs with `visibility` | 11 |

**Decision needed (design, before part 4 code):**
- One seam for both engines: a `permit`-shaped adapter for legacy specs, `ScopedContext.scope` deleted, and the legacy default flipped to deny.
- References (`customerId`, `projectId`, `meetingId`) declared on the spec and checked by `createCrudDal` on create and change.
- Named capabilities instead of `manage all` role checks, with every default branch denying.
- Which of the bypasses above are folded into part 4 and which get their own unit.

**Owner:** permissions epic #285. Part 4 is the Project family; its plan is on the branch, `docs/superpowers/plans/2026-10-12-permissions-unit-3-part-4-project-family.md`.

## Theme B: reads filter rows but not columns (no read model)

**Root:**
- Hand-written readers do `.select()` on whole rows, or pick columns ad hoc.
- Column trimming against the read rules (`projectToReadFields`) runs at 4 sites, against 32 `permit(...).sql` row filters.
- Public endpoints have no notion of a public read model.

**Evidence:**
- ✔ **B1 — homeowner PII is public (live exposure).**
  - Four unauthenticated procedures return whole `projects` rows for all 43 public projects: `landingRouter.projectsRouter.getProjects`, `getProjectByAccessor`, `projectsRouter.showroomDisplay.getAll` and `getDetail`.
  - Those rows include `homeownerName`, `address`, `zip`, `customerId`, `ownerId`, `qbSubCustomerId`, `pipelineStage` and the media bucket/path keys.
  - Sources: `features/landing/dal/server/projects.ts:36`, `shared/modules/projects/core/dal/server/queries.ts:78`.
  - Live check: `showroomDisplay.getDetail` returned a non-null `homeownerName`.
  - Two portfolio projects are slugged after the homeowner's full name and city, are in the sitemap, and their HTML carries street address and zip.
- ✔ **Proposal view leaks gated phones.** `proposals/core/dal/server/queries.ts:91` selects raw `customers.phone`, so `getFullView` returns the phone where the pipelines gate it. 5 of 5 probes confirmed it.
- **Proposals list payload:** about 300 KB per 20 rows (`form_meta_JSON`, `project_JSON`, `funding_JSON`).
- **Agents receive full project rows** through `crud.getAll` (all 66).

**Decision needed:**
- One read entry point that filters rows *and* trims columns, e.g. `readRows(ctx, spec, columns)`.
- An explicit **public read model** for anything served to anonymous visitors.
- The owner's call on the two homeowner-named portfolio projects: consent, rename or unpublish.

## Theme C: public and unauthenticated entry points each guard themselves differently

**Root:** there is no shared contract for an endpoint without a session, such as "verify the capability → rate-limit → narrow, server-derived write → generic error". Each route improvises one.

**Evidence:**
- ✔ **C1 — QuickBooks OAuth callback (live exposure).**
  - `src/app/api/quickbooks/callback/route.ts` checks no session and no signed `state`. It exchanges any `code` and calls `upsertTokens` with the caller's `realmId`, and the token save deletes the existing tokens first (`access-token-cache.ts:15`).
  - The raw Intuit error is echoed on a 500.
  - The prod probe got `invalid_client` back, so **check that the integration works at all.**
- ✔ **Public intake ignores the lead-source token.** `customersRouter.business.createFromIntake` (`customers.router/business.router.ts:80`) is `baseProcedure`. The `/intake` page checks source, token and active status; the mutation checks none of them and accepts any `leadSourceSlug`. Each call creates a customer (optionally a meeting) and a paid Twilio lookup. The only limit is 5 per hour per IP.
- **Funnel lead updates** (`funnels.router.ts:227-252`, `customer-intake.service.ts:147`) treat the customer UUID as a permanent capability. They are IP-limited and only affect funnel customers.
- **Notion SOW procedures** (`constructionRouter.sow.byScope`, `sow.content`) are public, return 500 on a bad id with Notion's error text, and expose internal SOW templates.
- **Webhooks:**
  - Zoho Sign accepts any signature when its secret env is unset.
  - The Google Calendar webhook never checks the channel token.
  - The QuickBooks webhook compares signatures with `===`, which is not timing-safe.
  - `qstash-jobs` parses JSON before verifying the signature and returns 500 on a bad signature (route.ts:103,118).
- **Error shapes:** `proposalsRouter.contracts.*` throws plain `Error` → 500 for a missing proposal (contracts.service.ts). `moveCustomerPipelineItem` throws a TypeError on an unknown `fromStage`.
- **Dev and test pages are live on prod:** `/test`, `/dev/pwa-probe`, `/dev/multi-step-flow` and `/auth/create-user` return 200 (what `create-user` exposes is **unverified**). robots disallows `/tests`, but the route is `/test`.
- **Presigned upload URLs** come from the public `intake.getRecordingUploadUrl` and from the agent procedure `projects.media.getUploadUrl`, the latter even for a made-up project.

**Decision needed:**
- A written contract for public endpoints, with one helper per capability kind (lead-source token, funnel lead token, OAuth `state`, webhook signature).
- An inventory of every `baseProcedure` and every `src/app/api/**` route against that contract.
- A rule for dev-only routes in prod builds.

## Theme D: the customer pipeline is derived in four places

**Root:**
- `customers.pipeline` / `customers.pipeline_stage` (columns) coexist with derivation from `meetings.pipeline` and outcomes.
- Four shapes exist: `derivedPipelineSql`, `deriveCustomerPipelines`, `deriveMeetingPipeline`, and `OUTCOME_PIPELINE_MAP`.
- `OUTCOME_PIPELINE_MAP` is typed `Record<string,…>`, so it isn't checked against the outcome list, and it maps `not_good`/`ftd` to rehash, not dead.

**Evidence (prod data):**
- ✔ **182 of 822 customers (22%) show a different pipeline in the records table than on the board.**
  - The table reads the column first (`entities/customers/lib/derived-pipeline-sql.ts:25`); the board reads `meetings.pipeline` (`pipeline-items.ts:151-178`).
  - Breakdown: 170 are table `fresh` / board rehash.
  - Lead-source segments (`segment-sql.ts:22-25`) use the column version too.
- **6 customers are on no board.** `pipeline_stage = 'schedule_manager_meeting'` with no meetings; `group-customers-by-stage.ts:13` drops unknown stages silently.
- **8 customers are on two boards.**
- **26 rows** hold `customers.pipeline_stage` values with no column.

**Owner:** the sales-lifecycle work (`docs/plans/2026-10-01-sales-lifecycle-rules-map.md` R34–R38, and the handoff `docs/plans/2026-10-07-pipeline-derivation-handoff-to-lifecycle.md`).

**Decision needed:**
- One derivation module that produces both the SQL and the TS from one outcome table checked against the enum.
- Retire `customers.pipeline` as a source, or define its role.
- The fallback for unknown stages.

## Theme E: invariants that are not enforced on write (prod data)

**Root:** rules live in UI or service code paths, but neither the database nor the CRUD hooks enforce them, so old rows and side paths drift.

**Evidence:**
- **Phones:**
  - 7 customer phones are not bare 10 digits. Exact-match lookups miss them: inbound text/call matching (`findCustomerByPhone`, `queries.ts:113`) and the DNC check (`compliance.service.ts:51`).
  - 10 duplicate-phone groups (22 rows). Lookups `limit(1)` with no order.
- **Sale dates:**
  - 5 `approved` proposals have no `approved_at`. `sale.ts:14` says an undated sale must surface as a data fix, and analytics dates sales by that field.
  - 6 `declined` proposals carry `approved_at` and `contract_signed_at`.
  - 46 sent, approved or declined proposals have NULL `sent_at`.
- **Calendar:**
  - 30 of 39 cancelled meetings still hold a `gcal_event_id`, all last updated before the 2026-10-12 calendar fix.
  - Event ids: 2 are on the new deterministic scheme, 307 are legacy (expected).
- **Overdue outcomes:** 28 meetings are more than 2 hours past and still `not_set`.
- **Single-row orphans:** 1 proposal without a meeting, 1 private project with no customer, owner or stage, and 1 note linked to a missing meeting.
- **Latent bug:** dragging a card on the projects board updates an arbitrary project for the customer (`move-customer-pipeline-item.ts:61`). It is harmless today because no customer has two projects.

**Decision needed:**
- Which invariants become database constraints or CRUD hooks: phone normalization on every write path, `approved_at` required with `approved`.
- Each data fix is the owner's call: run the calendar sync for the 30, backfill the 5 dates, merge duplicates.

## Theme F: public-site routes and metadata are built by hand

**Root:** links, canonicals and asset paths are written by hand or inherited, and no check verifies that a route or asset exists.

**Evidence:**
- ✔ **Canonical URLs:** every page's canonical is the homepage. `src/app/(frontend)/layout.tsx:103` sets it and only the funnels override it.
- **Broken links and assets:**
  - All 26 trade pages link to `/portfolio/<accessor>`, which 404s (`portfolio-proof.tsx:99,113`); the right path is `/portfolio/projects/<accessor>`.
  - The sitemap lists `/portfolio`, which 404s.
  - `/about` links to `/join/careers`, which 404s.
  - `/services/{luxury-renovations,energy-efficient}-hero.jpg` are missing (`pillar-config.ts:44,67`).
- **Funnel:** complete-interior returns 525 on its subdomain and 500 at `/funnels/complete-interior`. Its spec is a stub (`steps: []`) that the slug check accepts.
- **Hosts:** apex → www is a 307 (temporary). Canonical, og:url and the robots `Host:`/`Sitemap:` lines name the apex, while sitemap `<loc>`s use www. HSTS lacks `includeSubDomains`.
- **Headers:** no CSP, no `frame-ancestors`/X-Frame-Options (the dashboard and proposal pages can be framed), no nosniff, Referrer-Policy or Permissions-Policy, and `x-powered-by` is sent.
- **Titles:** 29 repeat the brand twice, 3 pages use the bare default, and `/portfolio/projects` has no `<h1>`.
- **Hydration:** `/blog` throws React error #418.
- **Weight:** about 470–575 KB of JS per page, and a 421 KB global CSS file that includes dashboard styles. Hero images are PNG/JPEG (352–519 KB); portfolio detail pages are 3.9–5.5 MB. Mobile CLS on the travertine project is 0.238.

**Decision needed:**
- Every internal link and canonical built from `ROOTS` (the ESLint nav-path rule exists; find why these slipped past it).
- A build-time or CI check that links and assets in the sitemap and pillar configs resolve.
- A global headers policy.
- Stub funnels return `notFound()`.

## Theme G: layout primitives and loading contracts with gaps

**Root:**
- Shared primitives lack width constraints: frozen columns, rails, toolbars.
- Not every view follows the data-view loading contract (suspense read + boundary).
- Identity is split between a server prop and the client session.

**Evidence (UI audit, prod code on a dev server):**
- ✔ **Phone Meetings records table:**
  - The frozen "Meeting" column is 420px on a 390px screen, so no other column is ever visible.
  - At the scroll end it slides off-screen, and its unpin control is off-screen too.
  - Source: `data-table.tsx:111` (`frozen ?? true`, no clamp), `data-table-row.tsx:94`.
  - Screenshot: `ui/shots/meet-phone__dispatcher__500.png`.
- ✔ **Two tabs, user switch:**
  - Tab B after a sign-out and a sign-in as another role in tab A: a "This section failed to load" banner, endless "Loading…", inert nav, and a footer still showing the old user.
  - No data leaks.
  - Source: the footer reads `user` from the server layout prop (`app-sidebar.tsx:53/247`), and nothing redirects to sign-in or re-runs after the cache clear (`permissions/client.tsx`).
- **Hydration:**
  - Analytics fails on every direct load: `useQuery` reads a streamed pending prefetch (`features/analytics/ui/views/analytics-view.tsx:25`).
  - Sidebar `useId` mismatch, intermittent (31 loads): `AppSidebar > SidebarSearchBar`. Likely the ability-built nav differs at hydration.
- **Overflow and clipping:**
  - The phone proposal editor (`edit-proposal-view.tsx`) has 457px of content in a 358px box, with toolbar buttons off-screen.
  - The schedule week view at 1440 and 1024 (sidebar open) cuts Friday and hides Saturday, with no scroll cue.
  - The phone schedule search collapses to about 45px.
  - Phone month-view labels overprint the next day.
  - Lead-source rail names collapse at 1024.
- **Insets:** the desktop project detail page ignores the page insets.
- **States:**
  - No Retry on "Failed to load profile".
  - "No customers match your filter" shows with no filter applied.
  - Nav clicks give no pending feedback for 1.5–3.4 s (dev; check prod).
- **Keyboard:** ←/→ change the page, and the table scroller is `tabIndex=-1`.

**Decision needed:**
- Constraints in the primitives: frozen-column clamp, rail and toolbar minimums.
- One loading contract enforced for every dashboard view.
- One client source for identity.

## Theme H: performance (scope is not the problem)

The compiled scope adds no measurable cost, there are no N+1s, and concurrency 15 gave 0 errors. Network round trips dominate: about 40 ms per statement against Neon, while the database executes each in 0.5–3 ms. Issues:
- **`getCustomerProfile`:** 7 sequential awaits (`get-customer-profile.ts`). About 3 round trips is possible (≈280 → ≈120 ms).
- **`meetings.reads.list`:** per-row proposal subqueries do a full scan of `proposals`. No usable index on `proposals.meeting_id` (only a partial unique one). The cost grows with meetings × proposals.
- **Dashboard and schedule:** prefetch 5 meeting windows where 1 is on screen (about 15–18 statements per load).
- **Unpaginated reads:** pipe.leads (517 rows, 245 KB) and the action queue (241 rows).
- **Proposed indexes (DDL only, nothing created):**
  - `proposals(meeting_id) INCLUDE (status, created_at)`
  - `meetings(customer_id)`, `meetings(scheduled_for)`, `meetings(project_id)`
  - `meeting_participants(user_id, meeting_id)`
  - `projects(customer_id)`
  - `customer_notes(customer_id, created_at DESC)`
  - `proposal_views(proposal_id)`

  They belong in the Drizzle schema.

## Theme I: docs, memory and comments describe the old system

Each one needs a doc fix, made to match the code.
- ⚠️ ADR-0002 (lines 17, 43, 55, 95, 105-119) and ADR-0003 describe `EntityServerSpec`, `AuthedContext`, `scopeMiddleware`, `ctx.ability`.
- ⚠️ `src/trpc/DOCS.md:358` calls manual `isOmni` branching an anti-pattern; the code has about 20 of them.
- ⚠️ Permissions tracker D-06 names `MEETING_OUTCOME_CLASS` as the single source; the code has `OUTCOME_PIPELINE_MAP`. D-04 cites `pipeline-items.ts:434`; the rule is at `:438-440`.
- ⚠️ Memory says a lint rule keeps `dal/server` private; prod `eslint.config.js` has none.
- About 80 code comments cite issues or plans, which CLAUDE.md forbids.
- Dead code:
  - Functions: `getCallByIdSystem`, `getDidByIdSystem`, `findOrCreateCustomerFromHomeowner`, `voipMessagesService.fetchThread`.
  - Unused API: `crud.getAll`/`getAllProjects`, `homeownerRules`, `$inDerivedPipeline`, the never-called `afterCommit`.
  - Files: `eslint.config.mjs`, the compatibility re-export in `trpc/types.ts`.
- Vocabulary:
  - `scope` means both the row filter and the construction **Scope** (`crud.router.ts:36`).
  - "Reach", "actor" and "share link" are in neither glossary.
  - There are two glossaries (`CONTEXT.md`, `docs/ubiquitous-language.md`).

---

## What held up (do not re-litigate)

- **Concurrency:** 300 requests at concurrency 10 across roles. No actor leakage, no 5xx, and `getProfile` always returned the caller.
- **Role walls:**
  - Dispatcher: all customers and meetings, never `flowStateJSON`, proposals refused, projects refused except `getCustomerProjects`.
  - Share link: its own proposal only, never cost lines.
  - Anonymous: 54 of 67 tRPC queries answer UNAUTHORIZED; the remainder are public by design.
- **Field-level write gates:**
  - Dispatcher: `flowStateJSON`, `projectId`, `age` refused; `name` allowed.
  - Agent: `name` refused; `age` allowed.
  - Bearer: only `financeOptionId` and `cashInDealCents`.
- **Compiled core:** denies by default and throws on an unknown operator. Every write also requires read reach. Startup checks cover the rule structure, and there is one cached actor per request.
- **Prod schema:** matches the Drizzle schema exactly (54 tables, 560 columns, 67 FKs, constraints and indexes).
- **No other bad prod data:** no `updated_at` before `created_at`, no future rows, no negative money, unique share tokens and gcal ids.
- **Public site:**
  - http→https is a 308 everywhere, and junk paths get a clean 404.
  - No source maps, no CORS to foreign origins, no cookies on public pages.
  - `/api/dev/playwright-session` returns 404.
  - Share-link routes with garbage tokens give a clean 404.
- **Edge-to-edge layout:** no page-level overflow in 18 role × viewport × theme walks. Nothing hidden under the phone dock, and hidden scrollbars still scroll.
- **Modals and recovery:** the profile modal survives open/close/tab spam and resizing. Escape and focus return work. A 4 s delay shows skeletons, and an RSC 500 recovers.

## How this was measured (so it can be re-run)

- **Code under test:** a detached worktree at `eff6ff23f` (`.worktrees/stress-prod`), served on `:3001` against the **dev** database.
- **Sign-in:** through `/api/dev/playwright-session` with `DEV_LOGIN_SECRET`.
- **Roles:** anonymous, super-admin, agent (dev test agent with 0 meetings, plus one real agent with 83 meetings, signed in by email), dispatcher, user, homeowner, and a share-link bearer.
- **Write safety:** mutations were sent only with random UUIDs or schema-invalid payloads. A FORBIDDEN/UNAUTHORIZED answer means the request was refused before any data access; NOT_FOUND/BAD_REQUEST means it passed the gate. Some "gate passed" findings are therefore inferred: random id plus code reading.
- **Prod:** GET/HEAD only for the site; SELECT-only aggregate SQL for the database. No personal data printed.
- **Not covered:** writes with real ids; valid public form submissions; WebKit/real iOS; the service worker offline path; prod-only conditions (`VERCEL_ENV`, whether the Zoho secret is set); batched tRPC; applications, VoIP enrollments, the Zoho send and the Drive upload (no dev data).

## Owner decisions collected

1. **Live exposure — RULED 2026-11-13: root-first for both.** No narrow containment. B1 is fixed by the Theme B public read model; C1 moves to the QuickBooks epic (item 6).
2. **The two homeowner-named portfolio projects — RULED 2026-11-13: keep; the homeowners consented.** Names, titles and slugs stay. Street address, zip and internal ids still leave the public payload through the Theme B read model.
3. **Data fixes:** gcal sync for the 30 cancelled meetings; backfill `approved_at` for 5 proposals; merge 10 duplicate-phone groups; record the 28 overdue outcomes; resolve 3 orphans; re-save 7 phones. *Open; taken one by one with Theme E.*
4. **Theme D ownership and sequencing** with the lifecycle work. *Open; asked when Theme D starts.*
5. **Theme A scope — RULED 2026-11-13: merge part 4 first.** The "one seam" work is its own unit after part 4 reaches main. Note (2026-11-13): the permissions branch, last touched 2026-10-15, also carries parts 5–6, unit 4 part 1 and Q8 batches 3–4, including the intake token check (`5412e1dca`) that answers part of Theme C.
6. **QuickBooks — RULED 2026-11-13: the integration will be in use soon.** The callback (C1) is fixed properly when QuickBooks is built (memory `project-quickbooks-setup`), not in this work. Until then the callback stays as it is on prod: no session, no `state`.
