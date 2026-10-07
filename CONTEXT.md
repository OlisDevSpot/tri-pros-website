# Tri Pros — Context

Domain glossary. Terms here are the canonical names used in code, schema, and docs.
When a term in code drifts from the definition below, fix one of them (and ping the user).

## Lifecycle

A **customer** moves through two distinct phases. Different systems own each phase.

### Phase 1 — Lead-to-meeting (conversion)

From "we got a phone number from a marketing campaign" to "this person has a meeting booked." Owned by a **lead-conversion provider** (currently CloudTalk; pluggable). Our app does NOT place these calls or send these texts — the provider does. Our app's role is:

- Push: enroll / unenroll a customer in a campaign, configure which `lead_source` routes to which provider campaign.
- Pull: parse the provider's webhooks for 2-way sync (status changes, DNC events, graduation when a meeting is booked).
- **Not** mirrored in our DB: per-contact call recordings, SMS thread history, AI agent transcripts. Those live in the provider's system. Our DB carries the configuration + the lifecycle status only.

### Phase 2 — Agent comms (post-conversion)

From "meeting booked" forward — proposal sent, project scheduled, ongoing customer relationship. Owned by **voip-in-house** (Twilio-backed). Every agent and every office worker gets a clean company-branded DID. All calls, SMS, and voicemails between Tri Pros staff and a known customer go through it. Provides the in-app communication surface: dialer, SMS thread, voicemail inbox.

The boundary is sharp. voip-in-house does **not** handle lead-conversion outreach. The lead-conversion provider does **not** handle post-conversion comms.

## VoIP terms

- **voip-in-house** — Twilio-backed in-app communication layer for Phase 2. Owns `voip_*` tables. Clean DIDs assigned 1:1 to humans.
- **voip-campaigns** — Integration surface to whichever lead-conversion provider is wired in (currently CloudTalk). Owns the config + webhook parsing, NOT the call/SMS data.
- **DID** — A phone number provisioned on Twilio. In voip-in-house, every DID is `agent_personal` (sticky to a sales agent), `office_worker` (sticky to a non-sales user), or `main_line` (the inbound reception number).
- **Lead-conversion provider** — The external system that handles Phase 1. Today: CloudTalk. Pluggable.

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
| **Setter** | The appointment setter: the user, often a dispatcher, who booked the meeting. One per meeting; a super-admin can change it. The one term in code, schema, docs and UI; never "closed by", "closer" or "created by" | `meetings.setBy` · picked on the add-meeting form, else the meeting's creator; kept by a duplicate and a reschedule; only super-admins change it |
| **Closer** | Any participant of the meeting (the reps who sit it, never the setter); per-closer totals overlap by design; a meeting (and its sale) with no closer groups under an unassigned row | `MeetingFact.closerIds` · `src/shared/entities/meetings/dal/server/analytics-facts.ts` |
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

## Records terms

- **Scope coverage** — for one proposal of a meeting: which of the scopes captured in the meeting it includes, which it leaves out (struck through), and which it adds that the meeting didn't capture (dashed "+"). Matched by scope id (`computeScopeCoverage`, `ProposalOverviewCard.ScopeCoverage`). _Avoid_: scope match, scope diff.

## Pipeline terms

- **Stage** — one step of a pipeline; a customer sits in exactly one stage per pipeline. On the kanban board each stage shows as a lane, but the domain word is always stage (`PipelineStageConfig`, `KanbanStageFilter`). _Avoid_: column, lane, status.
- **Confirmed** — a meeting whose homeowner, reached on the day of the meeting, said they will be home (`meetings.confirmedAt`). A soft confirmation: a confirmed meeting can still be rescheduled or cancelled before the rep arrives. It holds for one appointment time — moving `scheduledFor` clears it, and a reschedule books a new, unconfirmed meeting. Fresh pipeline: every booked meeting starts in **Needs Confirmation** and moves to **Confirmed** once confirmed.
