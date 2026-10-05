# 03 — Per-Entity Permissions Reality Map (LEGACY vs CASL, as the code runs today)

Worktree: `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/issue-285` @ `b40403b6` (Phase 7 unit 7a: meeting CRUD → CASL). Read-only inventory; every claim cites `file:line`. All paths are relative to the worktree root unless absolute.

## 0. Engine mechanics (what each engine actually does)

**The shared WHERE seam.** `createCrudDal` applies `requireResolvedScope(ctx.scope)` in exactly three places — `getById` (`src/shared/dal/server/lib/create-crud-dal.ts:117`), `update` (`:213`), `delete` (`:264`). **`create` applies NO scope and NO parent probe** (`:129-157`) — the only guard is whatever a `before` hook adds. `duplicate` = scoped `getById` + unscoped `createImpl` (`:288-313`). `requireResolvedScope` (`src/shared/dal/server/lib/helpers.ts:95-102`) throws on `undefined`, passes `null` through as "no WHERE".

**LEGACY read engine** = `spec.visibility(auth)` + parent bridge, resolved by `resolveEffectiveScope` (`src/shared/dal/server/lib/scope.ts:37-48`; own fragment `:38`, `bridgeToParent` `:39`, throws if neither `:42-46`). `bridgeToParent` (`:51-56`) emits `fk IN (SELECT parent.pk WHERE <parent effective scope>)` recursively. Three omni-collapsing callers: `resolveVisibilityScope` (`src/trpc/lib/middleware/scope-middleware.ts:19-25`), `buildUserContext` (`helpers.ts:65-78`), `shareableMiddleware` session branch (`src/trpc/lib/middleware/shareable-middleware.ts:39-51`). `isVisible` (`scope.ts:67-79`) has **zero callers**; `isInScope` (`scope.ts:90-97`, `@deprecated`) has one.

**CASL engine** = `resolveActorScope(spec, actor)` (`src/shared/dal/server/lib/resolve-actor-scope.ts:22-35`): root → `compileScope(actor, 'read', spec.caslSubject)` (`:26`) — **always the `read` action, even when the caller is about to UPDATE/DELETE**; child (`spec.parent`) → `verbOnly(actor,'read',subject)` (`:25`, `:42-48`) AND `fk IN (SELECT parent.pk WHERE resolveActorScope(parent))` (`:27-33`). `compileScope` (`src/shared/domains/permissions/scope/compile-scope.ts:22-35`): system → `null`; token → `actor.scope`; user → `rulesToAST(ability,'read',subject)`; no rule → `sql\`false\``; conditionless rule → `null` (omni is emergent). `canAccess` (`resolve-actor-scope.ts:55-73`) is the point probe; its child branch ignores `action` (`:62-66`). tRPC wrapper `resolveTrpcActorScope` (`src/trpc/lib/middleware/resolve-trpc-actor-scope.ts:18-23`) builds a `userActor` from the session.

**The router seam.** `createCrudRouter` picks `config.resolveScope ?? resolveVisibilityScope` (`src/trpc/lib/create-crud-router.ts:98`) → **default is LEGACY**; the authed procedure stamps `ctx.scope` at `:99-100`; shareable specs use `shareableMiddleware` (`:101`). Verb gates: `assertCan` on getById/create/delete/duplicate (`:119,131,158,165` → `:185-197`), `assertCanUpdateFields` on update (`:148` → `:214-230`), both skipped when `ctx.ability` is null (token path, `:118`, `:147`). Entities that pass `resolveScope: resolveTrpcActorScope`: **customers** (`src/trpc/routers/customers.router/crud.router.ts:50`, commit `3e901178`) and **meetings** (`src/trpc/routers/meetings.router/crud.router.ts:35`, commit `b40403b6`). Entities on the default (LEGACY): **proposals** (`src/trpc/routers/proposals.router/crud.router.ts:20-25`), **applications** (`src/trpc/routers/applications.router/crud.router.ts:13-17`), **customer-notes** (`src/trpc/routers/customer-notes.router/index.ts:10-14`).

**Context shape.** `ScopedContext { session, ability, scope, actor }` (`src/shared/dal/server/types.ts:35-47`). `SYSTEM_CONTEXT` = `{scope:null, actor: systemActor('legacy:system-context')}` (`:53-58`); `systemContext(reason)` (`:68-70`). `SystemReason` union has exactly two members (`src/shared/domains/permissions/scope/system-reasons.ts:8-15`). Procedures: `protectedProcedure` stamps `scope:null, actor:userActor` (`src/trpc/init.ts:60`); `agentProcedure` only checks `access Dashboard` (`:73`) — **dispatchers pass it** (`abilities.ts:226`); `superAdminProcedure` checks `manage all` (`:95`).

**CASL rule table (`src/shared/domains/permissions/abilities.ts`).** super-admin: `manage all` `:96`. agent: Dashboard `:106`; Customer read `{ $participatesViaMeeting: via customerId }` `:108`, update fields `['age']` `:112`; CustomerProfile read/update `:116-117`; CustomerLeadAttribution read `:121`; CustomerNote read/create/update/delete (no conditions) `:126-129`; Meeting read `{ via 'self' }` `:131`, create `:132`, update `:133`, own `:134`; Proposal read `{ via meetingId }` `:136`, create `:137`, update `:138`; Application read/create/update `:141-143`; Project read `{ ownerId: user.id }` `:149` OR read `{ via projectId }` `:150`, create `:151`, update `:152`; Activity read/create/update/delete `:155-158`; Calendar manage `:160`; CustomerPipeline read `:164`; User read `:166`; VoipCall read/create `:171-172`; VoipMessage read/create `:174-175`; VoipDid read `:177`; VoipLinkToken read/create `:179-180`; VoipCampaign read `:186`; VoipContactAttribute read `:187`; VoipCampaignContact read/update `:188-189`. homeowner: Proposal read `:208`, User read `:209`. user: User read `:216`. dispatcher: Dashboard `:226`; LeadsPool read `:227`; Customer read `{ $inDerivedPipeline: ['leads','rehash','dead','fresh'] }` `:233`, update fields `['name','phone','email','address','city','state','zip','pipelineStage','age']` `:236`; CustomerProfile read/update `:241-242`; CustomerLeadAttribution read `:245`; CustomerNote read/create/update/delete `:253-256`; Meeting read (UNCONDITIONAL) `:261`, create `:262`, update `:263`; User read `:266`; VoipCall read/create `:269-270`; VoipMessage read/create `:272-273`; VoipDid read `:274`.
**No mutation rule (create/update/delete) anywhere carries a row condition** — only field lists. Row conditions exist only on `read` for Customer/Meeting/Proposal/Project. **Delete grants**: super-admin (all), agent+dispatcher CustomerNote, agent Activity — nothing else.

---

## A. Per-entity reality map

Legend for column 4: **CASL** = `ctx.scope` compiled by `resolveActorScope`; **LEGACY** = `resolveEffectiveScope`/`spec.visibility`; **SYSTEM** = `scope:null` system actor; **NONE** = unscoped, bare `agentProcedure`/`baseProcedure`; **HAND** = hand-rolled predicate outside both engines.

### A.1 Customer (`customers`)

