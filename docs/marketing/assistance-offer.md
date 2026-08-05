# The TPR Assistance Program — Canonical Definition

> **This is the source of truth for the TPR Assistance offer.** Any application
> flow, landing, or agent script that implements Assistance derives from THIS
> document. Counterpart to `docs/marketing/showcase-offer.md` (the two are
> distinct programs with **different** guardrails — Showcase forbids rebate/
> government language; Assistance is *about* assistance funding). Origin: owner
> description 2026-07-30, captured during the applications engine brainstorm.

## what-it-is

**Tri Pros helps Southern California homeowners qualify for home-upgrade
assistance they didn't know existed.** SoCal has a dense landscape of
manufacturer credits, rebates, state energy-efficiency assistance funds, and
senior programs. Finding and qualifying homeowners for these — "programs they
don't know they don't know about" — is a core part of what Tri Pros does.

## the-deal

- Selected/qualified homeowners get their remodel at a **reduced price**,
  because **a portion of the project cost is funded** through assistance —
  offsetting materials, labor, taxes, or margin.
- The funding is real but its **mechanism is honest**: manufacturers of
  energy-efficient materials receive state grants/rebates (tied to California's
  Title-24 energy-efficiency goals). Tri Pros is **not** a government agency and
  does not issue grants — but when Tri Pros purchases those energy-efficient
  materials, the manufacturer assistance is **forwarded to Tri Pros, who
  forwards it to the homeowner** as reduced pricing.
- Because of this, the deepest reductions apply to **energy-efficient / green
  upgrades** (see [green-upgrades](#green-upgrades)).

## green-upgrades

The upgrades that qualify are **Title-24-aligned energy-efficiency
improvements** — the ones that help California hit its energy standards, which
is why manufacturer/state assistance flows to them:

- Roofing (cool/energy-efficient)
- Windows
- Insulation
- HVAC
- Drought-tolerant / dry landscaping
- Cool-coat exterior paint / coatings

This is a **curated program list**, distinct from the general remodel trades
catalog. It is authored in-code (`src/features/applications/constants/green-upgrades.ts`),
not sourced from Notion.

## qualification

Assistance is **qualification-dependent** — never automatic. Criteria include:

- **Homeownership** — assistance goes to owners (and tenure).
- **Age** — some funds are reserved for **seniors**.
- **Household size** — number of people in the home (household-based funds).
- **Income** — a real criterion, but **assessed by the agent offline / in
  review**, NOT captured as an exact figure in the homeowner-facing flow.
- **The upgrade itself** — how energy-efficient the improvement is.
- **ZIP code** — assistance-fund **pools vary by area**, so availability is
  checked per ZIP.

## conversion-mechanics

1. **Agent-started, homeowner self-served, in-home.** The Tri Pros specialist
   opens the application against the meeting and hands the device to the
   homeowner, who steps through it themselves.
2. **The flow IS a qualification intake.** Each question is a genuine criterion
   (ownership, household, age, chosen upgrades), which is what makes it
   legitimate rather than a marketing quiz.
3. **The ZIP funding-check is the emotional peak** — a real check of which
   assistance funds are available for the homeowner's area and chosen upgrades.
4. **"See if you qualify," not "here's your discount."** The homeowner is
   applying to be qualified; the specialist confirms and follows up.

## hard-guardrails

Apply to ALL Assistance surfaces (application flows, landings, agent scripts):

- **Qualification-framed, never guaranteed.** "See if you qualify," "checking
  availability" — never promise approval, and **never state a specific dollar
  amount or percentage** of funding publicly.
- **Honest mechanism.** Tri Pros forwards manufacturer material assistance and
  helps homeowners qualify. Never imply Tri Pros *is* a government agency,
  issues grants directly, or that funding is universal/automatic.
- **No exact income in the self-serve flow.** Income qualification is the
  agent's offline review, not a homeowner-facing question.
- **No pricing.** As with all Tri Pros offers, actual pricing happens in the
  in-home meeting.
- **Truthfulness.** Only describe programs/mechanisms that are real; do not
  invent specific fund names or amounts in copy.

## approved-vocabulary

Assistance MAY use (Showcase may NOT): "assistance funding," "manufacturer
credits/rebates," "energy-efficiency / green upgrades," "Title 24," "senior
assistance programs," "see if you qualify," "check availability of funds in
your area," "a portion of your project may be funded," "programs you didn't
know existed."

## where-the-code-implements-it

- Curated upgrades: `src/features/applications/constants/green-upgrades.ts`.
- The flow: `src/features/applications/constants/tpr-assistance-flow.ts` (a
  `multi-step-flow` `FlowConfig`), rendered by the application runner.
- ZIP availability check: reuses the funnels' ZIP resolve + the
  `ZipCheckProgress` animation, on the meeting's known ZIP.
- Applications entity backend (persistence, submit, review): canonical
  `src/shared/entities/applications/DOCS.md`.

## last-updated

2026-07-30 — initial capture (applications engine + runner brainstorm).
