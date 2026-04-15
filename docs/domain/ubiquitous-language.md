# Ubiquitous Language — Tri Pros Remodeling

> Living glossary of canonical terms. Every AI session, PR, and issue MUST use these terms exactly.
> Updated: 2026-03-23

## Single Unit Folder Structure

A **Single Unit** is any self-contained domain module in the codebase. Every single unit follows the same internal folder structure — this is the fractal pattern that repeats at every level of the architecture.

### Base Subdirectories

| Subdirectory | Contains | File Pattern |
|---|---|---|
| `constants/` | Static data, config objects, display arrays, lookup maps | `kebab-case.ts` |
| `hooks/` | Custom React hooks | `use-*.ts` |
| `lib/` | Pure utility/helper functions (no React, no side effects) | `verb-noun.ts` |
| `components/` | React components (props-driven, reusable within this unit) | `kebab-case.tsx` |
| `schemas/` | Zod validation schemas + inferred types (`schemas/index.ts` is the base) | `*-schema.ts` or `index.ts` |
| `types/` | TypeScript interfaces/types not derived from schemas | `index.ts` or `domain.ts` |
| `ui/` | Views (`ui/views/`) and feature-specific components (`ui/components/`) | Only in features |
| `dal/` | Data Access Layer — `server/` and `client/` subdirs | Only where DB access needed |

Not every subdirectory is required — only create what the unit needs. The structure is the same whether the unit is a feature, an entity, a domain system, or the root `shared/` level.

### Where the pattern appears

```
shared/                              ← Single Unit (root shared level)
├── constants/, hooks/, lib/, components/, types/, dal/, ...

shared/entities/customers/           ← Single Unit (entity)
├── constants/, hooks/, lib/, components/, schemas/, types/

shared/entities/meetings/            ← Single Unit (entity)
├── constants/, hooks/, components/, schemas/

shared/pipelines/                    ← Single Unit (domain system)
├── constants/, hooks/, lib/, types/, ui/

shared/auth/                         ← Single Unit (domain system)
├── hooks/, lib/, schemas/

features/meeting-flow/               ← Single Unit (feature)
├── constants/, hooks/, lib/, types/, ui/

features/customer-pipelines/         ← Single Unit (feature)
├── constants/, hooks/, lib/, types/, ui/, dal/
```

### The distinction test

A directory is a **Single Unit** (domain/entity/feature) when it has 2+ of these subdirectories. A directory that contains only files (no subdirectories) is a leaf — part of a parent unit's structure, not a unit itself.

---

## Core Entities

| Term | Definition | Code Location |
|------|-----------|---------------|
| **Customer** | A homeowner or prospect engaged with Tri Pros. Primary entity — everything flows from here. | `db/schema/customers.ts` |
| **Meeting** | An in-home consultation between agent and customer. Captures situation + program data as JSONB. | `db/schema/meetings.ts` |
| **Proposal** | Formal document: scopes, SOWs, pricing, financing. Statuses: `draft → sent → approved → declined`. | `db/schema/proposals.ts` |
| **Project** | A construction engagement at a specific address. Created at contract signing. Lifecycle: `active → completed → on_hold`. When `isPublic = true`, appears in portfolio/showroom. | `db/schema/projects.ts` |

## Construction Hierarchy

```
Trade (discipline)
  └─ Scope (work package)
       ├─ Material (product)
       ├─ Variable (configurable param)
       ├─ Addon (optional upgrade)
       └─ SOW (scope of work — narrative document)
```

| Term | Definition | Example |
|------|-----------|---------|
| **Trade** | A construction specialty. Has `location` (exterior/interior/lot). | Roofing, HVAC, Solar, Windows |
| **Scope** | A defined unit of work within a trade. Atomic proposal building block. | "Full Roof Replacement", "Attic Insulation" |
| **SOW** (Scope of Work) | Detailed narrative describing work included in a scope: materials, labor, timeline, exclusions. | Stored as TipTap JSON + HTML |
| **Material** | A specific product used in a scope. Has lifespan + warranty. | Tesla Solar Roof, GAF Timberline |
| **Addon** | Optional upgrade to a scope. Incremental upsell. | Premium paint, extended warranty |
| **Variable** | Configurable field that affects SOW content. Types: text, select, number, boolean. | Roof pitch, HVAC capacity |
| **Benefit** | A value proposition tied to a trade/scope/material. Grouped by category. | Energy savings, durability |

