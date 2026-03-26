# Meetings Complete Overhaul — Design Spec

**Issue**: #40
**Branch**: `feat/40-feat-meetings-complete-overhaul-schema-l`
**Date**: 2026-03-25
**Approach**: Full Rebuild (Approach A)

---

## 1. Overview

Complete overhaul of the meeting flow — schema, logic, and UX. The meeting flow is reframed from agent-facing tooling with two disconnected modes (intake + program) into a **single continuous journey** the agent walks through with the customer.

### Core Reframe

- **Old**: Two modes (Intake for profiling, Program for presenting). Agent-facing. Programs are heavy narrative engines with 5-6 steps each.
- **New**: Single 7-step journey. Mostly customer-facing. Programs are lean incentive packages. Context (profiling) is a persistent panel accessible at any time.

### Design Principles

- The meeting is a **customer journey**, not a data entry form
- Steps map to the due diligence story and in-home meeting playbook
- Dynamic content: the more context captured, the sharper each step becomes
- Media and visuals are front-and-center on customer-facing steps
- Agent-private work (deal structure, notes) is accessible but doesn't pollute the presentation
- Every piece of data collected feeds forward — into later steps and ultimately into the proposal

---

## 2. Schema Changes

### Migration Safety

**Sacred invariant**: `meetings.customerId` FK to `customers.id` must survive every schema change. All meeting records are expendable; customer relationships are not.

**Strategy**: Add new columns first, then drop old columns. Since meeting records are unused in production, no data migration is needed for meeting-level data.

### Meetings Table

**Columns kept as-is:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | No change |
| `ownerId` | text FK → `user.id` | No change |
| `customerId` | UUID FK → `customers.id` | **Protected** — sacred link |
| `scheduledFor` | timestamp | No change |
| `createdAt` | timestamp | No change |
| `updatedAt` | timestamp | No change |

**Columns removed:**

| Column | Reason |
|--------|--------|
| `contactName` | Redundant — customer has name |
| `type` | Replaced by `meetingType` enum column |
| `program` | Moves into `flowStateJSON.selectedProgram` |
| `status` | Replaced by `meetingOutcome` enum |
| `situationProfileJSON` | Replaced by `contextJSON` |
| `programDataJSON` | Absorbed into `flowStateJSON` |
| `meetingScopesJSON` | Absorbed into `flowStateJSON.tradeSelections` |

**Columns added:**

| Column | Type | Purpose |
|--------|------|---------|
| `meetingType` | pgEnum (`Fresh`, `Follow-up`, `Rehash`) | Proper enum replacing text `type` column |
| `meetingOutcome` | pgEnum (`in_progress`, `proposal_created`, `follow_up_needed`, `not_interested`, `no_show`) | Agent-controlled post-meeting label |
| `contextJSON` | JSONB → `meetingContextSchema` | Persistent context panel data (pre-meeting + during-meeting observations) |
| `flowStateJSON` | JSONB → `meetingFlowStateSchema` | Per-step collected data, trade selections, deal structure, selected program |
| `agentNotes` | text | Free-form private notes |

### New pgEnums (in `meta.ts`)

```typescript
// Replace existing meetingStatusEnum
export const meetingTypeEnum = pgEnum('meeting_type', meetingTypes)
export const meetingOutcomeEnum = pgEnum('meeting_outcome', meetingOutcomes)
```

New const arrays in `src/shared/constants/enums/meetings.ts`:

```typescript
export const meetingOutcomes = [
  'in_progress',
  'proposal_created',
  'follow_up_needed',
  'not_interested',
  'no_show',
] as const
```

### Customer Table — No Changes

`customerProfileJSON`, `propertyProfileJSON`, `financialProfileJSON` stay exactly as-is. The context panel reads/writes to these via the existing `customersRouter.updateProfile` mutation.

---

## 3. JSONB Schemas

### `meetingContextSchema`

Replaces `situationProfileSchema`. Holds all context panel data.

```typescript
export const meetingContextSchema = z.object({
  // Pre-meeting fields (filled before/at meeting start)
  decisionMakersPresent: z.enum(meetingDecisionMakersPresentOptions),
  preKnownPainPoints: z.array(z.string()),
  preKnownTrades: z.array(z.string()),
  preMeetingNotes: z.string(),

  // During-meeting observations (filled as conversation progresses)
  observedUrgency: z.number().int().min(1).max(10),
  observedBudgetComfort: z.enum(observedBudgetComforts),
  spouseDynamic: z.enum(spouseDynamics),
  customerDemeanor: z.enum(customerDemeanors),
}).partial()
```

