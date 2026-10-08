# Analytics (Business Health) — Epic Tracker

> **Status:** 📐 **DESIGN.** Business-rules brainstorm **complete 2026-09-26** (C1–C27). **Split confirmed by the owner 2026-09-26 — this file is the master tracker for specs A–F.** Spec A **shipped 2026-09-27** (C28–C43 added; revised after a code re-verification) — **Spec F unblocked.**
> **Goal in one line:** one Analytics page that shows, per lead source and in total, what each source yields downstream — leads → appointments → seats → sales → projects — on deduplicated, noise-free numbers whose counting rules live in exactly one place.
> **Baseline:** `main` at `e8c5d97a` (2026-09-26). Re-baseline at each spec.
> **Evidence:** read-only code sweep 2026-09-24 (lead-sources dashboard, analytics engine, schema, intake, dedup) spot-checked by hand; `#285` worktree at `b40403b6` and issues #217 / #220 read 2026-09-26. Findings with file:line in §4, present-day defects in §5.

**Adjacent, owned elsewhere (do not duplicate):**
- **Records Management epic** (`docs/plans/2026-09-26-records-management-epic.md`): owns source *management* and every entity table. Its **R2** reads one lead source's customers through the shared customers list with that source pinned as a fixed filter (a narrowing, not access control; records D62); its **D1** says per-customer de-duplication belongs to analytics (this epic).
- **#285 permissions** (`refactor/285-…` worktree): owns meeting visibility and every CASL row. Spec D needs it (C20, Q2). Junk/test marking rights come from it (C13).
- **Multi-proposal meeting flow epic** (`docs/plans/2026-09-20-multi-proposal-meeting-flow-epic.md`): owns proposal status and selection. The deferred auto-project work (X1) touches its selected-proposal model.
- **JSONB Wave 4** (SOW normalization): the trade dimension waits for it (X5).
- **Planned project-management feature**: will feed the Projects tab (C25) and payments (X6).
- **July analytics engine + spec**: `src/shared/domains/analytics/` (built, unused), `docs/superpowers/specs/2026-07-28-analytics-feature-marketing-sales-design.md`, `docs/superpowers/plans/2026-07-30-analytics-marketing-bucket.md`. Their paid-Meta-only scope is **not** this epic's scope; they now cover only the deferred Meta ad drill-down (X4). Spec F decides whether the engine is reused (Q5).

Legend: `[ ]` open · `[x]` done · `[~]` in progress · ⚠️ blocked on a §2 question.

---

## 0. Epic structure — MASTER TRACKER (split confirmed by the owner 2026-09-26)

**This file is the single source of truth for the epic.** Sync protocol: (1) every spec and plan cites tracker IDs and never restates a rule — it links here; (2) a spec that amends a decision adds a dated row to §1 (new C-id) before it is approved; (3) when a task lands, tick its IDs in §3 and update the row below (commit range); (4) a spec closes when every ID it owns is `[x]`; (5) deferred items (§6) open here as new Q-ids when they start.

