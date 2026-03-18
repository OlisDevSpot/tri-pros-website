# Revenue Model — Tri Pros Remodeling

## Sales Funnel Overview

```
LEAD GEN
  ↓
Telemarketing outreach / Social media inquiry
  ↓
APPOINTMENT SET
  ↓
In-Home Meeting scheduled (both decision-makers confirmed)
  ↓
IN-HOME MEETING
  ↓
Agent visits home → Discovery → Presentation → Price → Close attempt
  ↓
PROPOSAL CREATED & SENT
  ↓
Multi-step proposal built in system → DocuSign sent via email
  ↓
FOLLOW-UP
  ↓
Proposal view tracked → Agent notified → Cadenced follow-up
  ↓
SIGNED CONTRACT
  ↓
DocuSign completed → Project enters production queue
  ↓
PROJECT DELIVERED
  ↓
Project review & Referral/upsell product presentation
  ↓
Post-project review / referral request
```

---

## Stage 1: Lead Generation

**Channels**:
- **Telemarketing** — Outbound calls to targeted homeowner lists in our service area
- **Social media** — Paid campaigns (Facebook, Instagram, Google) driving form fills or direct calls

**Goal at this stage**: Set an in-home appointment with both decision-makers (homeowner + spouse/partner) present.

**Key metric**: Appointment set rate (calls → booked meetings)

**CRM entry point**: Lead is created in **Notion** with contact information and appointment date/time.

---

## Stage 2: In-Home Meeting

**Who attends**: One TPR agent + ideally both homeowners

**Duration**: 45–90 minutes

**Goal**: Understand needs, present solutions, attempt same-day close, or leave with a clear proposal to send.

**Tools used**:
- Proposal system (for live demo or post-meeting build)
- Material samples
- Portfolio (before/after project photos)
- Laptop or tablet

**Key metric**: Meeting-to-proposal rate (meetings → proposals created)

For full meeting framework, see `sales/in-home-meeting-playbook.md`.

---

## Stage 3: Proposal Creation & Delivery

**Where built**: Proposal flow application (`/proposal-flow/`) — 7-step agent-facing process

**Proposal contents**:
1. Customer information
2. Scope of work (line-item detail by trade)
3. Materials selection
4. Past results (portfolio examples)
5. Incentives / pricing
6. Financing options
7. Agreement / terms

**Delivery**: DocuSign envelope sent to customer email. Agent is notified when the proposal is viewed.

**Key metric**: Proposal creation rate; proposal open rate

For proposal creation guidance, see `proposal/creation-guide.md`.

---

## Stage 4: Follow-Up

**Trigger**: Proposal view notification → agent takes action

**System support**: Proposal view tracking is built in; see `sales/follow-up-cadence.md` for the full follow-up schedule.

**CRM updates**:
- **Notion**: Deal stage updated as proposal progresses (Sent → Viewed → In Negotiation → Won/Lost) Task items for follow-up activities

**Key metric**: Proposal-to-signed rate; days-to-sign

---

## Stage 5: Signed Contract

**Close mechanism**: DocuSign — can be completed by customer digitally, on any device, at any time.

**Supports same-day close**: Agent can open DocuSign on a tablet in the customer's home and walk them through signing before leaving.

**Key metric**: Close rate (proposals sent → signed); average contract size

---

## Stage 6: Production

**Handoff**: Signed contract → project enters production workflow

**Tracking**: Monday.com items updated; project status visible to team

**Post-project**: Request for review/testimonial, referral ask

---

## Key Metrics to Track

| Metric | Definition | Target (fill in) |
|---|---|---|
| Appointment set rate | % of outreach attempts → booked meetings | `[X%]` |
| Meeting-to-proposal rate | % of meetings → proposals created | `[X%]` |
| Proposal open rate | % of sent proposals → viewed | `[X%]` |
| Proposal-to-signed rate | % of proposals → signed contract | `[X%]` |
| Average contract size | Avg dollar value of signed contracts | `[$X,XXX]` |
| Days-to-sign | Avg days from proposal sent to signature | `[X days]` |
| Same-day close rate | % of contracts signed during/same day as meeting | `[X%]` |

---

## Tech Stack Supporting Revenue Operations

| System | Role |
|---|---|
| Pipedrive | Deal pipeline (stages, activities, forecasting) |
| Monday.com | Task management, project tracking, lead follow-up |
| DocuSign | E-signature for contracts |
| TPR Proposal System | Proposal creation, delivery, view tracking |
| Upstash QStash | Background jobs (email notifications on proposal view, etc.) |
| Resend | Transactional emails (proposal sent, proposal viewed alert) |
