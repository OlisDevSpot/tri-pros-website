# Ubiquitous Language — Tri Pros Remodeling

> Living glossary of canonical terms. Every AI session, PR, and issue MUST use these terms exactly.
> Updated: 2026-03-23

## Core Entities

| Term | Definition | Code Location |
|------|-----------|---------------|
| **Customer** | A homeowner or prospect engaged with Tri Pros. Primary entity — everything flows from here. | `db/schema/customers.ts` |
| **Meeting** | An in-home consultation between agent and customer. Captures situation + program data as JSONB. | `db/schema/meetings.ts` |
| **Proposal** | Formal document: scopes, SOWs, pricing, financing. Statuses: `draft → sent → approved → declined`. | `db/schema/proposals.ts` |
| **Project** | A completed remodeling job with media, narrative, and metrics. Shown in portfolio/showroom. | `db/schema/projects.ts` |

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
| **Decision Timeline** | When they want to act: ASAP, 1-3mo, 3-6mo, 6+mo, Not sure. | `customers.customerProfileJSON` |
| **Decision Urgency** | How urgent the need feels (1-10 scale). Distinct from timeline. | `customers.customerProfileJSON` |
| **Credit Score Range** | Self-reported bracket. Predicts financing approval. | `customers.financialProfileJSON` |
| **DMs Present** | Who attended the meeting. All, Only husband, Only wife, Partial, None. | `meetings.situationProfileJSON` |

## Pipeline & Lifecycle

| Term | Definition |
|------|-----------|
| **Customer Pipeline** | Bucket: `active` (engaged), `rehash` (re-engagement eligible), `dead` (closed). |
| **Pipeline Stage** | Computed from meetings + proposals: `needs_confirmation → meeting_scheduled → meeting_in_progress → meeting_completed → follow_up_scheduled → proposal_sent → contract_sent → approved \| declined`. |
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
| Showroom | `showroom` | Public portfolio + agent project editor |
| Landing | `landing` | Marketing pages: home, about, services, blog, contact |

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
- **Pipeline** refers to customer buckets (active/rehash/dead), not CI/CD
- **Pipeline Stage** is the computed journey position, not the pipeline type