| # | Field | Reality |
|---|---|---|
| 1 | CASL subject / rules | `'Customer'` (`src/shared/entities/customers/lib/server-spec.ts:40`). agent: read `:108` (cond), update fields `['age']` `:112`, **no create/delete**. dispatcher: read `:233` (cond), update 9 fields `:236`. Child subjects on same table family: `CustomerProfile` (read/update, no cond, `:116-117`, `:241-242`), `CustomerLeadAttribution` (read only `:121`, `:245`). |
| 2 | Legacy visibility fn | `customerVisibility` `src/shared/entities/customers/lib/visibility.ts:31-36` (LeadsPool → `derivedPipelineWhere(['leads'])` `:33`; else `userCanSeeCustomer` `:35`) → `userCanSeeCustomer` `src/shared/entities/customers/dal/server/visibility.ts:9-19`. Declared on spec `server-spec.ts:41`. **Still live only via the customer-notes parent bridge** (see A.7). `leadsPoolVisibility` DELETED (commit `a9808587`). |
| 3 | `parent` | none (root). |
| 4 | Engine per op | **list** (`business.list`, `business.search`): CASL — `customerProcedure` `src/trpc/routers/customers.router/procedures.ts:26-29` → `resolveTrpcActorScope`; WHERE at `business.router.ts:64`, `:129`. **getById**: CASL — crud leaf `crud.router.ts:50` → override handler `getCustomer` (`crud.router.ts:58`) → `src/shared/entities/customers/dal/server/queries.ts:81` `requireResolvedScope(ctx.scope)`. **create**: verb-only `assertCan('create')` (`create-crud-router.ts:131`) → agents/dispatchers FORBIDDEN; super-admin insert unscoped (`create-crud-dal.ts:129-157`). **update**: CASL read-scope WHERE (`create-crud-dal.ts:213`) + `assertCanUpdateFields` (`create-crud-router.ts:148`); geocode-reset hook `server-spec.ts:55-75`; `propagateCustomerChangeJob` after `:98-100`. **delete**: `assertCan('delete')` → super-admin only; cascade hook `server-spec.ts:125-142` runs `db.delete(proposals)` `:137` and `meetingCrud.delete(SYSTEM_CONTEXT)` `:140`. **duplicate**: CASL getById + unscoped create. **profile.upsert**: `profile.router.ts:17-27` → `upsertCustomerProfile` probes parent with `ctx.scope` (CASL) `mutations.ts:37-46`; also via `meeting-flow.router.ts:46-54` (`canAccess` + literal ctx with `resolveActorScope`). **Pipeline surfaces**: `get-customer-pipeline-items.ts:51` and `get-customer-profile.ts:54` compile `resolveActorScope(customerServerSpec, actor)` directly (CASL). |
| 5 | DAL callers outside tRPC | `customerIntakeService.ingestLead` → `customerCrud.create(ctx)` `src/shared/services/customer-intake.service.ts:76` and `.update` `:197`, ctx = `SYSTEM_CONTEXT` from `src/app/api/webhooks/bina/route.ts:35`, `src/trpc/routers/funnels.router.ts:121,241`, `customers.router/business.router.ts:224` (public `createFromIntake`); `landing.router/index.tsx:126` (`SYSTEM_CONTEXT`); `accounting.service.ts:80` (`SYSTEM_CONTEXT`, from QB jobs `create-qb-records.ts:17`); `contracts.router.ts:223-226` (`systemContext('derived:contract-age-from-token-proposal')`); `move-customer-pipeline-item.ts:43` (CASL `scopedFor`). Raw-`db` customer reads: `accounting.service.ts:27`, `notification.service.ts:68`, `compliance.service.ts:52`, `customers/dal/server/queries.ts:125-140,146-155,163-177,207-235` (SYSTEM-level, no ctx). |
| 6 | Hand-rolled auth outside engine | Phone gate `canSeeUngatedPhone(ctx.actor)` (`src/shared/entities/customers/lib/phone-gating-sql.ts:42-46`) at `queries.ts:51`, `business.router.ts:124`, `meetings/dal/server/queries.ts:165,279`, pipelines `:43`/`:32`, `dashboard.router.ts:10`; `business.search` omni-only phone match `business.router.ts:107-119`. Client mirrors: `use-customer-edit-form.ts:23-30` (field-CASL mirror), `columns-registry.tsx:63`, `customer-hero-actions.tsx:83-84`, `lib/can-see-phone.ts:16`. `use-customer-action-configs.ts` has **no** ability checks. |
| 7 | Raw table access bypassing scope | `projects.router/business.router.ts:34-37` (customer by input id, bare agentProcedure); `customer-pipelines.router.ts:82-87` (after `canAccess` probe — OK); `lead-sources.router.ts:263,329,391,486,576,644` (superAdmin); `notification.service.ts:68`; `accounting.service.ts:27`; `compliance.service.ts:52`; `landing.router/index.tsx:137` (**`db.insert(customerNotes)`** bypasses note hooks). |

### A.2 Meeting (`meetings`)

| # | Field | Reality |
|---|---|---|
| 1 | CASL | `'Meeting'` (`src/shared/entities/meetings/lib/server-spec.ts:21`). agent: read `{via:'self'}` `:131`, create/update/own `:132-134`, **no delete**, `assign` only via super-admin `manage all`. dispatcher: read **unconditional** `:261`, create/update `:262-263`, no own. |
| 2 | Legacy fn | `meetingVisibility` `src/shared/entities/meetings/lib/visibility.ts:9-11` → `userParticipatesInMeeting` `src/shared/entities/meetings/dal/server/participants.ts:9-18`; declared `server-spec.ts:22`. Still live via (a) applications parent bridge, (b) `buildUserContext(meetingServerSpec)` at `meeting-flow.router.ts:71` and `projects.router/business.router.ts:67`. |
| 3 | `parent` | none. |
| 4 | Engine per op | **list / getByIdWithJoins**: CASL — `meetingProcedure` `meetings.router/procedures.ts:20-23`; WHERE `meetings/dal/server/queries.ts:151`, `:294`. **getById/update/delete/duplicate (crud leaf)**: CASL — `crud.router.ts:35`; WHERE `create-crud-dal.ts:117/213/264`; hooks in `meetings/dal/server/crud.ts:20-188` (owner resolved server-side `:33-38` via `resolveMeetingOwnerId` reading `ctx.ability.can('own','Meeting')` `lib/resolve-owner.ts:14`; participant add `:52`). **create**: `assertCan('create')` then **unscoped insert with NO probe on `customerId`** (`create-crud-dal.ts:129-157`; hook only stamps owner). **business.setOutcomeWithReason**: raw unscoped `db.select` of the meeting `business.router.ts:42-46`, then CASL-scoped `meetingCrud.update(ctx)` `:52`, then `customerNoteCrud.create(ctx)` `:66` (ctx.scope is the *meeting* scope; note create relies on its own `canAccess` hook). **participants.getParticipants**: HAND — `isParticipant` + omni check `participants.router.ts:37-44`. **participants.manageParticipants**: verb `assign` `:59`; owner writes via CASL-scoped `meetingCrud.update(ctx)` `:107,132,139,200`; participant rows via unscoped raw fns `participants.ts:168-197`. **meeting-flow.getPersonaProfile**: **LEGACY** — `buildUserContext(...meetingServerSpec)` `meeting-flow.router.ts:71` → `resolveEffectiveScope` → participation predicate (dispatcher on a system-owned meeting → NOT_FOUND, unlike the CASL unconditional read). **customer-pipelines**: CASL — `getCustomerProjects` `customer-pipelines.router.ts:106`, `assignToProject` `:137,143-144`; `move-customer-pipeline-item.ts:37,92-114`. |
| 5 | Callers outside tRPC | `customerIntakeService` `meetingCrud.create(ctx=SYSTEM_CONTEXT)` `customer-intake.service.ts:144`; `move-customer-to-pipeline.ts:35` (`SYSTEM_CONTEXT`, super-admin gated at router `:58`); `customers/lib/server-spec.ts:140` cascade delete (`SYSTEM_CONTEXT`); `proposals/lib/server-spec.ts:54` `meetingCrud.getById(SYSTEM_CONTEXT)` (create hook, no visibility probe); `meetings/dal/server/mutations.ts:42,72` (`deriveOutcome*` with caller ctx: `delivery.router.ts:63` passes `SYSTEM_CONTEXT`; `contracts.service.ts:210` passes tRPC/SYSTEM ctx); `projects.router/business.router.ts:72` (LEGACY `buildUserContext`). GCal: `meetings/dal/server/google-calendar.ts:30,65,79,87,105-126` raw `db` (no ctx) used by `scheduling.service.ts` from jobs `sync-meeting-to-gcal.ts:19`, `sync-calendars.ts:35`, `propagate-customer-change.ts:19`. |
| 6 | Hand-rolled auth | `isParticipant` `participants.router.ts:39`; `assign` gate `:59`, `reads.router.ts:32`; `resolveMeetingOwnerId` `lib/resolve-owner.ts:13-18`; `get-action-queue.ts:154` uses `userParticipatesInMeeting` directly with `isOmni` pre-check (`dashboard.router.ts:7-11`). Client mirrors: `participants-slot.tsx:125,212,305` (`assign`), `meeting-flow/ui/components/table/index.tsx:85`, `customer-meetings-list.tsx:52`, `customer-hero-actions.tsx:83`. `use-meeting-action-configs.tsx` has no ability checks. |
| 7 | Raw access | `meetings.router/business.router.ts:42-46` (unscoped by-id read); `schedule.router/sync.router.ts:43-49` (**all** unsynced meetings, any agent → GCal push side-effect); `move-customer-to-pipeline.ts:26-32`; `lead-sources.router.ts:434,447,494,606,617,648` (superAdmin); `notification.service.ts:227,281,293`; `customers/lib/server-spec.ts:127-130`; `meeting-participation.ts:44-62` (the CASL operator itself). |

