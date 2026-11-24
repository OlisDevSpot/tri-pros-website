# Tri Pros — Context

Domain glossary. Terms here are the canonical names used in code, schema, and docs.
When a term in code drifts from the definition below, fix one of them (and ping the user).

## Lifecycle

A **customer** moves through two distinct phases. Different systems own each phase.

### Phase 1 — Lead-to-meeting (conversion)

From "we got a phone number from a marketing campaign" to "this person has a meeting booked." Owned by a **lead-conversion provider** (currently JustCall; pluggable). Our app does NOT place these calls or send these texts — the provider does. Our app's role is:

- Push: enroll / unenroll a customer in a campaign, configure which `lead_source` routes to which provider campaign.
- Pull: parse the provider's webhooks for 2-way sync (status changes, DNC events, graduation when a meeting is booked).
- **Not** mirrored in our DB: per-contact call recordings, SMS thread history, AI agent transcripts. Those live in the provider's system. Our DB carries the configuration + the lifecycle status only.

### Phase 2 — Agent comms (post-conversion)

From "meeting booked" forward — proposal sent, project scheduled, ongoing customer relationship. Owned by **voip-in-house** (Twilio-backed). Every agent and every office worker gets a clean company-branded DID. All calls, SMS, and voicemails between Tri Pros staff and a known customer go through it. Provides the in-app communication surface: dialer, SMS thread, voicemail inbox.

The boundary is sharp. voip-in-house does **not** handle lead-conversion outreach. The lead-conversion provider does **not** handle post-conversion comms.

## VoIP terms

- **voip-in-house** — Twilio-backed in-app communication layer for Phase 2. Owns `voip_*` tables. Clean DIDs assigned 1:1 to humans.
- **voip-campaigns** — Integration surface to whichever lead-conversion provider is wired in (currently JustCall). Owns the config + webhook parsing, NOT the call/SMS data.
- **DID** — A phone number provisioned on Twilio. A DID is assigned to a user (sticky to that person), or is the one **main line** (`voip_dids.is_main_line`).
- **Lead-conversion provider** — The external system that handles Phase 1. Today: JustCall. Pluggable.

## Visit messages

- **Main line** — The one company DID that sends visit messages and receives their replies. Never "company line".
- **Visit message** — A text or email Tri Pros sends about a meeting, or a homeowner's reply to one (`meeting_messages`). The kinds: **visit summary** (sent by a person), **day-before reminder** and **rep confirmation** (automatic), **confirmation reply** (the thank-you after a YES), **visit cancellation** (the email that removes a calendar entry), **homeowner reply** (inbound).
- **Visit message sequence** — the meeting's **Sequence** (Automation terms): visit summary → day-before reminder → rep confirmation. The confirmation reply and the visit cancellation are reactions, not steps.
- **Visit message plan** — Each sequence step's state for one meeting, computed from its visit messages, the rules, pauses and the current time (`planVisitMessages`). The scheduled runs send exactly the steps it marks due.
- **Visit message template** — The wording of one visit text, with `{{tokens}}`. **Default** is the wording in code; **edited** is a super-admin's saved wording.
- **Skip** — A person stops one automatic text for one meeting time. **Unskip** undoes it before the text's time.
- **Paused** — A super-admin stopped one automatic kind for every meeting until it is resumed.
- **Confirmation track** — The three confirmations of one visit: the office's (a visit message went out), the homeowner's, and the rep's (a rep confirmation went out for this time). Never "stage", which is a pipeline word.
- **Homeowner confirmed** — The homeowner said they will be there for this time, by replying YES or on their home visit page (`meetings.homeownerConfirmedAt`, `homeownerConfirmedVia`). Shown to the office; never moves the pipeline. The office still sets **Confirmed**.
- **Reschedule chain** — A meeting and the meetings it replaced, linked by `meetings.rescheduledFromId` (`getRescheduleChain`). Visit messages are read across it.

## Automation terms

