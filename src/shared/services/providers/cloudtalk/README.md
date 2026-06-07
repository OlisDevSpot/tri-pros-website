# CloudTalk provider

The DAL-equivalent for CloudTalk's REST API. All voip-campaigns code that talks to CT goes through this folder.

> **Usage rules + invariants** live in [`DOCS.md`](./DOCS.md). This README is a brief history-and-tooling reference; read DOCS.md first.

## Layout (post-2026-06-02 restructure)

```
client.ts                ← THE entry point (cloudtalkClient + CloudtalkApiError + CloudtalkResponseValidationError)
types.ts                 ← consumer-shaped domain types (CloudtalkContact, CloudtalkCall, CloudtalkContactSummary) + z.infer<> re-exports
schemas/                 ← outbound-API Zod (request shapes — what WE send)
├── primitives.ts        phoneE164Schema, ctTimestampSchema, ctIdSchema, ctPaginationSchema
├── contact.ts           Contact / ContactList / addTags / removeTags / show / attributes
├── call.ts              Cdr / Call (list row + getById)
├── sms.ts               /sms/send request + response
├── campaign.ts          Campaign / CampaignList / edit-status
└── bulk.ts              discriminated bulk op shapes
webhooks/                ← inbound-payload Zod (what CT sends us via 5 Workflow Automations)
└── events.ts            5-event discriminated union
constants/
└── index.ts             hosts, rate-limit thresholds, bulk cap, tag names, dispositions, app-keys, pricing
DOCS.md                  ← usage rules + invariants
README.md                ← this file (history + tooling)
```

> **No `lib/`.** Every action lives on `cloudtalkClient` (the superset-client convention — see [`docs/codebase-conventions/service-architecture.md` → `client-is-the-superset-entry-point`](../../../../../../docs/codebase-conventions/service-architecture.md#client-is-the-superset-entry-point)). Adding `lib/contacts.ts` or `lib/voice.ts` would re-introduce the multi-import-path problem.
>
> **No `webhooks/verify.ts`.** Webhook secret verification is `cloudtalkClient.verifyWebhookSecret({ url })`.
>
> **No `dal/` subdir.** Per ADR-0003: providers wrap third-party APIs; they aren't our domain DAL. The client + schemas ARE the DAL for CT.

> **Why `schemas/` sits next to `client.ts`, not inside `lib/`:** matches the codebase-wide convention for entities (`shared/entities/<x>/schemas/`), features (`features/<x>/schemas/`), and providers (`twilio/schemas/`). `schemas/` describes data shapes; the client does work. Documented in [`docs/codebase-conventions/service-architecture.md` → `provider-directory-shape`](../../../../../../docs/codebase-conventions/service-architecture.md#provider-directory-shape).

## Why hand-typed (no `@hey-api/openapi-ts` generation)

Evaluated 2026-05-30 against `@hey-api/openapi-ts@0.97.3` + CT swagger spec v1.7. Generation fails because:

1. **CT declares 15 of 67 schemas as top-level array-typed components** with inline-object items (`{ type: 'array', items: { properties: {...} } }`). Affected schemas include `Agent`, `Contact`, `CallNumber`, `CampaignList`, `Sms`, `StatusCode`, `PaginationData`, `ContactAttribute` — essentially every schema we'd actually want types for.
2. **Other parts of the spec `$ref` into deep paths** like `#/components/schemas/ContactAttribute/items/properties/attribute_id`. Legal per JSON Pointer / OpenAPI but unusual.
3. **`@hey-api/codegen-core@0.8.2`'s symbol planner can't assign `finalName` for those deep symbols** → `Error: Symbol finalName has not been resolved yet`.

Probes attempted (all failed or stripped useful coverage):

| Probe | Approach | Result |
|---|---|---|
| 1 | `parser.patch.schemas.ContactAttribute` — fix `maximum`→`maxLength` typo | Same Symbol #119 error |
| 2 | `parser.patch.schemas.ContactAttribute` — wrap top-level array in object | Shifted to `Reference not found` on the deep `$ref` |
| 3 | `parser.filters.schemas.exclude: ['ContactAttribute']` | Worked, but 14 other schemas hit the same bug — excluding them strips coverage of `Contact`, `Agent`, `Sms`, etc. |
| 4 | Drop the dep entirely; hand-type from cached swagger | Won — clean shapes for the small Phase 1 surface |

There's no `parser.patch.operations` or raw-spec hook to rewrite the deep `$ref`s themselves ([heyapi.dev — Parser docs](https://github.com/hey-api/openapi-ts/blob/main/web/src/content/docs/docs/openapi/typescript/configuration/parser.mdx)).

**Decision (LOCKED 2026-05-31):** hand-typed zod schemas in `schemas/*.ts`. `@hey-api/openapi-ts` removed from devDependencies. Revisit when:
- `@hey-api/codegen-core` ships a planner fix for deep-`$ref` symbol resolution
- OR CT republishes a cleaner spec (current is OpenAPI 3.0.1, CT info.version 1.7)
- OR our CT surface grows past ~30 endpoints (Phase 1 is ~12)

**Don't re-install `@hey-api/openapi-ts` without re-running the probes.** Hand-types win until upstream changes.

## References

- [`./DOCS.md`](./DOCS.md) — usage + invariants + quirks table (read this first)
- ADR-0003 — service/provider architecture
- [`docs/codebase-conventions/service-architecture.md`](../../../../../../docs/codebase-conventions/service-architecture.md) — `client-is-the-superset-entry-point` + `provider-directory-shape`
- [`docs/plans/voip-campaigns/EPIC.md`](../../../../../../docs/plans/voip-campaigns/EPIC.md) — full design + decisions log
- [`docs/plans/voip-campaigns/cloudtalk-api-research.md`](../../../../../../docs/plans/voip-campaigns/cloudtalk-api-research.md) — grounded CT capability notes
- [`docs/plans/voip-campaigns/phase-1-implementation.md`](../../../../../../docs/plans/voip-campaigns/phase-1-implementation.md) — this provider's role in the build sequence
- [`docs/plans/voip-campaigns/HANDOFF-2026-06-01.md`](../../../../../../docs/plans/voip-campaigns/HANDOFF-2026-06-01.md) — Phase 0 dashboard verification (V1–V11)
- [`docs/codebase-conventions/webhook-routes.md`](../../../../../../docs/codebase-conventions/webhook-routes.md) — webhook handler conventions