### A.3 Proposal (`proposals`)

| # | Field | Reality |
|---|---|---|
| 1 | CASL | `'Proposal'` (`src/shared/entities/proposals/lib/server-spec.ts:31`). agent: read `{via meetingId}` `:136`, create `:137`, update `:138`, no delete. dispatcher: **no rule** → CASL deny-all (`compile-scope.ts:30`). homeowner: read (no cond) `:208`. |
| 2 | Legacy fn | `proposalVisibility` `src/shared/entities/proposals/lib/visibility.ts:9-11` → `userParticipatesInMeeting`; declared `server-spec.ts:32`. **LIVE** on the crud leaf + shareable session branch. |
| 3 | `parent` | none. `shareable: { tokenColumn: 'token' }` `server-spec.ts:39`. |
| 4 | Engine per op | **business.list**: CASL — `proposalProcedure` `proposals.router/procedures.ts:28-31`; WHERE `proposals/dal/server/queries.ts:226`. **crud.getById / update / delete / duplicate**: **LEGACY** — `crud.router.ts:20-25` passes no `resolveScope` → `create-crud-router.ts:98` default `resolveVisibilityScope`; because `spec.shareable` is set, getById/update use `shareableMiddleware` (`create-crud-router.ts:104-105`): session branch → `resolveEffectiveScope` `shareable-middleware.ts:45` (LEGACY), token branch → `eq(proposals.token, token)` `:62`; delete/duplicate use the authed procedure (LEGACY default). WHERE at `create-crud-dal.ts:117/213/264`. **create**: `assertCan('create')` then unscoped insert; `create.before` hook reads the meeting with `SYSTEM_CONTEXT` `server-spec.ts:53-55` and copies `meeting.flowStateJSON` `:58` — **no probe that the caller can see `input.meetingId`**. **business.getFullView / contracts.getContractStatus / evaluateEnvelopeContext / applyEnvelopeContext / delivery.requestToMoveForward / funding.setCashInDeal**: `proposalShareableProcedure` (`procedures.ts:45`) → session = LEGACY, token = `eq(token)`; DAL WHERE `queries.ts:122`, `mutations.ts:70`. **contracts.createContractDraft/submit/recall/discard/resend, delivery.sendProposalEmail, incentives.replace, views.getProposalViews**: CASL — `proposalProcedure`; `contractService.*` uses `proposalCrud.update(ctx)` `contracts.service.ts:29,78,99,131,158`; `incentives` WHERE `proposal-incentives/dal/server/mutations.ts:45`; `getProposalViews` uses deprecated `isInScope(proposalServerSpec, ctx, id)` `proposal-views/dal/server/queries.ts:36` against the CASL `ctx.scope` (`scope.ts:94`). **views.recordView + `/api/proposals/[id]/summary` + `/pdf`**: token actor via `resolveShareTokenActor` (`share-token-actor.ts:21-29`) → literal ctx `{scope: resolveActorScope(proposalServerSpec, actor)}` at `views.router.ts:50`, `summary/route.ts:31`, `pdf/route.ts:27` (CASL token branch = `actor.scope`). `pdf/route.ts:36` then re-reads with `SYSTEM_CONTEXT`. |
| 5 | Callers outside tRPC | `accounting.service.ts:170,224,247` `proposalCrud.update(SYSTEM_CONTEXT)` (QB jobs `sync-qb-invoice.ts:7`, `sync-qb-payment.ts:7`, `create-qb-records.ts:17-18`); `contracts.service.applyContractEvent(SYSTEM_CONTEXT)` from `jobs/sync-zoho-sign-status.ts:41` → `getByContractEnvelopeId` `queries.ts:313-328` + `proposalCrud.update` `:206`; `zoho-sign/lib/documents/registry.ts:154` `pdfService.generateSowPdf(SYSTEM_CONTEXT)`; `pdf.service.ts:23,41` `getFullView(ctx)`; `move-customer-pipeline-item.ts:136` (CASL `scopedFor`); `scripts/recompute-final-tcp.ts:20`; **`ai/client.ts:96-113` raw select+update of `proposals.projectJSON` by id** reached from **public** `ai.router/index.ts:7-22` (`baseProcedure`) via `generate-ai-summary.ts:8`. |
| 6 | Hand-rolled auth | `incentives.router.ts:28` and `proposals media.router.ts:19-23` re-check `update Proposal`; `contracts.router.ts:191-196` token-path FORBIDDEN for `envelopeDocumentIds`; lock ladder `server-spec.ts:76-85` / `mutations.ts:74`; `getProposalLockSignals` deliberately unscoped `queries.ts:288-307`. Client mirrors: `proposal-flow/hooks/use-view-mode.ts:16`, `navbar.tsx:30-32`, `navbar-menu.tsx:38`, `heading.tsx:110-136`, `proposal/index.tsx:74`, `project-entity-card.tsx:32`. `use-proposal-action-configs.ts` has no ability checks. |
| 7 | Raw access | `ai/client.ts:96-113` (public-reachable write); `projects.router/business.router.ts:20-23` (by meetingId, bare agentProcedure); `customer-pipelines.router.ts:118-122` (proposals by meetingId after CASL *meeting* probe only — a dispatcher with no Proposal grant receives `label/status`); `get-customer-pipeline-items.ts:437-451` (projects branch, proposals by meetingIds after project scope); `accounting.service.ts:131,197,238`; `lead-sources.router.ts:218`; `validate-share-token.ts:36`; `proposal-media-files/dal/server/queries.ts:50-53` (`getProposalMediaFileById`, "No scope applied here"). |