What the app does at a time it chose, not when a person acts. Owner ruling 2026-10-08: the Phase 1 campaign cadence (the lead-conversion provider's texts) and background jobs with no customer-facing effect (calendar sync, QuickBooks sync, media optimisation) are not automations, whatever mechanism runs them.

- **Automation** — a send or action the app performs on a schedule or at a chosen time: a **sequence** or a **broadcast**. _Avoid_: job, cron, workflow, zap (mechanisms, not the thing).
- **Sequence** — the ordered automatic steps one record can get, re-planned as the record changes. Visit messages is one sequence (`VISIT_MESSAGE_SEQUENCE`); post-signing and pre-signing follow-up would be others. _Avoid_: drip, cadence (the Phase 1 word, `sms_cadence`), workflow, flow.
- **Step** — one automatic send in a sequence, with a planned time and a state (`VisitMessageStep`). _Avoid_: task, touch.
- **Plan** — one record's steps and their states at a moment, computed by a pure function from the record, its message rows, the settings and the clock (`planVisitMessages`). Every screen and every run read the same plan. Not the dev-flow **Plan** (an issue, Dev flow terms). _Avoid_: schedule (that is the settings), timeline.
- **Run** — one scheduled execution that acts on every step the plan marks due (`runAutomaticKind`). _Avoid_: tick, job, cron.
- **Broadcast** — one message to a chosen audience at a chosen time, sent once and never re-planned. The audience can be five hand-picked customers; the word means "once, to a set", not "to everyone". _Avoid_: blast, bulk message, campaign, scheduled send.

## DNC (Do-Not-Call)

A **shared canonical registry** of phone numbers that must NOT be contacted. TCPA-load-bearing. Lives outside both voip-in-house and voip-campaigns. Both systems INSERT into it, both systems gate against it on outbound. No `source` field on the row — the registry is reason-tagged (`customer_request | ftc | admin | ...`), not origin-tagged.

## Funnel terms

- **Funnel** — a marketing landing-page + multi-step lead-capture flow for one remodeling vertical (kitchens, bathrooms, complete-interior, …). Identified by a `FunnelSlug` that doubles as subdomain label, route segment, and registry key. Authored as a `FunnelSpec` (hero + landing marketing blocks + ordered steps).
- **Trade** — the construction vertical a funnel sells (the Notion "All Construction Trades" entity). **1:1 with a funnel** (a funnel's slug is its trade key); A/B variation happens *within* a funnel via `spec.variants`, not by mapping two funnels to one trade. The component-free **trade-facts** module is the single source of a trade's facts: display name, Notion trade UUID, and SEO/OG meta. (⚠️ The hardcoded display names have drifted from Notion — `"Kitchen Renovation"` here vs `"Kitchen Remodel"` there; P2 of the construction epic resolves names from the catalog.) (`pixel.contentCategory` is measurement config and stays on the `FunnelSpec`, not a trade fact.)
- **Step / Dimension** — one screen of a funnel flow. A `card-select` step is a **dimension** (layout, age, scope, timeline, …); its **options** are the tappable answers. A step's answer can **enrich** the lead (a self-describing label/value captured into `leadMetaJSON`).
- **Marketing block** — a composable trust section on the funnel landing (reviews, portfolio, guarantee, process, faq, …), rendered via the `MarketingRegistry`.

## Analytics terms

Each business rule behind an analytics number is one named export; change the rule there, then run `pnpm tsx scripts/verify-analytics-rules.ts`. "Meeting" stays the row; "appointment" stays avoided.

| Term | Rule | Defined in |
|---|---|---|
| **Lead** | One person, for life. Dated by, and credited to the source of, the person's earliest record | `pickLeadAnchor` · `src/features/analytics/lib/analytics-rules.ts` |
| **Same person** | Same normalized phone OR email, matches chained | `groupDuplicatePeople` · `src/shared/entities/customers/lib/group-duplicate-people.ts` |
| **Total leads / valid leads** | All leads / leads minus junk. Test leads are in neither | `aggregateLeadRecords` · `src/features/analytics/lib/aggregate-lead-records.ts` |
| **Junk lead / test lead** | Lead quality flags (not built yet) | `LeadRecord.quality` |
| **Sit** | The rep physically met the homeowner | `MEETING_OUTCOME_SIT`, `isSit` · `src/shared/constants/enums/meetings.ts` |
| **Project meeting** | The stored `Project` meeting type: serves an existing project (visits, upsells). Every other meeting works a lead toward its sale | `isProjectMeeting` · `src/shared/constants/enums/meetings.ts` |
| **Booked lead** | A lead with at least one non-project meeting, counted once; dated at the first sit, else the first non-project meeting | `pickBookedLead` · `src/features/analytics/lib/analytics-rules.ts` |
| **Meeting order** | `first` = first sat non-project meeting · `repeat` = after it · `not_sat` = before it, or never sat · `project` = a project meeting | `deriveMeetingOrder` · `src/features/analytics/lib/analytics-rules.ts` |
| **Unresolved meeting** | A past meeting with no outcome recorded (`not_set`) — unknown, never a sit, surfaced for fixing | `isUnresolvedMeeting` · `src/features/analytics/lib/analytics-rules.ts` |
| **New sale / total closes / revenue** | An approved proposal, dated at `approvedAt` (no fallback); initial sale = new, additional work = upsell | `classifySale`, `SALE_STATUS` · `src/shared/modules/proposals/core/lib/sale.ts` |
| **Rates** | Booking, sit and close rate over the same period; a total is Σ÷Σ | `ANALYTICS_RATES` · `src/features/analytics/lib/analytics-rules.ts` |
| **Not applicable** | Filtering or grouping by closer, outcome or meeting order makes leads not applicable; by outcome or meeting order, sales too — shown as such, never as an unfiltered number | `inapplicableStages` · `src/features/analytics/lib/analytics-rules.ts` |
| **Unknown city / zip** | Website-intake placeholders count as unknown | `UNKNOWN_PLACE_VALUES` · `src/features/analytics/lib/analytics-rules.ts` |
| **Bankable** | A project's money is net, at risk (on hold) or cancelled | `projectBankability` · `src/shared/modules/projects/core/lib/bankability.ts` |
| **Setter** | The appointment setter: the user, often a dispatcher, who booked the meeting. One per meeting; a super-admin can change it. The one term in code, schema, docs and UI; never "closed by", "closer" or "created by" | `meetings.setBy` · picked on the add-meeting form, else the meeting's creator; a meeting the system books gets the office account; never empty for new rows (nullable only for rows that predate it); kept by a duplicate and a reschedule; only super-admins change it |
| **Closer** | The **meeting reps** of a meeting with an approved proposal: they sold, or closed, it (owner ruling 2026-10-16); never the setter; per-closer totals overlap by design; a sale with no closer groups under an unassigned row. ⚠️ The code still counts every participant of every meeting, helpers included, until the proposal page rework's follow-up F9 | `MeetingFact.closerIds` · `src/shared/entities/meetings/dal/server/analytics-facts.ts` |
| **Business month** | Calendar month in Pacific time, never UTC | `businessMonthKey`, `businessMonthWindow` · `src/shared/lib/business-time.ts` |
| **Spend** | Dollars a lead source cost in one business month, typed in on the Analytics Spend tab; a blank month is "not entered", never $0 | `leadSourceMonthlySpendTable` · `src/shared/db/schema/lead-source-monthly-spend.ts` |
| **Spend mode** | `manual` (spend is typed in) or `none` (a free source, never "missing") | `leadSourceSpendModes` · `src/shared/constants/enums/lead-sources.ts` |
| **Spend missing** | A manual source brought a lead in a month with no spend entered, so every cost over that month is unknown | `findMissingSpend` · `src/features/analytics/lib/analytics-rules.ts` |
| **Cost per stage** | Spend ÷ leads, booked leads, sits or new sales; revenue ÷ spend is "revenue per $1". Shown for the total, per source or per month, when nothing but source narrows the view; n/a when the source filter includes leads with no source, and on the no-source row. The unfiltered total divides by every lead, no-source leads included | `ANALYTICS_COSTS`, `notApplicableReasons` · `src/features/analytics/lib/analytics-rules.ts` |
| **Merged duplicates** | Extra customer records folded into one person's lead | `mergedRecordCount` · `src/features/analytics/lib/analytics-rules.ts` |
| **Funnel** | The marketing funnels only (see Funnel terms) — the analytics chain is the lead chain | — |

## Presentation terms

Meeting-flow step 1 (Who We Are) is a presentation, and Program will be too. Portfolio (step 3) shares the presentation layout and ground but shows one project at a time through its story phases, not slides. The engine is a shared primitive; each feature authors its own slides.

- **Presentation** — a full-height scroll surface that shows one slide per screen, built from an ordered list of slides. _Avoid_: deck, snap presentation.
- **Slide** — one screen of a presentation: a heading, an optional background photo, and feature-specific content. Typed `PresentationSlide`. _Avoid_: beat (the story word in `docs/sales/`, never in code), section.
- **Frame** — where a slide's heading sits. `column`: in a heading column beside the slide (the default). `full`: centred over the whole slide. _Avoid_: layout (that word belongs to the meeting *step*), split.
- **Run** — consecutive `column` slides that share one heading column. Derived from the slides' frames, never declared. _Avoid_: group, section, chapter.
- **Heading column** — the sticky column that names a run's active slide and fades between headings. _Avoid_: pinned column, sidebar.
- **Content** — what a feature puts on a slide, shown beside the heading column (`column`) or under the centred heading (`full`). _Avoid_: body, stage, canvas.
- **Subheading** — the second line under a title, on a slide heading or a splash caption. On a slide it may end in an accent-coloured tail. _Avoid_: line, subtitle.
- **Splash screen** — the branded full-window mark shown at an entrance. It dismisses either **timed** (fades on its own) or **on press** (held until the viewer presses). Whether to show it at all (once per session, once per meeting) is the caller's policy, never the primitive's. _Avoid_: splash overlay.

## Project story terms

How a project is told, on every surface (portfolio page, meeting-flow Portfolio step).

- **Project story** — challenge → solution → result (`challengeDescription`, `solutionDescription`, `resultDescription`). The one standard for telling a project. _Avoid_: phase text, caption, timeline description; also not the landing page's homeowner-quote carousel (`features/landing/lib/experience-project-stories.ts`, `ProjectStorySlide`), which is a different thing despite its name.
- **Media phase** — before · during · after · uncategorized (labelled "Gallery"), on each project photo (`MediaPhase`, `PHASE_LABELS`).
- **Story phase** — a media phase that has photos, with the story told against it: challenge → Before, solution → During, result → After. A part whose phase has no photos joins the next story phase, else the last. With no media loaded, the hero stands in (`ProjectStoryPhase`, `buildProjectStoryPhases`). _Avoid_: chapter, step.
- **Story strength** — how fully a project's photos tell its story: how many of Before · During · After have photos, then how many photos those phases hold, then title (`compareStoryStrength`).
- **Portfolio match** — why a portfolio project is shown in a meeting: `scope` (shares a selected scope), `trade` (in a selected trade), `fallback` (the strongest few when nothing matches), `none` (`PortfolioMatch`, `matchPortfolioProjects`). _Avoid_: tier, rank, featured.
- **Match labels** — the pills naming a match: scope names, or the trade name.

## Media display terms

How media is fetched and shown on every surface. "Image" names generic shared UI (`OptimizedImage`, `CrossfadeImage`); "photo" stays the word in project-domain feature UI and copy (`ProjectPhoto`, "Next photo").

- **Media file** — one uploaded photo or video (`media_files`, `ProjectMediaFile`).
- **Hero image** — a project's cover photo (`heroImage`, `isHeroImage`). _Avoid_: cover, thumbnail.
- **Variant** — a resized WebP copy of a media file: `xs` · `sm` · `md` · `lg` (`optimizationVariants`, `VARIANT_OPTIONS`). _Avoid_: size, rendition.
- **Blur placeholder** — the tiny blurred copy shown until an image loads (`blurDataUrl`).
- **Crossfade** — one image fading out while the next fades in, once per change (`CrossfadeImage`).
- **Preload** — fetch and decode an image before it is shown, so showing it never waits (`usePreloadImages`).

## Data view terms

How a list of one entity's records is read and shown, on any surface. The `DataView` compound that gives every data view the same parts is planned, not built: today each view composes `DataViewBoundary` and `QueryToolbar` itself.

- **Data view** — one surface showing a list of one entity's records through the data layer: a `useDataViewQuery` read set up by a `DataViewQueryConfig`, inside a `DataViewBoundary` (the proposals table and campaign leads still read through `fromPaginatedQuery`). It is the same whether it is a page or sits in a tab, a card or a modal. Implements an **Entity View Context** (`docs/ubiquitous-language.md`). _Avoid_: list view, data page.
- **Body** — the view-specific presentation inside a data view: `DataTable`, `ScheduleCalendar`, `KanbanBoard`, a card list. The heading, count, toolbar, empty and stale states around it are the same for every data view. _Avoid_: renderer, widget.
- **Orchestrator** — the page or component that mounts a data view and writes the wrapper around it; it may drop the bar, swap the heading or pick toolbar pieces. No per-callsite layout component does this for it. Not the dev-flow **Orchestrator** (a Claude Code session, Dev flow terms). _Avoid_: container (a records-management term).
- **Loading screen** — a route's `loading.tsx`: the page's own component under `DataViewPending`, its data views showing their cached rows or none (`useLoadingScreenRead`). It starts no fetch; the page that replaces it refreshes the rows. _Avoid_: skeleton page.
- **Pending view** — any render where `DataViewPendingContext` is not `false`. `'loading'`: a loading screen, a `DataViewBoundary`'s suspense fallback, the layout's document-load skeleton, the PWA launch shell. `'error'`: a boundary's error fallback. Reads never suspend inside one, and only `'loading'` shows cached rows (`useIsDataViewPending`).
- **Filter rule** — one condition a viewer sets on a data view: a field, **is** or **is not**, and values (`FilterRule`). Planned (filter rules epic FR4). _Avoid_: rule alone in code (CASL rules live in the same server layer), condition, criterion.
- **Filter group** — filter rules joined by AND or OR, one level deep inside a filter rule tree (`FilterGroup`). _Avoid_: group alone in code (analytics "group by" is a different thing), clause.
- **Filter rule tree** — everything a viewer filters a data view by: an AND / OR root holding filter rules and filter groups, in one URL key `${prefix}_f` (`FilterRuleTree`). Fixed filters and the date window stay outside it. _Avoid_: query, filter state.
- **Filter grouping field** — a multi-select field whose values are a classifier's groups (Sit: Sat · Didn't Sit · Not Set) and whose SQL expands them through the classifier's inverse (`valuesInGroups`); a new value classified in the map reaches every filter. Projects' `statusBucket` is the first. _Avoid_: derived filter, virtual field.
- **Outcome type** — the UI name for a meeting outcome's group under `MEETING_OUTCOME_SENTIMENT`: Positive · Neutral · Negative · Not Set (field `outcomeSentiment`). _Avoid_: sentiment in UI copy (it is the code name only).
- **Quick filter** — named filter rules declared once per entity and shown as a one-tap toggle on every view of it (meetings "Sits": Sit is Sat AND Meeting type is not Project). Code, not the database. _Avoid_: preset, saved view, smart filter.

## Records terms

- **Scope coverage** — for one proposal of a meeting: which of the scopes captured in the meeting it includes, which it leaves out (struck through), and which it adds that the meeting didn't capture (dashed "+"). Matched by scope id (`computeScopeCoverage`, `ProposalOverviewCard.ScopeCoverage`). _Avoid_: scope match, scope diff.
- **Fixed filter** — a filter value a data view always applies, set by its callsite: in the data-view config (`fixed`) or at the callsite for a value only it knows (the `fixed` argument of `useDataViewQuery` and `loadDataViewQueryInput`). Never read from the URL, never shown in the toolbar. A field declared `fixedOnly` can only be set this way. Narrows what a view asks for; it is not access control. _Avoid_: scope, preset filter.
- **First-rows window** — a data view window that returns the first N rows of the view's order with no paging (`{ kind: 'first', count }`). A view with no user state builds its input with `staticDataViewInput`. _Avoid_: limit window, top-N.

## Pipeline terms

- **Stage** — one step of a pipeline; a customer sits in exactly one stage per pipeline. On the kanban board each stage shows as a lane, but the domain word is always stage (`PipelineStageConfig`, `KanbanStageFilter`). _Avoid_: column, lane (a dev-flow word, Dev flow terms), status.
- **Confirmed** — a meeting whose homeowner, reached on the day of the meeting, said they will be home (`meetings.confirmedAt`). A soft confirmation: a confirmed meeting can still be rescheduled or cancelled before the rep arrives. It holds for one appointment time — moving `scheduledFor` clears it, and a reschedule books a new, unconfirmed meeting. Fresh pipeline: every booked meeting starts in **Needs Confirmation** and moves to **Confirmed** once confirmed.

## Energy impact terms

The proposal's bill-savings projection and the Remodel ROI calculator share these (logic in `src/shared/modules/construction/core`). Ruled 2026-10-21 and 2026-10-22 (energy impact tracker EI-D19–D25); the chapter's own label is decided at its UI exploration. The model is keyed by the calculator's bill categories (electric, water, gas, gardening, misc); there is no separate "energy category".

- **Bill cut** — the share of a bill a trade or an add-on takes off, in percent: the team's working numbers, assuming old inefficient material is replaced with efficient material (`TRADE_BILL_CUTS`). Cuts stack multiplicatively. _Avoid_: savings rate, reduction.
- **Bill-cutting scope** ("bill-cut scope" for short) — a scope that, on a proposal, makes its trade's bill cut count, for the bills named; only complete replacements are (all windows, full Cool Life repaint, roof tear-off/torch down/redeck/overlay, split or package HVAC, attic insulation, radiant barrier, every dryscaping scope but sod). An A/C replacement cuts only electric and a furnace replacement only gas (`BILL_CUTTING_SCOPES`, still to be built in the energy-impact foundation). An **add-on** (the catalog's kind: work we don't normally do standalone) can be bill-cutting too: ducts, assumed with every full HVAC, radiant barrier and the attic fan (`BILL_CUT_ADD_ON_IDS`). Cool roof is not an add-on: Tri Pros sells only cool roofs, so it is the roof's own bill cut. _Avoid_: qualifying scope (qualify is program eligibility), energy scope, earning scope; "add-on" for anything that isn't the catalog's kind.
- **Electric utility** — the customer's power company, LADWP or SCE, priced at its average $/kWh; gas is always SoCalGas. Code: `electricProvider` (the `electricProviders` enum). _Avoid_: "provider" alone (service providers, finance providers and the lead-conversion provider already use it).
- **Utility bills** — the customer's monthly electric, gas and water bills plus their electric utility, one row per customer, shared by all their proposals and settable by the homeowner through the share link (`customer_utility_bills`, stored in cents). _Avoid_: energy bills.

## People terms

- **Agent** — a user with the `agent` role (`userRoles`): our salespeople, and only them. "Agent" in copy and docs means these users. _Avoid_: rep for a user who is not on a meeting (rep always means a meeting rep).
- **Meeting reps** — the owner and co-owner of a meeting, owner first; never helpers, never the system user (`SYSTEM_OWNER_EMAIL`). No entity of their own: they are `meeting_participants` rows with role `owner` or `co_owner`, normally agents. A meeting's proposals belong to them, not to `proposals.ownerId` (the proposal's author). Code: `meetingReps`, `getMeetingReps`. UI copy says "Your team" (two) or "Your consultant" (one). _Avoid_: proposal owner, specialist (the VoIP code's word for the owner rep), closer (a meeting rep only once the meeting has an approved proposal, see Closer).

## Proposal page terms

The customer-facing proposal page (`/proposal-flow/proposal/[proposalId]`).

- **Cockpit** — the agent's sheet on the proposal page: numbered steps (Share, the homeowner's choice, Agreement), then reference rows for the customer and the meeting; opened from the top bar when the viewer can act on the proposal (`Cockpit`). _Avoid_: agent panel, sidebar, agent view.
- **Contract fields** — the values the app fills into a contract's Zoho fields, owned by the codebase rather than by Zoho formulas or defaults: per proposal, grouped by field group (the payment schedule first), each group's defaults and Zoho mapping declared in the Zoho registry (`contractFields`, `proposals.contract_fields`; neither is built yet, PE1 of the proposal editor epic). _Avoid_: contract terms (the printed clauses), contract config.
- **Payment schedule** — the deposit followed by progress payments that split (contract price − deposit). For now the fixed standard template (`STANDARD_PAYMENT_SCHEDULE`, computed by `computePaymentSchedule`): Measurements/Site inspection 20%, Material order/Delivery 35%, Installation commencement 35%, Completion the remainder; per-proposal edits (2–5 payments) arrive with contract fields, as their first group. The same for every deal structure. _Avoid_: scheduled payments (the retired payment mode), payment plan.
- **All cash** — a proposal whose cash down equals the contract price; derived from `cashInDeal`, never stored. _Avoid_: all-cash mode, payment mode.
- **Proposal chapter** — one of the six sections of the proposal page, Overview → Trusted contractor → Past results → Scope of work → Funding → Next steps (`proposalSteps`). Scoped to the proposal page: in a presentation the grouping is a **Run** and in a project story a **Story phase**, and their _Avoid_ lists still bar "chapter" there. _Avoid_: step (the code's `proposalSteps` predates the term), section.

## Proposal editor pricing terms

The edit proposal page's labels for numbers that `docs/ubiquitous-language.md` already defines. Money math lives in `src/shared/modules/proposals/core/lib/financials/`.

- **Section starting price** — a SOW section's price before its section incentives: `financials.sectionPrice`. The glossary's "Section Price". _Avoid_: list price, base price.
- **Section final price** — the section's price after its section incentives: `computeSectionFinancials(...).netPrice`. Shown with the starting price struck beside it when they differ. Only inside a section. In Funding the final TCP is labelled **Final price** (owner, 2026-10-23). _Avoid_: net price (in editor copy), section total.
- **Cost Lines** — what Tri Pros pays for a section's work (job costs). They feed margin and multiplier, never the homeowner's price. _Avoid_: expenses, costs (alone).
- **Subtotal** — the Funding ledger line in breakdown mode: Σ section starting prices − Σ section incentives + Misc Pricing. Not the Total Contract Price: **TCP** stays `startingTcp` (the starting TCP); the final TCP is the ledger's **Final price**. _Avoid_: Total Contract Price for this line.

## Flagged ambiguities

- "run" means two things: a presentation **Run** (consecutive column slides, Presentation terms) and a scheduled execution of an automation (`runAutomaticKind`, `VisitMessageRunReport`, `resolveRunInstant`). Both stay, each scoped to its section; in automation copy "run" is always the scheduled execution.
- "sequence" was defined for visit messages only — resolved 2026-10-08: **Sequence** is the general automation kind (Automation terms); the visit-message sequence is one instance.
- "body" is a data view's **Body** (Data view terms); on a presentation slide the word is **Content**, never body.
- "qualify" means program eligibility (Energy Saver+ through `qualifyEnergySaver`, decided by a trade's category); whether a scope lowers a bill is a **Bill-cutting scope**, decided per scope. The two can differ: an A/C replacement qualifies for Energy Saver+ but cuts only the electric bill.
- "sits" means two counts: the **Sit** filter grouping field and the "Sits" quick filter count meetings (every sat non-project meeting), while analytics "Sits" counts booked leads (first sit per lead, `pickBookedLead`). Both stay; the two numbers differ by design.
- "rep" alone means a **meeting rep** (People terms). Older docs and code say "the reps who sit it" for every participant, helpers included (the analytics closer), and "specialist" for the owner rep (VoIP); both are being moved to the People terms (2026-10-16).
- "campaign" means a lead-conversion provider campaign (`voip_campaigns`) and a Meta ad campaign; never a scheduled send to customers.
- "plan" means three things: an automation **Plan** (Automation terms), a dev-flow **Plan** (an issue, Dev flow terms) and the planning **Stage** word `plan`. Each stays in its section; in dev-flow copy a plan is always the issue, and its file is its **Tracker**.
- "orchestrator" means the data-view **Orchestrator** (a page or component) and the dev-flow **Orchestrator** (a Claude Code session). In data-view code and docs it is always the former.
- "lane" is a dev-flow word only; on the kanban board the word is **Stage** (Pipeline terms).

## Planning terms

- **Stage** — where a plan or epic stands, one of six words: **brainstorm** (grilled, no design doc) · **spec** (design written or approved, no plan) · **plan** (plan or tracker written, nothing built; the stage word, not the **Plan** issue) · **building** (tasks in progress on a ref) · **built** (every task done on its ref, not on `origin/main`) · **shipped** (reachable from `origin/main`). A qualifier may follow (`stress-tested`, `awaiting iPad check`, `unmerged`). Owner agreed 2026-11-03.
- **Orientation** — the verified delta between what a plan intended, what the tree and git show was done, and what moved underneath it since; produced by `/orient`. Not a recap of the plan file.
- **Tracker** — the file that holds a piece of work's working detail: its order or tasks, its status block and its rulings table. An epic's tracker is `docs/plans/*-epic.md`; a plan's tracker is its file under `docs/superpowers/plans/`, which SDD builds from. The epic or plan itself is its GitHub issue, which links to the tracker (ADR-0007). _Avoid_: "plan" for the file.
- **Ruling** — an owner decision, one row in its tracker's rulings table (ID, question, ruling, date). An override edits the row in place: the new text on top, the old struck through as deprecated. _Avoid_: ruling comments on issues.
- **Status block** — the structured header every tracker carries (Stage · Built on · Verified at · page · Done · Next · Open · Blocked). `/orient` reads it as its checkpoint and rewrites it; `session-capture` writes it at session end as the hand-off. Replaces the old `> **Status:**` paragraph on first touch.
- **Child** (of an epic) — one of its plans: a sub-issue of the epic issue, linking its tracker. An epic not yet moved to an issue lists its children as plan files or tracker phase rows; a row with no plan is always `brainstorm` or `spec` and unverified.
- _Avoid_: "handoff mode" (there is none; the hand-off is `session-capture` writing the status block), "resume block" (it is the status block).

## Dev flow terms

How work moves from an issue to prod, in the words the ship board uses (board UI spec, #316; owner 2026-11-21, 2026-11-23 and ADR-0007). GitHub issues are the record of all work; an issue's spec and **Tracker** are committed files its body links to.

- **Epic** — a GitHub issue labelled `epic`. Its short body says what it solves, when it is done, and links to its tracker, spec and references; its sub-issues are its plans. An epic is also a lane: its own board row, branch and checkpoint PR.
- **Plan** — a GitHub issue for one piece of work, a sub-issue of an epic or standalone. Its short body gives its steps at a high level and links to its **Tracker**, where its tasks live, never as sub-issues. A plan in an epic opens its PR against the epic branch.
- **Slice** — what `/to-tickets` cuts work into: on an epic, its plans (sub-issues, each rated for readiness); on a plan, its tasks (rows in its tracker). Never a task sub-issue.
- **Lane** — one issue being worked on now: its own worktree, branch `{type}/{issue}-{slug}`, draft PR, preview and board row. One lane carries one issue. _Avoid_: lane for a kanban stage (Pipeline terms).
- **Orchestrator** — the one Claude Code session that runs a lane and its subagents.
- **Journey** — an epic's plans in its sub-issue order, in four steps: **On prod** (the sub-issue is closed) · **This release** (open, and its PR merged into the epic branch, or its lane in flight) · **Next** (open, no lane, P0 or P1) · **Later** (open, no lane, P2, P3 or no priority). A lane page shows only its own plan's steps; the four step names are the same everywhere.
- **Checkpoint PR** — an epic branch's PR into `main`: how an epic's merged plans reach prod.
- **Backlog** — open issues with no lane row, folded under the board's map. Not a Project 3 Status (Project 3 has none).
- **Start on issue** — the action on a Backlog row: a copyable one-line command that starts a worktree session on that issue. It starts no agent and writes no row; the session it starts creates the lane row `issue-<n>`. _Avoid_: pull into flight.
- **Gone quiet** — a lane on the agent's move with no commit, push, preview build or check-in for 4 days or more.
- **Status strip** — the five counts atop the board's map: waiting on you · broken · ready to merge · gone quiet · collisions. Each count is a **status filter**, a toggle that dims every row it does not match. _Avoid_: signal.

## Scope Pricing terms

Calculator vocabulary (owner, 2026-11-06). Formula, Variable, Unit Cost, Cost, Price, Multiplier and Pricing Key are the tracker's D1 names (`docs/plans/2026-09-26-sales-calculators-epic.md`).

- **Scope default** — the multiplier a pricing key sells at when nothing else is set (`multiplier.byScope`, Admin-configured from code): exterior paint 3.5, MPU 2.5; every other scope uses the 2.8 default. _Avoid_: per-trade default (defaults are per scope, not per trade).
- **Proposal-wide multiplier** — the agent panel's one control. It rests at 2.8 and shifts every scope without an override by `m − 2.8`, so the spread between scope defaults survives; the target price solves for it. Bounded below by the floor. The C0 calculator is a standalone quote (R2), so the code says `QuoteResult.multiplier`; the term is the proposal's. _Avoid_: job-wide, global multiplier.
- **Scope multiplier override** — the agent's absolute multiplier on one scope line (`multiplierOverride`); it ignores the shift and the solver never moves it. A line is one scope on the quote; the same scope added twice carries two overrides. _Avoid_: pinned, fixed, line override.
- **Custom scope** — a formula line the formula cannot cost (exterior paint above 3,000 sq ft): the agent types its price on the card and it is carried uncosted like a manual line (`reason: 'custom'`). _Avoid_: manual line for it, custom band.
- **Home size** — exterior paint's small / average / large classes by home square footage (≤ 1,350 / ≤ 1,800 / ≤ 3,000; an edge takes the smaller size; above 3,000 is a custom scope) (`exteriorPaintHomeSizes`). _Avoid_: tier (the multiplier tier and the R9 configuration tiers), band, threshold.

