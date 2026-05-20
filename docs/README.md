# Tri Pros Remodeling — Docs

Master index for all repository documentation. Two distinct surfaces:

- **Sales / company / customer** — how Tri Pros operates as a business. Authoritative source of truth for sales narrative, frameworks, customer journey, programs.
- **Engineering** — how the codebase is structured. ADRs (decisions), how-tos (recipes), codebase-conventions (cross-cutting rules), per-directory `DOCS.md` (business rules co-located with code).

Each file is independently retrievable. If you need a rule, look it up — don't memorize it.

---

## Company Summary

Tri Pros Remodeling is a Southern California residential construction and remodeling company. We generate leads through telemarketing and social media, convert them via in-home sales meetings, and deliver projects across energy-efficient and general remodeling trades. Our edge is licensed, insured craftsmanship paired with a customer experience that cheap contractors cannot match.

---

## Engineering — Quick Reference

| If you need to know... | Read this |
|---|---|
| **Where to put a new file** | `codebase-conventions/README.md` (topic index) |
| Architectural decisions ("why we chose X") | `adr/` (latest: `0003-service-provider-architecture.md`) |
| How to add a new entity to the tRPC layer | `how-to/add-an-entity.md` |
| pgEnum / schema rules | `codebase-conventions/database-schema.md` |
| Enum standardization (const array → type → pgEnum) | `codebase-conventions/enum-standardization.md` |
| tRPC procedure types + router structure | `codebase-conventions/trpc-procedures.md` |
| DAL signatures + `DalReturn<T>` + `ScopedContext` | `codebase-conventions/dal-conventions.md` |
| Service / provider 4-tier architecture | `codebase-conventions/service-architecture.md` (+ ADR-0003) |
| Pagination / sort / search / filters toolkit | `codebase-conventions/query-toolkit.md` |
| Tailwind / shadcn / motion / 'use client' / lint | `codebase-conventions/frontend-stack.md` |
| Env vars, public URLs, VAPID, integrations inventory | `codebase-conventions/environment.md` |
| **Business rules per entity** | `src/shared/entities/<entity>/DOCS.md` (proposals/ is canonical) |
| **tRPC entity-server-system operational rules** | `src/trpc/DOCS.md` |

---

## Sales / Company — Quick Reference

| If you need to know... | Read this |
|---|---|
| Who TPR is, brand story, team | `company/overview.md` |
| What trades and services we offer | `company/services-catalog.md` |
| Why we beat cheap contractors | `company/competitive-advantage.md` |
| Licenses, insurance, warranty details | `company/warranties-and-trust.md` |
| **Core sales frameworks** (CLOSER, Value Equation, A.R.A.C., Grand Slam) | `sales/sales-frameworks.md` |
| How leads become signed contracts | `sales/revenue-model.md` |
| How to run an in-home meeting | `sales/in-home-meeting-playbook.md` |
| The trust narrative (due-diligence story) | `sales/due-diligence-story.md` |
| How to handle any objection | `sales/objection-handlers.md` |
| How to close on the same day | `sales/closing-strategies.md` |
| When and how to follow up after sending a proposal | `sales/follow-up-cadence.md` |
| Post-signing reinforcement (prevent buyer's remorse) | `sales/post-signing-sequence.md` |
| Customer success stories for objection handling | `sales/story-bank.md` |
| Lead magnet strategy for top-of-funnel | `sales/lead-magnets.md` |
| What profiling data to capture during discovery | `sales/customer-intelligence.md` |
| How to build a great proposal | `proposal/creation-guide.md` |
| How to present price and financing | `proposal/financing-presentation.md` |
| How to present scope without overwhelming | `proposal/scope-presentation.md` |
| The full customer lifecycle | `customer/journey-map.md` |
| How homeowners make decisions | `customer/decision-psychology.md` |
| Programs (Energy-Saver+, Monthly Special, etc.) | `programs/README.md` |
| Canonical business term glossary | `domain/ubiquitous-language.md` |

---

## Directory Structure

```
docs/
  README.md                         <- this file (master index)

  adr/                              architectural decision records (immutable)
    0001-entity-action-system.md
    0002-entity-server-system.md
    0003-service-provider-architecture.md

  how-to/                           step-by-step recipes
    add-an-entity.md

  codebase-conventions/             cross-cutting engineering rules
    README.md                       topic index
    database-schema.md
    enum-standardization.md
    trpc-procedures.md
    dal-conventions.md
    service-architecture.md
    query-toolkit.md
    frontend-stack.md
    environment.md

  plans/                            large unimplemented designs
    meta-ads-compound-intelligence.md
    notion-crm-migration-design.md
    notion-crm-migration-plan.md

  domain/
    ubiquitous-language.md          canonical business terms

  company/                          sales-side: brand, services, advantages, warranties
    overview.md
    services-catalog.md
    competitive-advantage.md
    warranties-and-trust.md

  sales/                            sales-side: frameworks + playbooks
    sales-frameworks.md             CORE: CLOSER, Value Equation, A.R.A.C., Grand Slam
    revenue-model.md
    in-home-meeting-playbook.md
    due-diligence-story.md
    objection-handlers.md
    closing-strategies.md
    follow-up-cadence.md
    post-signing-sequence.md
    story-bank.md
    lead-magnets.md
    customer-intelligence.md

  proposal/                         sales-side: proposal authoring & presentation
    creation-guide.md
    financing-presentation.md
    scope-presentation.md

  customer/                         sales-side: customer lifecycle + psychology
    journey-map.md
    decision-psychology.md

  programs/                         active campaign programs (Energy-Saver+, etc.)
    README.md
    energy-saver-incentive.md
    existing-customer-savings-plus.md
    tpr-monthly-special.md

  tasks/                            two active task summaries (rest migrated to GitHub Issues)
    meta-ads-integration.md
    notion-crm-migration.md
```

Plus engineering business-rules co-located with code:

```
src/
  trpc/DOCS.md                              Entity Server System rules
  shared/entities/<entity>/DOCS.md          per-entity invariants, derivations, gates
  features/<feature>/DOCS.md                feature-level UX/flow rules (where earned)
```

---

## Key business context

- **Sales methodology**: docs are grounded in Hormozi's CLOSER, Value Equation, and Grand Slam Offer frameworks — adapted for home improvement. See `sales/sales-frameworks.md`.
- **Primary bottlenecks to address**: sticker shock, spouse objection, cold proposals, scope confusion, price competition.
- **Close mechanism**: e-signature via Zoho Sign (active path; DocuSign provider is legacy).
- **Proposal tool**: multi-step flow in `src/features/proposal-flow/` — seven agent-facing steps.
- **CRM**: Notion (temporary; in-house CRM migration designed at `plans/notion-crm-migration-design.md`).
- **Financing framing**: always bridge total price to monthly payment — see `proposal/financing-presentation.md`. Loan math at `src/shared/lib/loan-calculations.ts`.
- **Enum reference**: `src/shared/constants/enums/` (per-domain split) — trade types, home areas, scope identifiers, etc.
