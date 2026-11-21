# Inngest worker on a hardened VPS — design

**Date:** 2026-11-03 · **Status:** draft, awaiting owner approval · **Builds on:** otautomations Phase 0 (Inngest Cloud + Vercel `serve`, shipped 2026-04-26), reused as pattern, not wiring.

## 1. Intent

The app only works when someone is using it. Every background job today is a QStash call into a Vercel function, which caps a unit of work at Vercel's duration limit and leaves no run history we own. The owner wants a long-running server of our own that fires on time and on app events, runs the app's own services for as long as the work takes, shows every run, and is the first of possibly several VPSs, so provisioning must be repeatable and verifiably hardened.

The runtime is **Inngest, self-hosted on the VPS**. The code that runs is a **worker built from this repo** that connects outbound to Inngest (Connect mode), so the VPS exposes no inbound port for execution. The first function is a **morning brief** pushed to each rep.

## 2. Goals, non-goals, anti-goals

**Goals**
- Run units of work lasting minutes to hours in app code, with retries, concurrency caps and step checkpoints.
- Cron triggers now; app-event triggers in a following phase.
- Owner sees every run in a dashboard; Claude Code reaches the same instance over MCP. Both only over a private network.
- One command re-provisions an equivalent box in under 30 minutes, and one script proves it is hardened.
- The first function is useful to the business the day it ships.

**Non-goals**
- Migrating the 23 QStash jobs. They stay. A migration decision comes after 30 days of worker uptime.
- n8n. It can join the same box later as a canvas and connector library; it is not the runtime.
- Moving the Next.js app off Vercel.
- Customer-facing sends. The prod visit-sends gate stays closed; everything here is staff-facing.
- A multi-tenant SOP engine. That is otautomations' product.

**Anti-goals (a build that does these has failed even if it runs)**
- Any Inngest UI, REST or MCP endpoint reachable from the public internet. The self-hosted dashboard and MCP have **no authentication** (verified locally 2026-11-04 on inngest-cli 1.49.0: `/` and `/mcp` answer 200 unauthenticated; `/v1/*` requires the signing key).
- Docker publishing a port on `0.0.0.0`. Docker writes its own iptables rules and bypasses ufw; a published port is public regardless of the firewall.
- Secrets in cloud-init user-data, in the image, or in git. Cloud-init logs its input.
- Business rules re-implemented in the worker. Functions compose service calls; what counts as "pending" lives in services.
- The worker holding credentials no function uses. Keys are added per function, when that function ships.

## 3. Architecture

```
                    outbound only (events, phase 4)                 outbound only
Vercel app ───────────────────────────────┐      ┌──────────────── Neon (prod), Resend, web-push, R2, OpenAI
                                          ▼      │
VPS ──────────────────────────────────────────────┼───────────────────────────────────────────────
│  Caddy :443  (phase 4 only; routes /e/* → inngest, nothing else)                              │
│  inngest start   :8288 API+dashboard+/mcp  (bound to the Tailscale IP only)                    │
│                  :8289 Connect gateway      (compose network only)                             │
│  postgres:17, redis:7   (compose network only, named volumes)                                  │
│  worker (image from this repo)  ── Connect websocket → inngest:8289                             │
└────────────────────────────────────────────────────────────────────────────────────────────────
         ▲ Tailscale only: SSH, dashboard, /mcp (Claude Code), /v1 REST
   owner's machine
```

Phases 1 to 3 open **no public port at all**. SSH, the dashboard and MCP are reached over Tailscale. Phase 4 adds the single public route the Vercel app needs to send events.

## 4. Decisions

### 4.1 Decided by the owner in conversation
- Self-hosted Inngest on our own VPS, not Inngest Cloud. (2026-11-03)
- The worker runs on the VPS, never on Vercel compute. (2026-11-03)
- The VPS is hardened to a written, repeatable standard before anything runs on it. (2026-11-02)
- Long-running and scheduled work is the purpose; the first use case is small and useful. (2026-11-03)

### 4.2 Builder's calls (mine; the owner can overturn any of these)