New enums needed:

```typescript
export const observedBudgetComforts = ['comfortable', 'hesitant', 'resistant'] as const
export const spouseDynamics = ['aligned', 'one-skeptical', 'not-present', 'n-a'] as const
export const customerDemeanors = ['engaged', 'guarded', 'enthusiastic', 'anxious'] as const
```

### `meetingFlowStateSchema`

New schema. Holds per-step collected data and deal structure.

```typescript
export const tradeSelectionSchema = z.object({
  tradeId: z.string(),
  tradeName: z.string(),
  selectedScopes: z.array(z.object({ id: z.string(), label: z.string() })),
  painPoints: z.array(z.string()),
  notes: z.string(),
}).partial({ notes: true })

export const dealStructureSchema = z.object({
  mode: z.enum(['finance', 'cash']),
  startingTcp: z.number(),
  incentives: z.array(z.object({
    label: z.string(),
    amount: z.number(),
    source: z.string(),
  })),
  finalTcp: z.number(),
  // Finance-specific
  financeTermMonths: z.number().optional(),
  apr: z.number().optional(),
  monthlyPayment: z.number().optional(),
  // Cash-specific
  depositAmount: z.number().optional(),
  depositPercent: z.number().optional(),
})

export const closingAdjustmentsSchema = z.object({
  scopeChanges: z.array(z.string()),
  finalNotes: z.string(),
}).partial()

export const meetingFlowStateSchema = z.object({
  currentStep: z.number().int().min(1).max(7),
  // Step 2: Trade & Pain selections
  tradeSelections: z.array(tradeSelectionSchema),
  // Step 4: Program
  selectedProgram: z.string().nullable(),
  programQualified: z.boolean(),
  // Step 5: Deal Structure
  dealStructure: dealStructureSchema,
  // Step 6: Closing adjustments
  closingAdjustments: closingAdjustmentsSchema,
}).partial()
```

---

## 4. Flow Architecture

### Single Entry Point

One view (`MeetingFlowView`) with step-based navigation. No mode toggle.

```
+--------------------------------------------------+
|  Header: Back | Step title | Meeting info         |
+--------------------------------------------------+
|                                                    |
|         Step Content (dynamic per step)            |
|                                                    |
|   Customer-facing: large, clean, media-rich        |
|   Agent-facing (step 5): denser, form-heavy        |
|                                                    |
+--------------------------------------------------+
|  Footer: Prev | Step indicators | Next             |
|  Context panel toggle (always accessible)          |
+--------------------------------------------------+
```

### Context Panel

Persistent slide-out drawer (left side on desktop, overlay on mobile). Triggered by a floating button with field completion badge. Contains:

- **Section 1 — Pre-Meeting**: DMs present, pre-known pain points, pre-known trades, prep notes
- **Section 2 — Customer Profile**: Reads/writes to `customers.customerProfileJSON` (age group, trigger event, outcome priority, family status, household type, time in home, sell plan, prior contractor experience, decision timeline, decision urgency, project necessity, construction outlook)
- **Section 3 — Property**: Reads/writes to `customers.propertyProfileJSON` (year built, HOA)
- **Section 4 — Financial**: Reads/writes to `customers.financialProfileJSON` (credit score, quotes received)
- **Section 5 — Agent Observations**: Writes to `meetings.contextJSON` (observed urgency, budget comfort, spouse dynamic, customer demeanor)
- **Section 6 — Outcome**: Writes to `meetings.meetingOutcome` column (also accessible from Step 6)

**Data flow**: Sections 1, 5, 6 write to `meetings` table. Sections 2, 3, 4 write to `customers` table via `customersRouter.updateProfile`. Same routing pattern as current `handleFieldSave`.

---

## 5. Step Definitions

### Step 1 — "Navigating the Construction Industry"

- **Audience**: Customer-facing (first impression)
- **Purpose**: Who we are. Due diligence story framing. Establish authority + trust.
- **Content**: TPR credentials (license, insurance, warranty), the 6-point due diligence framework, message: "We're here to educate you, not sell you."
- **Media**: Company photos, license badge, team photo, warranty badge
- **Psychological levers**: Authority transfer, identity alignment ("smart homeowners do this")
- **Data collected**: None directly — context panel handles pre-meeting data
- **Maps to**: Playbook Phase 2 (Trusted Contractor Presentation) + Due Diligence Story

