# 07 — Flow catalog + context waterfall (every permission-touching flow, end to end)

> Read-only trace of worktree `.worktrees/issue-285` @ `b40403b6`. Every claim cites `file:line` as of that commit. Facts only — no design. Prior reports `01`–`05` were used as leads; every row below was re-verified in code.
> Paths are relative to the worktree root. `SM` = `src/trpc/lib/middleware/shareable-middleware.ts`, `CCR` = `src/trpc/lib/create-crud-router.ts`, `CCD` = `src/shared/dal/server/lib/create-crud-dal.ts`, `RAS` = `src/shared/dal/server/lib/resolve-actor-scope.ts`.

## 0. Engine legend (which code decides the row set)

| Tag | Mechanism | Code |
|---|---|---|
| **LEGACY** | `spec.visibility(auth)` fragment AND parent bridge, omni pre-collapsed to `null` | `resolveEffectiveScope` `src/shared/dal/server/lib/scope.ts:37-48`; callers `resolveVisibilityScope` `src/trpc/lib/middleware/scope-middleware.ts:19-25`, `buildUserContext` `src/shared/dal/server/lib/helpers.ts:65-78`, `SM:45` |
| **CASL** | `rulesToAST(ability,'read',subject)` → `interpret` → SQL; child = verb-only AND parent bridge; `system`→`null`, `token`→`actor.scope` | `compileScope` `src/shared/domains/permissions/scope/compile-scope.ts:22-35`; `resolveActorScope` `RAS:22-35` (`'read'` hard-coded `:25-26`); tRPC wrapper `src/trpc/lib/middleware/resolve-trpc-actor-scope.ts:18-23` |
| **PROBE** | Point check `SELECT 1 … WHERE pk=id AND <compiled scope>` | `canAccess` `RAS:55-73` (11 call sites, §1.3) ; legacy `isInScope` `scope.ts:90-97` (1 caller) |
| **TOKEN-EQ** | `eq(tokenColumn, token)` stamped as scope | `SM:62`; canonical `resolveShareTokenActor` `src/shared/domains/permissions/lib/share-token-actor.ts:21-29` → `validateShareToken` `.../validate-share-token.ts:28-50` (raw `db` `:34-38`) |
| **VERB** | `ability.can(action, subject[, field])` with no row component | `CCR:185-197`, `CCR:214-230`, inline `ctx.ability.can/cannot` in handlers |
| **HAND** | Hand-rolled owner/participant compare in handler or DAL | e.g. `schedule.router/activities.router.ts:111`, `assert-note-author.ts:7-16` |
| **NONE** | No row or verb decision beyond the procedure rung | — |

Actor factories: `userActor` `src/shared/domains/permissions/scope/actor.ts:19`, `tokenActor` `:23`, `systemActor` `:27`; `SystemReason` union has 2 variants `src/shared/domains/permissions/scope/system-reasons.ts:8-15`.

---

## Part 1 — Principal × entry-surface flow catalog

### 1.1 P0 — Unauthenticated visitor (no session, no token)

`createHTTPTRPCContext` resolves `session` from headers (`src/trpc/lib/create-http-context.ts:15-17`) and stamps `ability:null, scope:null, actor:null` (`:21-23`). RSC prefetch uses the same shape with `req: undefined` (`:37-38`). Every row below runs with that ctx untouched.

| # | Entry `file:line` | Rung | ctx built | DAL/service called | Engine | Reach |
|---|---|---|---|---|---|---|
| P0-1 | `src/trpc/routers/app.ts:24` `healthcheck` | `baseProcedure` | HTTP ctx literal | — | NONE | `'ok'` |
| P0-2 | `src/trpc/routers/funnels.router.ts:61-70` `phoneLookup` | `baseProcedure` | HTTP ctx | `validatePhoneLine` (Twilio) | NONE (IP rate-limit `:64-68`) | line-type verdict for any E.164 |
| P0-3 | `funnels.router.ts:73-198` `submitLead` | `baseProcedure` | `SYSTEM_CONTEXT` passed at `:121` | `customerIntakeService.ingestLead` `src/shared/services/customer-intake.service.ts:61-158` → `customerCrud.create` `:74`, `upsertLeadAttribution` `:91`, `customerNoteCrud.create` `:116,:129`, `meetingCrud.create` `:144` (meeting null here) ; `notificationService.notifyNewLead` `:153`; `metaCapiEventJob.dispatch` `:166` | NONE (rate-limit `ip:phone` `:104`; Twilio mobile gate `:111-119`) | creates a customer + attribution + notes as SYSTEM |
| P0-4 | `funnels.router.ts:203-222` `enrichFunnelLead` | `baseProcedure` | `SYSTEM_CONTEXT` `:217` | `customerIntakeService.enrichFunnelLead` `:168-181` → `upsertFunnelEnrichment` (no ctx) | NONE — capability = `leadId` UUID + `matched` guard `:175-177` | writes enrichment rows for any funnel-kind customer whose id is known |
| P0-5 | `funnels.router.ts:227-249` `setFunnelLeadAddress` | `baseProcedure` | `SYSTEM_CONTEXT` `:241` | `setFunnelLeadAddress` `:187-210` → `getCustomerAttribution` `:191` (kind gate `:194-197`) → `customerCrud.update(ctx)` `:196` | NONE — capability = `leadId` UUID | rewrites address/city/state/zip of any funnel customer |
| P0-6 | `src/trpc/routers/intake.router.ts:26-54` `getRecordingUploadUrl` | `baseProcedure` | HTTP ctx | `r2Client.getPresignedUploadUrl` `:46-51` (bucket `homeownerFiles`) | NONE (IP rate-limit `:33-41`) | anyone mints a 15-min R2 upload URL |
| P0-7 | `src/trpc/routers/landing.router/index.tsx:21-50` `scheduleConsultation`, `:51-87` `generalInquiry` | `baseProcedure` | `SYSTEM_CONTEXT` at `:126` | `emailService.*`; `ingestWebsiteLead` `:104-144` → raw `db.select(leadSourcesTable)` `:112-116`, `customerCrud.create(SYSTEM_CONTEXT)` `:126`, raw `db.insert(customerNotes)` `:137-141` (bypasses note hooks + author stamp) | NONE | creates customer + note as SYSTEM |
| P0-8 | `landing.router/projects.router.ts:6-14` `getProjects`, `getProjectByAccessor` | `baseProcedure` | HTTP ctx | `src/features/landing/dal/server/projects.ts:6,:34` (no ctx) | NONE (public-by-design) | public portfolio |
| P0-9 | `src/trpc/routers/projects.router/showroom-display.router.ts:6-15` `getAll`, `getDetail` | `baseProcedure` | HTTP ctx | `getPortfolioProjects` `src/shared/entities/projects/dal/server/queries.ts:15`, `getPortfolioProjectDetail` `:70` (no ctx) | NONE (public-by-design) | public portfolio |
| P0-10 | `src/trpc/routers/notion.router/scopes.router.ts:9-55` ×5, `trades.router.ts:6-17` ×2 | `baseProcedure` | HTTP ctx | `constructionDataService.*` (Notion) | NONE | full trade/scope/SOW catalog incl. `getSOWContent` `:43-55` |
| P0-11 | `src/trpc/routers/customers.router/business.router.ts:134-249` `createFromIntake` | `customerPublicProcedure` (= `baseProcedure`, `customers.router/procedures.ts:32`) | reads `(ctx as {req}).req` `:160`, `(ctx as {session}).session ?? null` `:182`; passes `SYSTEM_CONTEXT` `:224` | rate-limit `:160-164`; Twilio gate `:168-176`; raw `db.select(user)` fallback owner `:211-215`; `customerIntakeService.ingestLead(SYSTEM_CONTEXT)` `:224-238` (meeting owner = session user or `info@`) | NONE — the `/intake` page token (P1-13) is NOT re-checked here | anyone creates customer (+ meeting owned by `info@`) |
| P0-12 | `src/trpc/routers/proposals.router/business.router.ts:28-31` `getFinanceOptions` | `proposalPublicProcedure` (= `baseProcedure`, `proposals.router/procedures.ts:48`) | HTTP ctx | `getFinanceOptions()` (no ctx) | NONE | finance-option catalog |
| P0-13 | `src/trpc/routers/ai.router/index.ts:7-22` `dispatchProjectSummaryJob` | `baseProcedure` | HTTP ctx | `generateAISummaryJob.dispatch` `:18` → job `generate-ai-summary.ts:8` → `aiService.generateProjectSummary` → `src/shared/services/providers/ai/client.ts:96-113` raw `db.update(proposals).set({projectJSON})` for `input.proposalId` | NONE — **not public-by-design**; 0 client callers (grep `dispatchProjectSummaryJob` outside the router = none) | anyone overwrites `projectJSON.summary/energyBenefits` on any proposal id |
| P0-14 | Pages: `src/app/(frontend)/(site)/**/page.tsx` (public site), `portfolio/projects/[projectAccessor]/page.tsx:41-49` → `getPortfolioProjectDetail` (no ctx); `src/app/sitemap.ts:56` → `getPortfolioProjects` | RSC | none | projects public queries | NONE | public |
| P0-15 | `src/app/(frontend)/funnels/[trade]/page.tsx:39-48` | RSC | none | none server-side; client `FunnelEngine` drives P0-2..5 | NONE | — |
| P0-16 | `src/app/(frontend)/dashboard/layout.tsx:14,34` | RSC | `getCachedSession` `src/shared/domains/auth/lib/get-cached-session.ts:19-21` | none | session-only gate (`!session` → `<DashboardSignIn/>`) | sign-in screen |
| P0-17 | `src/app/api/quickbooks/callback/route.ts:8-61` | route handler | none | `upsertTokens` (raw `qbAuthTokens` `access-token-cache.ts:15-16`) | NONE (no `state`, no session) | whoever completes an Intuit OAuth redirect writes the QB token row |
| P0-18 | `src/app/api/voip/routing/{caller-lookup,compliance-check,transfer-target}/route.ts` | route handler | none | none (Phase-0 mocks) | NONE | mocked JSON |
| P0-19 | `src/app/api/dev/playwright-session/route.ts:64-152` | route handler | none | `auth.$context.internalAdapter` create user/session `:93-119` | env + host + secret gate `:69-75` (404 on any failure) | mints a real session for any role (non-prod only) |
| P0-20 | `src/app/api/auth/[...all]/route.ts:4` | better-auth | — | better-auth | Google-only social login `src/shared/domains/auth/server.ts:15-33`; new users default role `'user'` `:74`, `@triprosremodeling.com` → `'agent'` `:38-48` | session creation |

Also reachable by P0 with a **valid share token**: see §1.2 (P1 is P0 + token).

### 1.2 P1 — Share-token bearer (homeowner, no session) — EXHAUSTIVE

Token mechanics: (i) tRPC shareable procedures read `token` from the **raw input body** (`SM:59-60`, `getRawInput()`), not the URL; (ii) route handlers read `?token=` from the URL (`pdf/route.ts:15`, `summary/route.ts:18`); (iii) `recordView` validates through `resolveShareTokenActor` (`views.router.ts:41`). Two distinct token→scope paths exist: `SM:62` (`eq(table[tokenColumn], token)` — no existence check, empty result = NOT_FOUND downstream) and `share-token-actor.ts:25-28` (pre-validates via raw `db` then `eq(proposals.id, resourceId)`).

Client-side token plumbing: `use-current-proposal.ts:7-9` (URL `?token` → `getFullView`), `funding.tsx:29,60,147`, `proposal/index.tsx:38-44` (recordView), `index.tsx:71,119` (PDF URL built from the **returned** `proposal.token`), contract panel `use-contract-status.ts:20`, `customer-age-form.tsx:25`, `envelope-configuration-section.tsx:58,65`, `homeowner-contract-view.tsx:31`.

