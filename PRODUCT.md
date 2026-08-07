# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Two first-class audiences, treated with equal weight for design work:

- **Homeowners in Southern California** — the market for the public site, trade
  funnels, intake, and proposal-flow. Typically comparing contractors for a
  remodel or energy-efficiency project, weighing a Tri Pros bid against a cheaper
  quote. They arrive from outbound telemarketing or paid/organic social, and the
  decisive sales event is an in-home appointment, not the website. The site's job
  is to establish trust and legitimacy before and around that meeting, and the
  funnels' job is to convert an ad click into a booked appointment.
- **The internal Tri Pros team** — sales agents, dispatchers (lead-qualifier VAs),
  and admins operating the dashboard CRM. They manage the pipeline from lead →
  appointment → in-home meeting → proposal → signed contract → project. Their
  context is fast, repetitive, operational work across customers, meetings,
  proposals, pipeline, lead sources, schedule, campaigns, and analytics.

## Product Purpose

Tri Pros Remodeling exists to give homeowners access to skilled, trustworthy,
licensed contractors and to deliver remodeling projects that increase the comfort,
value, and efficiency of their homes. This product is the company's operating
system: the public-facing surfaces that generate and warm leads, and the internal
CRM that runs the sales-to-delivery pipeline. Success is measured in booked
in-home appointments, proposals sent, contracts signed, and projects delivered —
and in a sales process that feels more professional than a typical contractor's.

## Positioning

Tri Pros combines three competencies most single-trade contractors lack —
**Technology** (systems that make the sales process faster and more professional),
**Business** (CRM, communication, operational excellence), and **Construction**
(field execution and trade depth). Against a cheaper quote, the company competes on
four substantiated dimensions — **Security, Warranty, Craftsmanship, Experience
(SWCE)** — never on price. The public promise: the contractor you hire when you
want it "done once, done right, and backed by a company that will still be around
if you ever need us." The lead-gen engine is the **Showcase offer** — a casting
call, not a discount ad: a limited number of homes are selected as portfolio
showpieces in exchange for before/during/after photo and video rights. The
discount is real but never quantified publicly ("at a Showcase price" is the whole
public statement of it).

## Operating Context

- **Lead generation is outbound-first**: targeted telemarketing + paid/organic
  social, both funneling into in-home appointments.
- **Revenue pipeline**: Lead Gen → Appointment Set → In-Home Meeting (agent
  visits) → Proposal Created & Sent → Signed Contract (via **Zoho Sign** e-sign)
  → Project Delivered.
- **Two project categories**: Energy-Efficient Remodeling (roofing, insulation,
  windows & doors, HVAC, solar — tied to tax credits/rebates and monthly savings)
  and General Remodeling (bathroom, kitchen, flooring, paint, decking,
  foundation).
- **Showcase funnels are per-trade, never generic** — Kitchen Showcase, Bathroom
  Showcase, Complete-Interior Showcase; each funnel/ad speaks only to its trade.
- **The in-home meeting is the decisive sales event**; public surfaces and funnels
  exist to earn and support it, and internal tooling exists to run everything
  around it.

## Capabilities and Constraints

- **Public surfaces**: marketing site (`/(site)`: about, services, portfolio +
  testimonials, community, blog, contact), per-trade lead funnels
  (`/funnels/[trade]`), intake, and a customer-facing proposal-flow with
  e-signature.
- **Internal CRM** (`/dashboard`): pipeline, customers, meetings, proposals,
  projects, schedule, lead sources, campaigns, team, analytics, settings.
- **Roles**: sales agents, dispatchers (lead-qualifier VAs with scoped
  visibility), and admins — visibility and capabilities are permission-scoped.
- **E-signature is Zoho Sign** (DocuSign has been removed). Notion holds
  trades/scopes/SOW/pain-points only; the app is the source of truth for
  customers.
- **Company facts must never be hardcoded** — all company data comes from
  `src/shared/constants/company/` (name, licenses, insurances, certifications,
  awards, stats, testimonials, service area, socials). Treat that directory as the
  factual source for any public claim.
- **SWCE proof points must be substantiated** — license numbers, insurance
  certificates, warranty terms, and portfolio examples back every trust claim; do
  not invent or approximate them.

## Brand Commitments

- **Name**: Tri Pros Remodeling ("Tri Pros"). Founded 2021. Logo at `/logo.png`.
- **Voice is binding and derives from the sales playbooks** (`docs/sales/`) and the
  canonical **Showcase offer** (`docs/marketing/showcase-offer.md`): a
  human-psychology-driven approach that leads with trust, legitimacy, and reframing
  ("done once, done right") rather than price or discount. On the Showcase offer
  specifically: state the photo/video exchange openly but keep it **light and
  casual** ("we film the before-and-after for our portfolio") — never a legalistic
  rights grab; the discount is never quantified in public copy.
- **Design aesthetic already established in the app** (per project memory): cinematic
  overlays, parallax, frosted-glass badges, a luxury feel — appropriate to a
  premium, trust-first remodeler.

## Evidence on Hand

Real, verifiable company facts (canonical in `src/shared/constants/company/`):

- Founded **2021**; **40+** combined years of team experience; **2** generations.
- **520** projects completed; **~$9M** in project value delivered.
- **98%** client satisfaction.
- **BBB A+**, accredited since 2021; **100% Licensed & Bonded**; published bonding
  capacity for large projects.
- Licenses, insurances, certifications, awards, testimonials, and a defined
  Southern California service area (cities + ZIPs) all enumerated in constants.
- Portfolio of real projects + testimonials (public `/portfolio`).

Do not fabricate testimonials, benchmarks, pricing, or the Showcase discount
amount — the discount is deliberately unquantified in public.

## Product Principles

1. **Trust before price.** Every public surface substantiates Security, Warranty,
   Craftsmanship, and Experience with real proof; it never competes on cheapness.
2. **The website serves the in-home meeting.** Public design earns legitimacy and
   books appointments; it is not the closing event and should not pretend to be.
3. **Two audiences, two disciplines.** Homeowner surfaces persuade; internal CRM
   surfaces operate. Hold each to the standard of its job rather than one blended
   compromise.
4. **Facts come from the constants, claims come from proof.** Company data is
   sourced, not typed; trust claims are backed, not asserted.
5. **Showcase is a casting call, kept light.** Per-trade, trust-framed, the
   exchange stated casually and the discount never quantified in public.

## Accessibility & Inclusion

No formal accessibility standard is required for this project. Apply
good-practice defaults (legible contrast, keyboard operability, sensible focus and
labels), keeping in mind a homeowner audience that may skew older, but there is no
compliance bar to certify against.