### Step 2 — "Which Specialties Matter to You"

- **Audience**: Customer-facing (agent guides selections)
- **Purpose**: Identify trades, drill into pain points per trade, select relevant scopes
- **Content**: Trade cards with outcome-focused labels ("Stop the leaks", "Cut your energy bill", "Make it beautiful"). On trade selection → expand to show: pain point multi-select (from `meetingPainTypes`), relevant scopes from that trade, contextual notes.
- **Media**: Trade-specific hero images, scope example photos
- **Psychological levers**: Fear inoculation (pain-first framing), commitment & consistency
- **Data collected**: `flowStateJSON.tradeSelections[]` — trades, scopes, pain points per trade
- **Dynamic behavior**: Selected trades feed into Step 4 (program qualification) and Step 3 (portfolio filtering)
- **Maps to**: Playbook Phase 1 (Discovery) + Phase 3 (Scope of Work) combined

### Step 3 — "Past References & Projects"

- **Audience**: Customer-facing (proof of performance)
- **Purpose**: Social proof. Show real completed projects relevant to their trades/scopes.
- **Content**: Portfolio projects from `showroom` database, filtered by trades selected in Step 2. Fallback to other public projects if insufficient matches. Before/after photos, testimonials, project narratives.
- **Media**: Project photos from R2 (hero images, before/after pairs), homeowner testimonials
- **Psychological levers**: Social proof, contrast effect
- **Data collected**: None — presentation step only
- **Dynamic behavior**: Query showroom projects where scope matches Step 2 selections. Order by matched scope count (most relevant first), then recency. If fewer than 2 matches, backfill with other public projects.
- **Maps to**: Due Diligence Point 6 (Proof of Performance)

### Step 4 — "Picking the Right Path"

- **Audience**: Customer-facing (with qualification logic visible)
- **Purpose**: Present available programs, explain "why now", select or proceed without program
- **Content**: Two-phase step:
  1. **Selection**: Program cards showing name, qualification status (qualified/not qualified with reason), tagline, incentive summary. Plus "Standard Pricing" option.
  2. **Presentation** (after selection): Selected program's condensed presentation — story, history, timeline, FAQ accordion, key stats.
- **Media**: Minimal — program badges/icons
- **Psychological levers**: Scarcity (time-bounds), loss aversion
- **Data collected**: `flowStateJSON.selectedProgram`, `flowStateJSON.programQualified`
- **Qualification logic**: Pure function: `(tradeSelections, customer, meetingType) => QualificationResult[]`
- **Maps to**: New concept — program as incentive package with condensed story

### Step 5 — "Deal Structure"

- **Audience**: Agent-facing (private — denser UI, form-heavy)
- **Purpose**: Build pricing and financing structure
- **Content**: Finance vs. Cash toggle. TCP from selected scopes. Program incentives auto-applied. Monthly payment preview (finance) or deposit structure (cash). Tax credits/rebates shown only if Energy Saver+ selected.
- **Media**: None
- **Data collected**: `flowStateJSON.dealStructure` — mode, TCP, incentives, terms, payments
- **Dynamic behavior**: TCP auto-calculates from scope base prices. Program incentives auto-deduct. Finance terms show real-time monthly payment.
- **Maps to**: Playbook Phase 4 (Pricing & Financing)

### Step 6 — "Closing Summary"

- **Audience**: Customer-facing (interactive confirmation)
- **Purpose**: Visual recap. Agent can adjust live (swap scope, change term). Verbal close happens here.
- **Content**: Summary cards for scopes, program, price, monthly payment/cash structure, timeline, warranty. Each section editable.
- **Media**: Minimal — clean summary, possibly scope thumbnails
- **Psychological levers**: Commitment & consistency, the reframe
- **Data collected**: `flowStateJSON.closingAdjustments`, outcome label accessible here
- **Maps to**: Playbook Phase 5 (Close)

### Step 7 — "Create Proposal"

- **Audience**: Agent-facing (transition action)
- **Purpose**: Transfer meeting context to proposal builder
- **Implementation**: Button navigates to proposal flow with `?meetingId={id}`. Proposal flow reads meeting and pre-fills form.

