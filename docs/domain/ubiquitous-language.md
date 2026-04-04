# Ubiquitous Language — Tri Pros Remodeling

> Living glossary of canonical terms. Every AI session, PR, and issue MUST use these terms exactly.
> Updated: 2026-03-23

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
| Meetings | `meetings` | Calendar, intake form, program flow, past meetings |
| Proposal Flow | `proposal-flow` | Multi-step proposal builder + editor |
| Showroom / Projects | `showroom` | All projects (active construction + portfolio). Filter by status/isPublic. |
| Landing | `landing` | Marketing pages: home, about, services, blog, contact |

## UI Concepts

| Term | Definition |
|------|-----------|
| **Entity View Context** | Any UI surface that renders one or more entities — regardless of presentation format (calendar, kanban, data table, card list, modal). Within a view context, entities appear inside containers and cards that show a snapshot of their data. View contexts can be nested: a customer kanban card is a customer view context that also contains meeting view contexts (each meeting card), and those meeting cards may contain proposal view contexts (proposal rows). Every entity rendered in a view context gets the standardized entity action menu (base actions gated by CASL + optional context-specific actions). |
| **Entity Action Config Hook** | A `use<Entity>ActionConfigs` React hook that is the **single source of truth** for an entity's available actions. Every view context for that entity calls this hook rather than building actions inline. The hook owns: action list from `*_ACTIONS` constants, mutations (duplicate, delete), `useConfirm` for destructive actions, and returns `{ actions, DeleteConfirmDialog }`. Context-specific handlers (onView, onEdit, onStart) are injected via the hook's `handlers` parameter. |

### Entity View Context Map

Follow the ownership chain `Customer → Meeting → Proposal` to find nested view contexts.

| Entity | View Context | Location | Hook |
|--------|-------------|----------|------|
| **Customer** | Pipeline table | `customer-pipelines/ui/components/customer-pipeline-table.tsx` | `useCustomerActionConfigs` |
| **Customer** | Pipeline kanban card | `customer-pipelines/ui/components/customer-kanban-card.tsx` | Manual (has sub-menu for pipeline moves) |
| **Meeting** | Past meetings table | `meetings/ui/components/table/` | `useMeetingActionConfigs` |
| **Meeting** | Calendar card (month/week) | `meetings/ui/components/calendar/meeting-calendar-card.tsx` | `useMeetingActionConfigs` (via parent) |
| **Meeting** | Calendar dot (day) | `meetings/ui/components/calendar/meeting-calendar-dot.tsx` | `useMeetingActionConfigs` (via parent) |
| **Meeting** | Profile modal meeting card | `customer-pipelines/ui/components/meeting-entity-card.tsx` | `useMeetingActionConfigs` |
| **Meeting** | Kanban card meeting section | `customer-pipelines/ui/components/customer-kanban-card.tsx` | Manual (simplified) |
| **Proposal** | Past proposals table | `proposal-flow/ui/components/table/` | `useProposalActionConfigs` |
| **Proposal** | Profile modal proposals list | `customer-pipelines/ui/components/proposal-row.tsx` | `useProposalActionConfigs` |
| **Proposal** | Meeting card proposal row | `customer-pipelines/ui/components/meeting-proposal-row.tsx` | `useProposalActionConfigs` |
| **Proposal** | Kanban card proposal row | `customer-pipelines/ui/components/customer-kanban-card.tsx` | `useProposalActionConfigs` |
| **Project** | Showroom table | `showroom/ui/components/table/` | `useProjectActionConfigs` |

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
