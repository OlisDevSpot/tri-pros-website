# Customer contacts: handoff to a grilling session (2026-10-14)

**Owner ruling, 2026-10-14:** a customer can have more contacts than the one person and the one phone the system holds today, such as a spouse or a relative. The team chooses which of them, besides the main customer, are invited to a visit and receive its automatic texts. This is a schema change of its own and gets its own grilling session. The visit-messages backend (HV6) does not build it. HV6 builds its texts so that adding recipients later is an extension, not a rewrite (see §4).

Written by the HV6 session from its own reads of the tree. One read-only query against the dev database supplied the counts in §2. Nothing was written.

## 1. What the session decides

1. **The contact entity.** What a contact is (a person tied to one customer), what it carries (name, relationship, phone, email), and whether the main customer is itself a contact row or stays as the customer's own columns.
2. **Who receives what, per visit.** How the team picks the contacts who get the invite and the automatic texts for one visit: stored per meeting, a default on the contact, or both. Which of today's sends follow the selection:
   - the Google invite;
   - the visit summary;
   - the day-before reminder;
   - the specialist's confirmation;
   - the YES reply's confirmation.
3. **Who a number belongs to.** Inbound texts and calls are matched to a customer by phone today. With contacts, a number can belong to a contact. The session decides the matching rule, and what happens when a number belongs to several people (§2).
4. **Do-not-contact.** It is per customer row today (`customers.dncOptedOutAt`), checked by phone at send time. A contact with their own phone needs their own opt-out. Per phone, per contact, or both?
5. **Confirmation.** Who may confirm a visit by replying YES: the main customer only, or any selected contact? What does a contact's YES record?
6. **Migration.** How today's customers become the new shape, if the main customer moves into a contact row.

## 2. Facts from the code and the dev data

| Fact | Where |
|---|---|
| A customer has one `phone` (10 national digits) and one `email` | `src/shared/db/schema/customers.ts:16-17` |
| Matching a number to customers returns every customer with that phone; the reply handler takes the first | `findCustomersByPhone`, `src/shared/entities/customers/dal/server/queries.ts:120`; `handleHomeownerReply`, `src/shared/modules/meetings/business/service.ts` |
| **10 phone numbers in dev are shared by more than one customer** (households or duplicates) | read-only count, 2026-10-14 |
| Do-not-contact is a customer column, and a send checks every customer with that phone | `canOutboundTo` and `addToDnc`, `src/shared/services/voip/compliance.service.ts:41,64` |
| The Google invite adds the customer's email as the homeowner guest | `src/shared/services/scheduling.service.ts:306`; `meetings.homeownerInvitedAt`, `homeownerInviteRefusedAt` |
| Every visit text goes to the homeowner, including `rep_confirmation` ("{{specialist_name}} just confirmed…") | `src/shared/modules/meetings/messages/constants/templates.ts:58` |

## 3. What HV6 is building now, and how it meets contacts

HV6's redesign (spec `docs/superpowers/specs/2026-10-14-voip-conversations-and-visit-links-design.md`):
- **A conversation** is one of our lines talking to one outside number. It owns its texts, and it links to at most one customer (`voip_conversations.customer_id`).
- **A visit links to the conversations it uses** (`meeting_conversations`), one per recipient number per line.
- **Each automatic step is recorded per linked conversation** (`meeting_messages.meeting_conversation_id`), so the double-send guard and skips already work per recipient.
- **Today a visit has one recipient:** the customer's phone on the main line.

## 4. The extension points HV6 leaves for this session

| Seam | Today | With contacts |
|---|---|---|
| `resolveVisitRecipients(meeting)` | returns the customer's phone, if any | returns the selected contacts' phones |
| The number-owner match used when a conversation is created | links the conversation to the customer only when exactly one customer has the number | also matches contacts' phones, and may set a `contact_id` the session adds to `voip_conversations` |
| `canOutboundTo(phone)` | customer rows with that phone | the session's per-phone or per-contact opt-out |
| The Google invite guest list | the customer's email | the selected contacts' emails |

Contacts need no change to conversations, links or steps beyond an optional `contact_id` column. Every automatic text already runs once per linked recipient.

## 5. Not decided here

- Whether a contact may be its own customer in another household.
- Calls: `voip_calls` has the same line, number and customer shape, and joins conversations later.

Delete this file once the contacts spec carries what it says.
