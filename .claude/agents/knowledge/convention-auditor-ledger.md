# Convention Auditor — Ledger

Pointers + verification dates only. Docs remain the single source of truth.
Entries older than the doc's last git edit must be re-verified before citing.

## service-architecture (last verified 2026-07-09)
- Rule: four-tier split; pure-local utility never lives in `services/providers/` — source: docs/codebase-conventions/service-architecture.md#the-deciding-question + Anti-patterns
- Exemplar: `src/shared/services/pdf.service.ts` (internal service, ScopedContext, DAL-only reads) (verified 2026-07-09)
- Known drift: ⚠️ service-architecture.md:105-121 (`provider-directory-shape`) cites `sanitize-filename.ts` as the example provider `lib/` file — will go stale when the proposal-pdf-export spec relocates it to `src/shared/lib/sanitize-filename.ts` (reported 2026-07-09; propose doc edit in same PR)
- Rulings: `sanitizeFilename` has TWO importers (`zoho-sync.service.ts:6`, `providers/zoho-sign/lib/documents/assemble-envelope.ts:6`), not one as the 2026-07-09 spec claims.

## dal-conventions / backend layering (last verified 2026-07-09)
- Rule: only DAL imports `db`; services/routes go through DAL with ScopedContext/SYSTEM_CONTEXT — source: docs/codebase-conventions/dal-conventions.md + memory coding-conventions Rule 19
- Exemplar: `src/app/api/proposals/[proposalId]/summary/route.ts:1-34` (SYSTEM_CONTEXT + token gate); `src/shared/services/pdf.service.ts:27-34` (generateSowPdf shape) (verified 2026-07-09)
- Known drift: ⚠️ memory `coding-conventions.md` Rule 15 key-files table says `shared/dal/server/lib/types.ts`; actual file is `src/shared/dal/server/types.ts` (SYSTEM_CONTEXT at line 41). `lib/` holds helpers.ts/create-crud-dal.ts only. Reported 2026-07-09.

## frontend-stack (last verified 2026-07-09)
- Rule: one component per file, named exports, no file-level constants/helpers, lucide-only icons, shadcn over native HTML, motion/react — source: docs/codebase-conventions/frontend-stack.md
- Exemplar: `src/features/proposal-flow/ui/components/navbar/navbar.tsx` (hasMounted+CASL pattern at 24-32) (verified 2026-07-09)
- Known drift: `src/features/proposal-flow/ui/components/proposal/view-mode-toggle.tsx` exports 3 components + a local hook in one file (pre-existing violation of one-component-per-file); `ViewModeToggleMobile` uses raw `<button>` (Rule 17 drift). Both are removal/refactor targets of the 2026-07-09 pdf-export spec.

## urls-and-origins (last verified 2026-07-09)
- Rule: app-page paths via ROOTS.*; ESLint `project/no-raw-nav-paths` guard — source: docs/codebase-conventions/urls-and-origins.md
- Ruling: the lint regex (`eslint.config.js:6-7`) deliberately covers app-page prefixes only, NOT `/api/*`. ROOTS has no API-route builders; precedent builds API URLs inline (`providers/upstash/lib/create-job.ts:19` — `publicUrl('/api/qstash-jobs?...')`). Client hrefs to first-party API routes: template literal acceptable; put the builder in a feature `lib/` helper when 2+ consumers.

## webhook-routes (last verified 2026-07-09)
- Rule: async webhooks → `/api/webhooks/<provider>`; sync request-response → `/api/<domain>/<purpose>` — source: docs/codebase-conventions/webhook-routes.md (async-vs-sync split)
- Exemplar: `/api/proposals/[proposalId]/summary` (first-party sync-read under domain namespace) (verified 2026-07-09)

## proposals entity (last verified 2026-07-09)
- Rules used: `#shareable-via-token` (token IS authorization), `#final-tcp-derived` (never persist; computeFinalTcp), token-not-a-secret anti-pattern — source: src/shared/entities/proposals/DOCS.md
- Exemplar: summary route token gate `summary/route.ts:15-34`; `computeFinalTcp` use at `summary/route.ts:121` (verified 2026-07-09)

## proposal-flow feature (last verified 2026-07-09)
- Rules used: `#view-mode-defaults-to-customer-casl-gates-agent` (CASL gate inside useViewMode — never read `?view` directly); cost lines agent-only (Anti-patterns) — source: src/features/proposal-flow/DOCS.md
- Exemplar: `hooks/use-view-mode.ts`; gate pattern in navbar.tsx:30 (verified 2026-07-09)

## pdf pipeline (last verified 2026-07-09)
- Rule: pdf generation is a shared lib (`src/shared/lib/pdf/`), NOT a provider — source: service-architecture.md "Current classification" line 323
- Exemplars: `sow-doc-definition.ts` (styles: Roboto→Helvetica, 10pt, pageMargins [56,56,56,56]); `render-pdf.ts:30` renderPdf(def): Promise<Buffer>; pdfkit tracing at `next.config.ts:41-45` (serverExternalPackages + per-route outputFileTracingIncludes glob) (verified 2026-07-09)