---

## 6. Program Model

### Structure

Programs shift from heavy narrative engines (5-6 steps with body text, dynamic functions, case studies per step) to **lean incentive packages** with a condensed presentation.

```typescript
interface MeetingProgram {
  accessor: string
  name: string                        // Dynamic (e.g., "March Priority Program")
  tagline: string
  accentColor: 'amber' | 'sky' | 'violet'
  qualify: (ctx: QualificationContext) => QualificationResult
  incentives: ProgramIncentive[]
  expiresLabel: string                // Dynamic from getMonthEnd()
  presentation: {
    story: string                     // Why this program exists
    history: string                   // TPR history relevant to this program
    timeline: string                  // What happens after signing
    faqs: { question: string; answer: string }[]
    keyStats: { label: string; value: string }[]
  }
}
```

### Qualification

```typescript
interface QualificationContext {
  tradeSelections: TradeSelection[]
  customer: Customer | null
  meetingType: MeetingType
}

interface QualificationResult {
  qualified: boolean
  reason: string
  matchedCriteria: string[]
  missedCriteria: string[]
}
```

### The 3 Programs

**TPR Monthly Special** (always available):
- Qualification: Every customer qualifies
- Why now: Dynamic month-based urgency (supplier contract, install slots)
- Incentives: Material upgrade ($800), warranty extension ($400), free attic inspection ($200)

**Energy Saver+**:
- Qualification: At least 1 energy-efficient trade selected (Insulation, HVAC, Windows, Solar)
- Why now: Federal IRA 25C credits have annual caps, utility rebate programs fill up
- Incentives: IRA 25C tax credit (up to 30%), LADWP rebate (up to $3,000), energy audit
- Note: Tax credits/rebates only appear in Deal Structure (Step 5) when this program is selected

**Existing Customer Savings+**:
- Qualification: Customer has prior completed project with TPR
- Why now: Loyalty pricing window, priority scheduling this month
- Incentives: 20% loyalty labor discount, priority scheduling, VIP warranty (+2 years), no mobilization fee

### "No Program" Path

"Standard Pricing" option always available. If selected:
- `flowStateJSON.selectedProgram = null`
- Step 5 shows standard pricing with no incentive deductions
- Step 6 shows scopes + pricing without program branding

### Energy-Efficient Trade Classification

```typescript
export const energyEfficientTradeAccessors = [
  'insulation', 'hvac', 'windows', 'solar',
] as const
```

---

## 7. Portfolio Integration (Step 3)

### Query

New tRPC procedure: `meetingsRouter.getPortfolioForMeeting`

**Input**: `{ tradeSelections: [{ tradeId, selectedScopes: [{ id }] }] }`

**Logic**:
1. Collect all `scopeId`s from trade selections
2. Query `projects` with `x_projectScopes` where `scopeId` matches any selected scope AND `isPublic = true`
3. Include `mediaFiles` relation — hero images, before/after pairs, phase-tagged media
4. Order by: matched scope count (desc), then `completedAt` (desc)
5. Fallback: If fewer than 2 matches, backfill with other public projects (no scope filter)

**Return type**: Derived from Drizzle relational query (project + mediaFiles + projectScopes). Add computed `matchedScopeCount` at query level — no new complex type definitions.

### Step 3 UI

Each project rendered as a full-width card:
- Hero image prominent
- Before/after slider (if pairs exist)
- Challenge → Solution → Result narrative
- Homeowner quote
- City + duration as metadata
- Matched scope badges showing relevance

Agent navigates between 2-4 projects.

---

## 8. Proposal Data Transfer (Step 7)

### Field Mapping

| Meeting Source | Proposal Target |
|---|---|
| `flowStateJSON.tradeSelections` (trades + scopes) | `projectJSON.data.sow[]` — each trade becomes a SOW entry |
| `flowStateJSON.dealStructure.startingTcp` | `fundingJSON.data.startingTcp` |
| `flowStateJSON.dealStructure.finalTcp` | `fundingJSON.data.finalTcp` |
| `flowStateJSON.dealStructure.incentives[]` | `fundingJSON.data.incentives[]` — mapped to discriminated union |
| `flowStateJSON.dealStructure.depositAmount` | `fundingJSON.data.depositAmount` |
| `flowStateJSON.dealStructure.mode === 'cash'` | `fundingJSON.data.cashInDeal` — set to finalTcp if cash, 0 if finance |
| `meeting.id` | `proposals.meetingId` — FK link preserved |
| `meeting.ownerId` | `proposals.ownerId` |
| Customer pain points + trigger event | `projectJSON.data.projectObjectives[]` — auto-generated |
| Trade locations | `projectJSON.data.homeAreasUpgrades[]` — mapped from scope metadata |
| Program expiration | `projectJSON.data.validThroughTimeframe` — from program or default "60 days" |

