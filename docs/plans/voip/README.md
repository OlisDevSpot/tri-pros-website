# VoIP — Planning Hub

> **Entry doc.** VoIP planning at Tri Pros is split across two sibling EPICs. Start here, then go to the right EPIC for your task.

## The two EPICs

| EPIC | Owns | Phase status |
|---|---|---|
| **[voip-in-house](../voip-in-house/EPIC.md)** | All VoIP communications EXCEPT lead-to-meeting conversion campaigns. Includes: agent-mediated customer comms (replacing personal cells), inbound main line + IVR + voicemail, internal-comm push pipeline, transactional lifecycle SMS (meeting reminders, proposal links, project status), one-off agent click-to-call / send-SMS, browser softphone, mobile (cellular) transfer mode, tokenized-link sends, opt-out compliance. | Phase 0 mostly complete (Twilio + Trust Hub + 10DLC + DIDs procured); Phase 1 implementation pending |
| **[voip-campaigns](../voip-campaigns/EPIC.md)** | The lead-to-meeting conversion engine via CloudTalk's managed Campaigns + AI VoiceAgent. CloudTalk owns the cadence + dispatch + AI; our app pushes lead contacts, consumes outcome webhooks, and graduates customers out of the campaign when meetings are booked. | Not started (Phase 0 = CloudTalk procurement + dashboard configuration) |

## Why the split

Carrier "Spam Likely" labeling is the #1 risk to high-volume outbound. Campaign DIDs (high-volume AI dialing) will get spam-labeled by carriers no matter how well-warmed — we proved this during the deferred Twilio Phase 0 (A-attestation didn't save us). The split keeps **in-house Tri Pros DIDs reputation-clean** for the agent-mediated relationship side of the business; campaign DIDs are walled off in CloudTalk's domain where carrier reputation is CloudTalk's concern.

The architectural payoff: agents communicate with customers via clean Tri Pros DIDs (centralized control, no agent personal cells exposed, full audit trail in our app); leads get converted via CloudTalk's purpose-built engine (best-in-class for that one job).

## Cross-system contract

**[INTEGRATION-SEAM.md](./INTEGRATION-SEAM.md)** — read this when touching anything that crosses between the two systems (DNC propagation, voip routing endpoints, graduation event, contact sync, webhook handling, gate consistency, failure-mode recovery).

## Phase ordering

**voip-in-house ships first.** CloudTalk depends on the in-house DIDs + DNC table + voip routing endpoint infrastructure existing before campaigns can launch. During voip-in-house's external vetting clocks (10DLC, Trust Hub) we can configure CloudTalk's dashboard in parallel — code work is sequential, design + procurement work overlaps.

## Subdomain

`voip.triprosremodeling.com` — single subdomain for all VoIP-related external traffic (Twilio webhooks, CloudTalk webhooks, voip routing endpoints). DNS already configured (`CNAME → cname.vercel-dns.com`). Env var: `VOIP_WEBHOOK_BASE_URL`.

## Historical context

**[HANDOFF-from-twilio-build.md](./HANDOFF-from-twilio-build.md)** — preserves the 2026-05-23 pivot context (deferred custom Twilio+Retell+Sendblue auto-dialer build → CloudTalk for campaigns + in-house Twilio for everything else). Informational; the EPICs above are now the live docs.
