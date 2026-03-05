# Financing Presentation — Tri Pros Remodeling

## Core Principle

**Never lead with total price.**

The total contract value is a large number. Large numbers create hesitation. Present value first, present scope second, present the monthly payment — and let the total price be a supporting detail, not the headline.

---

## The Sequence

```
1. Establish value (scope, outcomes, credentials)
   ↓
2. Confirm they want it ("Does this feel like the right direction?")
   ↓
3. Present total price (briefly)
   ↓
4. Immediately bridge to monthly payment
   ↓
5. Offer multiple term options
   ↓
6. Introduce incentive (if applicable)
   ↓
7. Ask for the decision
```

If you present the total price before the customer has decided they want the solution, you're asking them to evaluate cost before value. You will lose.

---

## The Price Bridge Script

> "The total investment for everything we discussed is $[X]. Now, the way most of our customers actually move forward is through financing — which brings your monthly payment to about $[monthly payment] per month. Over [X] years, that's around $[daily cost] a day to have [primary outcome they care about most — e.g., a roof that won't leak for 30 years / an HVAC system that cuts your bill in half].
>
> We have a couple of different term options depending on what monthly payment works best for you. Would you like me to show you those?"

Then show the financing options — ideally two term lengths so they feel like they're choosing, not being sold.

---

## Monthly Payment Framing Examples

| Comparison | Script |
|---|---|
| Car payment | "That's less than most car payments — and this adds to your home's value, not depreciates." |
| Daily cost | "You're looking at about $[X] a day. Most people spend more than that on coffee." |
| Bill offset | "Once the [solar/insulation/HVAC] is installed, your energy bill drops by roughly $[Y]/month — meaning the net cost to you is only $[monthly - savings]/month." |
| Renting vs. owning | "Right now you're paying [problem cost] and getting nothing back. This converts that into an asset." |

---

## Loan Math Reference

Monthly payment calculations are handled in the codebase at:

**`src/shared/lib/loan-calculations.ts`**

Key variables:
- Principal (total contract price minus down payment, if any)
- Annual interest rate (set by financing provider)
- Loan term in months

**Standard terms to present**:
- 10 years (120 months) — lower total interest, higher monthly
- 15 years (180 months) — lower monthly, more accessible
- 20–25 years (for larger projects like solar) — lowest monthly

**Rule**: Lead with the term that gives the most attractive monthly payment, then offer the shorter term as an option for customers who want to pay less total interest.

---

## When to Introduce Financing

**Ideal timing**: After scope is agreed and before closing.

Do not introduce financing before the customer is sold on the solution. Talking financing too early signals that you expect price to be a problem — which plants that seed in their mind.

**Do say**:
> "I want to show you how most of our customers actually structure this."

**Don't say**:
> "I know this is a lot of money, but we do have financing..."

The first is matter-of-fact. The second is apologetic and undermines the value you've built.

---

## Energy-Efficient Projects: The Offset Narrative

For solar, insulation, HVAC, windows, and roofing, the monthly payment often competes directly with the homeowner's current monthly utility bill.

**Example framing for solar**:
> "Your current electric bill is $[X]/month. Once the system is installed, that bill essentially goes away — or drops significantly. Your solar payment is $[Y]/month. So your actual out-of-pocket change is $[Y - X]/month — and in [X] years when the loan is paid off, the electricity is free."

**Example framing for insulation + HVAC**:
> "Right now you're paying about $[current bill]/month in heating and cooling. This system reduces that by roughly 40%. So your monthly savings are about $[savings]. The financing payment is $[payment]. You're essentially paying $[payment - savings]/month more than you are now — for a home that's significantly more comfortable and a system with a 20-year lifespan."

The offset narrative converts a price objection into a math problem — and the math often works in TPR's favor.

---

## Incentives and Their Effect on Monthly Payment

A meaningful incentive should be presented in terms of its monthly payment impact, not just the dollar value:

> "$500 off sounds nice. But when you see it as a financing reduction, it actually brings your monthly payment down from $[X] to $[X - impact]. That's [$ per month] every month for the life of the loan."

This makes the incentive feel more real and more urgent.

---

## Financing Provider

> **Note**: Fill in actual financing provider details.

- **Provider name**: `[Financing partner — GreenSky, EnerBank, Service Finance, etc.]`
- **Application process**: `[Online, in-person, or hybrid — describe how customer applies]`
- **Approval time**: `[Usually minutes / same-day]`
- **Rates offered**: `[X% – X% depending on creditworthiness and term]`
- **Deferred interest options**: `[If applicable — e.g., 18-month same-as-cash]`

Always confirm current rates with the financing provider before quoting a specific monthly payment. Use the loan calculation tool for accuracy.

---

## When a Customer Does Not Qualify for Financing

If a customer doesn't qualify for the preferred financing product:

1. Check if there are alternative financing options (co-signer, second provider)
2. Explore a smaller scope that reduces the total (phase the project)
3. Discuss cash/check payment with a potential incentive for paying upfront
4. Set a follow-up timeline: "When would you be in a position to move forward?"

Do not simply abandon the conversation. A customer who doesn't qualify today may qualify in 3–6 months — and keeping them in the pipeline has value.