### A.4 Proposal media (`proposal_media_files`)

| # | Field | Reality |
|---|---|---|
| 1 | CASL | subject **reuses `'Proposal'`** (`src/shared/entities/proposal-media-files/lib/server-spec.ts:40`); `PROPOSAL_MEDIA_FILE` is in `ENTITY_NAMES` (`abilities.ts:56`) but no role has a `ProposalMediaFile` rule. |
| 2 | Legacy fn | none (never had one). |
| 3 | `parent` | `{ spec: proposalServerSpec, fk: proposalMediaFiles.proposalId }` `server-spec.ts:41`. |
| 4 | Engine per op | **All ops CASL** via `proposalMediaProcedure` `proposals.router/procedures.ts:39-42` → `resolveTrpcActorScope(proposalMediaServerSpec)` → child: `verbOnly(read Proposal)` AND bridge. **list**: `mediaService.list` → `listMediaByOwner` WHERE `media-ops.ts:36`; **create**: `assertCanUpdate` + `canAccess(proposalServerSpec, ctx.actor)` `media.router.ts:26-30,57` then unscoped `store.crud.create` `media.service.ts:37`; **update** (`setVisibility` `:75`, `rename` via `media.service.ts:78`) WHERE `create-crud-dal.ts:213`; **delete** `media.service.ts:46-59` (scoped getById + delete); **reorder** `media-ops.ts:57`; **retryOptimization**: `canAccess(proposalMediaServerSpec)` `media.router.ts:104` then unscoped `resetMediaOptimizationStatus` `optimization.ts:43`. Homeowner-visible rows read unscoped inside `getFullView` (`listHomeownerProposalMedia` `queries.ts:56-62`). |
| 5 | Callers outside tRPC | `mediaService` (rings `store.crud`, `stores.ts:38`); optimize job `optimization-target.ts:20` raw select by id. |
| 6 | Hand-rolled | `assertCanUpdate` `media.router.ts:19-23` (verb re-check). |
| 7 | Raw access | `projects.router/media.router.ts:114-129,169-181` (proposal media joined through `meetings.projectId` after `canAccess(project)` — join is the authz); `optimization-target.ts:20`; `proposal-media-files/dal/server/queries.ts:50-62`. |

### A.5 Project (`projects`)

| # | Field | Reality |
|---|---|---|
| 1 | CASL | `'Project'` (`src/shared/entities/projects/lib/server-spec.ts:45`). agent: read `{ownerId}` `:149` OR `{via projectId}` `:150` (compiled by `interpret.ts:56` as `or(...)`), create `:151`, update `:152`, **no delete**. dispatcher: **no rule**. |
| 2 | Legacy fn | `projectVisibility` / `projectParticipationScope` **DELETED** (commit `a8ec6c3f`); `lib/visibility.ts` now holds only `hasAssociatedMeeting` (`src/shared/entities/projects/lib/visibility.ts:15-22`, a portfolio filter, not authz). |
| 3 | `parent` | none. |
| 4 | Engine per op | **crud.list**: CASL — `projectProcedure` `projects.router/procedures.ts:15-16`; WHERE `projects/dal/server/queries.ts:202,230`. **crud.getAll**: **NONE** — `crud.router.ts:14-17` bare `agentProcedure` → `getAllProjects()` `queries.ts:147-175` (every project, no CASL check; dispatchers included). **crud.getForEdit**: NONE — `:37-41` → `getProjectForEdit(id)` `queries.ts:114-141` (+ all its media). **crud.create**: NONE — `:43-48` → `createProject` `mutations.ts:30-46` (no `assertCan`). **crud.update**: NONE — `:50-58` → `updateProject` `mutations.ts:48-82` (no scope, no `assertCanUpdateFields`). **crud.delete**: NONE — `:60-65` → `deleteProject` `mutations.ts:84-98` (**no `can('delete','Project')` check** — agents have no delete grant; also wipes R2 media `:86-95`). **business.create**: `:15-81` bare agentProcedure; raw reads `:20-37`; meeting link via **LEGACY** `buildUserContext(meetingServerSpec)` `:67-75`. **customer-pipelines**: CASL `resolveActorScope(projectServerSpec)` at `get-customer-pipeline-items.ts:397`, `get-customer-profile.ts:236`, `customer-pipelines.router.ts:140`; **but** `move-customer-pipeline-item.ts:61-71` projects branch = raw unscoped `db.update(projects)`; `customer-pipelines.router.ts:111-115` projects by customerId unscoped after meeting probe. `projectCrud` (`projects/dal/server/crud.ts:15`) exists but **no router calls it**. |
| 5 | Callers outside tRPC | `accounting.service.ts:89,120,125` raw; `jobs/create-qb-records.ts:10` raw; `sitemap.ts:4`, `portfolio/.../page.tsx:4`, `showroom-display.router.ts:6-15` (`baseProcedure`, `isPublic` only), `landing/dal/server/projects.ts:6-62` (public). |
| 6 | Hand-rolled | none server-side beyond `isPublic` filters. Client: `story-hero.tsx:31`, `notion-refresh-button.tsx:27`, `get-sidebar-nav.ts:97`. `use-project-action-configs.ts` has no ability checks. |
| 7 | Raw access | Entire `crud.router.ts` + `mutations.ts` + `queries.ts:15-175` are raw; `move-customer-pipeline-item.ts:61-71`; `customer-pipelines.router.ts:111-115`; `lead-sources.router.ts:464,503,629,652`. |

### A.6 Project media (`media_files`)

| # | Field | Reality |
|---|---|---|
| 1 | CASL | subject reuses `'Project'` (`src/shared/entities/media-files/lib/server-spec.ts:39`); `MEDIA_FILE` in `ENTITY_NAMES` `abilities.ts:58`, no rules. |
| 2 | Legacy fn | none. |
| 3 | `parent` | `{ spec: projectServerSpec, fk: mediaFiles.projectId }` `server-spec.ts:40`. |
| 4 | Engine per op | `projects.router/media.router.ts` runs on `projectMediaProcedure` (`procedures.ts:27-28`, CASL child bridge). **getUploadUrl**: `canAccess(project)` `:29`. **create** (`:42-48`): **no probe on `input.projectId`** → `mediaService.createRecord` → unscoped `mediaFileCrud.create` (`media.service.ts:37`). **delete/bulkDelete/reorder/movePhase/rename/toggleHero**: CASL-scoped via `media.service.ts:46-79` → `create-crud-dal.ts:117/213/264`, `media-ops.ts:57,90,112,121`. **retryOptimization**: `canAccess(mediaFileServerSpec)` `:53`. **listImportableProposalMedia / importFromProposal**: `canAccess(project)` `:111,164` + join authz. **google-drive.uploadFromFile** (`google-drive.router.ts:50-124`): **bare `agentProcedure` (scope null)** → `mediaService.createRecord(projectMediaStore, ctx, …)` `:114` for any `projectId`. Reads: `getProjectForEdit` returns all media unscoped (`projects/dal/server/queries.ts:129-133`). |
| 5 | Callers outside tRPC | `optimization-target.ts:16` raw; `projects/dal/server/mutations.ts:86-95` raw (delete cascade); `landing/lib/get-trade-images.ts:42` raw (public). |
| 6 | Hand-rolled | none. |
| 7 | Raw access | as above. |

### A.7 Customer note (`customer_notes`)