### Transfer Mechanism

Existing pattern: proposal flow accepts `?meetingId={id}`, reads meeting via `meetingsRouter.getById`, pre-fills form. The proposal flow's initialization logic is updated to read from `flowStateJSON` instead of old `programDataJSON`.

### Agent Still Fills Manually

- SOW narrative content (contentJSON/html per scope)
- Project label and summary
- Pricing breakdown details
- Finance option selection
- Agreement notes

---

## 9. What Gets Deleted

### Constants
- `MEETING_PROGRAMS` in `programs.ts` — entire heavy narrative structure
- `step-content.ts` — hardcoded package items, financing rows, stories, close summary rows
- `framing-types.ts` — `framingTypes` constant
- `program-accent-map.ts` — absorbed into lean program model
- `incentives.ts` — absorbed into program incentive definitions

### Components
- `steps/package-step.tsx` — old program step
- `steps/financing-step.tsx` — old program step
- `steps/stories-step.tsx` — old program step
- `steps/close-step.tsx` — old program step
- `program-quick-pick.tsx` — replaced by in-flow selection at Step 4
- `program-card.tsx` — replaced by new program card
- `buy-trigger-bar.tsx` — old buy trigger UI
- `case-study-panel.tsx` — replaced by portfolio integration
- `case-study-content.tsx` — replaced by portfolio integration
- `data-collection-panel.tsx` — replaced by context panel
- `step-data-panel.tsx` — replaced by context panel
- `step-data-content.tsx` — replaced by context panel

### Schemas
- `situationProfileSchema` in `entities/meetings/schemas.ts` — replaced by `meetingContextSchema`
- `programDataSchema` in `entities/meetings/schemas.ts` — absorbed into `meetingFlowStateSchema`
- `tpr-monthly-special-schema.ts` in `features/meetings/schemas/` — no longer needed
- `base-meeting-form-schema.ts` in `features/meetings/schemas/` — replaced by new flow

### pgEnums
- `meetingStatusEnum` — replaced by `meetingOutcomeEnum`

---

## 10. Migration Changelog

| Action | Column | Before | After |
|--------|--------|--------|-------|
| ADD | `meetingType` | — | pgEnum `meeting_type` (`Fresh`, `Follow-up`, `Rehash`) |
| ADD | `meetingOutcome` | — | pgEnum `meeting_outcome` (`in_progress`, `proposal_created`, `follow_up_needed`, `not_interested`, `no_show`) |
| ADD | `contextJSON` | — | JSONB → `meetingContextSchema` |
| ADD | `flowStateJSON` | — | JSONB → `meetingFlowStateSchema` |
| ADD | `agentNotes` | — | text, nullable |
| DROP | `contactName` | text | — |
| DROP | `type` | text | — (replaced by `meetingType`) |
| DROP | `program` | text | — (moved to `flowStateJSON.selectedProgram`) |
| DROP | `status` | pgEnum `meeting_status` | — (replaced by `meetingOutcome`) |
| DROP | `situationProfileJSON` | JSONB | — (replaced by `contextJSON`) |
| DROP | `programDataJSON` | JSONB | — (absorbed into `flowStateJSON`) |
| DROP | `meetingScopesJSON` | JSONB | — (absorbed into `flowStateJSON.tradeSelections`) |

**Protected**: `id`, `ownerId`, `customerId`, `scheduledFor`, `createdAt`, `updatedAt` — all untouched.

---

## 11. Cross-References

- `docs/sales/due-diligence-story.md` — 6-point framework mapped to Step 1
- `docs/sales/in-home-meeting-playbook.md` — 5 phases mapped across Steps 1-6
- `docs/customer/decision-psychology.md` — Psychological levers applied per step
- `docs/customer/journey-map.md` — Stage 3 (Evaluation) is the meeting
- `docs/domain/ubiquitous-language.md` — Canonical terms used throughout