## Sales & Pricing

| Term | Definition |
|------|-----------|
| **TCP** (Total Contract Price) | Total project cost. `startingTcp` = initial quote, `finalTcp` = after incentives. |
| **Incentive** | Discount, tax-credit, cash-back, or exclusive-offer. Reduces TCP. Types: `discount \| tax-credit \| cash-back \| exclusive-offer \| other`. |
| **Finance Option** | A loan product (term, APR, provider). Customer selects one per proposal. |
| **Finance Provider** | Lending company (Tesla, Sunrun, Mosaic, banks). Has many finance options. |

## Customer Profiling

| Term | Definition | Stored On |
|------|-----------|-----------|
| **Pain Point** | Customer's problem/frustration. Has `accessor` + `urgencyRating` (1-10). | `customers.customerProfileJSON` |
| **Trigger Event** | Recent catalyst that prompted contact (leak, high bill, neighbor's project). | `customers.customerProfileJSON` |
| **Outcome Priority** | What matters most: Price, Quality, or Speed. | `customers.customerProfileJSON` |
| **Customer Persona Profile** | Synthesized sales intelligence object. Joins customer/meeting JSONB data with Notion pain points to produce fears, benefits, decision drivers, emotional levers, household resonance, and risk factors — all contextualized to selected trades. | Generated at runtime (not stored) |
| **Decision Timeline** | When they want to act: ASAP, 1-3mo, 3-6mo, 6+mo, Not sure. | `customers.customerProfileJSON` |
| **Decision Urgency** | How urgent the need feels (1-10 scale). Distinct from timeline. | `customers.customerProfileJSON` |
| **Credit Score Range** | Self-reported bracket. Predicts financing approval. | `customers.financialProfileJSON` |
| **DMs Present** | Who attended the meeting. All, Only husband, Only wife, Partial, None. | `meetings.situationProfileJSON` |

## Pipeline & Lifecycle

| Term | Definition |
|------|-----------|
| **Pipeline** | Business-wide workflow track: `fresh` (new sales), `projects` (active construction), `rehash` (re-engagement), `dead` (archived). Derived from meetings + projects — not stored on customer. A customer can appear in multiple pipelines simultaneously. |
| **Pipeline (on meeting)** | Stored field: `fresh \| rehash \| dead`. If `meeting.projectId` is set, effective pipeline is `projects` (overrides stored field). |
| **Fresh Pipeline Stage** | Computed from meetings + proposals: `needs_confirmation → meeting_scheduled → meeting_in_progress → meeting_completed → follow_up_scheduled → proposal_sent → contract_sent → approved \| declined`. |
| **Projects Pipeline Stage** | Stored on project: `signed → permits_pending → in_progress → punch_list → completed`. |
| **SFH** (Single Family Home) | A residential structure type — the primary unit of work. A project is typically associated with a single SFH at a unique physical address. |
| **Lead Source** | Acquisition channel: `telemarketing_philippines`, `noy`, `quoteme`, `other`. |
| **Lead Type** | Qualification state: `appointment_set`, `needs_confirmation`, `manual`. |
| **Proposal View** | A tracked event when customer opens their proposal link. Source: email, direct, unknown. |

## User Roles

| Role | Access |
|------|--------|
| `user` | Basic app access |
| `homeowner` | Views own proposal via token |
| `agent` | Full sales + dashboard. Auto-assigned for `@triprosremodeling.com` signups. |
| `super-admin` | System admin. Can delete, manage all. |

## Features (Application Modules)

| Feature | Slug | Description |
|---------|------|-------------|
| Agent Dashboard | `agent-dashboard` | Central hub: action center, pipeline toggle, activity |
| Customer Pipelines | `customer-pipelines` | Kanban + table view of customers by stage |
| Meeting Flow | `meeting-flow` | Calendar, intake form, program flow, past meetings |
| Proposal Flow | `proposal-flow` | Multi-step proposal builder + editor |
| Showroom / Projects | `showroom` | All projects (active construction + portfolio). Filter by status/isPublic. |
| Landing | `landing` | Marketing pages: home, about, services, blog, contact |

## UI Concepts

| Term | Definition |
|------|-----------|
| **Entity View Context** | Any UI surface that renders one or more entities — regardless of presentation format (calendar, kanban, data table, card list, modal). View contexts nest following the ownership chain `Customer > Project > Meeting > Proposal`. Every entity in a view context gets the standardized entity action menu (base actions gated by CASL + optional context-specific actions). |
| **Entity Action Config Hook** | A `use<Entity>ActionConfigs` React hook that is the **single source of truth** for an entity's available actions. Every view context for that entity calls this hook rather than building actions inline. The hook owns: action list from `*_ACTIONS` constants, mutations (duplicate, delete), `useConfirm` for destructive actions, and returns `{ actions, DeleteConfirmDialog }`. Context-specific handlers (onView, onEdit, onStart) are injected via the hook's `handlers` parameter. |

### View Context Path Notation

Use slash-separated paths to reference any view context unambiguously. Format: `Page/Container/Entity/NestedEntity`

**Segments:**
1. **Page** — `Pipeline`, `Meetings`, `Proposals`, `Projects`, `Profile`, `CreateMeeting`, `CreateProject`
2. **Container** — `Kanban`, `Table`, `Calendar`, `Overview`, `Meetings` (tab), `Projects` (tab)
3. **Entity** — `Customer`, `Meeting`, `Proposal`, `Project`
4. **Pipeline qualifier** (optional) — `Pipeline[fresh]`, `Pipeline[projects]`, etc.

**Examples:**

| Path | What it refers to |
|------|-------------------|
| `Pipeline/Kanban/Customer` | Customer card in pipeline kanban |
| `Pipeline[fresh]/Kanban/Customer/Meeting` | Meeting section inside a fresh pipeline kanban card |
| `Pipeline[fresh]/Kanban/Customer/Meeting/Proposal` | Proposal row inside meeting section of a kanban card |
| `Pipeline[projects]/Kanban/Customer/Project` | Project container in projects pipeline kanban card |
| `Pipeline[projects]/Kanban/Customer/Project/Proposal` | Proposal row inside project container |
| `Pipeline/Table/Customer` | Customer row in pipeline table view |
| `Meetings/Calendar/Meeting` | Meeting card in calendar view |
| `Meetings/Table/Meeting` | Meeting row in meetings data table |
| `Proposals/Table/Proposal` | Proposal row in proposals data table |
| `Projects/Table/Project` | Project row in projects/showroom table |
| `Profile/Overview` | Overview tab of the customer profile modal |
| `Profile/Meetings/Meeting` | Meeting card in the meetings tab |
| `Profile/Projects/Project` | Project wrapper in the projects tab |
| `Profile/Projects/Project/Meeting` | Meeting card nested inside a project card |
| `Profile/Projects/Project/Meeting/Proposal` | Proposal row inside a project's meeting card |
| `CreateMeeting` | Create meeting modal |
| `CreateProject` | Create project modal |

### Entity View Context Map

| Path | File | Hook |
|------|------|------|
| `Pipeline/Table/Customer` | `customer-pipelines/ui/components/customer-pipeline-table.tsx` | `useCustomerActionConfigs` |
| `Pipeline/Kanban/Customer` | `customer-pipelines/ui/components/customer-kanban-card.tsx` | `useCustomerActionConfigs` |
| `Pipeline[fresh]/Kanban/Customer/Meeting` | `customer-pipelines/ui/components/customer-kanban-card.tsx` | `useMeetingActionConfigs` |
| `Pipeline[fresh]/Kanban/Customer/Meeting/Proposal` | `customer-pipelines/ui/components/customer-kanban-card.tsx` | `useProposalActionConfigs` |
| `Pipeline[projects]/Kanban/Customer/Project` | `customer-pipelines/ui/components/customer-kanban-card.tsx` | `useProjectActionConfigs` |
| `Pipeline[projects]/Kanban/Customer/Project/Proposal` | `customer-pipelines/ui/components/customer-kanban-card.tsx` | `useProposalActionConfigs` |
| `Meetings/Calendar/Meeting` | `meeting-flow/ui/components/calendar/meeting-calendar.tsx` | `useMeetingActionConfigs` |
| `Meetings/Calendar/Meeting` (dot) | `meeting-flow/ui/components/calendar/meeting-calendar-dot.tsx` | `useMeetingActionConfigs` |
| `Meetings/Table/Meeting` | `meeting-flow/ui/components/table/` | `useMeetingActionConfigs` |
| `Proposals/Table/Proposal` | `proposal-flow/ui/components/table/` | `useProposalActionConfigs` |
| `Projects/Table/Project` | `project-management/ui/components/table/` | `useProjectActionConfigs` |
| `Profile/Meetings/Meeting` | `shared/entities/meetings/components/overview-card.tsx` | `useMeetingActionConfigs` |
| `Profile/Projects/Project` | `shared/entities/customers/components/lists/project-entity-card.tsx` | `useProjectActionConfigs` |
| `Profile/Projects/Project/Meeting` | `shared/entities/meetings/components/overview-card.tsx` | `useMeetingActionConfigs` |
| `Profile/Projects/Project/Meeting/Proposal` | `shared/entities/customers/components/lists/meeting-proposal-row.tsx` | `useProposalActionConfigs` |

## JSONB Field Map

| Entity | Column | Zod Schema | Contains |
|--------|--------|------------|----------|
| Customer | `customerProfileJSON` | `customerProfileSchema` | Age, trigger, pain points, priority, timeline, urgency |
| Customer | `propertyProfileJSON` | `propertyProfileSchema` | HOA, year built |
| Customer | `financialProfileJSON` | `financialProfileSchema` | Credit score, quotes received |
| Meeting | `situationProfileJSON` | `situationProfileSchema` | DMs present, meeting type |
| Meeting | `programDataJSON` | `programDataSchema` | Scopes, utility, timeline, years in home |
| Proposal | `formMetaJSON` | `formMetaSectionSchema` | Pricing display mode |
| Proposal | `projectJSON` | `projectSectionSchema` | Scopes, trades, SOWs, objectives |
| Proposal | `fundingJSON` | `fundingSectionSchema` | TCP, cash, deposit, incentives |

## Terminology Rules

- **Customer** not "client" or "user" (unless referring to the user role)
- **Meeting** not "appointment" or "consultation" (those are casual synonyms, not code terms)
- **Proposal** not "quote" or "estimate"
- **Scope** not "line item" or "service"
- **Trade** not "contractor type" or "specialty"
- **SOW** always uppercase. Full form: "Scope of Work"
- **TCP** always uppercase. Full form: "Total Contract Price"
- **Incentive** not "promo" or "deal"
- **Pipeline** refers to business workflow tracks (fresh/projects/rehash/dead), not CI/CD or customer buckets
- **Pipeline Stage** is the journey position within a pipeline — computed for Fresh, stored for Projects/Rehash/Dead
- **Project** is an active construction engagement, not just a portfolio item
- **SFH** always uppercase. Full form: "Single Family Home"
- **Entity View Context** not "entity card" or "entity display" — refers to the full UI surface + its nested entity containers, not a single component
- **View Context Path** — use `Page/Container/Entity/Nested` notation to reference specific view contexts (e.g., `Profile/Projects/Project/Meeting/Proposal`)