| # | Field | Reality |
|---|---|---|
| 1 | CASL | `'CustomerNote'` (`src/shared/entities/customer-notes/lib/server-spec.ts:34`). agent read/create/update/delete `:126-129`; dispatcher same `:253-256`. **All conditionless.** |
| 2 | Legacy fn | `customerNoteVisibility` DELETED (commit `c215c3d2`). Effective legacy scope = parent bridge → `customerVisibility`. |
| 3 | `parent` | `{ spec: customerServerSpec, fk: customerNotes.customerId }` `server-spec.ts:35`. |
| 4 | Engine per op | Router = `createCrudRouter` with **no `resolveScope`** (`customer-notes.router/index.ts:10-14`) → **LEGACY** default. **getById/update/delete**: WHERE = `resolveEffectiveScope(customerNoteServerSpec)` → no own fragment → `bridgeToParent` → `customerVisibility` (dispatcher → `['leads']` only `visibility.ts:32-33`; agent → participation `:35`). **create**: unscoped insert, but `create.before` probes `canAccess(customerServerSpec, ctx.actor, customerId)` **(CASL)** `server-spec.ts:57-63` and stamps `authorId` from session `:61-62`. **update/delete before-hooks**: `customerNoteCrud.getById(ctx)` (LEGACY-scoped) `:77-78`, `:89-90` then `assertNoteAuthorOrAdmin` (`lib/assert-note-author.ts:7-16`). Net: **create = CASL, read/update/delete = LEGACY** — dispatcher update/delete on a non-`leads` customer's note → NOT_FOUND (acknowledged at `customers/lib/visibility.ts:20-22`). **list**: no list procedure; notes read unscoped inside `get-customer-profile.ts:190-204` after the CASL customer probe `:54`. |
| 5 | Callers outside tRPC | `customerIntakeService` `customerNoteCrud.create(SYSTEM_CONTEXT)` `customer-intake.service.ts:115,128`; `meetings/business.router.ts:66` (meeting-scoped ctx); `landing.router/index.tsx:137` **raw `db.insert(customerNotes)`** (bypasses hooks). |
| 6 | Hand-rolled | `assertNoteAuthorOrAdmin` (author-or-omni, reads `ctx.session`/`ctx.ability`, not `ctx.actor`); client mirror `use-customer-note-action-configs.ts:33-64` (`isAdmin || authorId === currentUserId`). |
| 7 | Raw access | `landing.router/index.tsx:137`; `get-customer-profile.ts:190-204`. |

### A.8 Application (`applications`)

| # | Field | Reality |
|---|---|---|
| 1 | CASL | `'Application'` (`src/shared/entities/applications/lib/server-spec.ts:23`). agent read/create/update `:141-143` (no delete, no conditions); dispatcher **no rule**. |
| 2 | Legacy fn | `applicationVisibility` DELETED (commit `4b705e81`). Effective legacy = parent bridge → `meetingVisibility`. |
| 3 | `parent` | `{ spec: meetingServerSpec, fk: applications.meetingId }` `server-spec.ts:24`. |
| 4 | Engine per op | **Everything LEGACY.** `applicationProcedure` `applications.router/procedures.ts:20-23` → `resolveVisibilityScope`; crud leaf `crud.router.ts:13-17` → default. **list / getWithAnswers**: WHERE `applications/dal/server/queries.ts:31,57`. **getById/update/delete**: `create-crud-dal.ts:117/213/264`. **draft.save/submit/withdraw**: scoped pre-read `mutations.ts:34,74,163` then unscoped update by id `:42-45,137-140,170-173`. **create**: `assertCan('create')` then **unscoped insert, no probe on `meetingId`**. Dispatcher: `assertCan` FORBIDDEN on crud; on `applicationProcedure` reads the legacy bridge yields participation = ∅. |
| 5 | Callers outside tRPC | none found. |
| 6 | Hand-rolled | status guards (`mutations.ts:38,78,167`). No client action-config file. |
| 7 | Raw access | child tables read unscoped after parent probe `queries.ts:61-70`; writes `mutations.ts:116-141`. |

### A.9 Activity (`activities`) — no spec, no DAL, outside both engines

Subject `'Activity'` (agent read/create/update/delete `abilities.ts:155-158`; dispatcher none) — **never checked** by the router. `schedule.router/activities.router.ts`: list scope = `isOmni ? undefined : eq(activities.ownerId, userId)` `:37-39,59`; getById owner check `:109-113`; update `:166-182`; complete `:204-219`; delete `:237-252`; create stamps `ownerId` from session `:130-136`. All on bare `agentProcedure` → dispatchers can create/list their own activities without any grant. GCal raw DAL `activities/dal/server/google-calendar.ts:9-72`. `use-activity-action-configs.ts` has no ability checks; `schedule-calendar-dot.tsx:32` and `entity-action-menu.tsx:31` evaluate `action.permission` tuples client-side.

### A.10 User (`user`) — no spec

Subject `'User'` read for every role (`abilities.ts:166,209,216,266`). `agent-settings.router.ts:15-23` reads own row; `updateProfile` `:45-47` → `users/dal/server/mutations.ts:36-48` keyed by `ctx.session.user.id` (own-record by construction). `meetings reads.getInternalUsers` gated on `assign Meeting` `reads.router.ts:32`. `getSystemOwnerId` `users/dal/server/system.ts:9-26`.

### A.11 Lead source (`lead_sources`) — no spec, no CASL subject

`lead-sources.router.ts`: every procedure is `superAdminProcedure` (`:136,175,192,240,257,274,339,365,568,708,723,779,793,807,836`); raw `db` throughout (`:36-846`). DAL `lead-sources/dal/server/queries.ts:14-39` takes no ctx. Landing/intake slug lookups raw (`landing.router/index.tsx:112-116`).

### A.12 App setting (`app_settings`) — spec, no visibility, no router

`app-settings/lib/server-spec.ts:12-24` (natural PK `feature`, no `visibility`, no `parent`). `APP_SETTING` in `ENTITY_NAMES` `abilities.ts:64`; only super-admin `manage all` grants anything. No `createCrudRouter` mounts it (grep: only 5 mounts, §0).

### A.13 VoIP family — specs without any scope declaration

`voipCallServerSpec` (`voip-calls/lib/server-spec.ts:13-22`), `voipMessageServerSpec` (`:12-21`), `voipDidServerSpec` (`:12-21`), `voipLinkTokenServerSpec` (`:12-26`, `shareable.tokenColumn:'token'`), `voipCampaignServerSpec` (`:13-22`), `voipCampaignContactServerSpec` (`:13-24`, PK `customerId`), `voipContactAttributeServerSpec` (`:13-22`) — **none declares `visibility` or `parent`**, so `resolveEffectiveScope` would throw (`scope.ts:42-46`) and `resolveActorScope` compiles verb-only (conditionless rules → `null`). No `createCrudRouter` mounts them. Access paths: `voip-campaigns.router.ts` — `listCampaigns/listAttributes/getSourceCampaignSummaries/listEnrolledLeads` are **bare `agentProcedure` with no CASL verb check** (`:48,52,61,79`) calling unscoped DAL (`listEnrolledLeadsBySource` `voip-campaign-contacts/dal/server/queries.ts:178-197` returns customer id+name for any source); everything else `superAdminProcedure` (`:92-277`) with `SYSTEM_CONTEXT` passed into `campaignEnrollmentService` (`:153,183,198`) or the raw super-admin ctx (`resyncFromCloudtalk(ctx)` `:111`, param ignored `campaign-sync.service.ts:57`). `listLeadsPaginated` gates phone on `ctx.actor` (`queries.ts:282`). Voip-in-house services (`voip-calls/messages/dids/link-tokens.service.ts`) take a `ScopedContext` and call `voipXCrud.create/update/getById` (e.g. `voip-calls.service.ts:113,149,171,187,227,231`) — **no tRPC procedure or API route imports them** (only `providers/twilio/client.ts` and each other); `fetchThread` (`voip-messages/dal/server/queries.ts:27-49`, the one voip query that reads `ctx.scope`) has no caller outside its service. `/api/voip/routing/*` routes are Phase-0 mocks with no DB access (`caller-lookup/route.ts:18-39` etc.). Jobs: `enroll-lead.ts:28`, `bulk-enroll.ts:26`, `bulk-unenroll.ts:21`, `bulk-dnc.ts:21`, `graduate-from-campaign.ts:20`, `enroll-source-batch.ts:47`; webhook `cloudtalk/route.ts:62,96` — all `SYSTEM_CONTEXT`.

