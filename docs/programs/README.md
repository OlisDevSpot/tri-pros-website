# TPR Sales Programs — Agent Reference Guide

This directory contains the pitch scripts, deal structures, and objection-handling guides for all active TPR in-home sales programs.

---

## What Is a Program?

A **program** is a structured presentation framework that an agent uses during Phase 2 of the in-home meeting. After completing Phase 1 discovery (learning about the customer's home, needs, and budget), the agent selects the program that best matches the customer's profile and opens `/meetings` on their laptop or tablet.

The `/meetings` tool then guides the agent through a step-by-step presentation — with supporting copy, buy triggers, and a real case study panel at every step. Every program ends with a direct path to proposal creation.

---

## The Three Active Programs

| Program | ID | Best For |
|---|---|---|
| [TPR Monthly Special](./tpr-monthly-special.md) | `tpr-monthly-special` | New customers, any trade, time-sensitive offer |
| [Energy-Saver Incentive](./energy-saver-incentive.md) | `energy-saver` | High utility bills, comfort issues, rebate interest |
| [Existing Customer Savings+](./existing-customer-savings-plus.md) | `existing-customer-savings-plus` | Returning TPR customers, Phase 2 projects |

---

## How to Choose a Program

Use the following signals from Phase 1 discovery to pick the right program:

### Choose **TPR Monthly Special** if:
- This is their first interaction with Tri Pros
- They're interested in any trade (no specific utility/energy concern driving the call)
- They responded to a specific monthly offer or promotion
- They want a complete, priced scope today with a clear timeline

### Choose **Energy-Saver Incentive** if:
- They mention high utility bills ($200+/month) or comfort issues (drafty rooms, hot upstairs, etc.)
- They're interested in rebates, tax credits, or "green" upgrades
- They have older HVAC, minimal insulation, or outdated windows
- Their primary pain point is energy cost or home comfort, not aesthetics

### Choose **Existing Customer Savings+** if:
- You can confirm they've had previous work done by Tri Pros
- They're calling about a new phase or additional scope on the same home
- They reference the previous project or previous crew by name
- Your CRM shows prior install history for this address

---

## Program Structure

Every program follows the same 5-step flow:

1. **Context / Problem** — establish why we're here; validate the customer's situation
2. **Credibility / Solution** — position Tri Pros as the right answer
3. **The Offer** — present the package, program, or rebate structure
4. **The Math** — make the financial case: investment vs. return
5. **The Close** — remove friction and guide toward proposal creation

Each step has:
- A **headline** shown prominently on screen (customer-facing)
- **Body copy** the agent walks through
- A **buy trigger** (urgency, scarcity, authority, or risk-reduction message) shown at the top of the screen
- A **case study** panel with a real SoCal customer story

---

## General Presentation Tips

**Keep the screen facing the customer.** The `/meetings` tool is designed to be presentation-mode — large text, high contrast, meant to be seen across a kitchen table.

**Use the case study at every step.** Don't skip it. The case studies are the most powerful trust-builders in the presentation. Specifically reference the customer's city or situation when the case study location or context matches.

**Don't rush the buy triggers.** Let the urgency or scarcity message sit on screen. Let the customer read it. The silence is intentional.

**Create Proposal is always one click away.** If the customer says "yes" at any step — don't wait for Step 5. Hit Create Proposal immediately.

---

## Updating Programs

Program content lives in:
```
src/features/meetings/constants/programs.ts
```

Buy trigger helper utilities live in:
```
src/features/meetings/constants/buy-triggers.ts
```

To add a new program: add a new `MeetingProgram` object to the `MEETING_PROGRAMS` array in `programs.ts`, then create a corresponding markdown doc in this directory.
