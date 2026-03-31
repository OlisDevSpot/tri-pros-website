# Tri Pros Remodeling — Docs Directory

Master index for all domain knowledge. Each file is independently retrievable without loading the full directory.

## Company Summary

Tri Pros Remodeling is a Southern California residential construction and remodeling company. We generate leads through telemarketing and social media, convert them via in-home sales meetings, and deliver projects across energy-efficient and general remodeling trades. Our edge is licensed, insured craftsmanship paired with a customer experience that cheap contractors cannot match.

---

## Quick-Reference Map

| If you need to know... | Read this file |
|---|---|
| Who TPR is, brand story, team | `company/overview.md` |
| What trades and services we offer | `company/services-catalog.md` |
| Why we beat cheap contractors | `company/competitive-advantage.md` |
| Licenses, insurance, warranty details | `company/warranties-and-trust.md` |
| **Core sales frameworks** (CLOSER, Value Equation, A.R.A.C., Grand Slam) | `sales/sales-frameworks.md` |
| How leads become signed contracts | `sales/revenue-model.md` |
| How to run an in-home meeting | `sales/in-home-meeting-playbook.md` |
| The trust narrative (due diligence story) | `sales/due-diligence-story.md` |
| How to handle any objection | `sales/objection-handlers.md` |
| How to close on the same day | `sales/closing-strategies.md` |
| When and how to follow up after sending a proposal | `sales/follow-up-cadence.md` |
| **Post-signing reinforcement** (prevent buyer's remorse) | `sales/post-signing-sequence.md` |
| **Customer success stories** for objection handling | `sales/story-bank.md` |
| **Lead magnet strategy** for top-of-funnel | `sales/lead-magnets.md` |
| What profiling data to capture during discovery | `sales/customer-intelligence.md` |
| How to build a great proposal | `proposal/creation-guide.md` |
| How to present price and financing | `proposal/financing-presentation.md` |
| How to present scope without overwhelming | `proposal/scope-presentation.md` |
| The full customer lifecycle | `customer/journey-map.md` |
| How homeowners make decisions | `customer/decision-psychology.md` |

---

## Directory Structure

```
docs/
  README.md                         <- this file
  company/
    overview.md
    services-catalog.md
    competitive-advantage.md
    warranties-and-trust.md
  sales/
    sales-frameworks.md             <- CORE: CLOSER, Value Equation, A.R.A.C., Grand Slam, Conviction
    revenue-model.md
    in-home-meeting-playbook.md
    due-diligence-story.md
    objection-handlers.md
    closing-strategies.md
    follow-up-cadence.md
    post-signing-sequence.md        <- NEW: Post-contract reinforcement protocol
    story-bank.md                   <- NEW: Customer success stories by objection type
    lead-magnets.md                 <- NEW: Lead magnet strategy (energy audit, checklist, calculator)
    customer-intelligence.md
  proposal/
    creation-guide.md
    financing-presentation.md
    scope-presentation.md
  customer/
    journey-map.md
    decision-psychology.md
  domain/
    ubiquitous-language.md
  programs/
    README.md
    energy-saver-incentive.md
    existing-customer-savings-plus.md
    tpr-monthly-special.md
```

---

## Key Business Context for Claude

- **Sales methodology**: All sales docs are grounded in Hormozi's CLOSER, Value Equation, and Grand Slam Offer frameworks — adapted for home improvement. See `sales/sales-frameworks.md` for the canonical reference.
- **Primary bottlenecks to address**: sticker shock, spouse objection, cold proposals, scope confusion, price competition
- **Close mechanism**: DocuSign e-signature (digital, same-day capable)
- **Proposal tool**: Multi-step flow in `/proposal-flow/` — seven agent-facing steps
- **CRM**: Notion
- **Financing framing**: Always bridge total price to monthly payment; see `proposal/financing-presentation.md`
- **Loan math utility**: `src/shared/lib/loan-calculations.ts`
- **Enum reference**: `src/shared/constants/enums.ts` — trade types, home areas, scope identifiers