## enum-standardization / user roles (last verified 2026-07-09)
- Rule: fixed-set string → const array in `constants/enums/<domain>.ts` → type `(typeof)[number]` → pgEnum in `db/schema/meta.ts` — source: enum-standardization.md#const-array-source-of-truth,#pgenum-from-const; database-schema.md#pgenum-placement,#pgenum-uses-const-array
- Exemplar: `src/shared/constants/enums/user.ts:1` (`userRoles`); `src/shared/db/schema/meta.ts:33` (`userRoleEnum`)
- Known drift: none. Ruling: `UserRole` type is inlined in `user.ts:2` (not `types/enums/`) — acceptable, still derives. APPEND new role to END of array (pgEnum order is positional in PG).

## db-migrations workflow (last verified 2026-07-09)
- Rule: schema sync via `pnpm db:push:dev` (drizzle-kit push), NOT hand-authored SQL migration files; NEVER `pnpm db:push` (prod) — source: database-schema.md:82; CLAUDE.md
- Known drift: none. Note: appended enum value emits `ALTER TYPE ... ADD VALUE` under push. Touchpoint framing "write a Drizzle migration" conflicts w/ repo convention (push, not generate).

## casl-abilities (last verified 2026-07-09)
- Rule: one `case '<role>'` block per role; field-level grants via 3rd-arg array; new subject → ENTITY_NAMES/AppSubject — source: abilities.ts:11-16 HOW-TO-EXTEND
- Exemplar: `src/shared/domains/permissions/abilities.ts:89` (agent), :93 (field-level Customer update)
- Known drift: meetings/DOCS.md#ownership-model's `can('delete','Meeting',{ownerId})` marked PLANNED, not implemented — documented, not hard drift.

## visibility-scope-middleware (last verified 2026-07-09)
- Rule: `EntityServerSpec.visibility: (userId:string)=>SQL`; `scope = isOmni ? null : spec.visibility(userId)` — source: trpc/DOCS.md#scope-middleware-is-the-core-superpower; types.ts:69
- Exemplar: `scope-middleware.ts:19-21`; `helpers.ts:71` (buildUserContext)
- Known drift: none. RISK: signature is a hard contract in scope-middleware.ts:20 + helpers.ts:71 + every `entities/*/lib/visibility.ts`. `leads` bucket (active customer, no meeting) is invisible to participation-scoped agents BY CONSTRUCTION (`userCanSeeCustomer` requires a meeting participation).

## phone-gating (last verified 2026-07-09)
- Rule: agent phone only via `gatedPhoneSql(...)` at DAL; unlock threshold proposal status IN('sent','approved') — source: customers/DOCS.md#phone-visibility-threshold; phone-numbers.md
- Exemplar: `phone-gating-sql.ts:33`
- Known drift: param named `isSuperAdmin` but ALL ~10 consumers pass `isOmni` (ability.can('manage','all')/scope===null/ability==null). Semantic = "ungated", not "is-super-admin". Doc says "super-admins always see it" while code ungates all omni+SYSTEM. Rename→capability on dispatcher refactor.

## meetings-ownership (last verified 2026-07-09)
- Rule: create.before forces `ownerId=session.user.id` for authed (anti-spoof); SYSTEM_CONTEXT passes ownerId through — source: meetings/DOCS.md#ownership-model,#meeting-owner-is-creator; server-spec.ts:49-54
- Exemplar: `meetings/lib/server-spec.ts:49`; `getSystemOwnerId` at `entities/users/dal/server/system.ts`
- UNBUILT: `sales_agent` role, `isDispatched` derivation (`lib/is-dispatched.ts`), "info@ owns = unassigned dispatch inbox" all PLANNED (meetings/DOCS.md#participant-roles-are-meeting-contextual Status:PLANNED, #dispatched-derived). Current roles owner/co_owner/helper. Dispatcher meeting "lands in inbox" has NO consumer yet.
- Ruling: extending create.before IS the sanctioned extension point (hooks contract types.ts:93).

## pipeline-access (last verified 2026-07-09)
- Rule: `getAccessiblePipelines(ability)` binary — omni→all, else hardcoded `['projects','fresh']` — source: get-accessible-pipelines.ts:7,14. Sidebar `get-sidebar-nav.ts` is CASL-driven (`ability.can(...)`).
- Known drift: none, but binary design; a role needing a DIFFERENT set (`leads`) forces role/ability-driven refactor, not a boolean fork.

## Unwritten best practices (candidates for docs/)
- Boolean-role-proxy → capability: `gatedPhoneSql(isSuperAdmin)` + `getAccessiblePipelines` omni-fork are role-proxy booleans with no written rule against them. Candidate permissions-topic rule: "gate on a CASL capability/subject, not on `role===x`/`isSuperAdmin` booleans." Promote via README decision tree.
- API-route URLs have no ROOTS builders and are exempt from the nav-path lint by design — urls-and-origins.md doesn't say this explicitly; candidate one-liner for that doc.
- `sanitizeFilename` collapses whitespace to `_` and does not strip `"` — callers embedding it in a quoted `Content-Disposition` header should strip quotes (header-injection edge). Candidate note wherever the helper lands.