### A.14 Proposal child DALs without specs

`proposal_views`: `recordProposalView` raw insert `proposal-views/dal/server/mutations.ts:15-25` (token-gated at `views.router.ts:41-52`); `getProposalViews` uses `isInScope` `queries.ts:36`. `proposal_incentives`: `replaceProposalIncentives` scoped on parent `mutations.ts:45`; `listProposalIncentives` unscoped `queries.ts:14-24`; `cloneProposalIncentives` unscoped `mutations.ts:74-97`.

### A.15 Non-entity subjects

`Dashboard` (`init.ts:73`, `protect-dashboard-page.ts:41`), `CustomerPipeline` (`customer-pipelines.router.ts:58`, `get-accessible-pipelines.ts:26-34`), `LeadsPool` (`customerVisibility` `:32`, `canSeeUngatedPhone` `:45`, `get-accessible-pipelines.ts:30`), `Calendar` (granted `:160`, **no server check found**).

---

## B. Legacy-symbol call-site inventory (live code only; comment-only mentions excluded)

| Symbol | Definition | Live call/reference sites | Count |
|---|---|---|---|
| `resolveEffectiveScope` | `src/shared/dal/server/lib/scope.ts:37` | `scope.ts:52` (inside `bridgeToParent`), `scope.ts:74` (inside dead `isVisible`), `helpers.ts:75`, `scope-middleware.ts:24`, `shareable-middleware.ts:45` | **5** (4 reachable) |
| `resolveVisibilityScope` | `src/trpc/lib/middleware/scope-middleware.ts:19` | `create-crud-router.ts:98` (default for proposals/applications/customer-notes leaves), `applications.router/procedures.ts:21` | **2** |
| `buildUserContext` | `src/shared/dal/server/lib/helpers.ts:65` | `meeting-flow.router.ts:71`, `projects.router/business.router.ts:67` | **2** |
| `bridgeToParent` | `scope.ts:51` | `scope.ts:39` | **1** |
| `isVisible` | `scope.ts:67` | — (only Playwright `el.isVisible` in `scripts/portfolio-scraper/*`) | **0 — dead export** |
| `isInScope` (`@deprecated`) | `scope.ts:90` | `proposal-views/dal/server/queries.ts:36` | **1** |
| `spec.visibility` (read) | `types.ts:192` | read at `scope.ts:38`; declared at `customers/lib/server-spec.ts:41`, `meetings/lib/server-spec.ts:22`, `proposals/lib/server-spec.ts:32` | **1 read / 3 decls** |
| `customerVisibility` | `customers/lib/visibility.ts:31` | `customers/lib/server-spec.ts:41` | **1** |
| `userCanSeeCustomer` | `customers/dal/server/visibility.ts:9` | `customers/lib/visibility.ts:35` | **1** |
| `meetingVisibility` | `meetings/lib/visibility.ts:9` | `meetings/lib/server-spec.ts:22` | **1** |
| `proposalVisibility` | `proposals/lib/visibility.ts:9` | `proposals/lib/server-spec.ts:32` | **1** |
| `userParticipatesInMeeting` | `meetings/dal/server/participants.ts:9` | `meetings/lib/visibility.ts:10`, `proposals/lib/visibility.ts:10`, `agent-dashboard/dal/server/get-action-queue.ts:136`, `:154` | **4** |
| `leadsPoolVisibility` | — | DELETED, commit `a9808587` | 0 |
| `customerNoteVisibility` | — | DELETED, commit `c215c3d2` (Phase 6) | 0 |
| `applicationVisibility` | — | DELETED, commit `4b705e81` (Phase 6) | 0 |
| `projectVisibility` / `projectParticipationScope` | — | DELETED, commit `a8ec6c3f` (Phase A) | 0 |
| `scopeMiddleware` / `createEntityRouter` / `appSettingVisibility` / `voip*Visibility` | — | none in code (grep) — `createEntityRouter` deleted in `d348fd3d`, `0948de10` | 0 |
| `SYSTEM_CONTEXT` (actor `'legacy:system-context'`) | `types.ts:53` | `move-customer-to-pipeline.ts:35`; `api/webhooks/bina/route.ts:35`; `api/proposals/[id]/pdf/route.ts:36`; `jobs/enroll-source-batch.ts:47`; `zoho-sign/lib/documents/registry.ts:154`; `voip-calls.service.ts:231`; `proposals/delivery.router.ts:63`; `accounting.service.ts:80,170,224,247`; `jobs/bulk-enroll.ts:26`; `landing.router/index.tsx:126`; `jobs/graduate-from-campaign.ts:20`; `jobs/bulk-dnc.ts:21`; `voip-campaigns.router.ts:153,183,198`; `api/webhooks/cloudtalk/route.ts:62,96`; `customers/business.router.ts:224`; `funnels.router.ts:121,217,241`; `voip-dids.service.ts:117`; `jobs/bulk-unenroll.ts:21`; `jobs/enroll-lead.ts:28`; `jobs/sync-zoho-sign-status.ts:41`; `proposals/lib/server-spec.ts:54`; `customers/lib/server-spec.ts:140` | **30 in `src`** (+3 in `scripts/verify-*.ts:63,33,11`) |
| `systemContext(reason)` | `types.ts:68` | `proposals.router/contracts.router.ts:224` | **1** |

**Total live legacy-engine call sites (rows 1-12): 19 reachable** (20 textual incl. the dead `isVisible` body).

---

## C. `ctx.scope` / `ctx.actor` site inventory

### C.1 `ctx.scope` WRITE sites (where a ScopedContext's `scope` is set)

| Site | Engine |
|---|---|
| `src/trpc/lib/create-http-context.ts:22` (`scope:null`, `actor:null`) | root |
| `src/trpc/init.ts:60` (`scope:null`, `actor:userActor`) | protectedProcedure |
| `src/trpc/lib/create-crud-router.ts:100` (`resolveScope(...)`) | LEGACY by default; CASL for customers (`customers/crud.router.ts:50`) and meetings (`meetings/crud.router.ts:35`) |
| `src/trpc/lib/middleware/shareable-middleware.ts:50` (session) / `:67` (token) | LEGACY / token |
| `src/trpc/routers/customers.router/procedures.ts:27-28` | CASL |
| `src/trpc/routers/meetings.router/procedures.ts:21-22` | CASL |
| `src/trpc/routers/proposals.router/procedures.ts:29-30`, `:40-41` | CASL (root, child) |
| `src/trpc/routers/projects.router/procedures.ts:16`, `:28` | CASL (root, child) |
| `src/trpc/routers/applications.router/procedures.ts:21-22` | LEGACY |
| `src/shared/dal/server/lib/helpers.ts:75` (`buildUserContext`) | LEGACY |
| `src/shared/dal/server/types.ts:56`, `:69` | SYSTEM |
| `src/trpc/routers/meeting-flow.router.ts:52` | CASL (literal ctx) |
| `src/trpc/routers/customer-pipelines.router.ts:106`, `:144` | CASL |
| `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts:37` | CASL |
| `src/trpc/routers/proposals.router/views.router.ts:50`; `src/app/api/proposals/[proposalId]/summary/route.ts:31`; `.../pdf/route.ts:27` | CASL token branch |