| # | Call | Why |
|---|------|-----|
| C1 | **Provider: Hetzner Cloud, US location (Hillsboro OR preferred, Ashburn VA fallback), 4 GB minimum, 8 GB preferred, Ubuntu 24.04 LTS.** DigitalOcean is the drop-in alternative; the provisioning files are provider-neutral. | Hetzner has the best price per resource and a plain console. Hetzner's US price list fetched 2026-11-03 showed CPX21 (3 vCPU/4 GB) at €32.49 and CPX31 (4 vCPU/8 GB) at €62.99 and marked both "currently unavailable"; if that holds at order time, DigitalOcean's 4 GB ($24) or 8 GB ($48) droplet in SFO3 is the pick. The decision is made in the console on order day, inside this envelope. |
| C2 | **Private access via Tailscale.** SSH, dashboard, MCP and REST bind to the Tailscale interface. Public SSH is closed once Tailscale is confirmed; the provider console is break-glass. | Removes every reason to expose a port in phases 1 to 3. Free tier covers one owner and a few devices. |
| C3 | **Provisioning as files in this repo under `infra/vps/`:** `cloud-init.yaml` (users, SSH policy, ufw, unattended-upgrades, Docker, Tailscale install), `compose.yml`, `Caddyfile` (phase 4), `verify.sh` (asserts the hardening standard from inside), `scan.sh` (asserts it from outside with nmap), `provision.md` is **not** written; the files and their comments are the runbook. | CLAUDE.md: encode rules in code, not prose. A second VPS is "run cloud-init, copy secrets, run verify". |
| C4 | **Worker packaging: one `Dockerfile.worker` at repo root, `node:24-slim`, full pnpm install, entry `tsx --import ./scripts/lib/stub-server-only.mjs src/automations/worker.ts`.** Bundling with esbuild is a later optimization if image size or cold start hurts. | The scripts folder already runs services this way; Connect needs Node 22.4+. Reuse what works before optimizing. |
| C5 | **Image built by GitHub Actions on push to `main`, pushed to GHCR as `ghcr.io/olisdevspot/tri-pros-worker:{sha,main}`. Activation is explicit: `pnpm worker:deploy` runs `docker compose pull worker && docker compose up -d worker` over Tailscale SSH.** No auto-pull. | Matches the owner's ship culture: the squash-merge produces the artifact, a human activates it. Building on the box would put the repo and a deploy key on the VPS. |
| C6 | **Code layout:** Inngest client + env in `src/shared/services/providers/inngest/{client.ts,lib/config.ts}` (provider pattern, `createProviderConfig`); functions, registry and the worker entry under `src/automations/` (`registry.ts`, `worker.ts`, `<area>/<name>/{function.ts,README.md}`); facts computed by **service methods** in the owning module. | Same shape as otautomations (one registry, functions thin); facts stay with their module per the services-orchestrate rule. The brief spans meetings and proposals, so its composition is a feature, not a module member. |
| C7 | **Worker env is the minimum for shipped functions:** `DRIZZLE_TARGET=prod`, `DATABASE_URL`, `NEXT_PUBLIC_BASE_URL` (push deep links resolve against it), `INNGEST_BASE_URL=http://inngest:8288`, `INNGEST_DEV=0`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, the VAPID pair for push. Nothing else until a function needs it. The Inngest fragment parses `INNGEST_DEV` as the literal strings `'0'`/`'1'`, never `z.coerce.boolean()` (which reads `"0"` as true; otautomations' fragment has this latent bug). | Anti-goal 5. `DRIZZLE_TARGET` is the repo's only switch to prod data; `NODE_ENV` must not be used for that. |
| C13 | **Recipient allowlist for the soak.** The brief's recipient set is a constant in the brief's module that ships as the owner only; widening it to every rep is a one-line PR after a week of correct briefs. The manual event also accepts an explicit `userIds` filter for testing. | A cron that reaches every rep's phone the first morning cannot be un-sent. The dashboard pause button is not a rollout plan. |
| C14 | **Owner summary goes to the system owner the code already knows** (`getSystemOwnerId()`, the `info@` user), as every existing notification does. | Follow the existing pattern; the owner can redirect it if they read pushes as a different user. |
| C15 | **The worker image is a public GHCR package.** The repository is public, so the image bakes nothing that isn't already public, and no registry credential lives on the box. Phase 0 loses the "GHCR read token" line. | A long-lived PAT on the box that no function uses would violate anti-goal 5 for nothing. |
| C16 | **Tailscale on both the Windows host and inside WSL2, as two nodes.** Claude Code, `worker:deploy`, `scan.sh` and the MCP client run in WSL2; the browser for the dashboard runs on Windows. | WSL2 cannot reach a tailnet joined only by Windows without mirrored networking. Two nodes is the setup that needs no WSL network changes. |
| C17 | **Privileged service calls use `systemContext(reason)`** with a new closed reason for the brief, not the legacy `SYSTEM_CONTEXT` constant. | The codebase is mid-migration to reasons; new sites do not add to the old constant's callers. |
| C8 | **Dedicated Neon role `worker`** with the table grants the shipped functions need (read on meetings, meeting_participants, proposals, proposal_views, user, push subscriptions; write only where a function writes). | A second credential set should have a smaller blast radius than the app's. |
| C9 | **Monitoring: a `_system/heartbeat` function every 5 minutes pings a dead-man's switch (healthchecks.io free tier) which emails and pushes the owner when it goes quiet.** Provider backups on. No metrics stack. | One signal proves box + Inngest + Postgres + Redis + worker + outbound network at once. |
| C10 | **Inngest's Postgres is never pruned by Inngest.** A weekly `_system/health-report` function reports table sizes and disk; a prune job is added when the report says so. | Documented Inngest gap; measure before building. |
| C11 | **The box is disposable.** Nothing of record lives on it: business data is in Neon, run history is operational. The acceptance test for "repeatable" is a timed reprovision from scratch. | This is what "confident we can spin up a new VPS" means in practice. |
| C12 | **Local development mirrors otautomations:** `pnpm dev:inngest` (dev server on 8288), `pnpm worker:dev` (worker in Connect dev mode against the dev DB), `INNGEST_DEV=1` set explicitly, Claude Code MCP `inngest-dev` at `http://127.0.0.1:8288/mcp`. Against the VPS, Claude Code uses a second MCP entry `tripros-inngest` at `http://<tailscale-ip>:8288/mcp`. | The dev server is free and isolated; the same MCP surface works on both. |

### 4.3 Left to the builder
- Exact ufw, sshd and unattended-upgrades settings inside the standard below.
- Swap size, journald and Docker log limits.
- How `verify.sh` discovers the Tailscale IP and the expected listener set.
- Cron minute and step layout inside the brief, within the function contract in §6.

## 5. The hardening standard (what `verify.sh` asserts, what `scan.sh` confirms from outside)

Each line is a check, not advice. A box passes or fails.

**Account and provider**
- 2FA on the provider account; a dedicated project for this box; API tokens scoped read/write to that project only; provider backups enabled.
- Provider firewall: inbound nothing (phase 1 to 3) or 443 only (phase 4); outbound unrestricted.

**Access**
- SSH: key-only (`PasswordAuthentication no`, `PermitRootLogin no`, `KbdInteractiveAuthentication no`), one non-root admin user with sudo, ed25519 keys with passphrases.
- Tailscale up; sshd listens on the Tailscale interface only once Tailscale is confirmed; public 22 closed in ufw and in the provider firewall.
- Break-glass: provider web console and rescue mode; documented in the field guide, tested once.

**Host**
- Ubuntu 24.04 LTS, `unattended-upgrades` with security updates and a reboot window; `systemd-timesyncd` active; swap present; journald and Docker logs capped.
- ufw: default deny incoming, allow outgoing; only Tailscale's interface permitted inbound.
- No listener on `0.0.0.0` or the public IP except what the phase allows. `ss -ltn` is the oracle.

**Containers**
- Docker CE from Docker's repository; every `ports:` entry in `compose.yml` binds to `127.0.0.1` or the Tailscale IP, never bare; Postgres and Redis publish no ports; named volumes; healthchecks on every service; `restart: unless-stopped`.
- Images pinned to a tag (`inngest/inngest:v1.x`, `postgres:17`, `redis:7-alpine`); worker pinned to a sha tag.

**Secrets**
- `/opt/tripros/.env` owned by the admin user, mode 600, copied over Tailscale after boot; never in user-data, never in the image; keys generated with `openssl rand -hex 32`.
- Inngest event key ≠ signing key; both rotate by replacing the value and restarting the stack.

**Proof**
- `scan.sh` from the owner's machine: `nmap -Pn -p-` against the public IP shows no open TCP port (phases 1 to 3) or 443 only (phase 4).
- `verify.sh` on the box: every line above green; `curl http://<tailscale-ip>:8288/health` is 200 from the owner's machine and times out from anywhere else.
- Reprovision drill: destroy, recreate from `infra/vps/`, worker connected and heartbeat green within 30 minutes.

## 6. First function: the morning brief

**Why this one.** Staff-facing (no launch gate), daily, visible to every rep, exercises cron, fan-out, step checkpoints, a service read and a push send. Deterministic in v1; an optional narration step with the AI provider is v1.1, after the plumbing is trusted.

**Trigger.** Cron, America/Los_Angeles, weekday mornings; the exact time and whether Saturday is included are owner decisions (Q1 below). Also triggered by a manual event `briefs/morning-brief.run` for testing from the dashboard or MCP.

**Shape.**
1. `list-recipients`: users who can receive a brief (role in the rep/admin set, at least one push subscription).
2. Per recipient, `compose` (one step per user so a failure retries only that user): `meetingService.briefs.forRep(systemContext('morning-brief'), { userId, now })` returns today's meetings where the user is a participant and meetings in the last 24 h whose outcome is `not_set`; `proposalService.briefs.forRep(...)` returns the proposals where the user is a participant on the proposal's meeting that still need the rep's attention. Which lifecycle defines "needs attention" is owner question Q1 below: the proposals table carries two independent lifecycles, the proposal one (`status`, `sentAt`, `approvedAt`, homeowner page opens in `proposal_views`) and the contract one (`contractSentAt`, `contractViewedAt`, `contractSignedAt`, `contractDeclinedAt` from Zoho), and the code never derives one from the other. Participant semantics follow the existing rule: proposals belong to meeting participants, never `proposals.ownerId`.
3. `send`: `webPushClient` with a deep link to the dashboard; empty briefs are not sent.
4. `owner-summary`: counts per rep to the owner.

**Facts live in services, not in the function.** The two `briefs.forRep` readers are new service methods in the owning modules; thresholds (N days) are constants in those modules.

**Done means.** A rep's phone shows the brief at the scheduled time from the prod worker; the run is visible in the dashboard over Tailscale; Claude Code can list the run through the `tripros-inngest` MCP; `pnpm tsc` and `pnpm lint` green.

## 7. Phases

| Phase | Outcome | Gate to next |
|---|---|---|
| 0. Accounts (owner) | Provider account with 2FA and a project; Tailscale account with nodes on Windows and in WSL2; healthchecks.io account. | Owner confirms. |
| 1. Provision | Box up from `infra/vps/cloud-init.yaml`; Tailscale joined; public SSH closed; `verify.sh` and `scan.sh` green. | Both scripts green, screenshot in PR. |
| 2. Runtime | Compose stack up; dashboard and `/mcp` reachable over Tailscale only; `_system/heartbeat` green on healthchecks.io; Claude Code MCP connected. | Heartbeat green 24 h. |
| 3. Morning brief | §6 shipped, verified on the dev DB with the local dev server first, then on prod. | Owner receives a real brief. |
| 4. Events from the app | Caddy + `/e/*` public; `inngest.send` from after-commit hooks; first event-driven function. Own spec and plan. | — |
| 5. Review | 30-day review: uptime, cost, retention table sizes; decide QStash migration. | — |

## 8. Repo footprint

New: `infra/vps/{cloud-init.yaml,compose.yml,verify.sh,scan.sh}`, `Dockerfile.worker`, `.dockerignore`, `.github/workflows/worker-image.yml`, `src/shared/services/providers/inngest/{client.ts,lib/config.ts}`, `src/automations/{registry.ts,worker.ts,_system/heartbeat/,_system/health-report/,briefs/morning-brief/}`, service methods `meetingService.briefs.forRep`, `proposalService.briefs.forRep`, scripts `dev:inngest`, `worker:dev`, `worker:deploy`.

Touched: `package.json` (dependency `inngest`, three scripts), `src/shared/config/server-env.ts` (the Inngest fragment through the provider config, plus whatever Q2 rules for the hard-required keys), `.env.example`.

Not touched: anything under `providers/upstash`, `vercel.json`, the Next.js app routes.

## 9. Costs (monthly, to confirm on order day)

VPS 4 to 8 GB in the US: €32 to €63 at Hetzner's fetched US prices, or $24 to $48 at DigitalOcean. Backups about 20 % of the box. Tailscale, healthchecks.io, GHCR, Inngest self-hosted: $0.

## 10. Questions only the owner can answer

**Q1. Which lifecycle does the brief chase: the contract or the proposal?** The contract lifecycle (sent / viewed / signed / declined via Zoho) says "a document is out and the rep should follow up". The proposal lifecycle (`status` plus homeowner opens of the share-link page) says "the homeowner is looking, or stopped looking". The answer decides both `briefs.forRep` queries, the Neon grants, the brief's wording and which "N days" counts. Options: contract only; proposal only; both as separate groups.

**Q2. How does the worker get past `server-env`'s hard-required keys?** `server-env.ts` exits the process unless `NEXT_PUBLIC_BASE_URL`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are all set, and every service reaches it through the db module. The brief needs the first two only. Options: (a) placeholder values for the other five in the box's `.env`, the way `.env.ci` does for CI, with `verify.sh` whitelisting them; (b) `server-env` requires the Next-only keys only when `APP_ROLE` is unset, so the worker sets `APP_ROLE=worker` and the app's boot guarantees are unchanged. Recommendation: (b); it is a small, explicit change to a shared file, which is why it is asked rather than assumed.

**Q3. When does the brief fire, and does Saturday count?** A time in America/Los_Angeles and the set of weekdays.

## 11. Builder check

Run 2026-11-04 by a fresh reviewer against the repo. Seven questions came back. Four were settled as builder's calls C13 to C16 (soak allowlist, owner-summary recipient, public image, Tailscale on both hosts); one became C17 and the `INNGEST_DEV` parsing note in C7 (two stale references the reviewer caught); three are the owner's, above.
