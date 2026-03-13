---
description: "Draft a follow-up email for a proposal sent to a customer. Use this skill whenever the user wants to write, draft, or send a follow-up email for a proposal or contact — e.g. 'draft a follow-up for [name]', 'write a follow-up email for [customer]', 'follow up on [name]'s proposal', 'check in with [customer] about their proposal'."
allowed-tools: [mcp__notion__API-post-search, WebFetch, mcp__gmail__draft_email]
---

# Proposal Follow-Up Email

Draft a personalized, human follow-up email for a customer whose proposal was recently sent.

## Step 1 — Get proposal context

If the customer's proposal data is not already in context:

1. Search Notion for the contact by name using `mcp__notion__API-post-search`
2. From the result, extract the `Proposals Link` URL property
3. From that URL, extract the `proposalId` (the UUID path segment) and `token` (the `token=` query param)
4. Fetch the proposal summary:
   ```
   GET https://triprosremodeling.com/api/proposals/[proposalId]/summary?token=[token]
   ```
   Use WebFetch with prompt: "Return the full text content exactly as-is."

If the proposal link or contact data is already available in the conversation, skip straight to drafting.

## Step 2 — Draft the email

Use the fetched context to write the email. Follow these principles exactly — they were developed through careful iteration and represent the voice Tri Pros wants to project:

### Tone
Casual, human, concise. Reads like a real person wrote it — not a salesperson, not a template. Short sentences. No fluff.

### Structure

**Opening** — Simple, warm check-in. Did the proposal come through? Does everything make sense? One or two sentences max.

**Scope reference** — Ground the email in something specific from their actual proposal. Use a real detail (e.g. "25 recessed LED lights across your 4 rooms", "the flat roof repair"). This makes the customer feel seen, not like they received a form email.

**Authority + Stakes paragraph** — This is the most important paragraph. The goal is to communicate the real-world cost of choosing the wrong contractor — without sounding like a sales pitch. Do it through earned authority, not persuasion:
  - Draw on Tri Pros' years of experience across the greater LA area
  - Reference what they've seen firsthand: homeowners who went with the cheapest quote and paid for it later
  - Use framing like "we've had customers come to us specifically to fix what someone else left behind"
  - Never hedge ("not trying to scare you", "just saying"). Let the facts speak.
  - Never list features or benefits. This is not a pitch — it's honest advice from people who've seen it all.

**Transition to trust** — Bridge naturally from the pain of bad contractors into the reassurance of working with Tri Pros. The throughline: "That's exactly why we do X." Position Tri Pros as the protector of the homeowner's long-term interest, not just a vendor closing a deal.

**Incentives (if applicable)** — If the proposal includes discounts or exclusive offers, weave one in naturally as a supporting detail — evidence of how Tri Pros operates, not as a selling point.

**Close** — Low-pressure, warm. Something like "No rush — just want to make sure you have what you need." Never push for a decision.

**Proposal link** — After the close, add a single line: `For quick reference, here is your proposal.` — hyperlinked to the proposal URL with `?token=[token]&utm_source=email` appended. The link text should be natural ("here is your proposal"), never the raw URL.

**Signature** — Tri Pros Remodeling + phone number only. No email address, no titles, no taglines.

### What to avoid
- Hedging language that undermines authority ("not trying to scare you", "just my opinion")
- Salesy phrasing ("unbeatable value", "act now", "limited time")
- Formal corporate tone ("I wanted to reach out to follow up on...")
- Bullet points or bold text in the email body
- Mentioning the full price or deposit unless the user explicitly asks
- Sentences like "We also applied a material discount to bring the price down from where it started, which is just how we work with homeowners who are being smart about budget." - this is not a sales pitch, but a cautionary tale of what could go wrong and how to avoid it (have a detailed scope of work, detail oriented contractor, etc)

## Step 3 — Output format

Display the drafted email in the conversation:

```
To: [customer email]
Subject: [subject line — casual, not clickbaity]
---
[email body]
---
```

## Step 4 — Create Gmail draft

After displaying the email, automatically create a Gmail draft using `mcp__gmail__draft_email`:
- `to`: the customer's email (from Notion contact data)
- `subject`: the subject line from Step 3
- `mimeType`: `"text/html"` — required to render the proposal hyperlink
- `body`: plain-text version of the email (required by the API even when htmlBody is provided) — use the raw URL for the proposal link
- `htmlBody`: the full email body rendered as HTML, with the proposal link as a proper `<a href="...">` tag. Use `<br><br>` for paragraph breaks. Keep the rest of the email as plain prose — no extra HTML styling.

Build the proposal link as: `[Proposals Link from Notion]` with `&utm_source=email` appended (the token is already part of the Notion URL).

**Never use `mcp__gmail__send_email` — always draft only.** Sending is done by the sales rep manually, or when the user explicitly says to send it.

Confirm to the user that the draft has been saved to Gmail, then ask: "Any tweaks, or ready to send?"

## Reference example

This is a calibrated example of the right voice and structure. Do not copy it verbatim — use it to calibrate tone and structure for the specific customer and scope:

> Hi Ofir,
>
> Just wanted to follow up on the proposal we sent a few days ago — wanted to make sure it came through okay and that everything made sense.
>
> We put together two scopes for you — 25 recessed LED lights across your 4 rooms and the flat roof repair — so there's a decent amount of detail in there. If anything feels unclear or you want to revisit any part of it, I'm happy to walk through it with you.
>
> In our years working across LA, electrical and roofing are the two trades we've seen go wrong the most when homeowners go with whoever came in cheapest. We've had customers come to us specifically to fix what someone else left behind — and it's always more painful and more expensive than doing it right the first time. That's exactly why we take the time to put together a proposal like this one, so you know exactly what you're getting and who's standing behind it.
>
> No rush at all — just want to make sure you have what you need.
>
> Talk soon,
>
> Tri Pros Remodeling
> (818) 651-1445
