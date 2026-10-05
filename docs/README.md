# Tri Pros Remodeling — Docs

Two surfaces:

- **Sales / company / customer** — how Tri Pros operates as a business. Authoritative for sales narrative, frameworks, customer journey, programs, offers.
- **Engineering** — only what the code cannot say: ADRs (why), two conventions that are decision rules, the design system, and live plans. **The code is the source of truth**; executed plans are deleted once shipped and live on in git history.

## Company summary

Tri Pros Remodeling is a Southern California residential construction and remodeling company. We generate leads through telemarketing and social media, convert them via in-home sales meetings, and deliver projects across energy-efficient and general remodeling trades. Our edge is licensed, insured craftsmanship paired with a customer experience that cheap contractors cannot match.

## Engineering

The code is the source of truth. Engineering docs survive only where code cannot carry the content (decisions, terms, design intent) or where pending work still cites them. Executed plans and specs were deleted on 2026-09-23 after a per-file audit; git history keeps them.

| Need | Read |
|---|---|
| Why a structural decision was made | `adr/` (0001 entity actions · 0002 entity server system · 0003 service/provider tiers · 0004 proposal/contract independence · 0005 JSONB vs column vs child table) |
| Cross-cutting rules that pending plans still cite | `codebase-conventions/` (verify against code; delete a file when its citing plan ships) |
| Business-rule notes that pending work still cites | `src/**/DOCS.md` (same rule; never add one) |
| Domain terms | `ubiquitous-language.md`, `../CONTEXT.md` |
| Design tokens, anti-slop rules, audiences | `design-system/`, `../DESIGN.md`, `../PRODUCT.md` |
| UI process (`/ui-exploration`) | `ui-design-playbook.md`, `how-to/ui-exploration.md` |
| Live epic trackers, contracts, ledgers, cited research, VoIP epics | `plans/` |
| Pending, partial, or in-progress specs and plans | `superpowers/specs/`, `superpowers/plans/` (delete on ship) |
| Permissions target state for #285 | `permissions/visibility-rules-catalog.md` |

## Sales / company

| Need | Read |
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
| THE Showcase offer (all funnels + ads) | `marketing/showcase-offer.md` |
| Ad editing patterns, variation axes, stills | `marketing/editing/`, `marketing/stills/` |
| SEO playbook, keyword map, LLM citation | `seo/` |
| Call scripts and per-source content for telemarketing | `plans/voip-campaigns/` |

## Key business context

- **Sales methodology**: grounded in Hormozi's CLOSER, Value Equation, and Grand Slam Offer frameworks — adapted for home improvement. See `sales/sales-frameworks.md`.
- **Primary bottlenecks**: sticker shock, spouse objection, cold proposals, scope confusion, price competition.
- **Close mechanism**: e-signature via Zoho Sign.
- **CRM**: this app. Notion supplies construction data (trades, scopes, SOWs, pain points) only.
- **Financing framing**: always bridge total price to monthly payment — see `proposal/financing-presentation.md`. Loan math at `src/shared/lib/loan-calculations.ts`.