### C.2 `ctx.scope` READ sites

`create-crud-dal.ts:117,213,264`; `scope.ts:94` (`isInScope`); `customers/dal/server/queries.ts:81,187`; `customers/dal/server/mutations.ts:37,41`; `customers.router/business.router.ts:64,129`; `meetings/dal/server/queries.ts:151,294`; `proposals/dal/server/queries.ts:122,226,323`; `proposals/dal/server/mutations.ts:70`; `proposal-incentives/dal/server/mutations.ts:45`; `applications/dal/server/queries.ts:31,57`; `applications/dal/server/mutations.ts:34,74,163`; `projects/dal/server/queries.ts:202`; `media-files/dal/server/media-ops.ts:36,57,90,112,121`; `voip-messages/dal/server/queries.ts:40`; `move-customer-pipeline-item.ts:99,127` (via derived ctx). **28 sites.**

### C.3 `ctx.actor` READ sites

`customer-pipelines.router.ts:77,106,136`; `proposals.router/media.router.ts:27,104`; `projects.router/media.router.ts:29,53,111,164`; `move-customer-pipeline-item.ts:37`; `dashboard.router.ts:10`; `customers.router/business.router.ts:124`; `meetings/dal/server/queries.ts:165,279`; `voip-campaign-contacts/dal/server/queries.ts:282`; `customer-notes/lib/server-spec.ts:58`; `customers/dal/server/queries.ts:51`; `get-customer-pipeline-items.ts:42` and `get-customer-profile.ts:31` (destructured, then used at `:43,48,51,199,225-226,248,277-278,397,430` / `:32,36,54,97,126,236`); operator ctx `meeting-participation.ts:33-38` (OperatorCtx, not ScopedContext). **19 direct sites.** Hand-rolled checks that read `ctx.ability`/`ctx.session` instead of `ctx.actor`: `assert-note-author.ts:8-9`, `resolve-owner.ts:14-15`, `participants.router.ts:37,59`, `reads.router.ts:32`, `activities.router.ts:37,109,166,204,237`, `sync.router.ts:94,139`, `incentives.router.ts:28`, `profile.router.ts:20`, `meeting-flow.router.ts:35`, `customer-pipelines.router.ts:35,58,133`, `contracts.router.ts:191`, `proposals media.router.ts:20`.

---

## D. Engine-bypass raw table access

### D.1 Reachable by scoped users (agent/dispatcher) with NO row scope from either engine

| Site | What it does | Who can hit it |
|---|---|---|
| `src/trpc/routers/projects.router/crud.router.ts:14-17` → `queries.ts:147-175` | `getAll` returns every project | any `agentProcedure` user incl. dispatcher (no Project grant) |
| `crud.router.ts:37-41` → `queries.ts:114-141` | `getForEdit` any project + all media | same |
| `crud.router.ts:43-48` → `mutations.ts:30-46` | create project, no `assertCan` | same |
| `crud.router.ts:50-58` → `mutations.ts:48-82` | update any project, no scope, no field-CASL | same |
| `crud.router.ts:60-65` → `mutations.ts:84-98` | **delete any project + R2 media**, no `can('delete','Project')` (agents lack it) | same |
| `projects.router/business.router.ts:15-81` | raw proposals `:20-23` + customers `:34-37` by input ids; `createProject` for any customerId | any agent/dispatcher |
| `projects.router/google-drive.router.ts:50-124` | bare agentProcedure → `mediaService.createRecord` for any `projectId` (`:114`) | any agent/dispatcher |
| `projects.router/media.router.ts:42-48` | media `create` with no `canAccess(project)` probe | any user with project-media procedure |
| `src/trpc/routers/ai.router/index.ts:7-22` → `ai/client.ts:96-113` | **unauthenticated `baseProcedure`** dispatches a job that raw-updates `proposals.projectJSON` for any `proposalId` | anyone, no session |
| `create-crud-dal.ts:129-157` (create slot) + `meetings/dal/server/crud.ts:33-38` | meeting create on any `customerId`; owner becomes participant `:52` → **caller gains CASL/legacy visibility of that customer** | agent, dispatcher |
| `proposals/lib/server-spec.ts:53-58` | proposal create reads any `meetingId` with `SYSTEM_CONTEXT`, copies its `flowStateJSON` | agent |
| `applications` create (`create-crud-router.ts:128-138`) | attach application to any `meetingId` | agent |
| `customer-pipelines.router.ts:103-124` | after CASL *meeting* probe, proposals (`:118-122`) + projects (`:111-115`) unscoped | dispatcher (read Meeting unconditional, no Proposal/Project grant) |
| `move-customer-pipeline-item.ts:61-71` | raw `db.update(projects)` on the customer's first project, no scope | any agent (`customer-pipelines.router.ts:41-50`) |
| `schedule.router/sync.router.ts:43-57` | selects **all** unsynced meetings and pushes them to GCal | any agent/dispatcher |
| `meetings.router/business.router.ts:42-46` | unscoped meeting read (customerId/scheduledFor) | agent/dispatcher (write below is scoped) |
| `meetings.router/participants.router.ts:46` → `participants.ts:36-49` | participants of any meeting after hand-rolled `isParticipant` | agent |
| `voip-campaigns.router.ts:48-83` | unscoped campaign/attribute/source/enrolled-lead reads, no CASL verb check | any agent/dispatcher |
| `schedule.router/activities.router.ts:29-257` | hand-rolled owner scope; no CASL verb check | dispatcher (no Activity grant) |
| `landing.router/index.tsx:137` | raw `db.insert(customerNotes)` (bypasses note hooks) | public |
| `customers.router/business.router.ts:134-249`, `funnels.router.ts:73-241`, `landing.router/index.tsx:21-88` | public `baseProcedure` → `SYSTEM_CONTEXT` writes (rate-limited/design) | public |

### D.2 System-level raw access (privileged by design; bypasses hooks and both engines)

`accounting.service.ts:27,89,120,125,131,197,238`; `jobs/create-qb-records.ts:10`; `notification.service.ts:68,77,132,138,227,281,293`; `voip/compliance.service.ts:52`; `ai/client.ts:96-113`; `media/optimization-target.ts:16,20`; `media-files/dal/server/optimization.ts:16-45`; `meetings/dal/server/google-calendar.ts:30,65,79,87,105,111,117,126`; `activities/dal/server/google-calendar.ts:9-72`; `accounts/dal/server/google-calendar.ts:12-42`; `validate-share-token.ts:36`; `customers/dal/server/queries.ts:107-177,207-235`; `customers/lib/server-spec.ts:127-137`; `move-customer-to-pipeline.ts:26-32`; `lead-sources.router.ts` (all, superAdmin); `proposals/dal/server/queries.ts:288-307` (`getProposalLockSignals`, deliberately unscoped); `proposals/dal/server/mutations.ts:26-46`; `proposal-media-files/dal/server/queries.ts:50-62`; `proposal-incentives/dal/server/queries.ts:14-24`, `mutations.ts:74-97`; `proposal-views/dal/server/mutations.ts:15-25`; `applications/dal/server/queries.ts:61-70`, `mutations.ts:42-45,116-141,170-173`; `get-customer-profile.ts:66-70,190-222` (after CASL customer probe); `projects.router/google-drive.router.ts:21-26,42-45,59-64,74-77` (`account` rows by session user).