| # | Entry `file:line` | Rung | ctx built (exact shape) | DAL/service | Engine | Reach for a valid token |
|---|---|---|---|---|---|---|
| P1-1 | Page `src/app/(frontend)/proposal-flow/proposal/[proposalId]/page.tsx:18-25` | RSC | none (`loadProposalSearchParams` only) ; layout `proposal-flow/layout.tsx:17-19` reads session solely for `isAuthenticated` splash flag | none | NONE (page renders for anyone; data via P1-2..) | shell |
| P1-2 | `proposals.router/business.router.ts:16-20` `business.getFullView {id, token?}` | `proposalShareableProcedure` (`procedures.ts:45` = `baseProcedure.use(shareableMiddleware(proposalServerSpec))`) | token branch `SM:59-67`: `{ ...ctx, session: null, ability: null, scope: eq(proposals.token, token), actor: tokenActor(scope,'Proposal') }` | `getFullView(ctx)` `src/shared/entities/proposals/dal/server/queries.ts:88-155` (scope `:122`); inside: `listProposalIncentives(row.id)` `:146` and `listHomeownerProposalMedia(row.id)` `src/shared/entities/proposal-media-files/dal/server/queries.ts:56-62` (both keyed by the scoped row's id, `visibility='homeowner'` filter `:60`) | TOKEN-EQ | full proposal row (incl. `token`, `ownerId`, envelope ids, `projectJSON`), customer name/phone/email/address/age, `meetingProjectId`, incentives, homeowner media |
| P1-3 | `proposals.router/views.router.ts:36-74` `views.recordView {proposalId, token, source…}` | `systemProcedure` (`= baseProcedure`, `src/trpc/init.ts:39`) | handler-built: `resolveShareTokenActor(token,'proposal')` `:41` → literal `{ session:null, ability:null, scope: resolveActorScope(proposalServerSpec, actor), actor }` `:50` (`compileScope` token branch returns `actor.scope` `compile-scope.ts:25-26`) | `getFullView` `:49-52`; `recordProposalView({proposalId: input.proposalId,…})` `src/shared/entities/proposal-views/dal/server/mutations.ts:15-25` (no ctx, plain insert); `sendViewNotificationJob.dispatch` `:66-73` | TOKEN-EQ (canonical path) + handler | inserts one `proposal_views` row for the token's proposal; push/email to owner |
| P1-4 | `CCR:115-126` `proposals.crud.getById {id, token?}` (`proposals.router/crud.router.ts:20-25`, `spec.shareable` `proposals/lib/server-spec.ts:39`) | factory `shareableProcedure` `CCR:101,104` | same token-branch shape as P1-2 | `proposalCrud.getById(ctx)` → `CCD:117` `and(eq(pk,id), requireResolvedScope(ctx.scope))` | TOKEN-EQ; VERB gate skipped (`CCR:118` `if (ctx.ability)`) | raw proposal row. **0 client callers** (grep `proposalsRouter.crud.getById` = none) |
| P1-5 | `CCR:140-153` `proposals.crud.update {id, data, token?}` | factory `shareableProcedure` `CCR:105` | token-branch shape | `proposalCrud.update(ctx)` → hooks `proposals/lib/server-spec.ts:76-85` (`update.before` lock ladder only if `touchesFrozenLockedFields`) → `CCD:213` scoped write; `after` recompute `:89-93` | TOKEN-EQ; **field gate skipped** `CCR:147-149` | any column in `insertProposalSchema.partial()` (`server-spec.ts:21` — everything but server-derived `kind`): `status`, `ownerId`, `meetingId`, `contractSentAt/SignedAt/DeclinedAt`, `contractEnvelopeId`, `projectJSON`, `startingTcpCents`, `priceDisplayMode`, `financeOptionId`, `envelopeDocumentIds`… on the token's row. Live client use: `funding.tsx:60` (`financeOptionId`). (= `03` §E1-3) |
| P1-6 | `proposals.router/funding.router.ts:17-25` `funding.setCashInDeal {id, token?, cashInDeal}` | `proposalShareableProcedure` | token-branch shape | `setCashInDeal(ctx)` `proposals/dal/server/mutations.ts:55-83`: scoped read `:60-70`, `isProposalFrozen` `:74`, then **unscoped** `db.update … where(eq(id))` `:78-80` | TOKEN-EQ (read) ; write keyed by id after the scoped read | `cash_in_deal_cents` on own row. Client `funding.tsx:147` |
| P1-7 | `proposals.router/contracts.router.ts:33-69` `contracts.getContractStatus {id, token?}` | `proposalShareableProcedure` | token-branch shape | `getFullView(ctx)` `:36`; `contractService.getContractEnvelopeStatus` `:63` (Zoho, no ctx) | TOKEN-EQ | envelope status + timestamps. Client `use-contract-status.ts:20` |
| P1-8 | `contracts.router.ts:113-147` `contracts.evaluateEnvelopeContext {id, token?}` | `proposalShareableProcedure` | token-branch shape | `getFullView(ctx)` `:116`; pure `evaluateDocuments` `:138-139` | TOKEN-EQ | customer age + doc evaluation. Client `envelope-configuration-section.tsx:58` (agent panel passes token too) |
| P1-9 | `contracts.router.ts:178-266` `contracts.applyEnvelopeContext {id, token?, age?, envelopeDocumentIds?}` | `proposalShareableProcedure` | token-branch shape | handler gate `:191` (`ctx.ability == null && envelopeDocumentIds !== undefined` → FORBIDDEN); `getFullView(ctx)` `:198`; `isProposalFrozen` `:206`; **`customerCrud.update(systemContext('derived:contract-age-from-token-proposal'), {id: proposal.customer.id, data:{age}})`** `:223-226`; `proposalCrud.update(ctx, {envelopeDocumentIds})` `:255-258` | TOKEN-EQ (read) → SYSTEM (customer write) → TOKEN-EQ (proposal write, field gate skipped) | writes `customers.age` for the proposal's customer (as system) and `envelopeDocumentIds` (reconciled) on own row. Client `customer-age-form.tsx:25` |
| P1-10 | `proposals.router/delivery.router.ts:77-97` `delivery.requestToMoveForward {id, token}` | `proposalShareableProcedure` | token-branch shape | `getFullView(ctx)` `:80`; `contractSignedAt` gate `:84`; `notificationService.notifyHomeownerMoveForwardRequest` `:88-94` (no ctx) | TOKEN-EQ + handler | email/push to meeting participants. Client `homeowner-contract-view.tsx:31` |
| P1-11 | `src/app/api/proposals/[proposalId]/pdf/route.ts:10-55` `GET ?token=` | route handler | `resolveShareTokenActor` `:21` → literal `{ session:null, ability:null, scope: resolveActorScope(proposalServerSpec, actor), actor }` `:27`; then **`SYSTEM_CONTEXT`** `:36` | `getFullView(ctx)` `:26-29` (row check + filename) → `pdfService.generateProposalPdf(SYSTEM_CONTEXT)` `src/shared/services/pdf.service.ts:22-29` → `getFullView(SYSTEM_CONTEXT)` `:23` | TOKEN-EQ (canonical) then SYSTEM re-read | full PDF for the token's proposal. Session is never consulted. Client `get-proposal-pdf-url.ts:2-4` |
| P1-12 | `src/app/api/proposals/[proposalId]/summary/route.ts:13-135` `GET ?token=` | route handler | `resolveShareTokenActor` `:24` → literal ctx `:31` | `getFullView(ctx)` `:30-33` | TOKEN-EQ (canonical) | plaintext dump incl. customer phone/email/address `:56-59` + pricing/incentives `:100-130`. 0 client callers (`TODO` `:29`) |
| P1-13 | `src/app/(frontend)/intake/page.tsx:15-64` `GET /intake?source=&token=` | RSC | no ctx; raw `db.select(leadSourcesTable).where(slug)` `:34-38`; `row.token !== token` → `notFound()` `:40-41`; bare hits → session read `:22-23` only to route super-admins `:25-27` | renders `IntakeFormView` (client) → drives P0-11 `createFromIntake` and P0-6 `getRecordingUploadUrl` (both `baseProcedure`, **no token re-check**) | HAND (one-off compare; F4) | page render only; the writes it triggers are P0-public |
| P1-14 | `funnels.enrichFunnelLead` / `setFunnelLeadAddress` (P0-4/5) with `leadId` | `baseProcedure` | `SYSTEM_CONTEXT` | see P0-4/5 | NONE (capability id) | as P0-4/5 |
| P1-15 | **voip-link-tokens** — `spec.shareable: { tokenColumn: 'token' }` `src/shared/entities/voip-link-tokens/lib/server-spec.ts:25`; `voipLinkTokensService.mintToken(ctx)` `src/shared/services/voip/voip-link-tokens.service.ts:87-122` / `resolveToken` `:133-163` / `markUsed` `:170-176` | — | — | `voipLinkTokenCrud` `voip-link-tokens/dal/server/crud.ts:5`; `getTokenByValue` `queries.ts:23-40` (raw, no ctx) | — | **DEAD**: no `createCrudRouter({spec: voipLinkTokenServerSpec})`, no `/api/voip/links/[token]` route (`find src/app/api` shows none), 0 consumers of `voipLinkTokensService` / `voipLinkTokenCrud` outside the entity+service files |
| P1-16 | Public procs the homeowner page also calls (no token): `proposals.business.getFinanceOptions` (P0-12, `use-get-finance-options.ts`), `notion.scopes.getSOWContent` (P0-10, `sow-field.tsx:250`) | `baseProcedure` | HTTP ctx | — | NONE | catalogs |

Token-path facts that cross flows:
- `proposals.media.*` (`proposals.router/media.router.ts`) run on `proposalMediaProcedure` = `agentProcedure` chain (`procedures.ts:39-42`) — **no homeowner path**; homeowner media arrive only through P1-2's `listHomeownerProposalMedia`.
- `proposals.incentives.replace` is `proposalProcedure` (`incentives.router.ts:22`) — agent-only; the homeowner never writes incentives.
- Session-first rule (`SM:39-51`): any session (incl. role `user`/`homeowner`) makes the token **ignored** — see P5-3.
- `ctx.ability == null` is used as the *role proxy* for "homeowner" at `contracts.router.ts:191`, `CCR:118`, `CCR:147`, `proposals.router/media.router.ts:20` (`?.cannot(...) !== false`).

### 1.3 P2 — Agent (role `agent`, session)

Grants: `abilities.ts:105-192`. `ctx` after `agentProcedure`: `{ session, ability, scope: null, actor: userActor(id, ability) }` (`init.ts:60`). Rows are grouped by the rung that stamps `ctx.scope`.

**A. Entity-scoped procedures (per-entity middleware stamps `ctx.scope`)**

| # | Entry | Rung (scope engine) | DAL/service | Engine at DAL | Extra decision | Reach (agent) |
|---|---|---|---|---|---|---|
| P2-1 | `customers.router/business.router.ts:50-96` `business.list` | `customerProcedure` `customers.router/procedures.ts:26-29` (CASL `resolveTrpcActorScope`) | inline `db.select(customers)` with `requireResolvedScope(ctx.scope)` `:64` | CASL | — | customers via `$participatesViaMeeting{via:'customerId'}` `abilities.ts:108` |
| P2-2 | `business.router.ts:101-131` `business.search` | `customerProcedure` | inline `db.select` `:120-130`; phone column via `gatedPhoneSql(canSeeUngatedPhone(ctx.actor))` `:124` (`phone-gating-sql.ts:42-46`) | CASL + `ctx.ability.can('manage','all')` `:107` for text WHERE | handler | name-search within scope; phone gated |
| P2-3 | `customers.router/profile.router.ts:17-27` `profile.upsert` | `customerProcedure` | `upsertCustomerProfile(ctx)` `customers/dal/server/mutations.ts:30-52` (parent probe `:37-46` only `if (ctx.scope)`) | CASL (parent probe) | VERB `cannot('update','CustomerProfile')` `:20` | profile of a visible customer |
| P2-4 | `customers.crud.{getById,create,update,delete,duplicate}` `customers.router/crud.router.ts:31-60` | factory `authedProcedure` `CCR:99-100` with `resolveScope: resolveTrpcActorScope` `:50` (CASL) | `getById` overridden → `getCustomer(ctx)` `customers/dal/server/queries.ts:66-97` (scope `:81`, phone gate `:51`); others `customerCrud.*` → `CCD` | CASL | VERB per slot `CCR:119,131,158,165`; field-level on update `CCR:148` (agent may update only `age` `abilities.ts:113`); `delete.before` cascade runs `meetingCrud.delete(SYSTEM_CONTEXT)` `customers/lib/server-spec.ts:140` (agents lack `delete Customer` → never reached); `update.after` job `:99-101` | own-scope customers; `create` FORBIDDEN (no grant) |
| P2-5 | `meetings.router/reads.router.ts:14-18` `reads.list`, `:20-28` `getByIdWithJoins` | `meetingProcedure` `meetings.router/procedures.ts:20-23` (CASL) | `listMeetings(ctx)` `meetings/dal/server/queries.ts:115` (scope `:151`, phone gate `:165`); `getByIdWithJoins(ctx)` `:264` (scope `:294`, phone `:279`) | CASL | — | meetings via `$participatesViaMeeting{via:'self'}` `abilities.ts:131` |
| P2-6 | `reads.router.ts:30-46` `getInternalUsers` | `meetingProcedure` | raw `db.select(user)` `:35-45` | none (users table) | VERB `cannot('assign','Meeting')` `:32` (agent has no `assign` → FORBIDDEN) | super-admin only |
| P2-7 | `meetings.router/participants.router.ts:34-47` `getParticipants` | `meetingProcedure` | `isParticipant` `:39`, `getParticipantsForMeeting` `:46` (no ctx) | HAND (`isOmni || isParticipant`) | handler | participants of meetings the agent is on |
| P2-8 | `participants.router.ts:51-221` `manageParticipants` | `meetingProcedure` | raw participant DAL + `meetingCrud.update(ctx)` `:107,:132,:139,:200`; raw `db.query.meetingParticipants` `:167-172`; `schedulingService.syncMeeting` `:216` | CASL (only on the `meetingCrud.update` legs) | VERB `cannot('assign','Meeting')` `:59` → agent FORBIDDEN | super-admin only |
| P2-9 | `meetings.router/business.router.ts:27-76` `setOutcomeWithReason` | `meetingProcedure` | raw `db.select(meetings)` `:42-46` (**unscoped read** of customerId/scheduledFor); `meetingCrud.update(ctx)` `:52` (scoped); `customerNoteCrud.create(ctx)` `:66` (→ note hook `canAccess(customerServerSpec, ctx.actor)` `customer-notes/lib/server-spec.ts:58`) | CASL (write) / none (pre-read) | DAL hook (note) | outcome on visible meeting; note on visible customer |
| P2-10 | `meetings.crud.*` `meetings.router/crud.router.ts:14-36` | factory `authedProcedure` with `resolveScope: resolveTrpcActorScope` `:35` (CASL) | `meetingCrud` `meetings/dal/server/crud.ts:20-188`: `create.before` server-resolves owner via `resolveMeetingOwnerId(ctx)` `:33-38` (`ctx.ability?.can('own','Meeting')` `resolve-owner.ts:14`); `create.after` `addParticipant(row.ownerId)` `:52` (creator gains visibility of any `customerId` — create slot has no scope `CCD:129-157`); `update.before` pipeline derivation `:79-87`; `update.after` GCal/Ably `:102-135`; `delete.before` GCal job `:157-161` | CASL | VERB per slot (`delete Meeting` not granted to agent → FORBIDDEN `CCR:158`); field-level on update `CCR:148` (unrestricted `can('update','Meeting')`) | create on **any** `customerId` (`03` §E1-4) |
| P2-11 | `proposals.router/business.router.ts:22-26` `business.list` | `proposalProcedure` `proposals.router/procedures.ts:28-31` (CASL) | `listProposals(ctx)` `queries.ts:163-277` (scope `:226`) | CASL | — | proposals via `$participatesViaMeeting{via:'meetingId'}` `abilities.ts:136` |
| P2-12 | `business.getFullView` (P1-2) with session | `proposalShareableProcedure` **session branch** `SM:39-51`: `{ ...ctx, session, ability, scope: isOmni ? null : resolveEffectiveScope(proposalServerSpec, …), actor: userActor }` | `getFullView(ctx)` | **LEGACY** (`proposalVisibility` `proposals/lib/visibility.ts:8-11` = `userParticipatesInMeeting`) | — | same row set as CASL for agents (parity noted in `03`); token in body ignored |
| P2-13 | `proposals.crud.getById/update` (P1-4/5) with session | factory `shareableProcedure` session branch | `proposalCrud.*` | LEGACY | VERB `CCR:119` / field gate `CCR:148` (unrestricted `update Proposal`) | own-scope proposals, all fields |
| P2-14 | `proposals.crud.create/delete/duplicate` | factory `authedProcedure` with **default** `resolveVisibilityScope` (`CCR:98`, no `resolveScope` in `proposals.router/crud.router.ts:20-25`) | `proposalCrud.create` → `create.before` reads **any** `meetingId` via `meetingCrud.getById(SYSTEM_CONTEXT)` `proposals/lib/server-spec.ts:53-58` and copies `flowStateJSON`; `duplicate` override `duplicateProposalWithIncentives` `crud.router.ts:24`; spec duplicate `ownerId: ctx.session!.user.id` `:119` | LEGACY | VERB (`delete Proposal` not granted → FORBIDDEN) | create bound to any meeting (`03` §E1-4) |
| P2-15 | `contracts.{createContractDraft,submitContract,recallContract,discardDraftContract,resendContract}` `contracts.router.ts:71-105` | `proposalProcedure` (CASL) | `contractService.*(ctx, proposalId)` `src/shared/services/contracts.service.ts:35-164` → `getFullView(ctx)` + `proposalCrud.update(ctx)`; `createDraft` `:21-31` → `zohoSyncService.createEnvelope` (registry generator runs `pdfService.generateSowPdf(SYSTEM_CONTEXT)` `zoho-sign/lib/documents/registry.ts:154`) | CASL (through ctx) | — (no verb check; row scope only) | envelope lifecycle on visible proposals |
| P2-16 | `contracts.getContractStatus/evaluateEnvelopeContext/applyEnvelopeContext` (P1-7/8/9) with session | `proposalShareableProcedure` session branch | as P1 rows; `applyEnvelopeContext` passes the `:191` gate (ability non-null) and still writes `customers.age` via `systemContext(...)` `:223-226` | LEGACY | handler gate | agent edits doc selection + age |
| P2-17 | `delivery.sendProposalEmail` `delivery.router.ts:38-67` | `proposalProcedure` (CASL) | `emailService.sendProposalEmail` (reads `ctx.session.user.email/name` `:48-49`); `proposalCrud.update(ctx)` `:53-56`; **`deriveOutcomeOnProposalSent(SYSTEM_CONTEXT, …)`** `:63` → `meetingCrud.update(SYSTEM_CONTEXT)` `meetings/dal/server/mutations.ts:42` | CASL then SYSTEM | — | sends + marks own proposal; meeting outcome written as system (class A, §3) |
| P2-18 | `delivery.requestToMoveForward` (P1-10) with session | shareable session branch | as P1-10 | LEGACY | — | agent can fire the homeowner signal |
| P2-19 | `funding.setCashInDeal` (P1-6) with session | shareable session branch | as P1-6 | LEGACY | — | — |
| P2-20 | `incentives.replace` `incentives.router.ts:22-35` | `proposalProcedure` (CASL) | `replaceProposalIncentives(ctx)` `proposal-incentives/dal/server/mutations.ts:30-65` (scoped read `:45`, frozen gate `:49`, raw tx `:53-61`) | CASL | VERB `cannot('update','Proposal')` `:28` | incentives on visible proposal |
| P2-21 | `views.getProposalViews` `views.router.ts:76-80` | `proposalProcedure` (CASL) | `getProposalViews(ctx)` `proposal-views/dal/server/queries.ts:31-54` → **`isInScope(proposalServerSpec, ctx, id)`** `:36` (legacy point probe against the CASL-stamped `ctx.scope`, `scope.ts:90-97`) | CASL scope via legacy probe | DAL probe | view stats for visible proposals |
| P2-22 | `proposals.media.*` `proposals.router/media.router.ts:33-109` (8 procs) | `proposalMediaProcedure` `procedures.ts:39-42` (CASL child bridge) | `assertCanUpdate(ctx)` `:19-23` (`ctx.ability?.cannot('update','Proposal') !== false`); `assertProposalVisible` → `canAccess(proposalServerSpec, ctx.actor, id)` `:26-30` on `getUploadUrl/create/list`; `proposalMediaCrud.update(ctx)` `:75`; `mediaService.{createRecord,list,reorder,rename,removeRecord}(store, ctx)` `src/shared/services/media/media.service.ts:36-83` → `store.crud`/`media-ops` scoped (`media-ops.ts:36,57,90,112,121`); `retryOptimization` probes child `canAccess(proposalMediaServerSpec, …)` `:104` | CASL (bridge) + PROBE | VERB + PROBE in handler | media of visible proposals |
| P2-23 | `projects.crud.list` `projects.router/crud.router.ts:22-35` | `projectProcedure` `projects.router/procedures.ts:15-19` (CASL) | `listProjects(ctx)` `projects/dal/server/queries.ts:197` (scope `:202`) | CASL | — | projects via `ownerId=me OR $participatesViaMeeting{via:'projectId'}` `abilities.ts:149-150` |
| P2-24 | `projects.media.*` `projects.router/media.router.ts:21-209` (11 procs) | `projectMediaProcedure` `procedures.ts:30-34` (CASL child bridge) | `canAccess(projectServerSpec, ctx.actor, projectId)` on `getUploadUrl :29`, `listImportableProposalMedia :111`, `importFromProposal :164`; `canAccess(mediaFileServerSpec, …)` `:53`; **`create` `:42-48` has no probe** (`mediaService.createRecord(store, ctx, …)` → `CCD:129-157` create has no scope); raw `db.select(proposalMediaFiles ⋈ proposals ⋈ meetings)` `:114-129`, `:169-181` bounded by `meetings.projectId = input.projectId` | CASL (bridge) + PROBE / none on create | PROBE in handler | media of visible projects; create on **any** `projectId` (`03` §E1-4) |
| P2-25 | `applications.business.{list,getWithAnswers}` `applications.router/business.router.ts:17-27`, `applications.draft.{save,submit,withdraw}` `draft.router.ts:16-35` | `applicationProcedure` `applications.router/procedures.ts:20-23` (**LEGACY** `resolveVisibilityScope`; spec has only `parent: meetingServerSpec` `applications/lib/server-spec.ts:24` → bridge through `meetingVisibility`) | `applications/dal/server/queries.ts:31,:57`; `mutations.ts:34,:74,:163` (`requireResolvedScope(ctx.scope)`) | LEGACY (meeting bridge) | — | applications on meetings the agent participates in |
| P2-26 | `applications.crud.*` `applications.router/crud.router.ts:13-17` | factory `authedProcedure`, default LEGACY | `applicationCrud` `applications/dal/server/crud.ts:5` (no hooks) | LEGACY | VERB per slot (`delete` not granted) | create on **any** `meetingId` |
| P2-27 | `customerNotes.crud.*` `customer-notes.router/index.ts:9-15` | factory `authedProcedure`, default LEGACY (`customer-notes/lib/server-spec.ts:35` `parent: customerServerSpec` → bridge through `customerVisibility` `customers/lib/visibility.ts:31-36`) | `customerNoteCrud`; hooks: `create.before` **`canAccess(customerServerSpec, ctx.actor, customerId)`** (CASL probe) + `authorId` from `ctx.session` `:57-63`; `update/delete.before` → `getById(ctx)` (legacy scope) + `assertNoteAuthorOrAdmin(note, ctx)` `:82,:94` (`ctx.session?.user.id`, `ctx.ability?.can('manage','all')` `assert-note-author.ts:7-16`) | LEGACY (rows) + CASL (create probe) | VERB per slot + DAL hooks (HAND own-record) | notes on participating customers; edit/delete own notes only |

**B. Bare `agentProcedure` (no `ctx.scope`; `scope: null` from `init.ts:60`)**

| # | Entry | DAL/service | Engine | Decision | Reach (agent) |
|---|---|---|---|---|---|
| P2-28 | `projects.router/crud.router.ts:14-17` `getAll` | `getAllProjects()` `queries.ts:147` (no ctx) | NONE | rung only | **every project** |
| P2-29 | `crud.router.ts:37-41` `getForEdit` | `getProjectForEdit(id)` `queries.ts:114` | NONE | rung only | any project + media |
| P2-30 | `crud.router.ts:43-48` `create` | `createProject` `mutations.ts:30` | NONE | rung only (no `assertCan`) | any customerId |
| P2-31 | `crud.router.ts:50-58` `update` | `updateProject` `mutations.ts:48` | NONE | rung only | **any project, any field** |
| P2-32 | `crud.router.ts:60-65` `delete` | `deleteProject` `mutations.ts:84` (+R2) | NONE | rung only (agent has no `delete Project` grant; not checked) | **any project** |
| P2-33 | `projects.router/business.router.ts:15-81` `business.create` | raw `db.select(proposals)` `:20-23`, raw `db.select(customers)` `:34-37`; `createProject` `:48` (`ownerId: ctx.session.user.id` `:52`); **`buildUserContext(ctx.session.user.id, role, meetingServerSpec)`** `:67-71` → `meetingCrud.update(meetingCtx)` `:72` | NONE (reads) / LEGACY (meeting write) | rung + legacy ctx built in handler | project for any customer; meeting write scoped legacy |
| P2-34 | `projects.router/google-drive.router.ts:19-48` `getAccessToken`, `:50-124` `uploadFromFile` | raw `db.query.account` by `ctx.session.user.id` `:21-26,:59-64`; raw `db.update(account)` `:42-45,:74-77`; `mediaService.createRecord(projectMediaStore, ctx, {projectId})` `:114` (ctx has `scope: null` → `CCD` create unscoped) | NONE | rung only | own Google account; media record on **any** `projectId` |
| P2-35 | `customer-pipelines.router.ts:27-39` `getCustomerPipelineItems` | `getAccessiblePipelines(ctx.ability)` `:35` (`src/shared/domains/pipelines/lib/get-accessible-pipelines.ts:26-34`); `getCustomerPipelineItems(ctx)` `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts:41-69` → `resolveActorScope(customer|meeting|proposal|project, actor)` `:51,:199,:225-226,:248,:277-278,:397,:430`; `maskFinancials(..., canReadProposals)` `:48,:55-69` | CASL (handler-built scopes from `ctx.actor`) | VERB (pipeline tab) + DAL self-scoping | fresh/projects tabs |
| P2-36 | `customer-pipelines.router.ts:41-50` `moveCustomerPipelineItem` | `moveCustomerPipelineItem(ctx)` `move-customer-pipeline-item.ts:31-…`: `scopedFor(spec) = {...ctx, scope: resolveActorScope(spec, ctx.actor)}` `:37`; **raw `db.update(projects).set({pipelineStage})`** `:71` (unscoped); scoped meeting/proposal reads `:99,:127` | CASL (partial) | DAL self-scoping | moves visible customers; project stage write unscoped (`03` §E1-6) |
| P2-37 | `customer-pipelines.router.ts:52-62` `moveCustomerToPipeline` | `moveCustomerToPipeline(customerId, pipeline)` `move-customer-to-pipeline.ts:22-35` → `meetingCrud.update(SYSTEM_CONTEXT)` `:35` | SYSTEM | VERB `cannot('manage','CustomerPipeline')` `:58` (agent FORBIDDEN) | super-admin only |
| P2-38 | `customer-pipelines.router.ts:64-70` `getCustomerProfile` | `getCustomerProfile(ctx, id)` `get-customer-profile.ts:30-…` → CASL scopes `:54,:97,:126,:236`; raw child reads (`customerEnrichment` `:66-70`, `customerNotes` `:190-201`, `proposalViews` `:203-222`, projects) after the customer probe; `canReadProposals` `:36,:74` | CASL (customer) then unscoped children | DAL self-scoping | profile of a visible customer |
| P2-39 | `customer-pipelines.router.ts:72-100` `getRecordingUrl` | `canAccess(customerServerSpec, ctx.actor, id,'read')` `:78`; raw `db.select(customerLeadAttribution)` `:82-87`; R2 presign `:94-97` | PROBE | handler | recording of visible customer |
| P2-40 | `customer-pipelines.router.ts:103-124` `getCustomerProjects` | `scopedCtx = {...ctx, scope: resolveActorScope(meetingServerSpec, ctx.actor)}` `:106` → `meetingCrud.getById` `:107`; then **raw unscoped** `db.select(projects).where(customerId)` `:111-115` and `db.select(proposals).where(meetingId)` `:118-122` | CASL (meeting) then NONE | handler-built scope | all projects of the customer + proposals of the meeting (`03` §E1-5) |
| P2-41 | `customer-pipelines.router.ts:127-150` `assignToProject` | `canAccess(meeting)` `:137`, `canAccess(project)` `:140`; literal `{ session, ability, scope: resolveActorScope(meetingServerSpec, actor), actor }` `:144` → `meetingCrud.update` | PROBE + CASL | VERB `cannot('update','Meeting')` `:133` + PROBE + handler-built ctx | link visible meeting to visible project |
| P2-42 | `meeting-flow.router.ts:28-65` `updateCustomerProfile` | VERB `:35`; `actor = userActor(...)` `:46` (rebuilt, ignores `ctx.actor`); `canAccess(customerServerSpec, actor, customerId,'read')` `:47`; literal ctx `:52` → `upsertCustomerProfile` `:51`; Ably publish `:60-63` | PROBE + CASL | VERB + PROBE + handler ctx | profile of visible customer |
| P2-43 | `meeting-flow.router.ts:68-84` `getPersonaProfile` | **`buildUserContext(ctx.session.user.id, role, meetingServerSpec)`** `:71` → `getByIdWithJoins(scopedCtx)` `:72` | LEGACY (participation) | handler-built legacy ctx | meetings the agent participates in |
| P2-44 | `dashboard.router.ts:7-11` `getActionQueue` | `getActionQueue(userId, isOmni, canSeeUngatedPhone(ctx.actor))` `src/features/agent-dashboard/dal/server/get-action-queue.ts:118` → `userParticipatesInMeeting` `:136,:154` | HAND (legacy fragment inlined) | handler passes `isOmni` | own participating proposals/meetings |
| P2-45 | `agent-settings.router.ts:15-23` `getProfile`, `:28-47` `updateProfile`, `:49-69` `getHeadshotUploadUrl` | raw `db.select(user).where(id = ctx.session.user.id)` `:16-20`; `updateUserProfile(ctx.session.user.id, input)` `:46`; R2 presign keyed by user id `:57` | HAND (self by session id) | handler | own user row |
| P2-46 | `push.router.ts:61-73` `sendTestToSelf` | `webPushClient.sendToUser(ctx.session.user.id)` `:66` | HAND (self) | rung | own devices |
| P2-47 | `schedule.router/activities.router.ts:29-90` `list` | raw `db.select(activities)`; `baseScope = isOmni ? undefined : eq(activities.ownerId, ctx.session.user.id)` `:37-39` | HAND | handler | own activities |
| P2-48 | `activities.router.ts:92-116` `getById` | raw read `:95-103` then `row.ownerId !== ctx.session.user.id` → FORBIDDEN `:109-113` (existence leak: NOT_FOUND vs FORBIDDEN) | HAND | handler | own |
| P2-49 | `activities.router.ts:118-151` `create` | raw insert `ownerId: ctx.session.user.id` `:130-136`; `schedulingService.syncActivity` `:145` | HAND | handler | own |
| P2-50 | `activities.router.ts:153-199` `update`, `:201-232` `complete`, `:234-257` `delete` | pre-read owner `:170-182,:207-219,:240-252` then raw write `:184-188,:221-225,:254` | HAND | handler | own (no CASL verb check although `Activity` grants exist `abilities.ts:155-158`) |
| P2-51 | `schedule.router/sync.router.ts:14-35` `getSyncStatus/connectCalendar/disconnectCalendar/resetCalendar` | `schedulingService.*(ctx.session.user.id)` | HAND (self) | rung | own calendar link |
| P2-52 | `sync.router.ts:37-84` `triggerSync` | **raw `db.select(meetings)` all unsynced** `:43-49` → `schedulingService.syncMeeting` per row `:51-57`; own activities `:60-70`; `handleInboundSync(userId)` `:81` | NONE (meetings) / HAND (activities) | rung | pushes **every** unsynced meeting to GCal (`03` §E1-6) |
| P2-53 | `sync.router.ts:92-128` `systemOwnerHealth`, `:137-149` `renewSystemOwnerChannel` | `ctx.ability.cannot('manage','all')` `:94,:139` → FORBIDDEN | VERB (inline omni) | handler | super-admin only |
| P2-54 | `voip-campaigns.router.ts:48-83` `listCampaigns/listAttributes/getSourceCampaignSummaries/listEnrolledLeads` | `listVoipCampaigns()`, `listVoipContactAttributes()`, `listLeadSources()`, `countLeadsByStatusPerSource()`, `listEnrolledLeadsBySource(slug)` (no ctx) | NONE | rung only | every campaign/attribute/source + enrolled leads (`03` §D.1) |
| P2-55 | `notion.router/index.ts:10-15` `revalidateNotionCache` | `revalidateTag` ×3 | NONE | rung | cache bust |
| P2-56 | RSC pages `src/app/(frontend)/dashboard/**/page.tsx` | `protectDashboardPage()` `src/shared/domains/permissions/lib/protect-dashboard-page.ts:26-49` (`ability.cannot('access','Dashboard')` → `redirect('/')` `:41-43`); prefetch via `trpc` RSC proxy (`src/trpc/server.ts:9-13`, ctx `createRSCTRPCContext` `create-http-context.ts:37-38`) — same rungs as above | VERB (page) + tRPC rungs | page + rung | — |
| P2-57 | `src/app/(frontend)/dashboard/meetings/[meetingId]/page.tsx:7-11` | **no** `protectDashboardPage` (only 3 dashboard pages lack it; the other two are redirects `pipeline/page.tsx:7`, `pipelines/page.tsx:7`) — layout session gate only `dashboard/layout.tsx:34` | NONE at page; data via tRPC rungs | — | renders client view for any session |

### 1.4 P3 — Dispatcher (role `dispatcher`, session)

Grants `abilities.ts:225-274`. Same entry surfaces as P2 (every `agentProcedure`-rooted rung passes: `can('access','Dashboard')` `:226`). Rows below are only where the outcome differs from P2.

| # | Flow | Engine | Outcome for dispatcher |
|---|---|---|---|
| P3-1 | P2-1/2/4 customers (CASL) | CASL `$inDerivedPipeline ['leads','rehash','dead','fresh']` `abilities.ts:233`; field grant `:236` | reads/edits lead-contact fields + `pipelineStage` + `age` on operational-pipeline customers |
| P3-2 | P2-27 customer-notes: `update/delete` | LEGACY bridge `customerVisibility` → `derivedPipelineWhere(['leads'])` `customers/lib/visibility.ts:32-33` (**diverges** from CASL 4-bucket) | NOT_FOUND on `fresh/rehash/dead` customers' notes (comment `:20-22` confirms); `create` uses CASL probe `server-spec.ts:58` → works |
| P3-3 | P2-5/10 meetings (CASL) | unconditional `can('read','Meeting')` `:261`, `create`/`update` `:262-263`, no `own` → `resolveMeetingOwnerId` returns system owner `resolve-owner.ts:13-18` | sees **all** meetings; bookings land unassigned |
| P3-4 | P2-43 `getPersonaProfile` (LEGACY `buildUserContext`) and P2-33 `projects.business.create` (LEGACY) | `meetingVisibility` = participation `meetings/lib/visibility.ts:8-11` | NOT_FOUND on the very meetings P3-3 lets them read (engine split) |
| P3-5 | P2-11..21 proposals | no `Proposal` grant → `rulesToAST` null → `sql\`false\`` `compile-scope.ts:29-30`; LEGACY paths use participation (≈∅) | denied/empty everywhere except… |
| P3-6 | P2-40 `getCustomerProjects` | after CASL meeting probe (passes, unconditional read) the proposals/projects reads are raw `:111-122` | **sees proposals + projects** despite no grant (`03` §E1-5, live residual of #210) |
| P3-7 | P2-28..32 projects bare crud | NONE | full project read/update/**delete** (`03` §E1-1) |
| P3-8 | P2-35 pipeline tabs | `getAccessiblePipelines` → `['fresh','leads','rehash','dead']` `get-accessible-pipelines.ts:18,30-32`; `canReadProposals=false` → `maskFinancials` | operational tabs, financials masked |
| P3-9 | P2-47..50 activities | HAND owner compare; no `Activity` grant but none checked | own activities |
| P3-10 | P2-52 `triggerSync`, P2-54 voip-campaign reads, P2-34 google-drive | NONE | same over-reach as agent |
| P3-11 | Phone gating | `canSeeUngatedPhone` true via `read LeadsPool` `phone-gating-sql.ts:45` | ungated phone |

### 1.5 P4 — Super-admin (`can('manage','all')` `abilities.ts:96`)

- Every rung passes; `superAdminProcedure` `init.ts:94-103` gates: `lead-sources.router.ts` ×15 (`:136,175,192,240,257,274,339,365,568,708,723,779,793,807,836`; raw `db` throughout, no ctx reads), `voip-campaigns.router.ts` ×15 (`:92,110,115,136,150,161,180,195,210,222,235,247,254,265,277`).
- CASL scope compiles to `null` (empty AST) for every subject; LEGACY collapses omni → `null` before `resolveEffectiveScope` (`scope-middleware.ts:23-24`, `SM:44-45`, `helpers.ts:71-75`). `requireResolvedScope(null)` → `undefined` → unrestricted (`helpers.ts:95-102`).
- Inline omni gates that only super-admin passes: `sync.router.ts:94,139`; `customer-pipelines.router.ts:58` (`manage CustomerPipeline`); `participants.router.ts:59`, `reads.router.ts:32` (`assign Meeting`); `activities.router.ts:37,109,166,204,237`; `business.router.ts:107` (customers search phone text); `dashboard.router.ts:9`.
- Super-admin handlers that then drop to `SYSTEM_CONTEXT` (loses `session`, so hooks stamp `authorId`/`ownerId` as null/system): `voip-campaigns.router.ts:153,183,198`; `move-customer-to-pipeline.ts:35`.
- `/intake` bare hit redirects super-admins to lead-sources `intake/page.tsx:25-27`.

### 1.6 P5 — `homeowner` / `user` role accounts (better-auth sessions without `access Dashboard`)

Creation path: Google sign-in with a non-corporate address → role `'user'` (`auth/server.ts:38-48,74`); `'homeowner'` is only assignable by DB edit / `playwright-session?role=homeowner` (`dev/playwright-session/route.ts:84-111`). Grants: `homeowner` `abilities.ts:207-210` (`read Proposal`, `read User`), `user` `:215-217` (`read User`).

| # | Surface | What happens |
|---|---|---|
| P5-1 | `push.router.ts:34-47` `subscribe`, `:50-55` `unsubscribe` | `protectedProcedure` — the **only** two procedures that serve these roles by design; keyed by `ctx.session.user.id` (HAND self) |
| P5-2 | Any `agentProcedure` chain | FORBIDDEN `init.ts:73-78` |
| P5-3 | Shareable procs (P1-2…P1-10) **with a valid token in the body** | `SM:39` session branch fires for any session → token ignored → `resolveEffectiveScope(proposalServerSpec)` = `proposalVisibility` participation `proposals/lib/visibility.ts:10` → 0 rows → NOT_FOUND (`getFullView`) ; `crud.getById`: `homeowner` passes `assertCan` (`read Proposal`) then DAL finds nothing; `user` → FORBIDDEN `CCR:119`. Net: a signed-in homeowner-role account **cannot open its own share link** through tRPC (the DOCS claim "homeowner-always-token" `src/trpc/DOCS.md:169-173` describes the token branch only) |
| P5-4 | `views.recordView` (P1-3), PDF (P1-11), summary (P1-12) | session not consulted → token works |
| P5-5 | `/dashboard/*` pages | layout renders children on any session `dashboard/layout.tsx:34`; every page except `meetings/[meetingId]/page.tsx` calls `protectDashboardPage` → `redirect('/')` `:41-43`; `meetings/[meetingId]` renders `MeetingFlowView` whose tRPC calls all hit P5-2 |
| P5-6 | Client ability mirror | `AbilityProvider` `src/shared/components/providers/casl-provider.tsx:19-37` builds the same `defineAbilitiesFor`; `proposal/index.tsx:74` picks `viewerRole` by `ability.can('update','Proposal')` (display only) |

### 1.7 P6 — System (jobs, webhooks, cron, scripts)

All rows run with `SYSTEM_CONTEXT` (`src/shared/dal/server/types.ts:53-58`: `{session:null, ability:null, scope:null, actor: systemActor('legacy:system-context')}`), a `systemContext(reason)` (`:68-70`), or **no ctx at all** (raw DAL). `compileScope`/`verbOnly`/`canAccess` all short-circuit `system` → allow (`compile-scope.ts:23-24`, `RAS:43-44`); `requireResolvedScope(null)` → unrestricted.

| # | Entry `file:line` | Auth at the edge | ctx | DAL/service driven | Engine |
|---|---|---|---|---|---|
| P6-1 | `src/app/api/qstash-jobs/route.ts:87-136` | QStash signature `:114-120` (`Receiver.verify`) | per-job (below) | `registry.get(key)(payload)` `:126-131` | — |
| P6-1a | job `bulk-dnc.ts:20-21` | (via P6-1) | `SYSTEM_CONTEXT` | `complianceService.addToDnc` (no ctx), `campaignEnrollmentService.unenroll(SYSTEM_CONTEXT)` | SYSTEM |
| P6-1b | `bulk-enroll.ts:26`, `bulk-unenroll.ts:21`, `enroll-lead.ts:28`, `enroll-source-batch.ts:47`, `graduate-from-campaign.ts:20` | " | `SYSTEM_CONTEXT` | `campaignEnrollmentService.enroll/unenroll` `enrollment.service.ts:68-…` → `getCustomer(ctx)` `:73` (ungated phone) + CloudTalk + participation rows | SYSTEM |
| P6-1c | `create-qb-records.ts:10,17-18` | " | none / `SYSTEM_CONTEXT` inside | raw `db.select(projects)` `:10`; `accountingService.ensureCustomer/ensureProjectSubCustomer` `src/shared/services/accounting.service.ts:27,89,120` (raw) + `customerCrud.update(SYSTEM_CONTEXT)` `:80` | SYSTEM / raw |
| P6-1d | `sync-qb-invoice.ts:7`, `sync-qb-payment.ts:7` | " | `SYSTEM_CONTEXT` inside | `accountingService.syncInvoiceStatus/syncPaymentStatus` → raw `:125,:131` + `proposalCrud.update(SYSTEM_CONTEXT)` `:170,:224,:247` | SYSTEM / raw |
| P6-1e | `sync-zoho-sign-status.ts:35,41,47` | " | `SYSTEM_CONTEXT` `:41` | `contractService.applyContractEvent(SYSTEM_CONTEXT)` `contracts.service.ts:175-214` → `getByContractEnvelopeId(ctx)` `:183` (scope `queries.ts:323`), `proposalCrud.update(ctx)` `:206`, `deriveOutcomeOnAdditionalWorkApproved(ctx)` `:210` → `meetingCrud.update` `meetings/dal/server/mutations.ts:72`; `notificationService.notifyContractStatusChange` `:47` | SYSTEM |
| P6-1f | `generate-ai-summary.ts:8` | " | none | `aiService.generateProjectSummary` → raw `db.update(proposals)` `ai/client.ts:96-113` | raw |
| P6-1g | `sync-meeting-to-gcal.ts:19`, `delete-meeting-event.ts:19`, `propagate-customer-change.ts:19`, `initial-calendar-sync.ts:7`, `sync-calendars.ts:35,39` (cron: QStash schedule created by `scripts/setup-gcal-cron.ts:91,128-130`) | " | none | `schedulingService.*` `src/shared/services/scheduling.service.ts:263-552` → raw meeting writes `meetings/dal/server/google-calendar.ts:101-128` | raw |
| P6-1h | `optimize-media.ts:10` | " | none | `optimizeMediaFile` → raw `media/optimization-target.ts:16,20` | raw |
| P6-1i | `meta-capi-event.ts:23,26` | " | none | `measurementService.trackFunnelLead/trackAppointmentSet` | raw |
| P6-1j | `send-view-notification.ts:15`, `notify-meeting-time-changed.ts:25`, `notify-last-interacting-agent.ts:17` | " | none | `notificationService.*` (no `db.*` in file; delegates) | — |
| P6-2 | `src/app/api/webhooks/bina/route.ts:12-58` | header secret `:14-17` (`gohighlevelClient.verifyWebhookSecret`) | `SYSTEM_CONTEXT` `:35` | `customerIntakeService.ingestLead` (P0-3 chain, meeting null `:39`); `webhookService.logBinaInbound` `:51-55` → raw insert `src/shared/dal/server/webhook-logs.ts:13` | SYSTEM |
| P6-3 | `src/app/api/webhooks/cloudtalk/route.ts:31-132` | `?secret=` `:34` | `SYSTEM_CONTEXT` `:62,:96` | `resolveCustomerByPhone/ByCtContactId` (no ctx); `complianceService.addToDnc` `:57,:90` (no ctx); `campaignEnrollmentService.unenroll(SYSTEM_CONTEXT)`; `smsCadenceService.handleCallEnded` `:114` (no ctx); `notifyLastInteractingAgentJob.dispatch` `:71` | SYSTEM / raw |
| P6-4 | `src/app/api/webhooks/quickbooks/route.ts:29-61` | HMAC `:37` | none | dispatches P6-1d `:50,:53` | — |
| P6-5 | `src/app/api/webhooks/zoho-sign/route.ts:15-56` | HMAC when header+secret present `:20-24`; missing header accepted outside production `:25-31` | none | dispatches P6-1e `:49-53` | — |
| P6-6 | `src/app/api/google-calendar/webhook/route.ts:11-33` | **none** (only `X-Goog-Channel-ID` presence `:13,:22`) | none | `schedulingService.handleWebhookNotification(channelId)` `:504-512` → `performInboundSync` `:69` → raw meeting writes `:105,:120,:122,:128` | raw |
| P6-7 | Scripts: `scripts/verify-short-path.ts:63`, `verify-long-path.ts:33` (`contractService.createContractEnvelope(SYSTEM_CONTEXT, …)`), `verify-generate-sow-pdf.ts:11` (`pdfService.generateSowPdf(SYSTEM_CONTEXT)`) | CLI (`DRIZZLE_TARGET`) | `SYSTEM_CONTEXT` | as named | SYSTEM |
| P6-8 | Raw-`db` scripts (no ctx): `scripts/add-during-media.ts`, `backfill-meeting-participants.ts`, `backfill-proposal-media-optimization.ts`, `backfill-sow-financials.ts`, `backfill-wave3-scalars.ts`, `normalize-customer-phones.ts`, `portfolio-scraper/import-project.ts`, `rebuild-gcal-descriptions.ts`, `recompute-final-tcp.ts`, `seed-bina-lead-source.ts`, `seed-closed-by-options.ts`, `verify-proposal-kind.ts` | CLI | none | raw | raw |
| P6-9 | Twilio / JustCall / Resend / Meta-CAPI inbound webhooks | **none exist** under `src/app/api` (`find` lists only bina, cloudtalk, quickbooks, zoho-sign, google-calendar) | — | — | — |

### 1.8 Required lists

**Consumers of `systemProcedure`** (1): `proposals.router/views.router.ts:36` `recordView`.

**Bare `baseProcedure` handlers that are NOT public-by-design** (verdict from the handler's own comments/design docs):
1. `ai.router/index.ts:7-22` `dispatchProjectSummaryJob` — writes any proposal's `projectJSON`; 0 callers (`03` §E1-2).
2. `intake.router.ts:26-54` `getRecordingUploadUrl` — mints R2 upload URLs into `homeownerFiles` for anyone (only the `/intake` page is token-gated; the proc is not).
3. `customers.router/business.router.ts:134-249` `createFromIntake` — same: intended for the token-gated `/intake` page, but the proc itself is public (optionally creates a meeting owned by `info@`).
(Public-by-design per comments: `healthcheck`, funnels ×4, landing ×4, showroom ×2, notion ×7, `getFinanceOptions`.)

**Every shareable procedure** (8; all on `proposalServerSpec`, all resolve session-branch scope with **LEGACY** `SM:45`):
`business.getFullView` `business.router.ts:16`; `crud.getById` `CCR:115` + `crud.update` `CCR:140` (via `proposals.router/crud.router.ts:20`); `contracts.getContractStatus` `:33`, `contracts.evaluateEnvelopeContext` `:113`, `contracts.applyEnvelopeContext` `:178`; `delivery.requestToMoveForward` `delivery.router.ts:77`; `funding.setCashInDeal` `funding.router.ts:17`. The `voipLinkTokenServerSpec` shareable declaration (`:25`) has no procedure.

**`validateShareToken` consumers**: only `resolveShareTokenActor` `share-token-actor.ts:25`; its consumers: `views.router.ts:41`, `pdf/route.ts:21`, `summary/route.ts:24`. `SM:62` does **not** go through it.

---

## Part 2 — Context waterfall per rung

### 2.1 Rung table (ctx fields present AFTER the rung)

Root shape: `HTTPTRPCContext` `src/trpc/types.ts:60-63` = `BaseTRPCContext` `:44-49` (`session|null, ability|null, scope|null, actor|null`) + `req?`, `resHeaders`. DAL contract `ScopedContext` `dal/server/types.ts:35-47` requires `actor: Actor` (non-null) — the tRPC root ctx (`actor: null`) is therefore **not** a `ScopedContext`; only rungs from `protectedProcedure` down satisfy it.

| Rung (`file:line`) | `session` | `ability` | `scope` | `actor` | Gate actually checked | Redundancy |
|---|---|---|---|---|---|---|
| `baseProcedure` `init.ts:29` (root from `create-http-context.ts:12-27` / RSC `:37-38`) | `BetterAuthSession \| null` (resolved from cookie) | `null` | `null` | `null` | none | — |
| `systemProcedure` `init.ts:39` | same as base (`= baseProcedure`) | `null` | `null` | `null` | none (handler owns auth) | identical object to `baseProcedure` — naming only |
| `protectedProcedure` `init.ts:46-62` | non-null | `AppAbility` from `defineAbilitiesFor({id, role})` `:54-57` | **`null` (explicit stamp `:60`)** | `userActor(session.user.id, ability)` `:60` | `!ctx.session` → UNAUTHORIZED `:47-52` | `actor.userId ≡ session.user.id`; `actor.ability ≡ ability` (same object); `scope:null` here means "unresolved" but is indistinguishable from omni-`null` |
| `agentProcedure` `init.ts:72-81` | non-null | non-null | `null` | user | `ability.cannot('access','Dashboard')` → FORBIDDEN `:73` | no ctx change (`next({ctx})` `:80`) |
| `superAdminProcedure` `init.ts:94-103` | non-null | non-null | `null` | user | `ability.cannot('manage','all')` → FORBIDDEN `:95` | no ctx change; `agentProcedure` check is subsumed |
| `customerProcedure` `customers.router/procedures.ts:26-29` | non-null | non-null | `SQL \| null` = `resolveTrpcActorScope(customerServerSpec, {userId, ability})` (CASL; rebuilds `userActor` internally `resolve-trpc-actor-scope.ts:22` — does not read `ctx.actor`) | user (unchanged) | none new (scope only) | `scope` is a pure function of `actor` — cached derivation |
| `meetingProcedure` `meetings.router/procedures.ts:20-23` | " | " | CASL meeting scope | " | none new | " |
| `proposalProcedure` `proposals.router/procedures.ts:28-31` | " | " | CASL proposal scope | " | none new | " |
| `proposalMediaProcedure` `procedures.ts:39-42` | " | " | CASL child: `verbOnly(actor,'read','Proposal') AND proposalId IN (SELECT … proposal scope)` `RAS:24-33` | " | none new | " |
| `projectProcedure` `projects.router/procedures.ts:15-19` | " | " | CASL project scope | " | none new | " |
| `projectMediaProcedure` `procedures.ts:30-34` | " | " | CASL child bridge (`media-files/lib/server-spec.ts:40` parent) | " | none new | " |
| `applicationProcedure` `applications.router/procedures.ts:20-23` | " | " | **LEGACY** `resolveVisibilityScope(applicationServerSpec)` → omni `null` else `meetingVisibility` bridge | " | none new | scope derived from `session.user.id` + `ability`, not from `actor` |
| `customerPublicProcedure` `customers.router/procedures.ts:32`, `proposalPublicProcedure` `proposals.router/procedures.ts:48` | as base | `null` | `null` | `null` | none | aliases of `baseProcedure` |
| `proposalShareableProcedure` `procedures.ts:45` / factory `shareableProcedure` `CCR:101` — **session branch** `SM:39-51` | non-null | rebuilt `defineAbilitiesFor` `:40-43` | `isOmni ? null : resolveEffectiveScope(spec, {userId, ability})` `:45` (**LEGACY**) | `userActor(userId, ability)` `:46` (kind asserted `:47-49`) | session presence only; `isOmni = ability.can('manage','all')` `:44` | duplicates `protectedProcedure`'s work (ability + actor rebuilt); no `access Dashboard` check → any role passes |
| same — **token branch** `SM:53-68` | `null` (`session: ctx.session` = null) | **`null`** | `eq(table[spec.shareable.tokenColumn], rawInput.token)` `:62` | `tokenActor(scope, spec.caslSubject)` `:63` | token string present in raw input `:59-61` (no DB validation here) | `actor.scope ≡ scope`; `actor.subject ≡ spec.caslSubject` |
| same — neither | — | — | — | — | UNAUTHORIZED `:71-74` | — |
| `createCrudRouter.authedProcedure` `CCR:99-100` | non-null | non-null | `resolveScope(spec, {userId, ability})` — default **LEGACY** `resolveVisibilityScope` `:98`; CASL when `resolveScope: resolveTrpcActorScope` passed (customers `crud.router.ts:50`, meetings `crud.router.ts:35`); proposals / applications / customer-notes use the default | user | inherits `agentProcedure` | same as `<entity>Procedure` but a second, independently-configured resolver for the same entity (proposals: `proposalProcedure` = CASL, `proposals.crud` authed slots = LEGACY) |
| `createCrudRouter.readProcedure` / `updateProcedure` `CCR:104-105` | = `shareableProcedure` if `spec.shareable` else `authedProcedure` | | | | | — |
| Handler-built contexts inside tRPC (bypass the rung's `scope`): `meeting-flow.router.ts:52` `{session, ability, scope: resolveActorScope(customerServerSpec, actor), actor}` (actor rebuilt `:46`); `customer-pipelines.router.ts:106` `{...ctx, scope: resolveActorScope(meetingServerSpec, ctx.actor)}`; `:144` literal with `actor = ctx.actor`; `meeting-flow.router.ts:71` + `projects.router/business.router.ts:67` `buildUserContext(...)` (`helpers.ts:65-78`: **synthetic** `session = {user:{id, role}}` cast `:72`, LEGACY scope `:75`, `userActor` `:76`); `views.router.ts:50` `{session:null, ability:null, scope: resolveActorScope(proposalServerSpec, tokenActor), actor}`; `move-customer-pipeline-item.ts:37` `scopedFor(spec)` | | | | | | 7 sites re-derive `scope` from the actor because the rung stamped `null` or the wrong entity's scope |
| Non-tRPC: `SYSTEM_CONTEXT` `dal/server/types.ts:53-58` | `null` | `null` | `null` | `systemActor('legacy:system-context')` | none | `scope:null` ≡ omni; `session:null` also used as the "is system" test (`meetings/dal/server/crud.ts:34`, `scope.ts:68`) |
| Non-tRPC: `systemContext(reason)` `:68-70` | `null` | `null` | `null` | `systemActor(reason)` | none | 1 call site `contracts.router.ts:224` |
| Non-tRPC: route-handler literals `pdf/route.ts:27`, `summary/route.ts:31` | `null` | `null` | `resolveActorScope(proposalServerSpec, tokenActor)` (= `actor.scope`) | token | `resolveShareTokenActor` non-null | `scope ≡ actor.scope` |

**Where `null` is overloaded**: `scope: null` means omni (`scope-middleware.ts:23-24`, `SM:44-45`, `helpers.ts:71-75`, `compile-scope.ts:23-24`), system (`SYSTEM_CONTEXT`), *and* "not resolved yet" (`init.ts:60`, `create-http-context.ts:22`); `requireResolvedScope` `helpers.ts:95-102` only distinguishes `undefined`, which no ctx ever carries. `ability: null` means both "no session" and "token bearer" (`SM:67`); `session: null` means both "public" and "system" (`meetings/dal/server/crud.ts:34`, `scope.ts:68`).

### 2.2 What handlers read off `ctx`

Grep of `ctx.session|ctx.ability|ctx.scope|ctx.actor` in `src/trpc/routers/**` excluding `procedures.ts` (lines, incl. comments; a line mentioning two fields counts once per field):

| Router dir/file | `ctx.session` | `ctx.ability` | `ctx.scope` | `ctx.actor` | Whole `ctx` handed to DAL/service (approx. call count) |
|---|---|---|---|---|---|
| `agent-settings.router.ts` | 3 (`:19,:46,:57`) | 0 | 0 | 0 | 0 |
| `ai.router/` | 0 | 0 | 0 | 0 | 0 |
| `applications.router/` | 0 | 0 | 0 | 0 | 5 |
| `customer-notes.router/` | 0 | 0 | 0 | 0 | 0 (factory) |
| `customer-pipelines.router.ts` | 1 (`:144`) | 4 (`:35,:58,:133,:144`) | 0 | 3 (`:77,:106,:136`) | 4 |
| `customers.router/` | 0 | 2 (`business:107`, `profile:20`) | 3 (`business:64,:129`, `crud:42` comment) | 1 (`business:124`) | 2 |
| `dashboard.router.ts` | 1 (`:8`) | 1 (`:9`) | 0 | 1 (`:10`) | 0 |
| `funnels.router.ts`, `intake.router.ts`, `landing.router/`, `notion.router/`, `lead-sources.router.ts` | 0 | 0 | 0 | 0 | 0 (public procs read `(ctx as {req}).req` for IP: `funnels:64,:103,:144,:160-161,:212,:236`, `intake:33`, `customers business:160`) |
| `meeting-flow.router.ts` | 3 (`:46,:52,:71`) | 3 (`:35,:46,:52`) | 0 | 0 | 1 |
| `meetings.router/` | 3 (`participants:39,:114,:194`) | 3 (`participants:37,:59`, `reads:32`) | 0 | 0 | 8 |
| `projects.router/` | 5 (`business:52,:68,:69`, `google-drive:23,:61`) | 0 | 0 | 4 (`media:29,:53,:111,:164`) | 2 |
| `proposals.router/` | 2 (`delivery:48,:49`) | 3 (`contracts:191`, `incentives:28`, `media:20`) | 1 (`media:74` comment) | 2 (`media:27,:104`) | 28 |
| `push.router.ts` | 3 (`:38,:53,:66`) | 0 | 0 | 0 | 0 |
| `schedule.router/` | 14 (`activities:39,:111,:134,:146,:179,:195,:216,:249`; `sync:16,:21,:26,:33-34,:39`) | 7 (`activities:37,:109,:166,:204,:237`; `sync:94,:139`) | 0 | 0 | 0 |
| `voip-campaigns.router.ts` | 6 (`:168,:216,:229,:241,:259,:285`) | 0 | 0 | 0 | 4 |
| **Total (routers)** | **41** | **23** | **4** (2 code) | **11** | ~54 |

Outside routers (DAL / services / features / app, code lines only): `ctx.session` **9** (`scope.ts` ×2, `assert-note-author.ts:8`, `customer-notes/lib/server-spec.ts:61`, `meetings/dal/server/crud.ts:34,:125,:185`, `resolve-owner.ts:15`, `proposals/lib/server-spec.ts:119`); `ctx.ability` **4** (`scope.ts` ×2, `assert-note-author.ts:9`, `resolve-owner.ts:14`); `ctx.scope` **27** (`CCD:117,213,264`; `scope.ts:94`; `applications` ×5; `customers` ×4; `media-ops.ts` ×5; `meetings/queries` ×2; `projects/queries:202`; `proposal-incentives:45`; `proposals/mutations:70`; `proposals/queries` ×3; `voip-messages/queries:40`); `ctx.actor` **9** (`move-customer-pipeline-item.ts:37`, `customer-notes/lib/server-spec.ts:58`, `customers/queries:51`, `meetings/queries:165,:279`, `voip-campaign-contacts/queries:282`, + operator `OperatorCtx.actor` `meeting-participation.ts` ×3) plus destructured `actor` in `get-customer-pipeline-items.ts:42-69` and `get-customer-profile.ts:31-236`. `requireResolvedScope(` has 42 call sites; `resolveActorScope(` is called from 10 files (18 sites incl. definition file).

Per handler category (what the handler itself reads):
- **Factory CRUD slot** (`CCR:115-168`): reads `ctx.ability` only (`:118,:131,:147,:158,:165`); passes whole `ctx` to `handlers.*` which read `ctx.scope` (`CCD:117,213,264`) and hooks read `ctx.session`/`ctx.actor`/`ctx.ability`.
- **Bespoke read** (`business.list`, `reads.*`, `views.getProposalViews`, `applications.business.*`, `projects.crud.list`): pass whole `ctx`; DAL reads `ctx.scope` (+ `ctx.actor` for phone gate). Exceptions that read `ctx.ability`/`ctx.session` in the handler: `customers.search:107,:124`, `reads.getInternalUsers:32`, `participants.getParticipants:37-39`, `activities.list/getById`, `dashboard:8-10`.
- **Bespoke mutation**: verb checks on `ctx.ability` (`profile:20`, `incentives:28`, `contracts:191`, `media:20`, `meeting-flow:35`, `customer-pipelines:58,:133`, `participants:59`, `sync:94,:139`); owner via `ctx.session.user.id` (activities ×5, agent-settings, push, voip-campaigns `requestedByUserId`); probes via `ctx.actor` (`customer-pipelines:77,:136`, `media.router`s).
- **Service call**: whole `ctx` (contracts ×5, `mediaService.*`, `campaignEnrollmentService.switchCampaign:250`, `campaignSyncService:111`, `voipCampaignCrud.update:142`) or a fresh `SYSTEM_CONTEXT` (`voip-campaigns:153,:183,:198`, `delivery:63`, `customers business:224`, funnels ×3, landing).
- **Cross-entity read**: handler re-derives scope (`customer-pipelines:106,:144`, `meeting-flow:52,:71`, `projects business:67`) or reads raw (`meetings business:42`, `customer-pipelines:82,:111,:118`, `projects business:20,:34`, `projects media:114,:169`, `google-drive:21,:59`).

---

## Part 3 — Server-originated / privileged context constructions (outside the rung ladder)

Live, non-comment sites. "Class A" = a user-initiated write executed under a system context (the actor's identity/scope is discarded).

| # | `file:line` | Construction | Why privileged (as the code states) | Classification | DAL driven |
|---|---|---|---|---|---|
| S1 | `src/shared/dal/server/types.ts:53-58` | `SYSTEM_CONTEXT` const | definition | — | — |
| S2 | `types.ts:68-70` | `systemContext(reason)` | definition; `SystemReason` = 2 variants | — | — |
| S3 | `src/trpc/routers/proposals.router/contracts.router.ts:223-226` | `systemContext('derived:contract-age-from-token-proposal')` | id is server-derived from the scope-checked `getFullView` `:198` (comment `:213-221`) | **class A** (token/agent write of `customers.age` as system) | `customerCrud.update` |
| S4 | `proposals.router/delivery.router.ts:63` | `SYSTEM_CONTEXT` | "system-level side-effect on the meetings entity, not gated by the agent's proposal visibility" `:60-61` | **class A** (agent-initiated meeting outcome write) | `deriveOutcomeOnProposalSent` → `meetingCrud.update` |
| S5 | `customers.router/business.router.ts:224` | `SYSTEM_CONTEXT` | public intake, no session | public-by-design (rate-limited) | `customerIntakeService.ingestLead` → `customerCrud.create`, `customerNoteCrud.create`, `meetingCrud.create` |
| S6 | `funnels.router.ts:121,:217,:241` | `SYSTEM_CONTEXT` | public funnel | public-by-design | `ingestLead` / `enrichFunnelLead` / `setFunnelLeadAddress` → `customerCrud.update` |
| S7 | `landing.router/index.tsx:126` | `SYSTEM_CONTEXT` | public website form | public-by-design | `customerCrud.create` (+ raw note insert `:137`) |
| S8 | `voip-campaigns.router.ts:153,:183,:198` | `SYSTEM_CONTEXT` | "super-admins are omni, so SYSTEM_CONTEXT is legitimate" `:176-178` | **class A** (super-admin write run as system; `session` dropped so `requestedByUserId`-style attribution is lost on this leg) | `campaignEnrollmentService.enroll/unenroll` |
| S9 | `src/features/customer-pipelines/dal/server/move-customer-to-pipeline.ts:35` | `SYSTEM_CONTEXT` | caller already passed `manage:CustomerPipeline` (comment `:19`) | **class A** (super-admin write) | `meetingCrud.update` |
| S10 | `src/shared/entities/customers/lib/server-spec.ts:140` | `SYSTEM_CONTEXT` | delete cascade after tRPC `delete:Customer` `:111-113` | **class A** (user delete cascades as system) | `meetingCrud.delete` (per meeting) |
| S11 | `src/shared/entities/proposals/lib/server-spec.ts:54` | `SYSTEM_CONTEXT` | create hook reads the meeting to derive `kind` + snap SOW | privileged read of **any** `meetingId` inside a user create (`03` §E1-4) | `meetingCrud.getById` |
| S12 | `src/app/api/proposals/[proposalId]/pdf/route.ts:36` | `SYSTEM_CONTEXT` | after token-scoped `getFullView` `:26-29` | **class A** (token read re-run as system) | `pdfService.generateProposalPdf` → `getFullView` |
| S13 | `src/shared/services/providers/zoho-sign/lib/documents/registry.ts:154` | `SYSTEM_CONTEXT` | SOW PDF for envelope assembly (called under the agent's ctx from `contracts.service.ts:28`) | privileged read inside a user write | `pdfService.generateSowPdf` → `getFullView` |
| S14 | `src/shared/services/accounting.service.ts:80,:170,:224,:247` (+ raw `:27,:89,:120,:125,:131`) | `SYSTEM_CONTEXT` | QuickBooks jobs | job-privileged | `customerCrud.update`, `proposalCrud.update` |
| S15 | `src/shared/services/voip/voip-dids.service.ts:117`, `voip-calls.service.ts:231` | `SYSTEM_CONTEXT` | provider-side lookups | unwired (no consumers outside services) | `voipDidCrud.getById`, `voipCallCrud.getById` |
| S16 | jobs: `bulk-dnc.ts:21`, `bulk-enroll.ts:26`, `bulk-unenroll.ts:21`, `enroll-lead.ts:28`, `enroll-source-batch.ts:47`, `graduate-from-campaign.ts:20`, `sync-zoho-sign-status.ts:41` | `SYSTEM_CONTEXT` | QStash-signed job | job-privileged | enrollment service / `contractService.applyContractEvent` |
| S17 | webhooks: `webhooks/bina/route.ts:35`, `webhooks/cloudtalk/route.ts:62,:96` | `SYSTEM_CONTEXT` | secret-verified webhook | webhook-privileged | `ingestLead` / `unenroll` |
| S18 | scripts: `verify-short-path.ts:63`, `verify-long-path.ts:33`, `verify-generate-sow-pdf.ts:11` | `SYSTEM_CONTEXT` | CLI | operator | `contractService.createContractEnvelope`, `pdfService.generateSowPdf` |
| S19 | `src/trpc/routers/meeting-flow.router.ts:71` | `buildUserContext(session.user.id, role, meetingServerSpec)` | needs a meeting-scoped ctx on a bare `agentProcedure` | LEGACY user ctx (synthetic session `helpers.ts:72`) | `getByIdWithJoins` |
| S20 | `src/trpc/routers/projects.router/business.router.ts:67-71` | `buildUserContext(..., meetingServerSpec)` | same reason | LEGACY user ctx | `meetingCrud.update` |
| S21 | `src/app/api/proposals/[proposalId]/summary/route.ts:31`, `pdf/route.ts:27`, `proposals.router/views.router.ts:50` | literal `{session:null, ability:null, scope: resolveActorScope(proposalServerSpec, tokenActor), actor}` | canonical token actor | token ctx | `getFullView` |
| S22 | `src/trpc/routers/meeting-flow.router.ts:52`, `customer-pipelines.router.ts:106,:144`, `move-customer-pipeline-item.ts:37` | literal / spread user ctx with handler-resolved CASL scope | rung stamped `scope:null` or another entity's scope | CASL user ctx | `upsertCustomerProfile`, `meetingCrud.getById/update`, pipeline reads |
| S23 | No-ctx raw DAL (privileged by absence): `meetings/dal/server/google-calendar.ts:101-128` (scheduling), `ai/client.ts:96-113`, `media/optimization-target.ts:16,20`, `media-files/dal/server/optimization.ts`, `proposal-views/dal/server/mutations.ts:15-25`, `proposals/dal/server/queries.ts:288-307` (`getProposalLockSignals`, "deliberately unscoped"), `customers/dal/server/mutations.ts:59,:105` (`upsertLeadAttribution`, `upsertFunnelEnrichment`), `webhook-logs.ts:13`, `access-token-cache.ts:5-16`, `validate-share-token.ts:34-38` | none | — | — | raw |

Counts: bare `SYSTEM_CONTEXT` call sites = **33** (30 in `src/` + 3 scripts; matches `03` §A.2 "30 bare sites"); `systemContext(reason)` = **1**; `buildUserContext` = **2**; literal/spread ctx constructions in code = **7** (`init.ts:60` excluded as the rung itself); `SM:50,:67` = 2 middleware stamps.

---

## Part 4 — Where authorization is decided (flow × decision point)

Decision points: **(a)** procedure rung · **(b)** per-entity middleware (`ctx.scope` stamp) · **(c)** handler body (verb check, probe, hand-rolled compare, handler-built ctx) · **(d)** DAL hook (`spec.hooks` / config-factory hooks) · **(e)** raw check inside a service · **(f)** nothing beyond (a). A flow may have several; `●` = present.

| Flow | (a) rung | (b) entity mw | (c) handler | (d) DAL hook | (e) service | (f) none | Note |
|---|---|---|---|---|---|---|---|
| P0-1 healthcheck | base | | | | | ● | |
| P0-2 funnels.phoneLookup | base | | ● rate-limit | | | | not authz, throttling |
| P0-3 funnels.submitLead | base | | ● rate-limit+Twilio | | | | writes as SYSTEM |
| P0-4/5 funnels.enrich/setAddress | base | | ● rate-limit | | ● kind gate `customer-intake.service.ts:175,:194` | | capability = uuid |
| P0-6 intake.getRecordingUploadUrl | base | | ● rate-limit | | | | |
| P0-7 landing.* | base | | | | | ● | writes as SYSTEM |
| P0-8/9/10/12 public reads | base | | | | | ● | public-by-design |
| P0-11 customers.createFromIntake | base | | ● rate-limit+Twilio | | | | writes as SYSTEM |
| P0-13 ai.dispatchProjectSummaryJob | base | | | | | ● | raw write in job |
| P0-17 quickbooks/callback | — | | | | | ● | |
| P0-19 dev/playwright-session | — | | ● env/host/secret | | | | |
| P1-2 getFullView (token) | base | ● TOKEN-EQ `SM:62` | | | | | |
| P1-3 views.recordView | system(=base) | | ● `resolveShareTokenActor` + literal ctx | | | | |
| P1-4 crud.getById (token) | base | ● TOKEN-EQ | (verb skipped `CCR:118`) | | | | |
| P1-5 crud.update (token) | base | ● TOKEN-EQ | (field gate skipped `CCR:147`) | ● lock ladder `server-spec.ts:76-85` | | | lock is state, not identity |
| P1-6 funding.setCashInDeal | base | ● TOKEN-EQ | | | | | DAL frozen gate `mutations.ts:74` |
| P1-7/8 contracts.getContractStatus/evaluate | base | ● TOKEN-EQ | | | | | |
| P1-9 contracts.applyEnvelopeContext | base | ● TOKEN-EQ | ● `ability==null` role proxy `:191` + systemContext write | ● update.before (proposal) | | | 3 layers + system write |
| P1-10 delivery.requestToMoveForward | base | ● TOKEN-EQ | ● signed gate `:84` | | | | |
| P1-11 pdf route | — | | ● token actor + literal ctx, then SYSTEM | | | | |
| P1-12 summary route | — | | ● token actor + literal ctx | | | | |
| P1-13 /intake page | — | | ● hand compare `intake/page.tsx:40` | | | | procs it drives are (f) |
| P2-1/2 customers.business.list/search | agent | ● CASL | ● (search: omni text WHERE, phone gate) | | | | |
| P2-3 profile.upsert | agent | ● CASL | ● verb `:20` | | | | + DAL parent probe `mutations.ts:37` |
| P2-4 customers.crud.* | agent | ● CASL (factory) | ● verb/field `CCR` | ● delete cascade / update.after | | | |
| P2-5 meetings.reads | agent | ● CASL | | | | | |
| P2-6 reads.getInternalUsers | agent | ● (unused) | ● verb `assign` | | | | |
| P2-7 participants.getParticipants | agent | ● (unused: reads other table) | ● HAND `isParticipant` | | | | |
| P2-8 participants.manageParticipants | agent | ● CASL (update legs) | ● verb `assign` | ● meeting update hooks | | | |
| P2-9 meetings.business.setOutcomeWithReason | agent | ● CASL (write) | ● (pre-read raw) | ● note create probe | | | |
| P2-10 meetings.crud.* | agent | ● CASL (factory) | ● verb/field | ● create.before owner, create.after participant | | | create has no row scope |
| P2-11 proposals.business.list | agent | ● CASL | | | | | |
| P2-12/13/16/18/19 shareable (session) | base | ● LEGACY `SM:45` | ● (`applyEnvelopeContext` gate; crud verb/field) | ● update.before | | | no `access Dashboard` check on this chain |
| P2-14 proposals.crud.create/delete/duplicate | agent | ● LEGACY (factory default) | ● verb | ● create.before (SYSTEM read of any meeting) | | | |
| P2-15 contracts lifecycle ×5 | agent | ● CASL | | ● proposal update hooks | | | service passes ctx through, adds no check |
| P2-17 delivery.sendProposalEmail | agent | ● CASL | | ● update hooks | | | meeting leg as SYSTEM |
| P2-20 incentives.replace | agent | ● CASL | ● verb `:28` | | | | DAL frozen gate |
| P2-21 views.getProposalViews | agent | ● CASL | | ● `isInScope` probe in DAL `queries.ts:36` | | | |
| P2-22 proposals.media.* | agent | ● CASL bridge | ● verb + `canAccess` probes | | | | |
| P2-23 projects.crud.list | agent | ● CASL | | | | | |
| P2-24 projects.media.* | agent | ● CASL bridge | ● `canAccess` probes (not on `create`) | | | | |
| P2-25/26 applications.* | agent | ● LEGACY | ● verb (crud) | | | | create has no row scope |
| P2-27 customerNotes.crud.* | agent | ● LEGACY bridge | ● verb | ● create probe (CASL) + author-or-admin (HAND) | | | |
| P2-28..32 projects.crud getAll/getForEdit/create/update/delete | agent | | | | | ● | `03` §E1-1 |
| P2-33 projects.business.create | agent | | ● handler-built LEGACY ctx for meeting leg | ● meeting update hooks | | | reads raw |
| P2-34 googleDrive.* | agent | | ● self by session (account rows) | | | | media create unscoped |
| P2-35 pipelines.getCustomerPipelineItems | agent | | ● verb (tab) | | ● DAL self-scopes from `actor` (feature DAL) | | |
| P2-36 pipelines.moveCustomerPipelineItem | agent | | | | ● DAL self-scopes; raw project write | | |
| P2-37 pipelines.moveCustomerToPipeline | agent | | ● verb `manage CustomerPipeline` | | | | write as SYSTEM |
| P2-38 pipelines.getCustomerProfile | agent | | | | ● DAL self-scopes customer; children raw | | |
| P2-39 pipelines.getRecordingUrl | agent | | ● `canAccess` probe | | | | |
| P2-40 pipelines.getCustomerProjects | agent | | ● handler-built scope (meeting only) | | | | proposals/projects raw |
| P2-41 pipelines.assignToProject | agent | | ● verb + 2 probes + literal ctx | ● meeting update hooks | | | |
| P2-42 meetingFlow.updateCustomerProfile | agent | | ● verb + probe + literal ctx | | | | |
| P2-43 meetingFlow.getPersonaProfile | agent | | ● `buildUserContext` (LEGACY) | | | | |
| P2-44 dashboard.getActionQueue | agent | | ● passes `isOmni`; DAL inlines legacy fragment | | | | |
| P2-45 agent-settings.* | agent | | ● self by session id | | | | |
| P2-46 push.sendTestToSelf | agent | | ● self | | | | |
| P2-47..50 activities.* | agent | | ● HAND owner compare (no CASL verb) | | | | |
| P2-51 sync.* (calendar link) | agent | | ● self | | | | |
| P2-52 sync.triggerSync | agent | | | | | ● (meetings leg) | |
| P2-53 sync.systemOwnerHealth/renew | agent | | ● inline omni verb | | | | |
| P2-54 voipCampaigns reads ×4 | agent | | | | | ● | |
| P2-55 notion.revalidateNotionCache | agent | | | | | ● | |
| P4 lead-sources ×15 | superAdmin | | | | | ● (rung is the decision) | raw db |
| P4 voipCampaigns superAdmin ×15 | superAdmin | | ● (`assertCampaignDialable` state gate) | | | | 3 drop to SYSTEM |
| P5-1 push.subscribe/unsubscribe | protected | | ● self by session id | | | | |
| P6-1 qstash-jobs → 21 jobs | — | | ● QStash signature at route | ● entity hooks fire under SYSTEM | ● service gates (enrollment eligibility) | | |
| P6-2/3 bina, cloudtalk webhooks | — | | ● secret at route | ● hooks under SYSTEM | | | |
| P6-4/5 quickbooks, zoho-sign webhooks | — | | ● HMAC at route (zoho: dev bypass) | | | | dispatch only |
| P6-6 google-calendar webhook | — | | | | | ● | raw meeting writes |
| P6-7/8 scripts | — | | | | | ● | operator |

**Totals (one count per matrix row carrying a `●`; 74 matrix rows)**: (a) the rung is a real decision on every tRPC row, and the *sole* decision on 9 tRPC rows (the (f) rows: P0-1, P0-7, P0-8/9/10/12 group, P0-13, P2-28..32, P2-52, P2-54, P2-55, P4 lead-sources) · (b) entity middleware **28** rows (17 CASL, 4 LEGACY-stamped — shareable session branch, proposals authed factory slots, applications, customer-notes — and 7 TOKEN-EQ) · (c) handler body **47** rows · (d) DAL hook **16** rows · (e) service / feature-DAL raw check **5** rows (P0-4/5, P2-35, P2-36, P2-38, P6-1) · (f) nothing beyond rung/edge **12** rows (16 procedures once P2-28..32 is expanded; incl. non-tRPC edges P0-17, P6-6, P6-7/8).

**Scatter summary (facts)**: the same entity (Proposal) is authorized by CASL middleware on `proposalProcedure`, by LEGACY middleware on `proposalShareableProcedure` and the factory's authed slots, by TOKEN-EQ on the token branch, by a handler role-proxy at `contracts.router.ts:191`, by DAL hooks (`server-spec.ts:76-85`), and by a legacy point probe inside a DAL (`proposal-views/queries.ts:36`) — six mechanisms for one subject. Customer-note own-record rules live in a DAL hook (`assert-note-author.ts`) while Activity own-record rules live in five handler bodies (`activities.router.ts`). Row scope for the pipelines feature is derived in the feature DAL from `ctx.actor` (ignoring `ctx.scope`), while every factory DAL derives it from `ctx.scope` (ignoring `ctx.actor`).
