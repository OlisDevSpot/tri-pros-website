# 04 — Alternatives & platform constraints (primary-source comparison)

**Read date:** 2026-09-07 · **Author:** research agent · **Scope:** realtime/sync options for Next.js 15.5 (App Router, Vercel) + Neon Postgres 17, compared against the approved-but-deferred Ably kernel (Epic #178).
**Method:** official docs, pricing pages, GitHub repos, vendor changelogs, and the npm registry (`npm view`) only. Every claim carries a source; anything a primary source did not state is marked **UNVERIFIED** or **inference**. Doc "last_updated" stamps are quoted where the page exposes them.

**Versions observed (npm registry, 2026-09-07):** `ably` 2.28.0 (2026-08-24, Apache-2.0) · `@rocicorp/zero` 1.9.0 (2026-08-14, Apache-2.0; 1.0.0 = 2026-03-24) · `@powersync/web` 2.3.0 (2026-09-02) · `@powersync/react` 2.0.1 (2026-09-02) · `@electric-sql/client` 1.5.27 (2026-09-01; 1.0.0 = 2025-03-17) · `@electric-sql/react` 1.0.56 · `@tanstack/db` 0.8.7 (2026-08-31, MIT) · `@tanstack/electric-db-collection` 0.4.7 · `@tanstack/powersync-db-collection` 0.1.66 · `@upstash/realtime` 1.1.0 (MIT) · `pusher-js` 8.6.0.

---

## 1. Ably (baseline)

**Pricing tiers** ([pricing page](https://ably.com/pricing), [limits doc](https://ably.com/docs/platform/pricing/limits)):

| Plan | Base | Peak connections | Peak channels | Messages/mo | Msg size | History TTL |
|---|---|---|---|---|---|---|
| Free | $0 | 200 | 200 | 6M (hard) | 64 KiB | 1 day |
| Standard | $29/mo **+ usage** | 10,000 | 10,000 | unlimited (metered) | 64 KiB | 30 days |
| Pro | $399/mo **+ usage** | 50,000 | 50,000 | unlimited (metered) | 256 KiB | 365 days |
| Enterprise | custom | unlimited | unlimited | unlimited | 256 KiB | ≤1 yr |

- **Overage/usage rates (Standard & Pro):** messages "$2.50 / million"; connection minutes "$1.00 / million mins"; channel minutes "$1.00 / million mins"; data transfer "$0.25 / GiB". The pricing page shows the paid fees as base "+ usage"; **no included usage allowance is stated** for Standard/Pro (pricing page + [pricing FAQs](https://ably.com/docs/platform/pricing/faqs) both silent). Minutes are billed rounded up ("10.01 minutes… billed as 11 minutes") ([billing doc](https://ably.com/docs/platform/pricing/billing)).
- **Message counting** ([message-counting doc](https://ably.com/docs/platform/pricing/message-counting)): "1 inbound message when a client publishes" + "1 outbound message for each subscriber that receives it" (10 subscribers ⇒ 11 billable). Rewind on attach = "1 outbound message per rewound message (up to 100)". Presence enter/leave/update each = 1 inbound + 1 outbound per presence subscriber. Billed in 5 KiB chunks. Client-side filtering does not reduce counts.
- **Other plan limits** (limits doc): new-connection rate Free 42/s, Standard 250/s, Pro 500/s; presence members/channel 200 on all plans (20,000 with server-side batching on Enterprise). Ably states it "won't penalize your success by blocking usage for the majority of limits" but count-based limits (connections, channels) do block.
- **Token auth + capabilities** ([capabilities doc](https://ably.com/docs/auth/capabilities)): capability = JSON map resource → operations; wildcards replace whole colon-delimited segments (`namespace:*`, `foo:*:baz`, `[*]*`); operations include `publish`, `subscribe`, `presence`, `history`, `channel-metadata`, `push-subscribe`, `object-publish/subscribe`, `message-update-*`, `message-delete-*`, `stats`, `privileged-headers`. Token capabilities = "intersection of the requested capabilities and those of the issuing API key"; JWTs carry `x-ably-capability`.
- **`rewind`** ([rewind doc](https://ably.com/docs/channels/options/rewind)): numeric (N messages) or time (`10s`, `5m`); `rewindLimit` combines both; "At most 100 messages will be sent in a rewind request"; window limited by persistence: "If persisted history isn't enabled for the channel then this will be 2 minutes. If you have persistence enabled, this will be 24 hours for free accounts, and 72 hours for paid accounts." ⇒ the plan's `rewind: 2m` is exactly the no-persistence maximum.
- **Presence** ([presence doc](https://ably.com/docs/presence-occupancy/presence)): needs `clientId` + `presence` capability; `subscribe` needed to receive events; 200 members default; n-squared message cost warning ("80,400 messages" example for 200 members).
- **Integrations / webhooks** ([webhooks doc](https://ably.com/docs/integrations/webhooks)): the term "Reactor" is no longer used in the doc — it says "outbound webhook integrations". Sources: `channel.message`, `channel.presence`, `channel.lifecycle`, `channel.occupancy`. Single-request mode (concurrency-limited, "a short 10 message queue") vs batched (≤1 request/s per instance). Retries: single = 2 retries on timeout (4 s, 20 s) and on 5XX; batched = exponential backoff (`delay * sqrt(2)`, cap 60 s, queue kept 5 min).
- **SDK status:** `ably` 2.28.0 released 24 Aug 2026 ([releases](https://github.com/ably/ably-js/releases)); v1 callback imports (`ably/promises`, `ably/callbacks`) deprecated in 2.22.0. React hooks ship in the main package at `ably/react` ([React getting-started](https://ably.com/docs/getting-started/react), [ably-js docs/react.md](https://github.com/ably/ably-js/blob/main/docs/react.md)): `useAbly`, `useChannel`, `usePresence`, `usePresenceListener`, `useConnectionStateListener`, `useChannelStateListener`, `useObject` (2.26.0+); "compatible with all versions of React above 16.8.0" (`useObject` needs React 18); no beta/experimental label; hooks are client-only ("make sure that your components which use Ably react hooks are only rendered on the client side"); a "NextJS warnings" section covers `keyv` / `bufferutil` build noise.

**Cost estimate at our scale** (30 connections × 8 h × 22 days; ~50k publishes/month; rates above):
- Connection minutes: 30 × 480 × 22 = 316,800 → **$0.32**.
- Channel minutes: depends on channel fan-out; at ~100 concurrently-attached channels for the 8-h day → 1.06M → **$1.06** (at 200 channels: $2.11).
- Messages: 50k inbound + outbound per subscriber. 5 avg subscribers → 300k → **$0.75**; worst case every message to all 30 → 1.55M → **$3.88**.
- **Standard total ≈ $31–36/mo.** Numerically this fits inside **Free** (30 ≪ 200 connections, ≪ 6M msgs) — the binding Free constraint would be the 200 concurrent-channel cap if per-entity channels are used.

## 2. Vercel platform constraints (bounds "roll our own")

- **WebSockets:** "Vercel Functions can serve WebSocket connections" — public beta since 2026-06-22 ([changelog](https://vercel.com/changelog/websocket-support-is-now-in-public-beta); [WebSockets doc](https://vercel.com/docs/functions/websockets), last_updated 2026-08-10, page badge "Permissions Required: WebSockets"). Rules: "A single WebSocket connection is pinned to one Vercel Function instance"; "WebSocket connections close when a Vercel Function reaches its maximum duration"; "New WebSocket connections are not guaranteed to reach the same Vercel Function instance"; state/presence/pub-sub must live in an external store (Redis). "WebSockets require Fluid compute to be enabled." Billing = normal Function usage + Fast Data/Origin Transfer; "With Active CPU pricing, billing only applies to the time your Function spends processing messages, not idle connection time" (changelog). **Next.js:** "Next.js does not expose an API for handling WebSocket upgrades. As a workaround, you can use the `experimental_upgradeWebSocket()` API" from `@vercel/functions` (requires `ws`; `maxPayload` default 256 KiB; local dev only via `vc dev` with CLI ≥ 54.14.2) ([API ref](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package), last_updated 2026-09-03). Vercel's KB still recommends managed providers "for high-volume scenarios", naming Ably, Convex, Firebase, Liveblocks, PubNub, Pusher, Sendbird, Supabase Realtime, TalkJS ([realtime KB guide](https://vercel.com/kb/guide/publish-and-subscribe-to-realtime-data-on-vercel)).
- **Max duration (with Fluid compute)** ([limits](https://vercel.com/docs/functions/limitations), last_updated 2026-08-24; [duration config](https://vercel.com/docs/functions/configuring-functions/duration)): Hobby 300 s default = max; Pro/Enterprise 300 s default, **800 s max GA**, **1800 s "extended maximum" Beta** (per-function `export const maxDuration = 1800`, Node 20/22/24, Bun, Python; not project-wide; not with Secure Compute/Static IPs). "For request handlers, this includes time spent processing the request and sending the response, including streamed responses." Edge runtime: must start responding within 25 s, stream ≤ 300 s. **Without Fluid compute:** the current docs no longer publish a separate non-Fluid table; Fluid is "enabled by default for new projects" since 2025-04-23 ([fluid doc](https://vercel.com/docs/fluid-compute), last_updated 2026-08-24) — pre-Fluid limits **UNVERIFIED** from current docs (check the project's Functions settings toggle).
- **SSE / streaming:** supported; Next.js example returns `Content-Type: text/event-stream` ([streaming doc](https://vercel.com/docs/functions/streaming-functions), last_updated 2026-09-01). Long-idle caveat: "Vercel sends connection-level HTTP/2 PING frames while the response is idle. HTTP/1.1 does not have an equivalent protocol frame, so HTTP/1.1 clients and intermediate network layers may still close idle connections. For those cases, stream progress or heartbeat data" (duration doc). KB: SSE "stays on standard HTTP… browsers reconnect on their own" with `Last-Event-ID`; a connection "closes at the duration limit and reconnects elsewhere" so clients must "resubscribe… and reload any state".
- **Other hard limits:** 1,024 file descriptors "shared across all concurrent executions (including runtime usage)" — DB sockets count; 4.5 MB body; Fluid concurrency auto-scales to 30,000 (Hobby/Pro).
- **Fluid instance lifecycle & DB connections** ([connection-pooling KB](https://vercel.com/kb/guide/connection-pooling-with-functions); [pricing doc](https://vercel.com/docs/functions/usage-and-pricing)): "Multiple concurrent invocations share the same instance, so they can share a single database connection or connection pool"; "After all requests complete, the instance is paused"; "Idle connection timeouts don't run while suspended, so connections remain open until either the VM shuts down or the database forcibly closes them"; `attachDatabasePool()` "closes idle connections before an instance suspends".
- **Can a route handler hold a Postgres LISTEN?** Not addressed anywhere in Vercel docs (**inference from the above**): a LISTEN socket can only be *serviced* while an invocation is in flight (≤ 800 s / 1800 s beta), on a direct (non-pooled) Neon connection (§3); once the last request finishes the instance is paused and NOTIFYs are not processed; there is no platform mechanism to *wake* a Function on a Postgres notification. So "LISTEN inside an SSE handler" is possible per-connection for ≤ maxDuration, but it is one listener per open client stream, not a shared trigger.
- **Pricing units (Fluid, Pro, iad1):** Active CPU $0.128/h; Provisioned Memory $0.0106/GB-h ("Billed for the entire instance lifetime… Continues billing while handling requests, even during I/O"); invocations $0.60/M. Hobby includes 4 CPU-h, 360 GB-h, 1M invocations.

## 3. Postgres LISTEN/NOTIFY on Neon

- **Supported** on direct connections; **not through the pooler**: Neon's PgBouncer runs `pool_mode=transaction` and the unsupported list explicitly includes "LISTEN / NOTIFY" (plus SET/RESET, PREPARE/DEALLOCATE, WITH HOLD CURSOR, session advisory locks) ([connection pooling doc](https://neon.com/docs/connect/connection-pooling)); hostname without `-pooler` = direct.
- **Durability:** "Postgres LISTEN and NOTIFY run entirely in memory and do not persist any data. If there are no listeners when a NOTIFY runs, the message disappears and Postgres does not provide a mechanism to replay messages." No delivery confirmation ([Neon LISTEN/NOTIFY guide](https://neon.com/guides/pub-sub-listen-notify)).
- **Scale-to-zero:** "If Neon scales your compute to 0, it will terminate all listeners, which may lead to lost messages when your database reactivates" — Neon recommends disabling scale-to-zero for this use ([same guide](https://neon.com/guides/pub-sub-listen-notify)); "notifications and listeners defined using NOTIFY/LISTEN commands only exist for the duration of the current session and are lost when the session ends" ([compute lifecycle](https://neon.com/docs/introduction/compute-lifecycle)); idle (not idle-in-transaction) connections do not keep compute awake. Default suspend after 5 min inactivity; "For Neon Free plan users, this setting is fixed. Paid plan users can disable" ([scale-to-zero doc](https://neon.com/docs/introduction/scale-to-zero)).
- **"NOTIFY → serverless function → push" on Vercel:** not viable as an architecture — nothing on Vercel can subscribe (§2), and the DB side offers no durable queue. Viable shapes are (a) publish from the app write path (the Ably-kernel plan), or (b) a **logical-replication consumer hosted off-Vercel** that turns WAL into webhooks/pushes — Neon's own consumer list includes **Sequin** and **Inngest** alongside Airbyte, Bemi, ClickHouse, Confluent, Databricks, Decodable, Estuary Flow, Fivetran, Materialize, PostgreSQL, Prisma Pulse, Snowflake ([logical replication guide](https://neon.com/docs/guides/logical-replication-guide)). Any such consumer keeps compute always-on (§7).

## 4. PowerSync

- **Architecture** ([overview](https://docs.powersync.com/intro/powersync-overview); [database setup](https://docs.powersync.com/installation/database-setup)): "a sync engine that keeps a client-side SQLite database in sync with your backend database"; components = PowerSync Service + client SDKs; "PowerSync reads the Postgres WAL using logical replication in order to create buckets in accordance with your Sync Streams"; requires Postgres ≥ 11, `wal_level=logical`, a publication named `powersync` (`FOR ALL TABLES` or a subset — "PowerSync Service has to read all updates present in the publication, regardless of whether the table is referenced in your Sync Streams"), and a role `WITH REPLICATION BYPASSRLS` ([Neon integration page](https://docs.powersync.com/integrations/neon)). Read path only from the engine; client writes go to an upload queue processed by *your* backend API (Neon page: "stored in an upload queue that gets processed via the Neon Data API").
- **Row-level auth = Sync Streams** ([streams doc](https://docs.powersync.com/sync/streams)): successor to Sync Rules ("everything Sync Rules do, plus more expressive queries (including JOIN support), on-demand syncing"); parameters: `auth.user_id()`/JWT claims (signed, trusted), `subscription.parameter()`, connection params; "Stream queries use a SQL-like syntax with SELECT statements. You can use subqueries, INNER JOIN, and CTEs for filtering"; "GROUP BY, ORDER BY, and LIMIT are not supported". Status **GA** ([feature status](https://docs.powersync.com/resources/feature-status)).
- **JWT:** client's `fetchCredentials()` returns a JWT + endpoint ([auth setup](https://docs.powersync.com/installation/authentication-setup)); custom auth via JWKS (RS256/EdDSA/ECDSA recommended) or HS256 shared secret "for development and testing", with an `audience` config ([custom auth](https://docs.powersync.com/configuration/auth/custom)) — better-auth would need a small token-minting endpoint (inference).
- **Web SDK** ([JS/Web SDK](https://docs.powersync.com/client-sdk-references/javascript-web)): `@powersync/web` 2.3.0; engine "wa-sqlite"; VFS options IndexedDB (default), OPFS variants, in-memory; multi-tab via shared web workers ("disabled by default" on Android/iOS/Safari → fallback); `database.ssrMode` returns empty results and disables sync during SSR; `@powersync/react` 2.0.1 hooks. Feature status: Service Open Edition **GA**, JS/Web SDK **GA**, React hooks **GA**, Postgres connector **GA**, Postgres bucket storage **GA**, **TanStack DB collection Alpha** (`@tanstack/powersync-db-collection` 0.1.66; [TanStack page](https://docs.powersync.com/client-sdks/frameworks/tanstack)).
- **Neon:** official guide exists ([docs.powersync.com/integrations/neon](https://docs.powersync.com/integrations/neon)) — enable Logical Replication in Neon settings, create `powersync_role`, publication, paste connection string. ⚠️ The guide's copy step says "select **'Pooled connection'**"; Neon's pooler is transaction-mode PgBouncer and both Electric and Zero require a *direct* connection for replication — whether Neon's pooler passes the replication protocol is **UNVERIFIED**; treat the direct string as the safe choice. No scale-to-zero note on the PowerSync page; Neon's rule applies (§7).
- **Cloud pricing** ([pricing](https://www.powersync.com/pricing)): **Free** $0 — "Up to 2 GB data synced / month", "Up to 500 MB of data hosted", "Up to 50 peak concurrent clients", 2 instances, "Free projects are deactivated after 1 week of inactivity". **Pro** from $49/mo — 30 GB synced (+$1/GB), 10 GB hosted (+$1/GB), 1,000 peak clients (+$30/1,000), 2 instances (+$25/instance). **Team** from $599/mo. **Enterprise** custom.
- **Self-host:** Docker `journeyapps/powersync-service`; needs bucket storage in **MongoDB (replica set) or Postgres** plus JWKS/static keys and a Sync Streams config ([service setup](https://docs.powersync.com/self-hosting/installation/powersync-service-setup)); no dashboard when self-hosted ([self-hosting](https://docs.powersync.com/self-hosting/getting-started)); license **Functional Source License 1.1, ALv2 Future License** ([LICENSE](https://github.com/powersync-ja/powersync-service/blob/main/LICENSE)).

## 5. Zero (Rocicorp)

- **Architecture** (docs): "Zero-cache runs in the cloud and maintains a read-only replica of your Postgres database. Zero-client gets linked into your app and maintains a client-side store of recently used rows… queries are sent to the server, which returns authoritative results asynchronously" ([intro](https://zero.rocicorp.dev/docs/introduction)); partial sync — "Zero syncs the union of all active queries' results" ([reading data](https://zero.rocicorp.dev/docs/reading-data)). Client persistence layer (memory vs IndexedDB) not stated on the pages read — **UNVERIFIED**.
- **Permissions:** "Zero does not have (or need) a first-class permission system like RLS. Instead, you implement permissions by authenticating the user in your queries and mutators endpoints, and creating a Context object" ([permissions](https://zero.rocicorp.dev/docs/permissions)); relations in filters, e.g. `or(cmp('authorID', ctx.id), exists('sharedWith', q => q.where('userID', ctx.id)))`. **Synced queries**: "A copy of each query exists on both the client and on your server"; server copy applies `ctx` filters; requires a query endpoint (`ZERO_QUERY_URL`) which the docs show as a **Next.js route handler** `app/api/zero/query/route.ts` ([synced queries](https://zero.rocicorp.dev/docs/synced-queries)). Auth token via `Authorization: Bearer`, refreshable with `zero.connection.connect({auth})`.
- **Hosting:** zero-cache is a long-running process with a persistent replica file (`ZERO_REPLICA_FILE: /data/replica.db`, mounted volumes/EFS/PVC), Docker/Fly/SST(AWS)/Kubernetes recipes, `stop_grace_period: 10m`; **not runnable on Vercel** ([deployment](https://zero.rocicorp.dev/docs/deployment)). Example sizing: replication-manager 1 vCPU/2 GB, view-syncer 2 vCPU/4 GB. "Cloud Zero" is referenced in the docs; roadmap lists "SaaS (invite only)" — **pricing UNVERIFIED / not published** ([roadmap](https://zero.rocicorp.dev/docs/roadmap)).
- **Postgres/Neon** ([connecting](https://zero.rocicorp.dev/docs/connecting-to-postgres)): "Zero requires Postgres v15.0 or higher, and support for logical replication"; upstream "must be a direct connection (not via pgbouncer)"; **Neon = fully supported**, with the caveat "Because Zero keeps an open connection to Postgres to replicate changes, as long as zero-cache is running, Postgres will be running and you will be charged by Neon" and preview-branch warning.
- **Status/version:** `@rocicorp/zero` **1.9.0** (2026-08-14; "improves query/mutation correctness… numerous reliability improvements"); **1.0.0** (2026-03-24): "we are declaring Zero stable… There may still be breaking changes in the future, but they will be rare" ([release notes](https://zero.rocicorp.dev/docs/release-notes)). ⚠️ The roadmap page still says "working toward a beta release of Zero late 2025 or early 2026" — stale relative to 1.x. License **Apache-2.0** ([rocicorp/mono](https://github.com/rocicorp/mono)); no paid license.
- **Next.js:** `ZeroProvider` in a `'use client'` `providers.tsx`; query/mutation endpoints as `app/api/*` route handlers ([install](https://zero.rocicorp.dev/docs/install)); starter [rocicorp/todo-nextjs](https://github.com/rocicorp/todo-nextjs).

## 6. Other pub-sub-as-a-service

- **Pusher Channels** ([pricing](https://pusher.com/channels/pricing/)): Sandbox free = 100 concurrent connections, 200k messages/day; Startup $49 = 500 / 1M/day; Pro $99 = 2,000 / 4M/day; Business $299 = 5,000 / 10M/day; up to Growth Plus $1,199 = 30,000 / 90M/day. Overage handled by e-mail warnings and prorated plan changes, not metering. `pusher-js` 8.6.0. Same "ping" paradigm as Ably; no documented rewind/history equivalent on the page read (**UNVERIFIED**).
- **Upstash Realtime** — **exists** as a product: `@upstash/realtime` 1.1.0 (MIT); "100% HTTP-based: Redis streams & SSE"; "Deploy anywhere: Vercel, Netlify" ([docs](https://upstash.com/docs/realtime)); announced 2025-10-29 — "not meant as a 1:1 Pusher replacement because we use HTTP and not sockets", "Priced based on events, not connection time" ([announcement](https://upstash.com/blog/about-upstash-realtime)). Metering rides on Upstash Redis: free 500K commands/mo, PAYG $0.2/100K commands ([Redis pricing](https://upstash.com/pricing/redis)). Because the subscribe side is an SSE stream served by *your* Vercel Function, §2 duration caps apply (inference).
- **PartyKit / Cloudflare Durable Objects:** PartyKit "is joining Cloudflare" (2024-04-05); "you can now use PartyKit for free… deploy to your own Cloudflare account and pay for the resources you use" ([announcement](https://blog.partykit.io/posts/partykit-is-joining-cloudflare); [docs](https://docs.partykit.io/)). Durable Objects pricing: SQLite-backed DOs available on Workers Free; Paid = $5/mo base ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)) with 1M requests + 400,000 GB-s included, then $0.15/M requests and $12.50/M GB-s; WebSocket Hibernation "can dramatically reduce duration-related charges" ([DO pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)). Adds a second hosting platform to operate.
- **Supabase Realtime Broadcast:** can be used as a pub-sub bus **without moving the DB** — publish via REST `POST /realtime/v1/api/broadcast/{topic}/events/{event}` (or batch endpoint) with `apikey`, subscribe via client libs ([broadcast doc](https://supabase.com/docs/guides/realtime/broadcast)). Requires a Supabase project (project URL/keys). Private channels are authorized by RLS policies on `realtime.messages` evaluated against "the user information sent as part of their Auth JWT" via `current_setting('request.jwt.claims')` ([authorization doc](https://supabase.com/docs/guides/realtime/authorization)) — whether a better-auth-minted JWT signed with the project secret is accepted is **UNVERIFIED**. "Broadcast from the Database" reads Supabase's own WAL/`realtime.messages` — not usable with Neon. Pricing: Free 200 peak connections / 2M msgs; Pro $25/mo, 500 connections (+$10/1,000), 5M msgs (+$2.50/M) ([pricing](https://supabase.com/pricing)).
- **Convex:** "The Convex database is automatically provisioned when you create your project" — data lives in Convex; no external-Postgres subscription documented ([understanding](https://docs.convex.dev/understanding/)); Free/Starter $0, Professional $25/dev/mo ([pricing](https://www.convex.dev/pricing)). Out of scope.
- **InstantDB:** homepage banner "Instant is sunsetting. Services will continue until August 31st, 2027"; team joining OpenAI; open-source self-host + migration guide ([instantdb.com](https://www.instantdb.com/), [essay](https://www.instantdb.com/essays/instant_team_joins_openai)). Out of scope.

## 7. Neon-native options

- **No Neon change-feed / realtime / webhook product** was found in Neon docs or changelog as of 2026-09-07. Neon's changelog hits for "realtime/CDC/logical replication" are: **2026-08-14 "Electric… is joining Neon"** ("The sync engine keeps data continuously synchronized between a central Postgres database and connected clients"; "deeper integration already underway"; no dates) ([changelog 2026-08-14](https://neon.com/docs/changelog/2026-08-14)); 2026-07-24 `neon inspect db` replication-slot diagnostics; 2026-07-17 `neon projects create --enable-logical-replication` ([changelog](https://neon.com/docs/changelog)). Blog "Electric is joining team Neon at Databricks" (2026-08-11) says "Real-time sync needs the same treatment, a primitive that agents reach for by default" — **no product timeline** ([blog](https://neon.com/blog/electric-joins-neon)). `electric-sql.com` now 301-redirects to `electric.ax` (observed 2026-09-07).
- **Official Neon ↔ Electric page:** "Getting started with Electric and Neon" ([neon.com/guides/electric-sql](https://neon.com/guides/electric-sql)) — enable Logical Replication; "turn off connection pooling in the connection string… essential for Electric to maintain a persistent connection"; self-hosted Docker only; "Electric doesn't perform any authentication or authorization checks. You will need to proxy requests through an authorization layer". Electric's side: [electric.ax/docs/integrations/neon](https://electric.ax/docs/integrations/neon) ("You want the direct connection string in order to use logical replication").
- **Logical replication on Neon** ([enable guide](https://neon.com/docs/guides/logical-replication-neon)): project-level toggle, `wal_level` → `logical`, "Once changed, it cannot be reverted", enabling restarts all computes; `max_wal_senders` 10, `max_replication_slots` 10; inactive slots removed after "approximately 40 hours"; **"a connected logical replication subscriber keeps the database in use, so the compute never becomes idle… it remains active at all times while subscribers are connected."** Cost floor for any LR consumer: 0.25 CU × 730 h = 182.5 CU-h ⇒ **$19.35/mo Launch ($0.106/CU-h) or $40.52/mo Scale ($0.222/CU-h)**; Free's 100 CU-h/project cannot cover it ([Neon pricing](https://neon.com/pricing)).
- Consumers Neon lists (§3) that could act as a "row changed → webhook" bridge: Sequin, Inngest, Prisma Pulse, Bemi — none evaluated here beyond the listing.

## 8. Comparison table

Scale assumptions: 30 staff browsers × 8 h × 22 d, tens of thousands of rows, ~50k change events/month. Neon always-on floor ($19–41) applies to every logical-replication row.

| Option | Paradigm | Row-visibility authz | Needs logical replication? | Hosting / ops surface | Neon compat | Est. $/mo at our scale | Maturity | Fit w/ server-computed tRPC read models | Migration |
|---|---|---|---|---|---|---|---|---|---|
| **Ably kernel (Epic #178)** | Pub-sub ping → React Query refetch (opt-in patches) | JWT capability tokens per channel; data still fetched via tRPC/CASL | No | Vendor SaaS; token endpoint + publish in write path | Unaffected | Free tier fits numerically; Standard ≈ **$31–36** | GA; SDK 2.28.0; hooks unlabeled-stable | **High** — refetches the existing read models unchanged | **S** (SDK installed, plan approved) |
| **Electric SQL + TanStack DB** | Data sync (single-table shapes over HTTP) + client live queries | Proxy/gatekeeper sets shape `WHERE` server-side (subqueries ok; no JSONB/FTS ops) | **Yes** (slot + publication; direct conn) | Electric Cloud (PAYG) or Docker w/ persistent disk off-Vercel; Next.js route-handler proxy | Official guides both sides; direct string; always-on compute | Cloud writes ≈ $0 ("Under $5/mo waived") or Fly 1 GB $5.92; + Neon **$19–41** ⇒ **≈ $19–47** | Electric 1.0 GA 2025-03-17; TanStack DB **BETA** (0.8.7); Electric acquired by Neon 2026-08 | **Low–Med** — shapes carry raw rows; joins/derived fields re-implemented in TanStack live queries; CASL→Drizzle WHERE must be re-expressed as shape WHERE | **L** |
| **PowerSync** | Data sync (client SQLite) | Sync Streams SQL w/ `auth.user_id()` claims; JOIN/CTE allowed; role is `BYPASSRLS` | **Yes** (`powersync` publication) | Cloud (Free/Pro $49) or Docker + MongoDB/Postgres bucket store | Official Neon guide (says "Pooled" — verify); always-on compute | Cloud Free $0 or Pro $49; + Neon **$19–41** ⇒ **≈ $19–90** | Service/SDK/Streams GA; TanStack collection **Alpha**; FSL license | **Med** — server-side stream SQL can pre-join, but client gets rows, not tRPC DTOs; second authz language | **L** |
| **Zero** | Data sync (partial, query-driven) | Synced queries w/ `ctx` in a Next.js route handler; relations via `exists()` | **Yes** (direct conn; PG ≥ 15) | zero-cache long-running + volume (Fly/SST/K8s); no Vercel; Cloud Zero pricing unpublished | "Fully supported"; explicit always-on cost warning | Fly 2×/4 GB $22.22 + volume; + Neon **$19–41** ⇒ **≈ $42–65** | 1.0 "stable" 2026-03; 1.9.0 2026-08; Apache-2.0; roadmap page stale | **Med** — ZQL is a separate query language; derived fields not represented | **L** |
| **Pusher Channels** | Pub-sub ping | Private/presence channel auth endpoint | No | Vendor SaaS | Unaffected | Sandbox $0 (≤100 conns, 200k msg/day) or $49 | GA; pusher-js 8.6.0 | **High** (same paradigm) | **S–M** (replace Ably; lose rewind/capability-token parity — UNVERIFIED) |
| **DIY SSE on Vercel** | Pub-sub ping over `text/event-stream` | Session check in route handler | No — but needs a trigger bus (Redis/Upstash or polling); NOTIFY not receivable | Vercel Functions ≤ 800 s (1800 s beta) per stream + reconnect churn; external Redis | LISTEN only on direct conn, non-durable | Memory ≈ 352 GB-h ≈ $3.7 + Upstash Redis $0–5 ⇒ **≈ $5–15** + engineering | Platform primitives GA; WebSockets beta | **High** on paradigm, **Low** on ops (no wake-on-change, duration caps) | **M** |

## 9. Fit notes — what each option does NOT solve for us

- **Ably kernel:** moves no data — every ping still costs a tRPC round-trip, and writes from jobs/webhooks are only seen if *every* write path publishes (a central CRUD chokepoint is mandatory); Ably itself never sees the DB.
- **Electric SQL + TanStack DB:** logical replication captures job/webhook writes for free, but shapes are single-table raw rows with no include trees — server-computed fields, joins, and CASL→Drizzle visibility all have to be re-implemented as shape WHERE clauses + client live queries, and the sync service (and Neon compute) must run 24/7 outside Vercel.
- **PowerSync:** same automatic capture, and Sync Streams can pre-join server-side, but the client receives SQLite rows (not tRPC DTOs), auth becomes a second language (stream SQL + JWT minting for better-auth), the TanStack bridge is Alpha, and the service is FSL-licensed with an extra bucket-storage DB to run.
- **Zero:** automatic capture and TypeScript permissions in a Next.js route handler, but ZQL replaces tRPC read models rather than reflecting them, zero-cache needs a stateful long-running host we do not have today, and hosted pricing is unpublished.
- **Pusher:** identical gap to Ably (pub-sub moves no data; app must publish on every write) with fewer platform features than the plan already assumes.
- **DIY SSE on Vercel:** solves nothing the Ably plan doesn't, and adds the unsolved part — there is no way for a Vercel Function to be woken by a Neon change, so a separate bus (Redis) or polling is still required, plus 300–800 s stream lifetimes.
- **Common to all logical-replication engines:** they need `wal_level=logical` enabled irreversibly on the Neon project, a direct (non-pooled) replication connection, and they pin Neon compute always-on (~$19–41/mo before any engine cost).

## Sources

All read 2026-09-07.

**Ably**
- https://ably.com/pricing
- https://ably.com/docs/platform/pricing/limits
- https://ably.com/docs/platform/pricing/billing
- https://ably.com/docs/platform/pricing/message-counting
- https://ably.com/docs/platform/pricing/faqs
- https://ably.com/docs/channels/options/rewind
- https://ably.com/docs/auth/capabilities
- https://ably.com/docs/presence-occupancy/presence
- https://ably.com/docs/integrations/webhooks
- https://ably.com/docs/getting-started/react
- https://github.com/ably/ably-js/releases
- https://github.com/ably/ably-js/blob/main/docs/react.md

**Vercel**
- https://vercel.com/docs/functions/limitations (last_updated 2026-08-24)
- https://vercel.com/docs/functions/configuring-functions/duration (2026-08-24)
- https://vercel.com/docs/functions/streaming-functions (2026-09-01)
- https://vercel.com/docs/fluid-compute (2026-08-24)
- https://vercel.com/docs/functions/websockets (2026-08-10)
- https://vercel.com/changelog/websocket-support-is-now-in-public-beta (2026-06-22)
- https://vercel.com/changelog/vercel-functions-can-now-run-up-to-30-minutes (2026-06-15)
- https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package (2026-09-03)
- https://vercel.com/docs/functions/usage-and-pricing (2026-06-16)
- https://vercel.com/kb/guide/publish-and-subscribe-to-realtime-data-on-vercel
- https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections
- https://vercel.com/kb/guide/connection-pooling-with-functions

**Neon**
- https://neon.com/docs/connect/connection-pooling
- https://neon.com/docs/reference/compatibility
- https://neon.com/docs/introduction/scale-to-zero
- https://neon.com/docs/introduction/compute-lifecycle
- https://neon.com/guides/pub-sub-listen-notify
- https://neon.com/docs/guides/logical-replication-guide
- https://neon.com/docs/guides/logical-replication-neon
- https://neon.com/docs/changelog
- https://neon.com/docs/changelog/2026-08-14
- https://neon.com/blog/electric-joins-neon (2026-08-11)
- https://neon.com/guides/electric-sql
- https://neon.com/pricing

**Electric / TanStack DB**
- https://electric.ax/docs/integrations/neon (301 from electric-sql.com)
- https://electric.ax/docs/guides/deployment
- https://electric.ax/docs/guides/shapes
- https://electric.ax/docs/guides/auth
- https://electric.ax/docs/integrations/next
- https://electric.ax/docs/integrations/vercel
- https://electric.ax/pricing
- https://electric.ax/product/cloud
- https://electric-sql.com/blog/2025/03/17/electricsql-1.0-released
- https://tanstack.com/db/latest/docs/overview
- https://tanstack.com/db/latest/docs/collections/electric-collection
- https://github.com/TanStack/db

**PowerSync**
- https://docs.powersync.com/intro/powersync-overview
- https://docs.powersync.com/installation/database-setup
- https://docs.powersync.com/integrations/neon
- https://docs.powersync.com/sync/streams
- https://docs.powersync.com/installation/authentication-setup
- https://docs.powersync.com/configuration/auth/custom
- https://docs.powersync.com/client-sdk-references/javascript-web
- https://docs.powersync.com/client-sdks/frameworks/tanstack
- https://docs.powersync.com/resources/feature-status
- https://docs.powersync.com/self-hosting/getting-started
- https://docs.powersync.com/self-hosting/installation/powersync-service-setup
- https://www.powersync.com/pricing
- https://github.com/powersync-ja/powersync-service/blob/main/LICENSE

**Zero**
- https://zero.rocicorp.dev/docs/introduction
- https://zero.rocicorp.dev/docs/deployment
- https://zero.rocicorp.dev/docs/connecting-to-postgres
- https://zero.rocicorp.dev/docs/permissions
- https://zero.rocicorp.dev/docs/synced-queries
- https://zero.rocicorp.dev/docs/reading-data
- https://zero.rocicorp.dev/docs/install
- https://zero.rocicorp.dev/docs/roadmap
- https://zero.rocicorp.dev/docs/release-notes (1.0, 1.9)
- https://github.com/rocicorp/mono
- https://github.com/rocicorp/todo-nextjs

**Other pub-sub**
- https://pusher.com/channels/pricing/
- https://upstash.com/docs/realtime
- https://upstash.com/blog/about-upstash-realtime (2025-10-29)
- https://upstash.com/pricing/redis
- https://docs.partykit.io/
- https://blog.partykit.io/posts/partykit-is-joining-cloudflare (2024-04-05)
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://supabase.com/docs/guides/realtime/broadcast
- https://supabase.com/docs/guides/realtime/authorization
- https://supabase.com/pricing
- https://docs.convex.dev/understanding/
- https://www.convex.dev/pricing
- https://www.instantdb.com/
- https://www.instantdb.com/essays/instant_team_joins_openai

**Hosting price sheets used for estimates**
- https://fly.io/docs/about/pricing/

**npm registry** (`npm view <pkg> version license time`, 2026-09-07): ably, @rocicorp/zero, @powersync/web, @powersync/react, @tanstack/db, @tanstack/electric-db-collection, @tanstack/powersync-db-collection, @electric-sql/client, @electric-sql/react, @upstash/realtime, pusher-js.