| Spec | Scope | Owns | Blocked by | Spec file | Plan | Status |
|---|---|---|---|---|---|---|
| **A** | **Lead rules + person identity** — the one place every counting rule is defined; building blocks in the customers / meetings / proposals / projects modules, composed by the analytics feature; person identity (phone OR email, chained); glossary terms. No UI. | A1–A9 | — | `docs/superpowers/specs/2026-09-26-analytics-a-lead-rules-design.md` | deleted after ship (git history) | [x] shipped d9347269..25fc22b2 (interleaved with other sessions' commits) |
| **B** | **Sales money rules** — "Total Signed / Total Opened" standardized into modules; per-project (not per-customer) classification; dated cancellations; `on_hold` before `cancelled`; projects pipeline stat bar consumes the shared rule. | B1–B6 | — | not written | — | [ ] |
| **C** | **Lead quality flags** — junk / test marking (super-admin + dispatcher), auto-internal, gross vs valid leads. | N1–N4 | permission rows from #285 (does not block the data half) | not written | — | [ ] |
| **D** | **Setter = `meetings.setBy`** — `ownerId` rethought as `setBy` (super-admin editable, one meeting or in bulk from the meetings records table); participants = assigned reps + visibility; setter backfill by date ranges. | D1–D5 | ⚠️ Q2 (#285 / #217 alignment) | not written | — | [ ] |
| **E** | **Lead-source spend** — monthly spend per source on the lead-source entity with a per-source spend mode; the entry grid ships in F. | E1–E3 | — | folded into F (C46) | — | [x] shipped with F |
| **F** | **Analytics feature v1** — page + nav enabled; global filter bar; tabs Overview / Leads / Appointments / Sales / Projects (stub); absorbs `lead-sources-admin` (F10 moved to an end-of-epic cleanup spec, C46); includes E. | F1–F12 | A (uses B, C, E as they land; setter dimension lights up with D) | deleted after ship (git history) | deleted after ship (git history) | [x] shipped 470eb0e4..99fabf8d on local main (interleaved with other sessions' commits; SDD, per-task reviews + final review, one fix batch); pending owner: ⚠️ `pnpm db:push:prod` BEFORE any push to origin (lead intake reads every `lead_sources` column), hand-check of the page and spend saving, spend entry, /impeccable pass |

**Order:** A and B first (parallel); C and E alongside; F after A; D on #285's timeline. A dimension or metric whose data has not landed shows "not available yet" — never a faked number (F11).

---

## 1. Decided (owner)

| ID | Decision | Date |
|---|---|---|
| **C1** | **Scope:** overall business health across **all** lead sources, per source **and** total. Not paid-Meta only (that is the July spec, now X4). | 2026-09-24 |
| **C2** | **Lead = one person, for life.** A returning person is never a new lead. The **first** source that brought them gets the credit forever; their later meetings and sales roll up to that one lead. | 2026-09-24 |
| **C3** | **Same person = same normalized phone OR same email, matches chain** (A~B by phone, B~C by email ⇒ A, B, C are one person). Households sharing a phone are one person. | 2026-09-24 |
| **C4** | **Seat (sit) = a meeting where the rep physically met the homeowner.** Sat: `pns`, `npns`, `ftd`, `not_good`, `lost_to_competitor`, `follow_up_needed`, `proposal_created`, `proposal_sent`, `converted_to_project`. Not sat: `no_show`, `cancelled`, `reschedule_needed`, `nra`. `not_set` = unknown, never a seat, surfaced as a hygiene count. `Project`-type meetings and `additional_work` are outside the lead chain (C43: the split is simply project meeting vs not). | 2026-09-24 |
| **C5** | **Every KPI is sliceable by one shared set of dimensions** — questions like "ratio of `not_good` meetings in July" are filters over the same data as the headline numbers, never bespoke queries. Meeting-quality KPIs themselves are a later session (X2). | 2026-09-24 |
| **C6** | **Sale = a signed initial-sale contract** (proposal `approved` via Zoho), **dated at signing**. A project's existence is a hygiene check only ("signed, no project"). | 2026-09-24 |
| **C7** | **Month lens = time of event**, not cohort. Leads, meetings and sales land in the month they happened ("a July lead that closed in October counting for July is wrong"). | 2026-09-25 |
| **C8** | **Appointment = once per customer, never per meeting row.** Two cancelled meetings then a sit = 1 appointment, 1 seat. A single cancelled meeting = 1 non-sit appointment. **Seats ≤ appointments, always.** | 2026-09-25 |
| **C9** | **The appointment lands in the month of the sat meeting if the customer sat, otherwise their first meeting's month.** A past month's appointment count can drop when one of its customers later sits — accepted. | 2026-09-25 |
| **C10** | **Sales cycles considered and dropped** (repeat customers are rare). 1 customer = 1 lead = at most 1 appointment for all lead / appointment analytics. | 2026-09-25 |
| **C11** | **Sales metrics:** **New sales** = signed initial-sale contracts (a repeat customer's second project still counts). **Total closes** = initial-sale + additional-work contracts signed in the month. **Revenue** = all contracts signed in the month, split initial vs upsell. The seat → sale close rate uses new sales only. | 2026-09-25 |
| **C12** | **Noise, three tiers:** **test / internal** = excluded everywhere (not a lead); **junk** (spam, fake, wrong number) = counted as a lead but flagged → **gross leads** vs **valid leads**, stage rates run on valid leads; **unqualified** (renter, out of area, too small) = a normal sales outcome, not noise. | 2026-09-25 |
| **C13** | **Marking junk / test is done by a super-admin or a dispatcher.** | 2026-09-25 |
| **C14** | **Changing a customer's lead source is a correction** — today's behavior stays (the whole history moves to the new source). No change log. Within a duplicate cluster, the person's source is the earliest record's source (C2). | 2026-09-25 |
| **C15** | **Cancellations after signing happen** → report **gross / cancelled / net** sales; a cancellation counts in the month it happens (C7). Today's mechanism is the projects pipeline "Total Signed" vs "Total Opened"; it must be standardized into shared modules (spec B). | 2026-09-25 |
| **C16** | **On hold = still potential, not cancelled.** Stays in net sales, shown separately as "at risk". In the pipeline it sits **before** `cancelled`; it is yellow, `cancelled` is red. | 2026-09-25 |
| **C17** | **Spend: v1 = monthly spend entered by hand per source** (super-admin). Ultimate goal = hybrid (Meta automatically, price-per-lead × valid leads, the rest by hand), so each source carries a spend mode. | 2026-09-25 |
| **C18** | **Setter credit is required.** Past setters worked in strict sequence, so they can be backfilled by date range. | 2026-09-25 |
| **C19** | **Closer credit:** each meeting counts toward **each** of its participants; per-rep totals exceed the company total by design (labelled). | 2026-09-25 |
| **C20** | **`meetings.ownerId` is rethought as `setBy`** (field name ruled 2026-09-27, was `createdBy`) — the user who booked the meeting = the **setter** (appointment setter); a super-admin can edit it (a super-admin sometimes enters a meeting another dispatcher generated). **Participants are the reps assigned**; meeting visibility comes from participation. Supersedes #217's "ownership lives on `meetings.ownerId`". | 2026-09-26 |
| **C21** | **v1 dimensions:** date range (calendar months in Pacific time + custom), lead source, setter (after D), closer, meeting outcome, meeting type (Fresh = first with the customer vs Project / continuing), city / zip. Deferred: trade (X5), Meta ad drill-down (X4). | 2026-09-26 |
| **C22** | **`features/lead-sources-admin/` is absorbed into the analytics feature** as starting logic and components (its name collides with the lead-source entity). Source management (list, settings, customers) goes to the records-management feature. | 2026-09-26 |
| **C23** | **One analytics page, one global filter bar applied to every tab.** Tabs follow the entity lifecycle: **Overview** (one row per source: leads → appointments → seats → sales → revenue, plus spend and cost per stage) → **Leads** → **Appointments** → **Sales** → **Projects**. | 2026-09-26 |
| **C24** | **No "Collections" tab** — payments have no amounts or dates today. The sequence follows the entities, ending at Projects. | 2026-09-26 |
| **C25** | **Projects tab = stub in v1**, fed later by the planned project-management feature. | 2026-09-26 |
| **C26** | **Spend entry lives in Analytics** (a month × source grid). The data belongs to the lead-source entity. | 2026-09-26 |
| **C27** | **All business rules are defined in ONE place** — the analytics feature, composed from `shared/modules` building blocks; never re-encoded in routers, DALs or stat configs. *(Placement amended by C29.)* | 2026-09-25 |
| **C28** | **Vocabulary (Q1):** **booked lead** = a customer with ≥1 non-project meeting, counted once ("meeting" stays the row; "appointment" stays avoided); **sit** (not "seat"); **junk lead / test lead**; **total leads** vs **valid leads**; **"Total Opened" kept** — B6 closes won't-fix, the `opened` stage is not renamed. | 2026-09-26 |
| **C29** | **Rule placement (Q7, amends C27):** each rule lives once, in the entity or module that owns its table — customers and meetings stay `src/shared/entities/` (no module promotion), proposals and projects in `src/shared/modules/`; the analytics feature only composes them. Another feature (the projects stat bar) consumes the same primitive — never a cross-feature import. | 2026-09-26 |
| **C30** | **Person identity is computed on read (Q4):** a pure union-find over customer rows in TypeScript; no stored person id, no backfill, no intake change. Revisit only if volume grows ~100× (767 customers on 2026-09-26). | 2026-09-26 |
| **C31** | **Booked leads and sits are dated by the meeting's `scheduledFor`**, not by when it was booked. A setter's "booked in month X" view is Spec D's, on `createdAt`. | 2026-09-26 |
| **C32** | **An approved proposal with no `approvedAt` is an undated sale:** counted in all-time totals, never in a month, reported as a hygiene count. No fallback date. | 2026-09-26 |
| **C33** | **Closer credit goes to every meeting participant, whatever the role.** | 2026-09-26 |
| **C34** | **Rule verification = one `scripts/verify-analytics-rules.ts` fixture script** (repo precedent); no test runner added. | 2026-09-26 |
| **C35** | **Meeting-type dimension is derived**, not read from the stored `meetingType` (`Fresh` on every non-project meeting). *(Values redefined by C37.)* | 2026-09-26 |
| **C36** | **Dimension semantics:** person-level dimensions (source, city/zip) filter people for every stage; event-level dimensions (closer, outcome, meeting type) filter meetings/sales, and stages with no such event show "not applicable", never an unfiltered number. Rates are same-period ratios; totals are Σ÷Σ. | 2026-09-26 |
| **C37** | **Meeting order (amends C35):** `first` = the person's **first sat** non-project meeting (cancelled → `pns` ⇒ the `pns` is `first`) · `repeat` = any non-project meeting after the first sit · `not_sat` = any non-project meeting before the first sit, or of a person who never sat · `project` = a project meeting. A reschedule's cancelled original is `not_sat`, never `first`. | 2026-09-26 |
| **C38** | **Every business rule is tweakable in one obvious place:** one named export per rule (data map or small pure function) with a one-line *why*, in its owner per C29; analytics' own composition rules all in `src/features/analytics/lib/analytics-rules.ts`; builder and aggregator hold no inline rule logic; CONTEXT.md `## Analytics terms` is the index (term → one-sentence rule → symbol + file); the verify script pins each rule with a numbered check. | 2026-09-26 |
| **C39** | **`additional_work` counts as a sit** in the sit map (the rep met the homeowner and sold more work). It only happens on project meetings (C43), so no lead-chain number changes. | 2026-09-26 |
| **C40** | **The meeting count covers every meeting row**, project or not; the meeting-order dimension narrows it. It is the base for outcome ratios. | 2026-09-26 |
| **C41** | **Under an event-level filter, booked leads and sits are tested against the booked lead's own meeting**; outcome and meeting-order filters make sales "not applicable" (a closer filter still applies to the sale meeting). | 2026-09-26 |
| **C42** | **"Funnel" means the marketing funnels only** — never the analytics chain. The per-person record is a **`LeadRecord`** (a lead is one person, C2); the meeting split is project meeting vs not (C43); its opposite is a project meeting); the chain lead → booked lead → sit → sale is "the lead chain"; feature-level types and files take the `Analytics` prefix (`AnalyticsFacts`, `AnalyticsFilters`, `AnalyticsCounts`, `ANALYTICS_RATES`, `analytics-rules.ts`). Spec A renamed to "Lead rules". | 2026-09-26 |
| **C43** | **No invented meeting term (amends C4, C42):** `additional_work` only ever happens on `Project` meetings, so the split is the stored type — a **project meeting** (`isProjectMeeting`) vs every other meeting, which works a lead toward its sale. Only non-project meetings book a lead or count as its sit; sits count once per lead (a lead who cancels, then sits on a follow-up, then buys = 1 sit). | 2026-09-26 |
| **C44** | **Grouping by closer keeps an unassigned row:** a meeting with no closer, and any sale on it, groups under a null key (the page labels it "Unassigned") instead of dropping out of the closer view. | 2026-09-27 |
| **C45** | **Placeholder phones are not screened for now.** A shared junk number (e.g. `0000000000`) can chain unrelated people into one lead (C3); gating phone keys on `isPlausibleUsPhone` is deferred until the tally shows it matters. | 2026-09-27 |
| **C46** | **Spec F v1 decisions (brainstorm 2026-09-27):** Q5 → build on Spec A's functions, the July engine is not reused; one server-built report per filter state; no period-over-period comparison, a 12-month trend with the selected period highlighted instead; Spec E folded into F; a period that covers part of a month counts that month's spend pro rata by days (the current month by days elapsed); a `none` spend mode for free sources; hygiene counts link out to pre-filtered records tables. **F10 (retiring the lead-sources analytics) moves out of F** into a separate cleanup spec at the end of the epic, so no visibility is lost before the new page has proven itself. | 2026-09-27 |

---

## 2. Open questions

| ID | Question | Blocks |
|---|---|---|
| ~~**Q1**~~ | ✅ Resolved → C28. **Vocabulary.** "Seat" vs "sit"; "appointment" as the customer-level analytics term vs `ubiquitous-language.md:261` ("Meeting, not appointment"); "setter", "closer", "junk lead", "valid lead", "total closes", "at risk". Owner agrees the terms once; A writes them to CONTEXT.md. | A |
| **Q2** | **#285 / #217 alignment for C20.** `#285` (`b40403b6`) keeps `meetings.ownerId` NOT NULL as a permission level (dispatcher-booked meetings are system-owned because the role lacks `own Meeting`; the planned agent `Meeting.delete` condition is `{ ownerId: me }`); #217 removes `owner` from participants because "ownership lives on `meetings.ownerId`". Both need rewriting to the `createdBy` + participants model before D. Who gains delete / full-update rights once `ownerId` is gone is a #285 ruling. | D |
| **Q3** | **Setter backfill targets.** Do past setters have user accounts? Is the setter a column (`setBy`) only, or also a participant role? (C20 says column.) What date ranges? | D |
| ~~**Q4**~~ | ✅ Resolved → C30. **Person identity: computed on read or stored?** Chained phone/email matching is a connected-components problem. Options for spec A: recursive CTE on read · a stored person / cluster id maintained at intake + backfill · a derived table refreshed by a job. | A |
| **Q5** | **Reuse the July engine** (`domains/analytics/` source → metric → resolver) with a different grouping key, or compose directly from module building blocks? | F |
| **Q6** | **How a cancellation is dated** (B): a `cancelledAt`-style column set on the stage change, or a project stage-change history (which would also unlock project-velocity KPIs later). | B |
| ~~**Q7**~~ | ✅ Resolved → C29 (B confirms its two). **Where the rule modules live** (B, A): recommendation = projects module owns "is this project's money still bankable"; proposals module owns "what is a signed contract and its value"; confirm per rule at spec time. | A, B |

---

## 3. Requirements

### A — Lead rules + person identity (no UI)

- [x] **A1** One definitions module per rule, consumed by analytics and any other screen that shows these numbers (C27): lead, appointment, seat, new sale, total closes, revenue, cancelled, net, junk / valid / test. Cancelled / net are wired by B through `projectBankability`; junk / test by C through `LeadRecord.quality`.
- [x] **A2** Person identity per C3: normalized phone OR email, chained; the person's lead date = the earliest record's `createdAt`; the person's source = the earliest record's source (C2, C14). Storage per Q4.
- [x] **A3** Every meeting / sale of any record in a cluster rolls up to the one person (no lead with zero appointments on one record and an appointment without a lead on another).
- [x] **A4** Seat classification per C4 as a named outcome set next to the existing sets in `src/shared/constants/enums/meetings.ts` (it is **not** `DID_NOT_OCCUR_OUTCOMES`, which would count `nra` as a sit).
- [x] **A5** Appointment per C8 and its month per C9.
- [x] **A6** Sale per C6, dated at signing; `kind` splits initial vs upsell (C11).
- [x] **A7** Event-month bucketing in **America/Los_Angeles**, never UTC (C7, C21).
- [x] **A8** Pure-portfolio projects (no meetings) never count (`hasAssociatedMeeting`, `src/shared/modules/projects/core/lib/visibility.ts:43`).
- [x] **A9** Glossary terms per Q1 in CONTEXT.md.

### B — Sales money rules

- [ ] **B1** "Signed value" and "still bankable" live in modules (Q7), consumed by the projects pipeline stat bar and analytics; the local `NON_BANKABLE_PROJECT_STAGES` list is deleted — the canonical source is `PROJECT_STAGE_BUCKET` (`src/shared/constants/enums/pipelines.ts`).
- [ ] **B2** Classification is **per project**, not per customer (§5 I4).
- [ ] **B3** A cancellation carries a date (Q6); gross / cancelled / net per C15.
- [ ] **B4** On hold stays in net and is reported as "at risk" (C16).
- [ ] **B5** `on_hold` ordered before `cancelled` in `projectPipelineStages` (C16).
- [ ] **B6** Resolve the name clash: "Total Opened" (not cancelled / on hold) vs the `opened` stage (§5 I6). Naming per Q1.

### C — Lead quality flags

- [ ] **N1** A customer can be marked **junk** or **test / internal** (C12) by a super-admin or dispatcher (C13); permission rows come from #285.
- [ ] **N2** A record whose phone or email matches a user account is internal automatically (proposed; confirm at spec time).
- [ ] **N3** Test / internal records are excluded from every metric; junk counts in gross leads only.
- [ ] **N4** Junk rate per source is a reported metric (evidence for vendor refund disputes).

### D — Setter = `meetings.setBy`

- [ ] **D1** `meetings.ownerId` → `setBy` semantics (C20); a super-admin can edit it, one meeting at a time or in bulk (records-management O8: a bulk "set setter" on the meetings records table).
- [ ] **D2** Participants are the assigned reps and the basis of meeting visibility (C20) — delivered with #285 (Q2).
- [ ] **D3** Setter captured at booking on every intake path (funnels, `/intake`, Bina webhook, website forms, dispatcher booking, reschedule rebook).
- [ ] **D4** Backfill past setters by date range (C18, Q3); system-owned (info@) rows are the targets; the script follows the repo's `--dry-run` + explicit-prod-go shape.
- [ ] **D5** #217 and #285 docs updated to the new model.
- [ ] **D6** Retire the `closedBy` name in code (owner, 2026-09-27: **setter** is the one term everywhere). Today it survives in intake: `leadMetaJSON.closedBy` (`src/shared/entities/customers/schemas/index.ts:57`), lead-source `closedByOptions` (`src/shared/entities/lead-sources/schemas.ts:16`), `ClosedByField`, the intake form schema and `add-customer-sheet.tsx`. Both keys are stored JSONB, so the rename needs a data migration; D3's capture work is the natural place. **Parked (owner, 2026-10-02; records tracker D58):** the rename happens when external setters are built, as part of migrating `closedByOptions` / `closedBy` into `lead_source_setters`, not before.

### E — Lead-source spend

- [x] **E1** Monthly spend per lead source stored on the lead-source entity (C17, C26).
- [x] **E2** Each source carries a spend mode (`manual` in v1; Meta and price-per-lead later, X3).
- [x] **E3** Cost per lead / appointment / seat / sale and revenue ÷ spend are defined in A's rule layer.

### F — Analytics feature v1

- [x] **F1** Route `src/app/(frontend)/dashboard/analytics/page.tsx` replaces the stub; super-admin only (the stub has no super-admin redirect today).
- [x] **F2** Nav item enabled (`src/features/agent-dashboard/lib/get-sidebar-nav.ts:106`).
- [x] **F3** One global filter bar (C21) applied to every tab (C23).
- [x] **F4** Overview: one row per source + a total row — leads, appointments, seats, sales, revenue, spend, cost per stage; conversion rates between stages.
- [x] **F5** Leads tab: gross vs valid, junk rate, duplicate rate, cost per lead, trend.
- [x] **F6** Appointments tab: appointments, seats, sit rate, outcome breakdown, unresolved `not_set` on past meetings, by setter.
- [x] **F7** Sales tab: new sales, total closes, revenue (initial vs upsell), cancelled, net, close rate, average ticket, by closer, "signed, no project".
- [x] **F8** Projects tab: stub (C25) — at most today's status-bucket counts.
- [x] **F9** Spend entry grid (month × source) inside Analytics (C26).
- [ ] **F10** `lead-sources-admin` absorbed (C22): its analytics procedures in `src/trpc/routers/lead-sources.router.ts` and its analytics UI are deleted in the same change (non-defensive migration); no raw `db` in routers (ADR-0002). Open: end-of-epic cleanup spec (C46).
- [x] **F11** A metric or dimension without data yet is shown as "not available yet", never faked.
- [x] **F12** Every number on the page is produced by A's rule layer — no metric logic in the feature's components or router.

---

## 4. Research findings (2026-09-24 / 26; verified where marked ✔)

### 4.1 Today's lead-sources dashboard (`src/features/lead-sources-admin/`, `src/trpc/routers/lead-sources.router.ts`)
- Funnel (Leads → Meetings → Proposals → Signed) is **cohort + event hybrid**: leads = customers created in range; later steps = those customers whose event also fell in range. The trend chart buckets each series on its **own** event timestamp → funnel and trend never reconcile.
- Meetings step has **no outcome filter** (cancelled, no-show, future meetings count). Signed = has a project, with no portfolio exclusion.
- `totalSales` is **lifetime** regardless of the range and includes additional-work proposals.
- "This month" chip = rolling 30 days ✔ (`constants/time-ranges.ts:27`). Buckets truncate in the DB session time zone (UTC); no Pacific handling.
- Raw `db` inside the router (ADR-0002 violation; flagged by the July spec).

### 4.2 Data available
- **Intake paths:** funnels (`funnels.router.ts:130` takes the slug from input; the `branded-meta-ads` hard-code is client-side in `shared/domains/funnels/lib/build-lead-input.ts:30` — corrected 2026-09-26), `/intake` + admin add-customer (`customers.router/business.router.ts:132`), Bina webhook (`app/api/webhooks/bina/route.ts`, no meeting), website forms (`landing.router/index.tsx:103`, bypasses `ingestLead`, no attribution row). Twilio line-type check runs on funnels, `/intake` and website (fail-open) ✔; not on Bina.
- **No dedup at intake** ✔ (`customer-intake.service.ts:58` always creates). Phones are normalized to 10 digits on write; no unique index on phone or email; no merge feature, no duplicate / test flags.
- **Meetings:** `scheduledFor` + `createdAt` only — no held-at timestamp; the sit is inferred from outcome. Reschedule cancels the original and books a new row. Participants carry `owner | co_owner | helper`. `ownerId` can be the info@ system account.
- **Addresses:** `customers.city` and `customers.zip` are NOT NULL ✔ (`customers.ts:18-20`) — but website leads write `city='Unknown'`, `zip=''` (`landing.router/index.tsx`), so the dimension needs an unknown bucket (39 rows, §7); street address is optional; meetings have no address of their own.
- **Sales:** Zoho completion auto-approves the proposal ✔ (`contracts.service.ts:199`) and creates **no** project; projects are created by an agent action ✔ (`projects.router/business.router.ts`). `finalTcpCents` null = not computed, not $0. `kind` = `initial-sale | additional-work`.
- **Spend:** none stored outside the Meta insights provider (July work, unused).
- **Outcome sets in code** ✔ (`src/shared/constants/enums/meetings.ts:115-136`): `DECIDED_OUTCOMES`, `LIVE_MEETING_OUTCOMES`, `DID_NOT_OCCUR_OUTCOMES`.

### 4.3 "Total Signed / Total Opened" today ✔
- `src/features/customer-pipelines/constants/projects-stat-config.ts`: Signed = Σ approved proposal values; Opened = the same minus stages `cancelled` / `on_hold`, computed in the browser over pipeline rows.
- Values from `computeProjectValue` (`src/shared/domains/pipelines/lib/compute-pipeline-value.ts`): all approved proposals, initial and additional work.

---

## 5. Present-day issues found (independent of this epic; none fixed)

| ID | Issue | Fixed by |
|---|---|---|
| **I1** | "This month" chip is a rolling 30 days (`lead-sources-admin/constants/time-ranges.ts:27`). | F10 (absorbed) |
| **I2** | Lead-sources funnel and trend use different counting bases and never reconcile. | A, F |
| **I3** | `totalSales` is lifetime whatever the range, and includes upsells. | A, F |
| **I4** | Projects pipeline rows are per **customer**: one project's stage (`get-customer-pipeline-items.ts:379-384`) classifies the value of **all** the customer's projects. | B2 |
| **I5** | `NON_BANKABLE_PROJECT_STAGES` re-encodes the canonical `PROJECT_STAGE_BUCKET`. | B1 |
| **I6** | "Opened" means both a stage and "not cancelled / on hold". | B6 |
| **I7** | `converted_to_project` can be picked by hand once an approved proposal exists, creating no project (`get-disabled-outcomes.ts`). | X1 |
| **I8** | Project scopes are extracted from **all** proposals on the meeting, not the signed one (`projects.router/business.router.ts:71`) — wrong once a meeting holds alternatives. | X1 |
| **I9** | `customers.leadType` is never written by any code path. | (note only) |
| **I10** | The `/dashboard/analytics` stub has no super-admin redirect. | F1 ✔ fixed (page redirects non-super-admins) |
| **I11** | A third meaning of "signed": `entities/customers/lib/signed-customer-sql.ts` = "has a project" (the pipeline bucket), and its `EXISTS_PROJECT` SQL is duplicated in `derived-pipeline-sql.ts`. | A (dedup + comment) |
| **I12** | No shared Pacific-time helper: `features/agent-dashboard/lib/meeting-windows.ts` owns `BUSINESS_TIMEZONE`; six other files inline `'America/Los_Angeles'`. | A (moves the helper to `shared/lib/business-time.ts`; the six stay) |
| **I13** | No shared email normalizer; customer email is stored as typed. | A (read-time `normalizeEmail`) |

---

## 6. Deferred (not scheduled; each opens as a Q-id when started)

| ID | Item | Note |
|---|---|---|
| **X1** | **Auto-create the project when an initial-sale contract is signed** (no popup); additional-work signing attaches to the existing project. Reverses the documented manual decision (`src/shared/modules/proposals/core/DOCS.md#conversion-trigger`). Must take scopes from the signed proposal only (I8), retire the hand-picked `converted_to_project` (I7), and rule on `assignToProject`. Until it ships, a contract cancelled before its project exists can't be marked cancelled (B3 gap). | owner deferred 2026-09-24 |
| **X2** | Meeting-quality KPIs over time. | C5 |
| **X3** | Automatic spend: Meta insights, price-per-lead × valid leads. | C17 |
| **X4** | Meta ad / campaign drill-down (the July spec's scope). | C21 |
| **X5** | Trade dimension — after JSONB Wave 4. | C21 |
| **X6** | Payments / collections — through the project-management feature. | C24 |
| **X7** | Repeat-customer sales cycles. | C10 |

---

## 7. Manual data hygiene tally (owner fixes by hand; code never writes these)

Re-run the criteria read-only before each spec; update counts and date. Last read: **prod, 2026-09-27**, via Spec A's loaders (`loadAnalyticsFacts` → `buildLeadRecords` → `aggregateLeadRecords`): `{ customers: 767, leads: 754, orphans: 0 }`; all-time `totalCloses: 39` (`newSales: 24` + upsells), `hygiene.unresolvedMeetings: 27`, `hygiene.newSalesWithoutProject: 0`, `hygiene.unknownCityZip: 31` (per-person after dedup, so lower than H3's raw per-customer 39 — expected); `undatedSales: 5` both all-time and for the current business month (2026-09). All figures match the hand tally within what dedup explains; no rule changed.

| ID | Item | Count | Criteria | Why it matters |
|---|---|---|---|---|
| **H1** | Approved proposals with no `approvedAt` (undated sales, C32) | 5 | `status='approved' AND approved_at IS NULL` — ids `6c29a52c-7251-4891-98d3-077860b695c3`, `afa1677c-daf6-48ff-b638-807d55228e79`, `bedfd349-b9a7-4735-ac11-9427d64ebf2c`, `48c765fe-c127-4426-bf41-25978aa51ec4`, `93097676-7fc0-4729-84b8-b08f6637d130` (all last updated 2026-08-11) | Excluded from every month's sales until dated |
| **H2** | Past meetings still `not_set` | 27 | `meeting_outcome='not_set' AND scheduled_for < now()` | Never a sit; understates sits and sit rate |
| **H3** | Customers with unknown city / zip | 39 | `city IN ('Unknown','') OR zip = ''` (website intake) | Land in the "unknown" city/zip bucket |
| **H4** | Initial sales with no project ("signed, no project") | 0 | approved `initial-sale` whose meeting has no `project_id` | Hygiene check (C6) |
| **H5** | Junk / test leads to mark | — | needs Spec C's flags | Test leads inflate total leads until marked |
| **H6** | Setters to backfill | — | needs Spec D (Q3 date ranges) | Setter dimension dark until done |
| **H7** | Monthly spend per source | — | needs Spec E's grid (F9) | Cost-per-stage dark until entered |

