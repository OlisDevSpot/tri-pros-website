# Follow-Up Cadence — Tri Pros Remodeling

## Why Follow-Up Wins

Most contracts are not signed on the first attempt. Research across home improvement sales consistently shows that 60–80% of eventual closes happen after the first meeting — through follow-up. A cold proposal is not a lost deal. It's an incomplete conversation.

**The system advantage**: TPR's proposal platform notifies the agent the moment the customer opens the proposal. This precision enables follow-up at the exact moment of peak engagement — when the customer is actively reading and thinking about the project.

---

## The Cadence

### Day 0 — Proposal Sent

**Action**: Send proposal via DocuSign / proposal system

**Message**: Brief, warm email or text confirming the proposal is on its way.

> "Hi [Name] — great meeting you today. Your proposal is on its way to your inbox. Take a look when you get a chance, and let me know if anything needs clarification. I'll follow up with you [day/time we agreed on]."

**CRM action**: Move Pipedrive deal to "Proposal Sent." Create Monday follow-up task for Day 1.

---

### Day 1 — Proposal Viewed (Trigger-Based)

**Trigger**: Agent receives notification that the proposal was opened

**This is the highest-leverage follow-up moment.** The customer is looking at it right now, or just finished.

**Action**: Call within 1–2 hours of the notification. If no answer, send a text.

**Call script**:
> "Hi [Name], it's [Agent] from Tri Pros. I saw the proposal came through — just wanted to make sure you got it and see if you had any initial questions. Even a quick five minutes?"

**Text fallback**:
> "Hi [Name], just wanted to make sure the proposal landed okay and see if anything jumped out at you. Happy to answer any questions — just reply here or give me a call."

**Goal**: Re-warm the conversation, surface any objections, move toward a commitment.

---

### Day 1 — If Proposal Not Yet Opened

**Action**: Send a brief check-in

> "Hi [Name], just checking in to make sure the proposal came through — sometimes these end up in spam. Let me know if you didn't receive it and I'll resend."

This opens the conversation and often triggers them to open it.

---

### Day 3 — Value-Add Touch

**Use if**: No response after Day 1 follow-up, or conversation is stalled.

**Action**: Share something relevant and useful — not a sales pitch.

Options:
- A before/after photo of a similar project: "Was thinking of you when I pulled up this project — same [trade], similar home. Turned out great."
- A relevant tip: "Noticed you're in [city] — heads up that there are some active rebate programs this quarter for [trade]. Happy to walk you through it."
- A customer testimonial: "Got this note from a customer we finished last month — thought you'd find it relevant."

**Goal**: Stay top of mind without pressure. Position yourself as helpful, not pushy.

---

### Day 7 — Urgency Touch

**Use if**: Still no decision and the incentive window is real.

**Action**: Reach out with a specific deadline.

> "Hi [Name], wanted to follow up before the end of the week. The promotion I mentioned — [specific incentive] — expires [specific date]. I'd hate for you to miss that.
>
> I know it's a big decision. If there's anything we haven't fully addressed, I'm happy to get on a quick call. What's your schedule like?"

**Goal**: Create legitimate urgency. Do not invent fake deadlines.

---

### Day 14+ — Long-Term Nurture

**Use if**: No response after Day 7, or customer said "not right now" but didn't say no.

**Action**: Move to a lower-frequency, value-first sequence:
- Monthly check-in (once per month, max)
- Seasonal relevance: "Summer is coming — HVAC installs are booking out 3–4 weeks. Just wanted to give you a heads up."
- New promotions as they become available
- Relevant project photos or company news

**CRM action**: Tag deal in Pipedrive as "Nurture" — set automated reminder tasks for monthly follow-up.

> The goal here is to stay present so that when they're ready — and many do eventually come back — you're the first person they call.

---

## The Precision Advantage: Proposal View Tracking

TPR's proposal system records every time a proposal is opened. This means:

- You know **when** the customer is engaging with the proposal
- You can time your follow-up to the exact moment of interest
- You can see **how many times** they've opened it (high open count = high consideration)

**High open count (3+ views)**: This customer is actively considering. Prioritize this follow-up over everything else. They're close.

**Zero opens after Day 2**: Try the "did you receive it" approach. If still nothing after Day 5, the meeting likely didn't create enough urgency — address that in your follow-up conversation.

Agent notification is sent via email when a proposal is viewed (see `src/shared/services/resend/emails/` for email template).

---

## Key Rules for Follow-Up

1. **Every follow-up must have a specific purpose** — not just "checking in"
2. **Never follow up more than once per day** unless the customer initiated contact
3. **Always end with a next step** — even nurture messages should invite a response
4. **Match channel to customer preference** — some prefer text, some prefer email, some prefer calls
5. **Don't burn the bridge** — if someone asks to stop hearing from you, log it in CRM and stop
6. **Log everything in CRM** — every call attempt, every text sent, every voicemail left

---

## CRM Workflow Summary

| Day | Action | CRM Update |
|---|---|---|
| 0 | Send proposal | Pipedrive: "Proposal Sent"; Monday: create follow-up task |
| 1 | Call on view trigger | Pipedrive: log call; Monday: mark task complete |
| 3 | Value-add touch | Pipedrive: log contact; Monday: create Day 7 task |
| 7 | Urgency close attempt | Pipedrive: log; update deal probability |
| 14+ | Monthly nurture | Pipedrive: tag "Nurture"; set recurring reminder |
| Close | Signed | Pipedrive: "Won"; Monday: project kickoff |
| No | Not interested | Pipedrive: "Lost" with reason; tag for future reactivation |
