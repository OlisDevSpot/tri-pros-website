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
- **Plan** — one record's steps and their states at a moment, computed by a pure function from the record, its message rows, the settings and the clock (`planVisitMessages`). Every screen and every run read the same plan. _Avoid_: schedule (that is the settings), timeline.
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

## Trade scene terms

3D scenes that model the house's construction for a meeting (spec `docs/superpowers/specs/2026-10-15-3d-presentation-scenes-and-assembly-cutaway-design.md`). Scene primitives live in `src/shared/components/scene/`, the construction model in `src/shared/modules/construction/core/`, trade scenes in `src/features/trade-scenes/`.

- **Scene** — a 3D presentation surface driven by scene inputs. _Avoid_: canvas (slide content), stage, visualization.
- **Scene inputs** — the typed values controls change and the scene reads; one store per open scene, discarded on close.
- **Scene targets** — what `resolveScene(inputs)` returns; 3D objects and panel figures ease toward them.
- **Trade scene** — one inputs schema + one `resolveScene` + one scene kit + its panel, modeling an assembly for the trades that build it. The assembly cutaway is the first. _Avoid_: experience (the public `/experience` page), visualization.
- **Cutaway overlay** — the fixed full-screen surface a trade scene opens in during a meeting (`?assembly=`). _Avoid_: modal, dialog, layer (Modal layers).
- **Assembly** — a section of the house's construction that one or more trades build (`roof-attic`, `crawl-space`, `exterior-wall`, `windows`, `yard-ground`, `hvac-attic`). _Avoid_: system (a group of parts the rep shows together, see System), section.
- **Part** — a layer or component of an assembly (deck, brown coat, duct run, condenser). On screen it is a "layer"; in code always a part. _Avoid_: layer (in code), piece, component.
- **Part material** — what a part is made of (`deck: spaced-boards | plywood`); the in-code twin of the catalog **Material** (`docs/ubiquitous-language.md`) until Materials are read at runtime.
- **Part condition** — `retained | worn | absent | installed`, shown as Kept / Original / Missing / New. _Avoid_: status, state.
- **Home material** — a material the home has today that the rep can rate and the Tri Pros build can replace (roof & gutters, attic insulation, windows, exterior paint, heating & cooling, ducts, crawl space insulation); one entry each in `HOME_MATERIALS`. _Avoid_: system (see System), part (one layer of an assembly).
- **System** — the owner's word for a group of the home's parts the rep shows and upgrades together: the roof system, the attic system, the window system, the walls, heating & cooling (the HVAC system) and the foundation system (owner, 2026-10-25). The Upgrades tab groups its rows by system (`HOME_SYSTEMS`), and TS3b.4b gives systems their up-close screens. A system can span assemblies, and an assembly can feed more than one system. The foundation system holds crawl space insulation on a raised home (trade `foundation-and-crawl-space`). _Avoid_: group, section, assembly (the construction model's unit).
- **Wear** — how worn a home material is: `new | good | fair | worn | failing`. On screen it is "Condition"; in code always wear. Wear `new` makes its parts `retained`, any other wear `worn`. It never changes a heat figure. _Avoid_: condition (in code; Part condition owns it), age, home stress.
- **Paint wear** — the three kinds of wear exterior paint shows besides its fade: `cracks | stains | peeling`; on screen Cracks, Stains, Peeling. Each takes a starting level from the paint's wear, and the rep can set each on its own; a wear change never resets what the rep set. _Avoid_: damage, defects, condition (Part condition owns it), wear alone (Wear is the five-step Condition).
- **Paint wear level** — how much of one paint wear kind a home shows: `none | light | moderate | heavy`. _Avoid_: amount in code (`WEAR_AMOUNT` is Wear's numeric share), severity.
- **Age bands** — the years each wear step covers for one home material; the age follows from the wear the rep picks.
- **Era guess** — what the build era assumes for a home material the rep has not set (Basis `era-typical`); picking another era changes only era guesses. _Avoid_: default, template.
- **Efficiency upgrade option** — a more efficient material the rep can switch on or off on a Tri Pros build pick: the cool roof on a shingle or torch down pick (on by default) and the R-8 step up on new ducts. Switched off, the pick installs the regular material, Like for like. Code: `efficiencyUpgrades`, `EfficiencyUpgradeId` (owner, 2026-10-25). _Avoid_: add-on (the catalog's kind only, EI-D25), swap, toggle.
- **Saves energy / Like for like** — the two kinds of offer: an inefficient material becoming an efficient one, or the same material new, which ends upkeep only. Only Saves energy moves a bill.
- **Existing conditions** — the parts as they most likely stand today, inferred from the property profile (the as-is sheet) and the home materials with their wear. _Avoid_: today, current state.
- **Proposed build** — the existing conditions with the previewed scopes installed (the proposed sheet). _Avoid_: after, Tri Pros build (in code).
- **Basis** — `recorded` (every input from the profile, drawn exactly), `era-typical` (fell back to the home's era or a nearest drawing), `typical` (no year built). Drives "your" / "homes built …" / "a typical home" wording. Disclaimer copy says **estimate source**, never basis.
- **Home kit** — the scene kit that draws the whole house from the property profile, with the residents, sky and yard; exposes anchors. One per app (spec `docs/superpowers/specs/2026-10-16-home-scene-design.md`).
- **Assembly kit** — the scene kit for one assembly (`roof-attic` first), drawn at its anchor when zoomed; folder `assembly-kits/<assembly-id>/`. _Avoid_: section kit.
- **Anchor** — a named place on the home where an assembly kit sits, plus its camera framing (`roof`, `attic`, `exterior-wall`, `yard`, `under-floor`).
- **Weather** — `normal | summer | winter | rain`; picks an assembly's mode (heat or water) and the sky. Normal is a mild average afternoon, the default. _Avoid_: condition (part condition owns it), season (only inside the heat walk).
- **Home stress** — the stress a home takes over time given its condition: a leaking roof turning into mold, small earthquakes straining a raised foundation, cracks opening in the exterior walls. Upgrading lowers it; the payoff is better long-term home health and a better financial position, not only lower bills. _Avoid_: wear, wear and tear, condition (part condition owns it), strain (the AC's).
- **Heat weather** — a weather whose assembly mode can be heat (every weather but rain); carries the season, sun share and flow share the heat walk reads.
- **Climate** — `coastal | inland`, the preset behind the °F readings.
- **Readings** — the °F estimates pinned on the thermal camera: roof surface, attic air, ceiling surface, exterior wall, window glass and, for an attached garage, the garage's air. Room air is never shown.
- **Comfort** — `strained | fair | comfortable`, from the ceiling surface reading; drives the residents and the equipment.
- **Residents** — the people in the home, cast from household type and age group. _Avoid_: family, avatars.
- **Burst** — the two minutes of life after an input changes, before the scene rests (`SCENE_BURST.seconds`).
- **Thermal camera** — the whole-scene ironbow look with readings; from TS3b.3 it is the Thermal lens. Replaces "heat view".
- **Dock** — the strip at the scene's right edge for the switches flipped all the time, every choice one tap: the home views (Complete, Partly open), Thermal, the four weathers as thumbnails, then the shortcut-keys button and the look drawer. Where the stage is too short it folds the weather, then the home views, into one button each with its choices in a tray beside the strip (`SceneDock`). _Avoid_: toolbar, controls, lens strip (Lens is Thermal only).
- **Scene visible area** — the part of the scene the card and the dock leave uncovered; the camera frames and centres the house in it, so folding the card widens it and the house glides to the new centre (owner-agreed 2026-10-23, `SceneVisibleArea`). _Avoid_: inset, viewport, safe area.
- **Scopes and addons** (the Upgrades tab's list) — one row per part, grouped by System: what the part is today and the Notion scopes and addons that install it, one pick per part, each marked Saves energy or Like for like (owner-agreed 2026-10-23, `ScopesAndAddons`, `ScopeOrAddonRow`). The scene input beside the picks is `efficiencyUpgrades`, the Efficiency upgrade options switched on. _Avoid_: receipt, catalog (the construction catalog), layer list.
- **Home view** — how much of the house is drawn: `complete` (the whole closed house as it looks from the street, the default) or `partly-open` (the cutaway that shows the layers). Picked in the dock. Replaces "view mode" from TS3b.3 (the code's `ViewMode` until then). Not Today / Tri Pros build, which is the `view` input (`existing | proposed`). _Avoid_: view (that input), view mode (the proposal pages' customer / agent), Normal (the weather), layer.
- **Lens** — what the home is looked at through, on top of either home view. Today there is one, Thermal (the thermal camera), switched on and off; an X-ray lens is deferred, since Partly open is how the scene glances inside. _Avoid_: mode, filter, overlay.
- **Assembly screen** — what the close-up card shows up close: a column of blocks defined per assembly, today `parts` (the numbered list of parts matching the pins) and `peel` (the peel slider) (`AssemblyScreen`, `ASSEMBLY_SCREENS`). _Avoid_: section screen, zoomed panel.
- **Gable vent** — the louvred vent high in a gable end of a pitched home; part of the house, never a part or an upgrade. A flat roof has none (owner agreed 2026-10-30, attic design). The gable an attached garage's roof covers has none, so the scene's house vents through the left gable only (owner, 2026-11-01, R198). _Avoid_: attic vent (the ridge vent is one too), louver.
- **Roof vent** — a low-profile static vent near the ridge of a pitched roof, the part `roof-vent` (material `static`). Code requires them on a re-roof, so every pitched tear-off installs them, two per roof face on the scene's house; a tile reset and a flat roof add none (owner, 2026-11-01, R198, R199). _Avoid_: attic vent, whirlybird (a different, later product), ridge vent (its own add-on, R200).
- **House door to the garage** — the door from the rooms into an attached garage, in the wall they share (code `HOUSE_GARAGE_DOOR`); it does not open (owner, 2026-11-01, R202). _Avoid_: garage door (the car's roll-up door), interior door (the room-to-room door is one too).
- **Attic fan** — the upgrade part (`attic-fan`, material `thermostat-fan`) mounted behind one gable vent. Its **fan thermostat** switches it on while the attic reads over 100 °F before the fan's own effect: **Running** (blades spin in a burst, status light lit, attic cooler, heat lane out the vent) or **Idle** (drawn still). Pitched homes only (owner agreed 2026-10-30, attic design). _Avoid_: thermostat alone (the room thermostat), whole-house fan (a different product), on/off.
- **Ceiling opening** — a hole through the ceiling into the attic: a register boot, a recessed light can or a plumbing vent pipe. Air sealing closes each one with a foam collar; unsealed ones leak (owner agreed 2026-10-30, attic design). _Avoid_: penetration (in copy), gap, hole.
- **Foam collar** — the ring of expanding foam air sealing leaves round a ceiling opening; seen only with no insulation over it (`KIT_PENETRATIONS.collar`, owner agreed 2026-10-30). _Avoid_: foam ring, gasket.
- **Hung ducts** — ducts strapped up from the rafters, clear of the insulation, per today's code; how R-6 and R-8 ducts are drawn, whether new or already in the home (owner agreed 2026-10-30, attic design). _Avoid_: suspended, elevated, raised (the foundation's).

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
- **Orchestrator** — the page or component that mounts a data view and writes the wrapper around it; it may drop the bar, swap the heading or pick toolbar pieces. No per-callsite layout component does this for it. _Avoid_: container (a records-management term).
- **Loading screen** — a route's `loading.tsx`: the page's own component under `DataViewPending`, its data views showing their cached rows or none (`useLoadingScreenRead`). It starts no fetch; the page that replaces it refreshes the rows. _Avoid_: skeleton page.
- **Pending view** — any render where `DataViewPendingContext` is not `false`. `'loading'`: a loading screen, a `DataViewBoundary`'s suspense fallback, the layout's document-load skeleton, the PWA launch shell. `'error'`: a boundary's error fallback. Reads never suspend inside one, and only `'loading'` shows cached rows (`useIsDataViewPending`).

## Records terms

- **Scope coverage** — for one proposal of a meeting: which of the scopes captured in the meeting it includes, which it leaves out (struck through), and which it adds that the meeting didn't capture (dashed "+"). Matched by scope id (`computeScopeCoverage`, `ProposalOverviewCard.ScopeCoverage`). _Avoid_: scope match, scope diff.
- **Fixed filter** — a filter value a data view always applies, set by its callsite: in the data-view config (`fixed`) or at the callsite for a value only it knows (the `fixed` argument of `useDataViewQuery` and `loadDataViewQueryInput`). Never read from the URL, never shown in the toolbar. A field declared `fixedOnly` can only be set this way. Narrows what a view asks for; it is not access control. _Avoid_: scope, preset filter.
- **First-rows window** — a data view window that returns the first N rows of the view's order with no paging (`{ kind: 'first', count }`). A view with no user state builds its input with `staticDataViewInput`. _Avoid_: limit window, top-N.

## Pipeline terms

- **Stage** — one step of a pipeline; a customer sits in exactly one stage per pipeline. On the kanban board each stage shows as a lane, but the domain word is always stage (`PipelineStageConfig`, `KanbanStageFilter`). _Avoid_: column, lane, status.
- **Confirmed** — a meeting whose homeowner, reached on the day of the meeting, said they will be home (`meetings.confirmedAt`). A soft confirmation: a confirmed meeting can still be rescheduled or cancelled before the rep arrives. It holds for one appointment time — moving `scheduledFor` clears it, and a reschedule books a new, unconfirmed meeting. Fresh pipeline: every booked meeting starts in **Needs Confirmation** and moves to **Confirmed** once confirmed.

## Flagged ambiguities

- "run" means two things: a presentation **Run** (consecutive column slides, Presentation terms) and a scheduled execution of an automation (`runAutomaticKind`, `VisitMessageRunReport`, `resolveRunInstant`). Both stay, each scoped to its section; in automation copy "run" is always the scheduled execution.
- "sequence" was defined for visit messages only — resolved 2026-10-08: **Sequence** is the general automation kind (Automation terms); the visit-message sequence is one instance.
- "body" is a data view's **Body** (Data view terms); on a presentation slide the word is **Content**, never body.
- "campaign" means a lead-conversion provider campaign (`voip_campaigns`) and a Meta ad campaign; never a scheduled send to customers.
