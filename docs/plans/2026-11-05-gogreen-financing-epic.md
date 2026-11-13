# GoGreen financing — Epic Tracker

> **Status:** opened 2026-11-05. Research pass 1 done (§3). Owner answered the open questions 2026-11-05 (GG-D9–D19): **this stage is presentational** (the public site first, then the in-home presentation); running GoGreen jobs in the app is out. Nothing designed, nothing built. Next: brainstorm the GoGreen page and the landing-page section (GG2).
> **Goal:** Tri Pros was approved as a participating GoGreen Home contractor. Rebuild how we introduce ourselves and our energy upgrades around that: on the public site, in the in-home meeting, in the trade scene and on the proposal, so the homeowner sees a vetted contractor, upgrades the program finances, and a monthly payment set against the bill savings.
> **Adjacent, owned elsewhere (link, don't duplicate):**
> - Public site transformation epic `docs/plans/2026-10-02-public-site-transformation-epic.md`: D1 validator-first, D4 one CTA, D7 + R3 the energy chapter, R5 facts only from `src/shared/constants/company/`.
> - 3D trade scenes epic `docs/plans/2026-10-16-trade-scenes-epic.md` (on `feat/trade-scenes-foundation`, not on main): R118 the scene is the meeting's product-benefits presentation, R127/R185 Benefits, R115/R128 product proof and the upgrade registry.
> - Proposal energy impact epic `docs/plans/2026-10-21-proposal-energy-impact-epic.md`: bill cuts, bill-cutting scopes, electric utility, the chapter after Funding.
> - Proposal applications spec `docs/superpowers/specs/2026-09-24-proposal-applications-design.md`: what a **program** and an **application** mean in our app (A1–A20).
> - Sales calculators epic `docs/plans/2026-09-26-sales-calculators-epic.md`: the Remodel ROI calculator's monthly story.
> - Business docs: `docs/sales/` (CLOSER, due-diligence story, playbook), `docs/proposal/financing-presentation.md` (price bridge, "The Offset Narrative"), `docs/proposal/financing-providers.md` (lenders we use or could).

Legend: `[ ]` open · `[x]` done · `[~]` in progress · ⚠️ blocked on a §2 question · ✅ settled (decision, nothing to build).

**Sync protocol:** (1) specs and plans cite these IDs and link here instead of restating a rule; (2) a new owner ruling becomes a dated row in §1 before the spec that relies on it is approved; (3) when work lands, tick its IDs and record the commit range in §9; (4) owner input goes into §1 in the owner's words, with the date; (5) a program fact enters §3.1 only with a primary source and the date it was read.

---

## 1. Settled (owner rulings)

| # | Ruling | Date |
|---|---|---|
| GG-D1 | **Energy efficiency is the specialty.** "We are a general construction company, but that is our specialty. Our bread and butter is energy efficiency": cool reflective paint, efficient AC and heat, efficient ducting, attic insulation, crawl space insulation, double-pane windows, cool roofs, radiant barrier, and the rest of the catalog. | 2026-11-05 |
| GG-D2 | **GoGreen changes how we present the offer.** "It's going to completely revolutionize the way that we present our offer." The reveal of who we are is re-sequenced on "the most up-to-date sales and psychology principles that we have and that we're keeping track of in our codebase". | 2026-11-05 |
| GG-D3 | **The trust claim.** Homeowners "feel immediately sure of us as a company once they realize that we operate through and were approved to operate through" the program. The vetting is the story: about 10 months of back and forth, proof of satisfied customers, calls to customers, product checks, funding, licence, insurance, bond. The exact public wording follows the program's marketing rules (GG-Q1). | 2026-11-05 |
| GG-D4 | **The public site gets a section** "dedicated to us working through this state-funded program and being able to offer it". | 2026-11-05 |
| GG-D5 | **The public site gets a full page** on "what GoGreen is, maybe a little bit of the history, what product can qualify, and some additional resources" (the owner's own, plus what we find). | 2026-11-05 |
| GG-D6 | **The trade scene is the tool we use to put the upgrades through GoGreen.** "This is a tool that we use in order to apply them to GoGreen or through GoGreen, and we need to make sure that the efficiency is there." | 2026-11-05 |
| GG-D7 | **Payment against savings.** The scene's Benefits savings report ties to the financing: "the monthly payment will be so much lower under this program that the offset of what we're saving is going to really make the job a no-brainer." | 2026-11-05 |
| GG-D8 | **This tracker's shape:** research opportunities, a resource collection (what the owner hands over, what Claude fetches), and an actionable epic tracker. | 2026-11-05 |
| GG-D9 | **Nothing about how we applied.** "I wouldn't want to get into details on how we applied as it is too revealing for other contractors that may see our page. It's more about stating things that are real but don't need proof on our website." Presented "in a nice way and in a way that is not overly revealing". Narrows GG-D3: the status is stated, the vetting is not narrated. | 2026-11-05 |
| GG-D10 | **Our status is worded "an approved GoGreen Home contractor".** (Closes GG-Q1. The program's own guide says "enrolled"; the owner chose "approved".) | 2026-11-05 |
| GG-D11 | **GoGreen is the financing; the TPR GoGreen Program is ours.** "GoGreen is the financing solution, but we also have our 'TPR GoGreen Program' which is entirely based on that and has our own business decision that make sense for us (eg minimum 2 upgrades per home, limited spots per year, and other business decisions we may rule on)." (Closes GG-Q2.) | 2026-11-05 |
| GG-D12 | **The public work ships now, on today's site:** the page first, then the section; the homepage rebuild picks them up later. (Closes GG-Q3.) | 2026-11-05 |
| GG-D13 | **This stage is presentational.** "This is supposed to be presentational in nature, shown on our main landing page as another trust indicator and showcasing that we really are energy efficiency professionals, not to manage our projects here." Managing GoGreen jobs through the app is "definitely not what I wanted. Definitely not for this stage, at least." | 2026-11-05 |
| GG-D14 | **The resources are links.** "The links are mainly tools created by GoGreen or their financing partners that give additional credibility/explanation/reasoning." Nothing is tied to jobs; no private papers are needed. "As of right now, we have everything we need to start setting it up." (Closes GG-Q9.) | 2026-11-05 |
| GG-D15 | **The TPR GoGreen Program is always shown,** with a note that the upgrades it covers depend on the home's utilities. (Closes GG-Q5.) | 2026-11-05 |
| GG-D16 | **Energy Saver+ stays, beside the TPR GoGreen Program,** with the ended tax credit copy removed. (Closes GG-Q6.) | 2026-11-05 |
| GG-D17 | **Other work on the same loan is sold up front:** one loan for the energy upgrades and the remodel, within the 30% share (GG-F11). (Closes GG-Q7.) | 2026-11-05 |
| GG-D18 | **When lenders reach the proposal, each is listed with its own rates,** and Claude checks the published rates monthly and brings the changes for approval. Later stage (GG-D13). (Closes GG-Q4, GG-Q8.) | 2026-11-05 |
| GG-D19 | **All of it goes ahead, built to outlast:** any app part is built so another financing program could use it if GoGreen's funding lapses (GG-F18). (Closes GG-Q10.) | 2026-11-05 |
| GG-D20 | **No policing, no bogging down.** "Very important that we don't get bogged down on the details." "You are not here to police speech… you are here to aid us in our process of integrating gogreen into our presentations." A wording risk is flagged once; the owner's call stands. | 2026-11-05 |
| GG-D21 | **What the landing-page section leaves a homeowner believing:** "that Tri Pros is a very unique contractor, part of a select few contractors that are approved to work through Go Green. That it took us a long time to get approved by them, and that we were approved because our focus is energy efficiency first." The long approval is stated, not narrated (GG-D9). | 2026-11-05 |
| GG-D22 | **What GoGreen does for the homeowner, in the owner's words:** "Reduced rate financing funded through the state's green agenda. California is pushing energy efficiency hard and this shows that whoever doesn't take advantage of this will stay behind." | 2026-11-05 |
| GG-D23 | **Urgency is subtle and comes from circumstance, never coercion.** On Claude's draft line "The ones who wait get left behind": "Very bad copy. Way too aggressive and not understanding of the homeowner's desires and motivations… should be more subtle and blaming it on circumstance rather than coersion. Something that reads more 'limited spots, program scheduled to expire in 2027'." The facts behind it: our program's limited spots (GG-D11) and the program's funding, authorized through June 30, 2027 (GG-F18). So the limited spots show on the public site. | 2026-11-05 |
| GG-D24 | **The notice line says "in 2027", never the month** ("Don't say june 2027. Simply 'in 2027'"), and **the section sits further down the landing page**, with the reviews and credentials, not under the opening screen. Draft notice: "Limited spots each year · Current program funding runs in 2027" (wording to settle in the design). | 2026-11-05 |
| GG-D25 | **The section is an interactive energy demo, and energy efficiency is the centre.** On round 1: "I don't like any of these. The direction is closer to B (an interactive demo, similar to our trade scene). We should even highlight our custom 3D energy-focused scene experience to show how experienced we are about energy efficiency upgrades. This is our kingdom. The idea is to really visualize efficiency, highlight our in-house proprietary tech for estimating project savings, and highlight bill reductions/savings/warranties… make energy efficiency the central focus, and tie it nicely to go green. DO NOT be so verbose. Less is more." GoGreen is the tie at the end of the section, not its subject. | 2026-11-05 |
| GG-D26 | **Round 2 rulings.** Closer, not it. (1) The big "$469 a month" "automatically feels like a payment at first glance": bill figures may live inside the interactive element, never as the section's headline number. (2) The scene must feel "approachable and magnetic, almost drawing you in and alerting you that it's clickable and interactive". (3) Highlight "that we have our own 3D energy model and that this is a glimpse of it". (4) Speak of "the transformation of their home… the transformative nature of our work", "made possible with Go Green financing. Even more, it's more reachable thanks to Go Green financing". (5) Kept: the temperature strikeouts (attic, exterior wall, window glass), the GoGreen logo, "Approved GoGreen Home contractor". (6) Fix: two columns must be the same height on a tablet. (7) "See the heat, see the savings" is not the headline; "think much more creatively". (8) Order of work: layout and flow first ("what each section should hold, and the flow of things"), a content pass after. (9) On the real site the scene is a short recording. | 2026-11-05 |
| GG-D27 | **Round 3: option 2's approach (the model in a window, spots on the house, a list beside it), with corrections.** "2's approach is most appealing, but it is really broken." (1) No layout shift when a dot is tapped. (2) The home is shown opened, "with the attic showing": a complete view makes the radiant barrier "unnoticeable". (3) The products shown are several: "attic insulation, attic fan, cool paint, cool roof, windows. That's the idea (multi-products)". (4) Colours were "extremely muddy and murky, without decent hierarchy like our rungs": surfaces follow the elevation ladder. (5) More GoGreen: "state-backed" and "other highlights of why gogreen make tri pros unique… tie in Tri Pros being special using GoGreen to prove that"; mostly copy for later, but the layout must give it a place now. Also the same day: mocks must use the site's own tokens ("light mode is broken"). | 2026-11-05 |
| GG-D28 | **Round 4 rejected: no panel layouts.** "This layout is way too plain, boring, and AI-slop. Given all the requirements and inputs we gave so far. I don't like this direction at all, and need at least 3 options that adhere to our inputs so far yet really give us new ideas for what is wrong and could improve with the layout you're proposing." Claude's reading: a window, a list and a card row is app grammar on a page that has to persuade; the scene must be the stage, full width, with motion and large type, and GoGreen must be the payoff, not a footer card. All earlier rulings still hold (GG-D21–D27). | 2026-11-06 |
| GG-D29 | **Direction: the reveal.** "I like the reveal (scroll approach, telling a story), but we'll need to REALLY tweak and fine tune it to make it usable on our actual app. For now, I do like that approach however. Need a good /impeccable polish round first to see the potential." The visitor's scroll plays the story: the home, the heat, the home opens, the upgrades land, GoGreen closes. | 2026-11-06 |
| GG-D30 | **The reveal, corrections after the first polish.** (1) "Too much is happening too quickly. Data is being shown and hidden from the steps as we scroll and it's too overwhelming to notice anything": one idea per step, and data that appears stays. (2) "You are also telling the summer story, but we want to show the winter story as well." (3) "The steps indicator should be clickable for each step, and not start/end with half filled." (4) "The 3D model loses its effectiveness without movement, so maybe visualizing the arrows moving is important": "video rather than fully interactive OR a simple 3D with only the arrows moving". | 2026-11-06 |
| GG-D31 | **The reveal runs on a real recording; corrections after round 7.** "Record real video first, then corrections should happen." (1) "'Leaks' doesn't make sense": the step is named Heat. (2) "Mobile has weird lighting artifacts": on a phone the recording gets its own band with nothing laid over it. (3) "Clicking on step of the sections goes section by section rather than jumping into a section (reduce jitter or quick flashes)": a step tap goes straight there; scrolling moves a whole step at a time. (4) "Bills down should be $200+ due to all of these upgrades appearing at once": the model reads $179 at its default $200 electric bill and "saves $216 a month" with a $320 electric bill (both count repairs avoided); the mock shows "Saves $216 a month". (5) "Shouldn't have 'in-between' frames as we get jitters": no blended or scroll-linked part-way frames. | 2026-11-06 |
| GG-D32 | **Air sealing joins the build; the section must be fast.** "It's very slow now (maybe due to the videos). We also want to include 'air sealing' so that the number of arrows drop significantly in the 'rebuilt' section." Six products: cool roof, attic fan, attic insulation, air sealing, Cool Life paint, windows. In the model air sealing cuts the bright arrow area in Rebuilt to less than half of today's; the savings figure does not move ($179 default, $216 at a $320 electric bill); summer ceiling 86 → 79, winter ceiling 65 → 68. Speed: one recording plays at a time, clips load up front, 1280 px clips, less scroll per step. | 2026-11-06 |
| GG-D33 | **Round 9 is the starting point, not an approval.** "We'll start here, noting I'm very dissatisfied with it and we'll need to work on this in the future. Now it's important that we start also on the brainstorming of the GoGreen content in our landing / meeting flow / trade scene in our codebase." The section's layout stays open for rework; the next work is the GoGreen content brainstorm across the landing page, the meeting flow and the trade scene. | 2026-11-06 |

---

## 2. Open (needs the owner)

| # | Question | Blocks | Claude's recommendation |
|---|---|---|---|
| GG-Q12 | **The TPR GoGreen Program's rules.** So far: a minimum of two upgrades per home, limited spots per year, "and other business decisions we may rule on". How many spots, and what else? | The program's copy on the page and in the meeting | Rule them when the program's presentation is designed. Until then the page can say "limited spots each year" with no number. |
| GG-Q13 | **Does this stage end at the public site, or take in the in-home presentation too** (the TPR GoGreen Program in the meeting, the trade scene framed as the tool, GG-D6)? | The order after GG2 | Both, site first. |
| GG-Q11 | **Roofs on LADWP homes** (a cool roof counts only on SCE homes, GG-F10). Not answered: it is an app rule and app work is out of this stage (GG-D13). On the page the upgrade list carries the utilities note (GG-D15). | Later stage | Revisit with GG3. |

Answered 2026-11-05 and moved to §1: GG-Q1 → D10, Q2 → D11, Q3 → D12, Q4 and Q8 → D18, Q5 → D15, Q6 → D16, Q7 → D17, Q9 → D14, Q10 → D19.

---

## 3. Research

### 3.1 What the program is (verified)

Read 2026-11-05 from primary sources (S-numbers in §3.4). A fact without a source does not go on a page or a slide.

| # | Fact | Source |
|---|---|---|
| GG-F1 | **Who runs it.** GoGreen Home Energy Financing is run by CAEATFA, a financing authority chaired by the State Treasurer, at the request of the CPUC. | S1, S3 |
| GG-F2 | **Whose money.** Utility ratepayer funds ("Funds from investor-owned utility ratepayers power our program"), authorized by the CPUC, plus a California Energy Commission grant for homes on a public electric utility. Not taxes. The program's own phrase is "a State of California-backed program". | S1, S2, S4 |
| GG-F3 | **History.** Pilot July 2016, full program April 2020, renamed GoGreen Home August 2021. | S3, S6 |
| GG-F4 | **Size.** Through July 31, 2026: 18,304 loans, $444.14 million financed. 1,979 contractors were enrolled at the end of March 2026. | S7, S8 |
| GG-F5 | **How it lowers the rate.** A loan loss reserve, not a rate buy-down: the program puts 20% of the loan (credit score 700 or below) or 5% (above) into the lender's reserve, and the lender can claim up to 90% of a loss. With that cover, credit unions lend at lower rates and for longer. | S7, S9 |
| GG-F6 | **Rates.** Each lender sets its own. Published rates today run 3.49% to 10.00%; the July 2026 average was 6.13%. | S7, S12 |
| GG-F7 | **Limits.** Up to $50,000 per home, up to 15 years, credit score from 580, debt-to-income up to 55%. | S9, S13 |
| GG-F8 | **Unsecured, by lender.** The lender chart says "No collateral required". It is not a program rule: Self-Help FCU files a UCC-1 on HVAC jobs. No origination fees; some credit unions charge about $5 to join. No program-wide rule on prepayment was found; the lenders that state it say no penalty. | S8, S12, S13 |
| GG-F9 | **Which homes.** Any home that gets electricity or gas from PG&E, SDG&E, SCE or SoCalGas; homes on a public electric utility may finance most measures. Single-family, townhome, condo, 2–4 units, manufactured homes on a foundation; owners, and tenants with the owner's written permission. | S14, S15 |
| GG-F10 | **The utility decides the measures.** For an LADWP home with SoCalGas, only the measures in the list's "POU w/ IOU Gas" column count as eligible. **Cool roof and a central AC unit on its own are financeable "only for customers who receive electricity from PG&E, SCE, or SDG&E".** | S16, S17 |
| GG-F11 | **The 70 / 30 rule.** "At least 70 percent of the proceeds must be used to fund" eligible measures; "no more than 30 percent" may go to other related home improvements (the site names landscaping, painting, flooring, cabinetry). | S9, S19 |
| GG-F12 | **Our catalog against the list** (list dated June 3, 2026; the SCE / LADWP columns were read from extracted text, so GG-RQ2 confirms them in the contractor portal):<br>• Both SCE and LADWP + SoCalGas homes: attic, floor and wall insulation; heat reflective wall coating (solar reflectance ≥ 0.5); radiant barrier; duct sealing and insulation; windows and glass doors; heat pumps; furnace; furnace + AC system; water heaters.<br>• SCE homes only: cool roof (aged Solar Reflectance Index ≥ 20, from the program's product list); central AC unit alone.<br>• Not on the list: solar without a battery. | S16, S18 |
| GG-F13 | **Lenders.** Statewide: California Coast CU, KeyPoint CU, Matadors Community CU, San Francisco FCU, Self-Help FCU, Travis CU. Los Angeles and Orange counties: USC CU. | S12, S13 |
| GG-F14 | **How a job runs.** The homeowner is pre-approved by a lender; the contractor then enters the job in the GoGreen Home Portal. There is no lender at the point of sale. | S17 |
| GG-F15 | **0% heat pump promotion.** 0% up to 10 years, 2% for 10–15, heat pump projects only, up to $30,000, household income up to $150,000, home in a priority-population area, score from 600. Expected "through the middle of 2027 at least". | S10, S11 |
| GG-F16 | **What enrollment checks, as published.** Active CSLB licence, no discipline in 12 months, no outstanding judgments or liens, $1 million general liability, program training. After a job the Authority may review the file, visit the home or ask for photos, for a year. A contractor with no financed job in a year can be dropped from the directory. | S9, S21 |
| GG-F17 | **What we may say.** Full name "GoGreen Home Energy Financing" on first mention, then "GoGreen Home". Approved sample: "GoGreen Home is a State of California-backed program"; "ACME Contracting is an enrolled GoGreen Home contractor." We may use the GoGreen Financing logo, never the version with the state seal. The regulations bar a contractor from claiming "association or affiliation" with the Authority or the utilities, and from "false or misleading claims about any part of the Program". | S9, S22 |
| GG-F18 | **Outlook.** The ratepayer funding is authorized "through June 30, 2027". No extension was found. A bill to make the program permanent (SB 1265) stalled in the Assembly in June 2026. The Energy Commission grant that covers LADWP-type homes was cut from $30 million to $20 million in August 2026. Loan volume is still growing. | S5, S20, S23 |
| GG-F19 | **Other incentives today.** Federal 25C credit: ended for work placed in service after 2025. HEEHRA single-family rebates: fully reserved since February 2026. HOMES rebates: not launched in California. TECH Clean California: open in the San Fernando Valley since November 2, 2026. LADWP: cool roof up to $0.60 per sq ft, windows $2 per sq ft, heat pumps up to $2,500 per ton. SoCalGas: furnace and water-heater rebates to December 31, 2026. SCE: not checked. | S25–S30 |

### 3.2 The owner's brain dump, checked

| The owner said | What the sources say | So |
|---|---|---|
| State-funded, from our taxes | Utility ratepayer money, authorized by the CPUC (GG-F2). | Say "State of California-backed", the program's words. Never "tax-funded". |
| "The state buys down the rate to sometimes as low as 7%" | The state funds a loss reserve; lenders set the rate, 3.49%–10.00% today (GG-F5, GG-F6). The only buy-down is the 0% heat pump promotion (GG-F15). | Say "lower rates and longer terms from credit unions". Quote a rate only from the lender's current sheet, with its date. |
| It "only operates in select areas, select communities that are considered disadvantaged" | Nearly every home in our area qualifies (GG-F9). Location matters only for the 0% heat pump promotion. The extra help for low-income tracts ended January 1, 2024, replaced by the credit-score rule. | Good news: far more of our homeowners can use it. Do not present it as a program for disadvantaged communities. |
| Upgrades differ by electric and gas company | Correct (GG-F10). The gap that matters: on an LADWP home, a cool roof or an AC unit alone is not an eligible measure. | GG3 must know the electric utility before it shows anything. |
| "One of very few select contractors" | 1,979 enrolled contractors statewide (GG-F4). | Say "enrolled"; drop "few" and "select". How many are active near us is GG-RQ6. |
| The vetting: customers called, products checked, funding checked | The published checks are narrower (GG-F16). What happened to us may well be more; it has to be told as it happened and shown from our own paper (GG-RES5). | Do not say "state-approved" or "state-vetted": no source allows it and the regulations bar claiming affiliation (GG-F17). Ask the program before the story is published (GG-RQ1). |
| Unsecured, no lien, no prepayment penalty | True for most lenders, by lender, not by rule (GG-F8). | State it per lender we actually use (GG-Q4). |
| Our portal is on the Treasury Department's `ca.gov` site | The program's pages are on `treasurer.ca.gov`; the public contractor directory is on `gogreenfinancing.com`. | The "check us yourself" link is the directory (§4.2). |

### 3.3 Research backlog

| # | Question | Why it matters | Who |
|---|---|---|---|
| GG-RQ1 | Ask the program in writing: may we tell how we were enrolled, and which words are barred beyond the public guide (GG-F17)? | The vetting story is the owner's main trust claim (GG-D3). | Owner sends (Contractors@gogreenfinancing.com, 888-899-9127); Claude drafts |
| GG-RQ2 | The eligible measures list mapped onto our catalog, scope by scope, per electric utility, with each measure's requirements; confirm the columns in the contractor portal. Check that the roofs we install (Owens Corning Duration COOL first) are on the program's cool roof product list. | GG3; the scene and the proposal must agree with the program. | Claude, with the owner's portal |
| GG-RQ3 | Property eligibility for our service area: for each `service-area-zips.ts` zip, the utilities that serve it and what that allows. Share of our past meetings that would have qualified. | GG-Q5; sizes the opportunity. | Claude (public data + our meetings) |
| GG-RQ4 | Lender comparison for our use: rates by term and credit tier, maximum amounts, speed, how the contractor is paid, any contractor fee. | GG-Q4, GG4. | Claude, confirmed by the owner with each lender |
| GG-RQ5 | Payment against savings on three real past jobs: the GoGreen monthly payment next to the bill savings our own bill cuts project. | Proves or tempers GG-D7 before we print it. | Claude, with owner-picked jobs |
| GG-RQ6 | What other participating contractors in Southern California publish about GoGreen: page structure, claims, what looks weak. | GG2; positioning. | Claude |
| GG-RQ7 | Incentives that stack with the loan for the same upgrades (utility rebates, state heat-pump money), with expiry dates. | The offer in GG1; never quote a dead incentive. | Claude |
| GG-RQ8 | How homeowners search for this: the queries, and whether the page should target "GoGreen contractor near me" by city. | GG2 SEO. | Claude |
| GG-RQ9 | Paperwork the program expects per financed job (itemized invoice, permits, photos, certificates of completion) and its inspections. | GG7; the proposal's scope may need to print measure lines. | Owner's enrollment material; Claude reads |
| GG-RQ10 | Program outlook: any CPUC action on funding after June 30, 2027, and the fate of SB 1265 (GG-F18). | How much we build on it (GG-Q10). | Claude, re-checked each quarter; the owner asks the account manager |

### 3.4 Sources (read 2026-11-05)

- S1 https://www.treasurer.ca.gov/caeatfa/cheef/index.asp
- S2 https://www.gogreenfinancing.com/about-us/
- S3 https://www.treasurer.ca.gov/sites/default/files/caeatfa/Initial%20Statement%20of%20Reasons.pdf
- S4 https://www.treasurer.ca.gov/caeatfa/gogreen/additional-funding
- S5 https://treasurer.ca.gov/sites/default/files/caeatfa/2026-08-18-CAEATFA-CEC-Amendment.pdf
- S6 https://www.treasurer.ca.gov/caeatfa/gogreen/home
- S7 Monthly data summary, July 2026: https://www.treasurer.ca.gov/sites/default/files/caeatfa/202607-ggh-monthly.pdf
- S8 Quarterly report, Q1 2026: https://www.treasurer.ca.gov/sites/default/files/caeatfa/202603-cheef-quarterly.pdf
- S9 Program regulations, effective October 10, 2025: https://www.treasurer.ca.gov/sites/default/files/2026-03/current.pdf
- S10 https://www.gogreenfinancing.com/wp-content/uploads/2026/10/0-Interest-Heat-Pump-Promotion-FAQ-8.10.26.pdf
- S11 https://www.gogreenfinancing.com/heat-pump-promotion/
- S12 https://www.gogreenfinancing.com/energy-efficiency-home-loans-california/finance-options/
- S13 Lender chart, March 2, 2026: https://www.gogreenfinancing.com/wp-content/uploads/2026/03/28133-1_GGF_Financing_Home_Chart_SolarBattery_030226.pdf
- S14 https://gogreenfinancing.com/residential
- S15 https://www.gogreenfinancing.com/about-us/faqs/
- S16 Eligible measures list, June 3, 2026: https://gogreenfinancing.com/homemeasures
- S17 Contractor portal FAQ: https://www.gogreenfinancing.com/wp-content/uploads/2026/10/GoGreen-Home-Portal-Contractor-FAQs-FINAL.pdf
- S18 https://www.treasurer.ca.gov/sites/default/files/caeatfa/cool_roof_eligibility_requirements.pdf
- S19 https://www.gogreenfinancing.com/energy-efficiency-home-loans-california/eligible-financing-projects/
- S20 Quarterly report, Q4 2025: https://treasurer.ca.gov/sites/default/files/caeatfa/202512-cheef-quarterly.pdf
- S21 https://www.gogreenfinancing.com/partners/contractor-partners/home/
- S22 Marketing Guidelines for Contractors, July 2, 2026: https://www.gogreenfinancing.com/wp-content/uploads/2026/08/GoGreen-Home-Marketing-Guide-for-Contractors-7.2.26.pdf
- S23 SB 1265 committee analysis: https://autl.assembly.ca.gov/system/files/2026-06/sb-1265-richardson.pdf
- S25 https://www.irs.gov/credits-deductions/energy-efficient-home-improvement-credit
- S26 https://techcleanca.com/heehra/
- S27 https://www.energy.ca.gov/programs-and-topics/programs/inflation-reduction-act-residential-energy-rebate-programs
- S28 https://techcleanca.com/incentives/
- S29 https://www.ladwp.com/residential-services/programs-and-rebates-residential/consumer-rebate-program
- S30 https://www.socalgas.com/savings/rebates-and-incentives

Not verified: any funding past June 30, 2027; SB 1265 after June 24, 2026; a program-wide no-lien or no-prepayment rule; SCE's current rebates.

---

## 4. Resource collection

### 4.1 From the owner

Owner, 2026-11-05: "we have everything we need to start setting it up" (GG-D14). Nothing below blocks this stage. For the page only GG-RES7 (the owner's own links) and the logo file in GG-RES2 are wanted; the rest is kept for the later stage.

| # | Resource | For | Got |
|---|---|---|---|
| GG-RES1 | The approval notice and the signed contractor agreement (out of git, GG-Q9). | GG-D3 wording, dates, our obligations | [ ] |
| GG-RES2 | The GoGreen Financing logo file (the version without the state seal), our co-branded flyer, and the account manager's name. The marketing guide itself is public (S22). | GG-Q1, GG2 | [ ] |
| GG-RES3 | Our listing on the program's contractor directory (URL) and the Tri Pros portal page on the Treasurer's site the owner mentioned. | The "check us yourself" link | [ ] |
| GG-RES4 | The enrollment and training material: slides, manuals, the eligible measures list as given to us, project paperwork forms. | GG-RQ2, GG-RQ9 | [ ] |
| GG-RES5 | The story of the 10 months: dates, what they asked for, who they called, what they inspected. Voice note is fine. | The vetting story (GG1), the page's "how we were approved" | [ ] |
| GG-RES6 | Lender contacts and anything they sent: rate sheets, the application link or portal, contractor terms. | GG-Q4, GG-RQ4 | [ ] |
| GG-RES7 | The "additional resources" the owner already has for the page (GG-D5). | GG2 | [ ] |
| GG-RES8 | Three finished energy jobs to use as worked examples, with the homeowner's bills if we have them. | GG-RQ5, case studies | [ ] |
| GG-RES9 | Who at the program we can ask questions (name, email). | Anything §3 cannot settle | [ ] |

### 4.2 Claude fetches (public)

| # | Resource | Link | For |
|---|---|---|---|
| GG-L1 | Contractor directory ("check us yourself") | https://www.gogreenfinancing.com/energy-efficiency-home-loans-california/find-a-contractor/ | GG1, GG2 |
| GG-L2 | Program home for homeowners | https://www.gogreenfinancing.com/residential | GG2 |
| GG-L3 | What can be financed | https://www.gogreenfinancing.com/energy-efficiency-home-loans-california/eligible-financing-projects/ | GG2 |
| GG-L4 | Eligible measures list (PDF) | https://gogreenfinancing.com/homemeasures | GG2, GG3 |
| GG-L5 | Lender comparison and loan calculator | https://www.gogreenfinancing.com/energy-efficiency-home-loans-california/finance-options/ | GG2, GG4 |
| GG-L6 | Homeowner FAQs | https://www.gogreenfinancing.com/about-us/faqs/ | GG2 |
| GG-L7 | Case studies (five families, one in Los Angeles) | https://www.gogreenfinancing.com/energy-efficiency-home-loans-california/case-studies/ | GG2 |
| GG-L8 | 0% heat pump promotion and its map | https://www.gogreenfinancing.com/heat-pump-promotion/ | GG1, GG3 |
| GG-L9 | The State Treasurer's program page | https://www.treasurer.ca.gov/caeatfa/gogreen/home | GG2 (the `.ca.gov` proof) |
| GG-L10 | Marketing guidelines and co-branded material | https://www.gogreenfinancing.com/partners/contractor-partners/marketing-materials/ | GG0 |
| GG-L11 | Program statistics (monthly summaries) | S7 in §3.4 | GG2 |
| GG-L12 | Cool roof requirement and product list | S18 in §3.4 | GG-RQ2 |

Still to fetch: the program's flyers and presentations (Partner / Contractor tab → Resources), the Spanish pages, each lender's own rate page.

---

## 5. Phases

Each phase gets its own brainstorm → spec → plan. Staged by GG-D13.

| # | Phase | What it produces | Stage | Status |
|---|---|---|---|---|
| GG0 | **Facts in one place** | Our status ("an approved GoGreen Home contractor"), the program's public links (§4.2) and the list of upgrades it finances, held once beside the company facts in `src/shared/constants/company/`, so the page, the section and later the slides read the same words. Built with GG2, not before it. | Now | [ ] |
| GG2 | **Public site** | First the GoGreen page (GG-D5): what GoGreen Home Energy Financing is, a little history, the upgrades it finances, the TPR GoGreen Program, links to GoGreen's and the lenders' own tools (GG-D14). Then the section on the main landing page and the energy services page (GG-D4, GG-D13): a trust indicator that we are energy-efficiency professionals. Nothing about how we applied (GG-D9). | Now, first | [ ] |
| GG1 + GG6 | **The reveal, in the meeting** | The TPR GoGreen Program as a program presentation beside Energy Saver+, always shown with the utilities note (GG-D15, GG-D16); other work on the same loan as part of the opening (GG-D17); the trade scene framed as the tool (GG-D6). §6 is the first cut. | Now, second (GG-Q13) | ⚠️ GG-Q12 |
| GG-X2 | **Energy Saver+ tax credit copy removed** | A small fix on its own (GG-D16, §8). | Now | [ ] |
| GG4 | **Lenders on the proposal** | Each GoGreen lender listed with its own rates on the Funding chapter; rates checked monthly (GG-D18). | Later | [ ] |
| GG5 | **Payment against savings** | The monthly payment beside the monthly bill savings, in the scene's Benefits and on the proposal (GG-D7). Needs the scene's Benefits build and energy impact EI0–EI2. | Later | [ ] |
| GG3 | **What counts for a home** | The upgrades that count by electric utility, the 70 / 30 share, roofs on LADWP homes (GG-Q11). | Later | [ ] |
| GG7 | **Running GoGreen jobs in the app** | Applications, paperwork, tracking. | Out (GG-D13) | — |

Later-stage app parts are built for any financing program, with GoGreen as the first (GG-D19).

### Exploration rounds (GG2, the landing-page section)

Run with `/ui-exploration`. The section sits between Our Past Projects and What Our Clients Say (GG-D24).

| Round | Question | Artifact | Pick |
|---|---|---|---|
| 1 | Which shape carries the status: a certificate, a house drawing, or a plain statement? | [GoGreen Section Studies](https://claude.ai/artifact/PbZ9Ct9XXkANfoiQfUbSjJ) (private): A the credential (recommended) · B the house · C the statement, each at desktop and phone width, light and dark, same words | **All rejected** (GG-D25): too wordy, GoGreen-first. Closest was B, as an interactive demo like the trade scene. |
| 2 | The real 3D scene as the section: which arrangement? | Same link, version 2: A the scene leads · B scene and figures side by side. Stills and figures captured from the trade scene on `feat/trade-scenes-foundation` (example home, summer: $469 → $245 a month; attic 140 → 127°F, exterior wall 124 → 110°F, window glass 92 → 82°F; radiant barrier, window replacement, Cool Life repaint, split system replacement). The owner's logo file carries the state seal; the mock uses the GoGreen Financing mark alone. | **Not it, closer** (GG-D26). |
| 3 | Layout and flow only: how does the scene pull a visitor in, and where do the transformation and GoGreen sit? | Same link, version 3: 1 drag to transform · 2 the model in a window with hotspots · 3 three beats down the page | **2, with corrections** (GG-D27). |
| 4 | Option 2 corrected: opened home, five products, rungs, a GoGreen panel. | Same link, version 4. Stills and figures re-captured from the scene in the Partly open view, summer: shingle roof tear-off with cool roof, attic insulation replacement, attic fan, Cool Life repaint, window replacement. Roof 166 → 153°F, attic 140 → 114°F, ceiling 86 → 80°F, exterior wall 124 → 110°F, window glass 92 → 82°F; $469 → $290 a month, saves $179. Pairing each product with one reading is Claude's presentation choice. | **Rejected** (GG-D28): plain, boring, panel layout. |
| 5 | Three bolder directions, all full width: how does the scene become the stage? | Same link, version 5: A the reveal (scroll-driven) · B the thermal lens (pointer-driven) · C the countdown (plays by itself) | **A, the reveal** (GG-D29); polish round first. |
| 6 | The reveal, polished: what is its potential? | Same link, version 6 | **Another round** (GG-D30): too fast and too busy, summer only, steps not clickable, no movement. |
| 7 | The reveal, calmer: one idea per step, summer and winter, clickable steps, moving heat arrows. | Same link, version 7 | **Record real video first, then corrections** (GG-D31). |
| 8 | The reveal on a real recording: the scene recorded frame by frame at 30 fps (six looping clips, summer and winter), steps jump, Heat replaces Leaks, the phone gets a clean band, "Saves $216 a month". | Same link, version 8 | **Slow; add air sealing** (GG-D32). |
| 9 | The same, with air sealing in the build (far fewer arrows in Rebuilt) and made fast: one recording plays at a time, clips preloaded and lighter, 900 px of scroll per step. | Same link, version 9 | **Start here; owner very dissatisfied; rework later** (GG-D33). Next: the content brainstorm. |

---

## 6. The reveal, first cut (Claude's proposal for the GG1 brainstorm)

Built from `docs/sales/sales-frameworks.md`, `docs/sales/due-diligence-story.md` and `docs/proposal/financing-presentation.md`. None of this is agreed.

| When | What the homeowner learns | Why there (our own frameworks) |
|---|---|---|
| Before the visit: the site, the confirmation messages | Tri Pros is an approved GoGreen Home contractor (GG-D10), GoGreen Home is a State of California-backed program, and here are the program's own tools (GG-D14). | The validator's first question is "are they real" (public-site D1, R7). A claim they can verify on a `.ca.gov` or program site is worth more than any we make ourselves. |
| Phase 3, due diligence, after the Circle of Pain | Our status, stated plainly, with no account of how we applied (GG-D9). Framed as a test for any contractor: "look them up in the program's directory". | "Credentials presented cold feel like a sales pitch"; after the pain they are the answer. Authority transfer and the contrast effect: the checklist does the comparing, and this item is one most contractors cannot tick. Raises perceived likelihood in the Value Equation. |
| Phase 4, the scope, in the trade scene | These upgrades are the ones the program finances, and the scene shows what each one does to the bills. | "Sell the vacation": the scene already carries comfort and savings (R118). GoGreen adds that a third party chose the same upgrades. |
| Phase 5, the price bridge | The total, then at once the monthly payment at the lender's current rate, set against the monthly savings. The loan terms (no collateral, early payoff) said per lender (GG-F8). | "Immediately bridge to monthly payment" and the Offset Narrative already in the financing doc. Lowers effort and risk in the Value Equation. |
| With the scope, up front (GG-D17) | One loan for the energy upgrades and the remodel: other work rides on the same loan, within the program's 30% share. | Offer stacking, and the 1-2-3 scope rule. |
| Never | Leading with financing in Phase 1, quoting a rate before the lender does, or urgency that is not real. | The financing doc's "When to Introduce Financing"; "Real: don't fabricate urgency". |

---

## 7. Where it touches the codebase (read 2026-11-05)

| Area | What exists today | GoGreen's likely touch |
|---|---|---|
| Company facts | `src/shared/constants/company/` (`certifications.ts`, `credentials.ts`, `licenses.ts`, `service-area-zips.ts`). Public-site R5: every fact comes from here. | Our GoGreen status and directory link (GG0). |
| Public site | `src/app/(frontend)/(site)/`: `services/energy-efficient-construction/`, `about`, `experience`, homepage. | The page and the section (GG2). |
| Company presentation | `src/features/meeting-flow/constants/who-we-are-slides.ts`: the six due-diligence slides, comparison, extras, closing. `src/shared/constants/company/contractor-comparison.ts`. | The vetting story and a comparison row (GG6). |
| Programs | `src/features/meeting-flow/constants/programs.ts` (`tpr-monthly-special`, `energy-saver-plus`, `existing-customer-savings-plus`), `lib/qualify-programs.ts`. The applications spec moves programs into the proposals module (A9, A10; unbuilt). | GG-Q2, GG-Q6. |
| Financing | Tables `finance_providers`, `finance_options` (term in months, interest rate). `src/shared/modules/proposals/core/constants/financing.ts`, `lib/financials`, `src/shared/lib/loan-calculations.ts`, `src/features/proposal-flow/hooks/use-funding-choice.ts`. | GoGreen lenders and options; when they may be offered (GG4). |
| Proposal page | Chapters Overview → Trusted contractor → Past results → Scope of work → Funding → Next steps (`proposalSteps`); the energy chapter after Funding is planned. | Trusted contractor (status), Funding (options), energy chapter (payment against savings). |
| Bill savings | `TRADE_BILL_CUTS` and the bill-cutting scopes in `src/shared/modules/construction/core` (part on the scenes branch); `electricProvider` on the customer (LADWP or SCE; gas is SoCalGas). | Eligibility by utility (GG3); the savings side of GG5. |
| Trade scene | `feat/trade-scenes-foundation`: Benefits (R127, R185), the upgrade registry (R128), product proof (R115). | GG-D6, GG5: which upgrades the program finances; the payment beside the savings. |
| Business docs | `docs/proposal/financing-providers.md` lists the lenders we use (360 Finance, Figure) and could; `financing-presentation.md` has the price bridge and the offset story. | GG1 rewrites the offset story with GoGreen's terms; providers doc gains the GoGreen lenders. |

---

## 8. Drift found while reading (not fixed)

| # | Where | What |
|---|---|---|
| GG-X1 | `docs/programs/README.md:19-23` | Names the programs "TPR Monthly Special" with id `energy-saver` for the energy one; the code has `energy-saver-plus` and "TPR {month} Priority Program" (`src/features/meeting-flow/constants/programs.ts:54-104`). |
| GG-X2 | `src/features/meeting-flow/constants/programs.ts:104-140`, `docs/programs/energy-saver-incentive.md` | Energy Saver+ sells the federal 25C tax credit ($1,200) as its headline: the incentive, the story, the timeline, two FAQs and a key stat. The credit ended for work placed in service after 2025 (IRS, S25), so the screen shows homeowners a credit they cannot claim. Fix proposed in GG-Q6; not touched. |

---

## 9. Change log

| Date | Change |
|---|---|
| 2026-11-05 | Tracker opened from the owner's brain dump: rulings GG-D1–D8, questions GG-Q1–Q9, research backlog, resource collection, phases GG0–GG7, first-cut reveal. |
| 2026-11-05 | Owner answered the open questions: rulings GG-D9–D20. The epic is re-staged as presentational (GG-D13): public site first, the in-home presentation second, app work later, running jobs in the app out. New questions GG-Q12 (the TPR GoGreen Program's rules) and GG-Q13 (where this stage ends); GG-Q11 parked. |
| 2026-11-05 | Research pass 1 (primary sources, §3.4): facts GG-F1–F19, the brain dump checked (§3.2), links GG-L1–L12. New questions GG-Q10 (funding ends June 30, 2027) and GG-Q11 (roofs on LADWP homes); GG-Q1 and GG-Q6 rewritten on the findings. |
| 2026-11-06 | Round 7 answered (GG-D31); round 8 published: the reveal on a real recording of the trade scene. How it was recorded: Playwright with its clock paused and stepped 1/30 s per screenshot on the trade-scenes dev server, encoded to looping MP4 + WebM; scripts and clips live only in that session's scratchpad. |
| 2026-11-06 | §10 Energy investment plan: the owner's brain dump ordered into requirements EIP-R1–R10, building blocks, blockers EIP-B1–B6, order EIP0–EIP4, questions EIP-Q1–Q4. Belongs in the trade scene tracker; parked here while that file is open in another session. |

---

## 10. Energy investment plan (EIP): the home's investment case, in the trade scene's Benefits

> Owner, 2026-11-06, after round 9 of the landing-page section. **Belongs in the trade scene epic tracker** (`docs/plans/2026-10-16-trade-scenes-epic.md`, on `feat/trade-scenes-foundation`); it sits here until that file is free to take it (it was mid-edit in another session when this was written). GoGreen is one building block of this plan, not the plan. **Owner 2026-11-06: "this 'investment plan' section ISN'T centered around GoGreen. GoGreen is a great option if they qualify, but not the only reason to go through with the investment plan."** The plan stands on its own numbers (price, payment, savings, net monthly); GoGreen appears as the best option when the home qualifies.

### 10.1 What the owner described (his words, ordered)

| ID | Requirement | Source |
|---|---|---|
| EIP-R1 | GoGreen is introduced **in the Benefits section of the trade scene**: "ultimately what we would want to do is combine it with our scope pricing calculator". | 2026-11-06 |
| EIP-R2 | **A price at the moment of the pick:** "When we select a specific upgrade we could already give a price for it and then show it right next to the savings in the benefits." | 2026-11-06 |
| EIP-R3 | **The framing is net monthly:** the monthly payment set beside the monthly savings, "a perceived reduction in how much things would actually cost for the monthly payments". | 2026-11-06 |
| EIP-R4 | **A second view in Benefits**, not a new section: "a second location or a tab that we click on to switch, maybe the header right next to the Tri Pros build badge". The switch is between the matrix + timeline artifact and the cost of this build. | 2026-11-06 |
| EIP-R5 | **Two ends of one summary:** "a beautiful summary of benefits on one end and the monthly payments on the other end". | 2026-11-06 |
| EIP-R6 | **Payments come from our existing financing partners and their rates.** GoGreen is one of them, "a special program, so they will have to qualify for that program". | 2026-11-06; GG-D11 (each lender listed), GG-D18 (Claude checks rates monthly) |
| EIP-R7 | All of it lives **in that tab of the Benefits section**. | 2026-11-06 |
| EIP-R8 | This tab is where the homeowner **first meets GoGreen**, as one option among the partners, shown when the home qualifies. The plan is not centred on it: it must read whole and persuasive for a home that does not qualify. The rep's conversation threads (urgency, scarcity, price conditioning, anchoring, social proof, trust) are written for the plan; GoGreen gets its own thread inside it. | 2026-11-06 (two rulings); GG1 |
| EIP-R9 | Built for any financing program, not GoGreen alone. | GG-D19 |
| EIP-R10 | Scope: the "energy investment plan" for the home = picked upgrades → price per upgrade → build total → payment per partner → net monthly against the savings. Other work on the same loan is sold up front (GG-D17). | 2026-11-06; GG-D17 |

### 10.2 Building blocks (what exists, read 2026-11-06)

| Block | Where it stands | Gap for the EIP |
|---|---|---|
| **Scope Pricing engine** | Sales calculators epic `docs/plans/2026-09-26-sales-calculators-epic.md` §3.3 (PR): remodel-x formulas ported in C0 (21 Formulas, unit costs §7.2 awaiting the owner's review D10); C0 Task 9 awaits the owner. | Not shipped; no price per scope in the app yet. The scene's picked upgrades must map onto its scopes (the scene already has `lib/upgrade-scopes.ts`, `picked-upgrades.ts`, `rounded-costs.ts`, `today-costs.ts`: verify what they price today). |
| **Financing data** | Tables `finance_providers` (label, accessor, logo) and `finance_options` (term in months, interest rate); `src/shared/modules/proposals/core/constants/financing.ts` (min financed $3,500, deposit cap); `src/shared/lib/loan-calculations.ts`; the proposal's Funding chapter and `pay-card.tsx` read these. | No room for a **program** above lenders (GoGreen holds several lenders), qualification rules (credit floor 580, utility, 70% eligible measures), amount floor/ceiling ($50k), rate as-of date, dealer fee, or "which upgrades qualify". Schema design needed (ADR 0005 route, one truth per fact). |
| **GoGreen facts** | Tracker §3.1 GG-F1–F19 with sources; lenders and current rates not yet collected (GG-RQ backlog, GG-RES4). | The lender list we can actually offer, their rates and terms, in a form the app can evaluate. |
| **Savings figure** | Benefits computes "Today $X → $Y, saves $Z a month" from bills + repairs avoided (`use-benefits-figures`, `lib/scene-savings.ts`). | For net monthly the bill part and the repairs part may need to read separately (a payment against repairs avoided is a different sentence). |
| **Benefits UI** | Shipped (R127, R185): head with the Tri Pros build badge, costs editor, matrix, two-futures timeline. | The second view and the switch in the head are new. |
| **Qualification** | `lib/qualify-programs.ts` in the meeting flow (TPR programs); customer `electricProvider` (LADWP / SCE). | GoGreen qualification is per home and per measure (GG-Q11 cool roof on LADWP). |

### 10.3 Blockers, in the order they bite

| ID | Blocker | Unblocked by |
|---|---|---|
| EIP-B1 | **No price per upgrade.** The Scope Pricing engine is not in the app; unit costs await the owner's review (calculators D10), C0 Task 9 awaits the owner. | Owner: calculators D10 + Task 9. Then an upgrade → scope → price path for the scene. |
| EIP-B2 | **The financing model cannot hold a program.** Providers and options only; no qualification, limits, dates, eligible measures. | A schema design (brainstorm → spec) for programs, lenders, options, rules; owner rules on the shape. |
| EIP-B3 | **We do not have the lender list and rates we can offer through GoGreen**, nor the current rates of our other partners (docs name 360 Finance and Figure). | Owner (GG-RES4: the lenders we are set up with); Claude collects published rates monthly (GG-D18). |
| EIP-B4 | **Qualification rules are prose**, not data: credit floor, utility, 70/30, measure eligibility by utility. | Comes with EIP-B2's design. |
| EIP-B5 | **Net monthly needs the savings split** (bills vs repairs avoided). | Read `scene-savings.ts`; a small change on the scenes branch if the split is not exposed. |
| EIP-B6 | **This section lives in the wrong tracker.** The trade scene tracker is on the branch and open in another session. | Move §10 there when that file is free; one change-log line each side. |

### 10.4 Order of work (each step brainstorm → spec → plan; nothing built on "go ahead")

1. **EIP0** This register (done 2026-11-06). Owner 2026-11-06: "I like the plan." EIP3 is brainstormed first, in a fresh session (handoff below); §10.5 is answered there.
2. **EIP1 Financing options schema**: programs over lenders over options, with rules, limits and dates; GoGreen's facts aggregated into it. Unblocks EIP-B2, B4, and the proposal's Funding chapter later.
3. **EIP2 Price per upgrade**: the scene's picks onto Scope Pricing. Depends on calculators C0 (EIP-B1).
4. **EIP3 The Benefits tab** (`/ui-exploration`): the switch in the head, the two ends of the summary, the net-monthly line, GoGreen's first appearance. Can start on mocks before EIP1/EIP2 ship, with figures by hand.
5. **EIP4 The rep's threads and copy** for that tab (the plan's own, with GoGreen's inside it; GG1), then the landing page and the proposal reuse them.

### 10.6 Handoff to the EIP3 session (written 2026-11-06)

Prompt for the fresh session: *"Brainstorm the Energy investment plan tab of the trade scene's Benefits section: read `docs/plans/2026-11-05-gogreen-financing-epic.md` §10 (requirements, blockers, order, open questions, this handoff) and the trade scene tracker on `feat/trade-scenes-foundation` (`docs/plans/2026-10-16-trade-scenes-epic.md`, Benefits R127/R185; `.worktrees/trade-scenes`, another session's tree: read only). Use `superpowers:brainstorming`, then `/ui-exploration` for the tab's mocks on hand figures. The plan is the home's own investment case (price, payment, savings, net monthly); GoGreen is one option when the home qualifies, never the centre. No app code; mocks only; nothing built on 'go ahead'. Figures for the example home: Benefits reads $469 → $290, saves $179 a month at the default bills; $216 at a $320 electric bill; both count repairs avoided."*

### 10.5 Open (owner), with a default each

| ID | Question | Default |
|---|---|---|
| EIP-Q1 | The tab's name. | "Energy investment plan", the owner's phrase. |
| EIP-Q2 | Which partners show: every partner with a rate, or the best option plus GoGreen when the home qualifies? | The best option the home qualifies for leads; GoGreen takes that place when it qualifies; the rest behind a tap. |
| EIP-Q3 | Does the price show in Modify at the moment of the pick, in the tab, or both? | Both: the pick shows its price; the tab carries the total. |
| EIP-Q4 | Does the proposal's Funding chapter read the same engine? | Yes, later; one engine, two surfaces. |
