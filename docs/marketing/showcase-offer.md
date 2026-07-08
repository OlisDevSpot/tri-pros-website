# The Showcase Offer — Canonical Definition

> **This is the source of truth for the Showcase offer.** Any funnel, ad, landing
> page, or campaign that implements Showcase derives from THIS document. Origin:
> design spec `docs/superpowers/specs/2026-06-17-showcase-funnel-system-design.md` §1
> (2026-06-17); promoted to this living doc after the 2026-07-07 cross-reference
> triage (see [Provenance](#provenance)).

## what-it-is

**Showcase is a casting call, not a discount ad.** Tri Pros — positioned (in
mindset, not necessarily in copy) as a large, established construction company
revamping its brand presence — is **selecting a limited number of homes** to
feature as portfolio showpieces.

## the-deal

- Selected homeowners receive a **discounted, AAA-grade ("best of the best")
  remodel** — quality is non-negotiable because the result must photograph/film
  beautifully.
- In exchange: **before / during / after photo + video rights**, and the home is
  featured on our website and ads.
- Business rationale: future customers see real Tri Pros work without us having
  "hired" testimonials — it manufactures social proof.
- **The exchange is deliberately soft-pedaled in customer-facing copy.** Live
  funnels say only "featured in our showcase"; they never spell out the rights
  transfer. Ads must match that restraint. The explicit terms surface in the
  in-home meeting and the contract.
- The discount is real but **never quantified anywhere public** ("at a Showcase
  price" is the entire public statement of it).

## conversion-mechanics

1. **Per-trade, never generic.** Kitchen Showcase, Bathroom Showcase,
   Complete-Interior Showcase. Each funnel/ad speaks only to its trade.
2. **Real, stated scarcity.** "We're selecting **5** [kitchens] in your area."
   Limited slots + "does your home fit the look we're going for" is the core
   psychological engine (scarcity + qualification/casting).
3. **Selectivity reframes the transaction.** The homeowner is *applying to be
   chosen*, not *requesting a quote*. Raises perceived value, suppresses
   price-shopping.
4. **Homeowners only.** Renters can't grant remodel/photo rights; the funnels
   ingest them as CRM leads but suppress the Meta `Lead` optimization signal
   (see [enforcement](#where-the-code-enforces-it)).

## hard-guardrails

Apply to ALL Showcase surfaces (funnels, ads, landing pages, emails):

- **No pricing.** Pricing happens in the in-home meeting. "Showcase price" is a
  frame, never a number.
- **No government / rebate / tax-credit language.**
- **No promises not explicitly approved.** No insurance/warranty-transfer claims,
  no "free 3D design" or similar sweeteners unless Oliver approves them into this
  doc first.
- **Never "get a quote."** Quote-language (including Meta's `GET_QUOTE` CTA
  button) contradicts the apply-to-be-chosen reframe. Approved CTAs:
  `APPLY_NOW`, `LEARN_MORE`.
- **Truthfulness in proof imagery.** Portfolio before/afters may be framed as
  "the standard every Showcase home gets" — never falsely claim a pre-Showcase
  project was a Showcase selection.

## approved-vocabulary

The language system, verbatim. Ads must **message-match** these funnel phrases so
the click lands mid-sentence:

| Phrase | Where it lives |
|---|---|
| "AAA-grade … at a Showcase price" | funnel heroes (`kitchens.ts` / `bathrooms.ts` / `complete-interior.ts`), OG metadata |
| "See if your home qualifies…" / "See if you qualify" | hero subhead + CTA labels, PII step CTA |
| "We're selecting 5 [kitchens/bathrooms] in your area" | hero scarcity line, guarantee block |
| "Showcase projects are available to homeowners." | ownership step subtitle |
| "Showcase [kitchens] are selected by neighborhood." / "We select Showcase homes by area." | ZIP step |
| "You're on the Showcase list." / "…review your home against this round's Showcase criteria" / "If selected…" | confirmation step |
| "Showcase-grade work, guaranteed" | guarantee blocks |
| "Claim your Showcase spot" / "Start your Showcase project" | landing CTA interstitials |

Canonical copy sources: `src/shared/domains/funnels/constants/{kitchens,bathrooms,complete-interior}.ts`,
`src/shared/domains/funnels/lib/steps/*.ts`, `src/shared/domains/funnels/constants/cta-copy.ts`.

## rules-for-new-funnels

Any new trade funnel implementing Showcase must:

1. Set `FunnelSpec.offer = 'showcase'` and speak ONLY its trade.
2. Open with a branded hero: headline (`AAA-grade … at a Showcase price` shape),
   qualification subhead, scarcity line with a real number, single qualify CTA.
3. Gate on `ownership` (renters ingested, `Lead` suppressed) unless the trade
   genuinely has no ownership requirement.
4. Frame ZIP as *selection by area*, PII as *"Where should we send your Showcase
   details?"*, confirmation as *review-for-fit + first-come*.
5. Honor every [hard guardrail](#hard-guardrails).

## rules-for-ads

Any Meta ad (or other paid placement) implementing Showcase must:

1. Lead with **selection scarcity** ("We're selecting 5 … in your area") and/or
   the **AAA-grade-at-a-Showcase-price** value line.
2. Close with the qualification ask ("See if your home qualifies") — never a
   quote/estimate/consultation ask.
3. CTA button: `APPLY_NOW` (preferred) or `LEARN_MORE`. **Never `GET_QUOTE`.**
4. Land on the trade's funnel subdomain with the standard UTM convention
   (`utm_source=meta&utm_medium=paid&utm_campaign=<campaignKey>&utm_content=<adKey>`).
5. Campaign-as-code: ads live in `scripts/meta/campaign-specs/*.campaign.ts`
   (see `scripts/meta/DOCS.md#campaign-as-code`) — never hand-built in Ads Manager.

## where-the-code-enforces-it

- `src/shared/domains/funnels/lib/tracking/lead-qualification.ts` —
  `firesLeadOptimization`: `ownership='rent'` → no Meta `Lead` (browser + CAPI).
- ZIP gate (`resolve-zip.ts` + `SERVICE_AREA_ZIPS`) — funnels reject out-of-area;
  ad geo targeting derives from the same ZIP source (`scripts/meta/campaign-specs/lib/geo.ts`).
- `FunnelSpec.offer: 'showcase'` on all three live funnel specs.

## provenance

Cross-reference triage (2026-07-07, four parallel research passes — repo docs,
funnel implementation, memory + git history, Notion):

- **Sole canonical origin:** design spec `2026-06-17-showcase-funnel-system-design.md`
  §1 (commit `0fb621d5`). Never superseded; no competing definition ever existed
  or was deleted (git pickaxe verified).
- **The offer lives entirely in this codebase.** Notion contains no definition
  (owner decision 2026-07-07: anything outside the codebase is not relevant to
  the Showcase offer). Old third-party ad copy ("[GM]" campaigns) echoed the
  framing but is NOT a source.
- The live funnels implement the offer faithfully but soft-pedal the rights
  exchange — that restraint is intentional and part of the definition above.