### D.3 Public-by-design (`isPublic`/no auth)

`projects.router/showroom-display.router.ts:6-15`; `landing.router/projects.router.ts:6-14` → `features/landing/dal/server/projects.ts:6-62`; `projects/dal/server/queries.ts:15-106`; `app/sitemap.ts:4`; `landing/lib/get-trade-images.ts:42`; `notion.router/*` (`baseProcedure`); `intake.router.ts:26`.

---

## E. Surprises — code contradicts a nearby comment / DOCS reference

1. **`src/shared/entities/media-files/lib/server-spec.ts:26-31`** says "the project-media ROUTER still runs on a bare `agentProcedure` (`ctx.scope = null`), so this CRUD DAL currently executes UNSCOPED". Code: `src/trpc/routers/projects.router/media.router.ts:18` imports and every procedure uses `projectMediaProcedure` (CASL child bridge, `procedures.ts:27-28`). Only `google-drive.router.ts:16,50` is still bare. Same stale claim in `media-files/dal/server/crud.ts:7-9`.
2. **`abilities.ts:282-285`**: "With every rule above still conditionless, `referenced` is empty in `assertScopeWiring`, so this never throws — it's dormant until Tasks 6-9 add conditions". Code: conditions exist at `:108,131,136,149,150,233`.
3. **`abilities.ts:168-170`** ("voip-in-house … Scoping (only see own rows) is enforced by entity visibility predicates") and `:268` ("row-scoping via visibility predicates"). Code: no voip spec declares `visibility` or `parent` (`voip-calls/lib/server-spec.ts:13-22`, `voip-messages:12-21`, `voip-dids:12-21`, `voip-link-tokens:12-26`); no such predicate symbols exist (grep §B). Same false claims in `voip-calls/DOCS.md:20-24`, `voip-messages/DOCS.md:38-41`, `voip-dids/DOCS.md:21-26`, `voip-link-tokens/DOCS.md:40-44`, and `app-settings/DOCS.md:18-22` ("`appSettingVisibility` returns sql`FALSE`" — symbol does not exist). `voip-campaigns/DOCS.md:49-53` / `voip-contact-attributes/DOCS.md:22-26` ("visibility predicate is `FALSE` — only super-admin reads via scoped CRUD") — no predicate; `voip-campaigns.router.ts:48-56` lets any agent/dispatcher read them.
4. **`customers/DOCS.md:18-24`**: "sees a customer only if they participate in any meeting… Reference impl `userCanSeeCustomer`/`customerVisibility`… Enforced by `scopeMiddleware(customerServerSpec)`". Code: `scopeMiddleware` no longer exists; customer rows are compiled from CASL (`customers/procedures.ts:27`, `crud.router.ts:50`) with a dispatcher branch (`abilities.ts:233`) the DOCS rule doesn't mention; `customerVisibility` is live **only** through the customer-notes bridge.
5. **`meetings/DOCS.md:74-84`**: "sees a meeting only if they are a participant… Enforced by `scopeMiddleware(meetingServerSpec)`". Code: dispatcher read is unconditional (`abilities.ts:261`); `meeting-flow.router.ts:71` and `projects.router/business.router.ts:67` still apply the *legacy* participation predicate via `buildUserContext`, so the same dispatcher gets NOT_FOUND there and a row on `meetings.crud.getById`.
6. **`meetings/DOCS.md:19-31` (ownership-model)**: "Only the owner OR a super-admin can delete a meeting… Reference impl `hooks.create.before` in `lib/server-spec.ts`". Code: no role but super-admin has `delete Meeting` (`abilities.ts:105-192` has no delete grant) → the owner **cannot** delete (`create-crud-router.ts:158`); the create hook lives in `meetings/dal/server/crud.ts:33-38`, and `meetings/lib/server-spec.ts:19-29` has no hooks.
7. **`proposals/DOCS.md:74-80`**: "Enforced by `scopeMiddleware(proposalServerSpec)`". Code: the crud leaf and every shareable procedure run LEGACY (`crud.router.ts:20-25` → `create-crud-router.ts:98`; `shareable-middleware.ts:45`), while `business.list`/contracts/delivery/incentives run CASL (`procedures.ts:29`). One entity, two engines.
8. **`projects/DOCS.md:107-118`**: "Reference impl `projectParticipationScope` / `projectVisibility` in `src/shared/entities/projects/lib/visibility.ts`… Enforced by the entity scope compiler (`ctx.scope`)". Code: that file holds only `hasAssociatedMeeting` (`lib/visibility.ts:15-22`); both symbols were deleted (`a8ec6c3f`); `crud.getAll/getForEdit/create/update/delete` are unscoped bare `agentProcedure` (`crud.router.ts:14,37,43,50,60`).
9. **`src/trpc/DOCS.md:150-165`** documents `resolveVisibilityScope` as *the* resolver "baked on at definition time"; code has two resolvers (`resolve-trpc-actor-scope.ts:18`) and the migration table (`:342-358`) doesn't record which engine each entity uses. Its own anti-pattern (`:360-362`, "a bare `agentProcedure` leaves `ctx.scope` null and the DAL runs unscoped") is exactly what `projects.router/crud.router.ts`, `business.router.ts:15`, and `google-drive.router.ts:19,50` do.
10. **`customer-notes/lib/server-spec.ts:47-56`** ("Single-engine probe via `canAccess`… replaces the legacy `buildUserContext`/`customerVisibility` probe"). True for `create` only; `update`/`delete` hooks (`:77-78`, `:89-90`) read through `ctx.scope`, which the router leaves on the LEGACY default (`customer-notes.router/index.ts:10-14`) → `customerVisibility` `['leads']` for dispatchers. The consequence is documented only in `customers/lib/visibility.ts:20-22`.
11. **`resolve-actor-scope.ts:18`** ("Replaces `resolveEffectiveScope` once every entity migrates (Phase 5)") and `:87-88` ("both die together in Phase 5") — both engines are live at Phase 7a.
12. **`customers/dal/server/queries.ts:64-65`** ("Scope applied via ctx.scope (set by the customers entity router's inline scope step, or by `buildUserContext` for service/job callers)"). No service/job calls `getCustomer` with `buildUserContext`; its only callers are two tRPC routers (§B).
13. **`abilities.ts:101-103`** ("per-row ownership … is enforced in the DAL, not by CASL" for Activity/CustomerNote). Activity ownership is enforced in the router (`activities.router.ts:111,179,216,249`); there is no activities DAL/spec.
14. **`voip-link-tokens/lib/server-spec.ts:21-25`** references a customer consume route `/api/voip/links/[token]`; `src/app/api/voip/` contains only `routing/`.
15. **`src/shared/domains/permissions/types.ts:7,23`** ("`EntityName` (5 business entities)"); `ENTITY_NAMES` has 19 (`abilities.ts:49-69`).
16. **`create-crud-dal.ts:6`** ("Each handler applies `ctx.scope`") — `create` does not (`:129-157`), which is the root of the create-side IDORs in §D.1.
17. **`meetings.router/crud.router.ts:30-34`** correctly predicts `meetingVisibility` stays live via applications + `buildUserContext` — verified (`applications/procedures.ts:21`, `meeting-flow.router.ts:71`, `projects business.router.ts:67`). Not a contradiction; recorded because it is the accurate statement of the remaining legacy footprint.
