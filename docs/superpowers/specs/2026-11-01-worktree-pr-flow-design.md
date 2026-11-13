# Worktree → PR flow: one idea, one worktree, one PR

Status: design approved by the owner 2026-11-01 (builder-check questions answered); amended 2026-11-02 after `/stress-test-plan` with the owner's rulings (Neon Launch, photos-only prod login, side-effect guards, proxy-secret trade-off). Follow-up project: the daily engineering-partner routine (separate spec).

## Why

The owner works on local `main` even though they know it is wrong, because starting anywhere else costs a toll: create a GitHub issue, remember its number, run `pnpm dispatch start <#>`, open and sync a new session, fit inside 3 slots, and re-register `localhost:300N` with Google. Main has no toll, so main wins. The result (measured 2026-10-29): local main 177 commits ahead of prod, ready work queued behind unready work, releases in big risky pushes, hotfixes needing their own `pnpm hotfix` machinery and a sync dance.

The owner is also not confident in git and fears merge conflicts and anything touching prod or the databases. What they want is a flow that is **provably safe and built from established patterns for this stack** (Next.js on Vercel, Neon Postgres, Drizzle, better-auth, GitHub), not a homegrown system. `scripts/dispatch.sh` (1,954 lines) and `scripts/hotfix.sh` (301 lines) are the homegrown system this replaces.

## Success looks like

- Starting an idea in a worktree costs the same as starting on main: name it in Orca, get a ready worktree with an agent running. No issue number, no slot limit, no Google Cloud edits.
- Every change reaches prod through a PR with a Vercel preview the owner can sign into on the iPad.
- Local `main` mirrors `origin/main` (prod). Nobody commits to it.
- Schema changes travel inside the PR as migration files and apply on deploy. No person or agent changes the prod schema or prod data by hand.
- The owner never runs a git command they don't understand. Agents do the git; the owner reads plain-English summaries.

## Non-goals

- GitHub issues as a required step. They stay available for work worth tracking; they are never a gate.
- The `pnpm dispatch loop` AFK engine. Not carried over. If unattended agents come back, they come back through Orca or Claude Code, not a bash loop.
- Cleaning up the ~60 one-off scripts in `scripts/` (backfills, verifies, migrations already run). Separate small cleanup after this ships.
- The daily coach routine (next project).

## Anti-goals (a failure even if it technically works)

- Any path where a worktree, a preview, or an agent can write to the prod database.
- A worktree or preview database that holds live secrets copied from prod (Google tokens, sessions, push subscriptions, QuickBooks tokens) or that can make real outbound sends (SMS, email, calendar invites to customers).
- A new homegrown tool where an established one exists.
- A flow the owner has to remember. If a step depends on memory, it belongs in a hook, a check, or a script.

## The flow (owner's view)

1. **Start.** In Orca, new worktree from `origin/main`, named `{type}/{slug}` (`feat | fix | refactor | chore | docs`, no issue number). Orca copies `.env` and `.claude/settings.local.json` (`.worktreeinclude`; `.env.local` stays per checkout), runs setup (install, free port, own database branch), then starts the agent (`setupAgentStartupPolicy: wait-for-setup`).
2. **Work.** The agent commits on the branch, keeps it current with `main`, resolves conflicts and explains them in plain words.
3. **Schema.** Schema edits come with a generated migration file in the same PR.
4. **Ship.** Agent runs `pnpm lint && pnpm tsc`, the one automated review, opens the PR. GitHub checks run. Vercel builds a preview with its own database. Owner opens it on the iPad, signs in with Google, looks, merges.
5. **Deploy.** Merge to `main` → Vercel production deploy → migrations apply.
6. **Shelve or drop.** Delete the worktree in Orca. Its database branch is deleted by the archive hook. The git branch stays on GitHub if pushed, so the idea can be reopened by creating a worktree from that branch; its migrations rebuild its database.

## Decided (by the owner)

- **Orca** is the worktree/agent tool. `orca.yaml` and `.worktreeinclude` already exist at the repo root, uncommitted; Orca only reads them once committed to main.
- **Agents do the git**: syncing, conflict resolution, pushing, PRs. Owner sees summaries and gets warned when two open branches touch the same files.
- **Every worktree gets its own Neon database branch**, created automatically.
- **Migrations replace `db:push`** for anything that reaches prod. The owner has not used migrations and wants the industry-standard way, taught along the way.
- **Google sign-in: the better-auth `oAuthProxy` plugin plus wildcard host patterns** (details below). Accepted trade-off: local dev sign-in depends on prod being up with the plugin deployed.
- **Parking = delete the worktree, keep the pushed branch.** No parked folders.
- **Prod-touching scripts go away**: `db:push:prod`, `db:reset:prod`, `db:seed:prod`.
- **Transition**: drain today's local main with one last `/pre-ship`, then switch.
- **No prod credentials on the owner's machine or in any worktree** (owner, 2026-11-01). Prod data jobs run through a manually triggered, owner-approved GitHub Action (section 9).
- **The repo goes private, with GitHub Pro for branch protection, and Vercel preview protection on** (owner, 2026-11-01). Customer data in scrubbed copies stays unmasked for now (section 10).
- **Neon is on the Launch plan** (owner upgraded 2026-11-02; API shows `plan: launch`). Production becomes a protected branch; Launch keeps 10 branches per project included, extra branches are $1.50 per branch-month, no monthly minimum.
- **The two photo workflows keep running from the laptop through a photos-only prod login** (owner, 2026-11-02), not the full prod password. This supersedes Q-A of `docs/superpowers/specs/2026-10-20-r2-storage-design.md` for the database side (section 9).
- **Copies cannot touch real people or live files: the guards ship in this project** (owner, 2026-11-02): storage deletes, Zoho contracts, meeting realtime channels (section 12).
- **The sign-in proxy secret on laptops is an accepted, documented trade-off** (owner, 2026-11-02; section 5 and Residual risks).

## Parts in detail

### 1. Orca setup and archive (`orca.yaml`)

Current `orca.yaml` already does `pnpm install --frozen-lockfile` and claims the next free `PORT=` in `.env.local`. Add:

- **Setup: create the worktree's Neon branch** and write its connection string into the worktree's `.env.local` as `DATABASE_DEV_URL`, then apply migrations to it. Branch name derives from the git branch (e.g. `wt/feat-filters`). Idempotent: a setup re-run reuses the branch if it exists and carries the scrub marker. The Neon branch id is stored in `.env.local` so the archive hook deletes by id even if the git branch was renamed.
- **Archive hook (`scripts.archive`)**: delete that Neon branch. Orca's CLI documents that a failed archive hook blocks removal unless overridden, so the hook must succeed when the branch is already gone.
- **A prune command** for orphans (Neon `wt/*` branches with no matching worktree), replacing `pnpm dispatch neon-prune`.

The Neon logic moves out of `dispatch.sh` into TypeScript under `scripts/`, reusing `scripts/lib/neon-api.ts` and `scripts/lib/neon-refresh.ts` (which already hold `SCRUB_STATEMENTS`, branch listing, endpoint resolution).

Orca facts verified from its docs/source (2026-11-01): `.worktreeinclude` copies literal gitignored paths only; `worktree.sharedDirectories` symlinks (do NOT share `node_modules`: Turbopack rejects symlinks resolving outside the project root); per-repo base ref is usually `origin/main`; `orca.yaml` supports `scripts.setup`, `scripts.archive`, `setupAgentStartupPolicy`; setup reads `$ORCA_WORKTREE_PATH`; Orca reads `.worktreeinclude` from the primary checkout and setup from the new worktree's revision.

### 2. Database branches: where they fork from (my call)

Today worktree branches fork from the `development` Neon branch, and `pnpm db:refresh:dev` refuses to reset `development` while it has children (Neon will not reset a branch with children). That couples every open worktree to the owner's ability to refresh dev.

**My call:** worktree and preview branches fork from **production** and are scrubbed immediately with the existing `SCRUB_STATEMENTS`, **fail-closed**: if the scrub fails, the branch is deleted and setup fails. Result: `development` never has children, refresh always works, and every new worktree starts from fresh, scrubbed real data. The scrub list must also neutralise real outbound sends (an empty `voip_dids` table is the one gate on visit SMS, so a scrubbed copy must empty it too; verify against the code). The builder must audit the scrub list for every table holding a secret or a send trigger before this ships, and the list stays the single source used by refresh, worktrees and previews.

Neon reads of production for branching are copy-on-write metadata operations; nothing writes to production.

**Found while planning:** a Neon branch copies its parent's role passwords, so a fresh fork of prod carries a connection string whose password also opens prod (confirmed 2026-11-02: today's `development` URL carries prod's password). Neon generates new role passwords for a branch created from a **protected** branch, so protecting production (Launch plan) fixes this for worktree and preview copies alike; it is proven once by trying a fresh copy's password against the prod host, which must fail. Prod's password is rotated once when credentials leave the machine (section 9), which also kills the old shared password on `development` and in old worktree env files.

A copy is reused only if it carries the scrub marker; a copy without one (setup killed between fork and scrub) is deleted and forked again.

### 3. Migrations (replacing `db:push`)

State today: `drizzle.config.ts` outputs to `src/shared/db/migrations/`, which holds three stale migrations last touched 2026-03; prod and dev are maintained with `drizzle-kit push`.

Target:
- **Baseline**: replace the stale files with one baseline migration generated from the current schema, and record it as already applied on prod and dev (the established Drizzle pattern for adopting migrations on a push-managed database). The builder must prove the baseline matches prod exactly before recording it (e.g. generate against a fresh Neon branch of prod and diff, or `drizzle-kit` check tooling), because a wrong baseline is the one way this project could damage prod.
- **Day to day**: schema edit → `pnpm db:generate` → migration file committed in the same PR → applied to the worktree branch, the preview branch, and on production deploy.
- **Where prod migrations run** is the builder's call between (a) the Vercel build step for `VERCEL_ENV=production` and (b) a GitHub Action on push to `main` that runs before/with deploy. Constraints: runs exactly once per deploy, a failed migration stops the deploy, and migrations are written additive-first (expand, then contract in a later PR) so code and schema can be briefly out of step.
- **Migration conflicts**: two PRs that both generate migrations will collide on the journal. The agent's sync step regenerates its own migration on top of `main` when that happens, never hand-merging `_journal.json`, and then recreates its worktree copy and its preview copy (they already ran the old file). This rule is load-bearing: drizzle's migrator reads only the newest recorded row and applies a file only when its journal `when` is later (`drizzle-orm/pg-core/dialect.js:56-62`), so a hand-merged older entry would be skipped on prod with no error. CI enforces it: journal `when` values strictly increase, and every entry a PR adds is later than the newest on `main`.
- **One migrator at a time**: drizzle takes no lock, so the deploy step holds a Postgres advisory lock while it migrates; two quick merges queue instead of racing.
- **Migrations run with an explicit address** (drizzle-orm's `migrate()` on a connection to the given URL), never `drizzle-kit migrate`, because `drizzle.config.ts` lets `.env.local` override any address passed in.
- `db:push` is retired everywhere (changed 2026-11-02, was call 4): a push changes the schema without recording a migration, so the next `migrate` on that database fails. Schema edits always go `db:generate` → `db:migrate:dev`. `db:push:prod`, `db:reset:prod`, `db:seed:prod` are deleted.

### 4. Vercel previews with their own database

Each preview deployment needs its own Neon branch (forked and scrubbed per section 2) so a PR with a migration can be checked on the iPad. **Chosen (2026-11-02): the Neon–Vercel integration**, because with production protected its preview copies get their own passwords; the preview build scrubs a copy once (scrub marker) and migrates it. The GitHub Action route (`neondatabase/create-branch-action`) is rejected: Vercel starts building on push before an Action could hand it a database. The integration deletes a preview copy when its git branch is deleted, which the ship flow always does after a merge.

The preview half of the build step ships only after the integration is on, so no preview build ever scrubs or migrates a database it does not own. The build refuses outright when it cannot tell the prod endpoint apart (`NEON_PROD_ENDPOINT_ID` unset) or when the preview's address is prod.

**Must verify first:** what database previews hit today. `src/shared/db/index.ts` uses `DATABASE_DEV_URL ?? DATABASE_URL` when `VERCEL_ENV !== 'production'`; if the preview scope lacks `DATABASE_DEV_URL` and has the prod `DATABASE_URL`, previews currently read and write prod. Report this to the owner either way.

### 5. Google sign-in everywhere (oAuthProxy + wildcards)

Verified against the installed `better-auth` 1.6.9 source:
- `baseURL.allowedHosts` and `trustedOrigins` accept wildcard patterns. Replace the 12 enumerated `localhost:300N` / funnel-subdomain entries in `APP_HOSTS.dev` (`src/shared/config/roots.ts`) with `localhost:*` and `*.localhost:*`, and add the Vercel preview host pattern. Funnel subdomains keep working on any port.
- Add `oAuthProxy({ productionURL: 'https://www.triprosremodeling.com' (or the apex; whichever Google has registered), secret: <dedicated proxy secret> })`. Flow: sign-in starts on the worktree/preview origin → Google returns to prod's registered callback → prod exchanges the code, encrypts profile + tokens (60 s max age) → redirects to the origin's `/api/auth/oauth-proxy-callback` → that origin creates the session in **its own** database. Prod's database is not written in the proxied flow.
- Use the plugin's dedicated `secret` option (not `BETTER_AUTH_SECRET`), shared by prod, previews and local, so a leaked dev secret cannot forge prod sessions.
- **Accepted trade-off (owner, 2026-11-02):** whoever holds the proxy secret can build a sign-in link that makes prod hand a victim's Google tokens to a host of their choosing (prod decrypts the state with this secret and redirects to the URL inside it; `oauth-proxy/index.mjs:186-235`). That is about the exposure today's laptop already has through the Google client secret plus registered localhost URIs. The secret is rotated whenever a laptop may be compromised, and together with the prod password.
- `productionURL` is the prod host that serves without redirecting (read it with a HEAD request before wiring it); a redirecting host breaks prod sign-in.
- The secret is required on Vercel (production and preview) and optional locally, following the `VERCEL_ENV` gate idiom in `server-env.ts`, so existing worktrees and scripts keep booting.
- Sign-in through the ngrok tunnel (the iPad on a local branch) is part of the check.
- Ship order: the plugin must be on prod before any worktree or preview relies on it. Until then, local sign-in keeps the current registered ports.
- After it works: remove the `localhost` redirect URIs from the Google Cloud OAuth client so it holds only the prod callback.
- Google's own rules (verified 2026-11-01): redirect URIs must match exactly, no wildcards, `http` allowed only for localhost. This is why the proxy, not more registrations, is the scalable fix.
- Existing escape hatch stays: `/api/dev/playwright-session` (gated by `DEV_LOGIN_SECRET`) for automated browsers.
- Behaviour to keep in mind: Google refresh tokens are issued on first consent only (no `prompt`), and the scrub deletes `account` rows, so Drive/Calendar features in a worktree may lack a refresh token. Same as today; not a regression.

Out of scope: webhooks (Twilio, QStash) still reach local via the single ngrok tunnel; testing a webhook against a feature should use its preview URL. QuickBooks callback is dormant.

### 6. Agent git duties and conflict safety

- **Merge strategy (owner confirmed 2026-11-01 as the standard way to ship for now):** PRs **squash-merge** on GitHub; branches update by **merging `main` into the branch** (no rebase, no force-push). Simplest model for a git-novice owner, linear history on `main`, nothing rewritten.
- **After the merge:** local `main` catches up with `git pull --ff-only origin main` and nothing else. Nobody commits on local `main` in this flow, so it always fast-forwards; a refusal means it has commits of its own and is a stop-and-look, never a merge. The branch and worktree are deleted; a squash-merged branch is never reused because its commits and the squash commit are different objects.
- **When to sync:** at PR open, and whenever `main` moves while the PR is open.
- **Overlap warnings:** before opening a PR and on demand, list other open PRs/worktree branches touching the same files, in plain words. Extend the existing `merge-risk` skill for this rather than writing a new tool.
- **One automated review per PR:** `ponytail-review`, run by the agent before opening the PR, findings fixed or listed in the PR body. (A hosted GitHub review action is a possible later step; not in this project.)
- Where these instructions live is the builder's call: a project skill (e.g. a "ship this worktree" skill) plus CLAUDE.md lines, so every agent in every worktree follows it without the owner repeating it.
- **Teaching:** when a PR carries a migration, its summary for the owner says in plain words what the migration changes and why it is safe to apply (additive or not). This is the "taught along the way" for migrations.
- The Claude pre-commit hook in `.claude/settings.json` checks the checkout being committed, not always the main checkout (today it `cd`s to main, so a worktree commit is gated by main's tree).
- `/pre-ship` is retired once the queue is drained; it exists to ship local `main`, which this flow ends.

### 7. Guard rails on GitHub

- **Branch protection on `main`:** PR required, the PR Checks workflow must pass, no direct pushes, no force-pushes. This is what makes "main mirrors prod" enforced, not remembered.
- **PR Checks** (`.github/workflows/pr-checks.yml`) today: install, lint, build. Add `pnpm tsc`, and a migration check (schema and migrations agree; no pending un-generated change). Note it pins Node 20 and builds with the prod `DATABASE_URL` secret; the builder should check whether the build needs DB access at all and point it at a non-prod branch if it does.

### 8. Retiring the old system

- Delete `scripts/dispatch.sh`, `scripts/hotfix.sh`, their `package.json` entries, and the hotfix `.worktrees/prod` / `.worktrees/sync` checkouts. A hotfix is now a small PR.
- `db:refresh:dev` stays (prod → scrubbed dev copy for the owner's main-checkout dev server); its error message pointing at `pnpm dispatch` changes to the new prune command.
- Update `CLAUDE.md` (Commands, GitHub workflow, Mobile testing port notes) and the memories that encode the old model (`feedback-work-on-main`, `reference-dispatch-system`, `reference-git-workflow-playbook`, `reference-orca-ade`). Per CLAUDE.md, no new DOCS.md files.

### 9. Prod credentials leave the machine

Today `.env` holds the prod `DATABASE_URL` and a full-power `NEON_API_KEY`, `.worktreeinclude` copies `.env` into every worktree, and 10+ scripts reach prod via `DRIZZLE_TARGET=prod` (`backfill-*`, `setup-visit-message-crons.ts`, `send-push.ts`, …). Deleting the prod `package.json` entries alone does not close that.

Target:
- **Local env files hold no full prod database credentials.** Worktrees and the main checkout run the app only against non-prod Neon branches.
- **One narrow prod login stays local: `photos_writer`** (owner, 2026-11-02). It can add and update rows only in the tables the two photo workflows write (`scripts/add-during-media.ts`, `scripts/portfolio-scraper/import-project.ts`: projects, project scopes, project media files, plus reads of the lookups they need); no `DELETE`, no other table, no DDL. Locally, `DATABASE_URL` is this login, so `DRIZZLE_TARGET=prod` from any script reaches prod only as `photos_writer` and Postgres refuses everything else. Postgres permissions are the guard, not code, so every script path is covered however it picks its URL. Grants ship as a reviewed script run through the prod-script Action.
- **A local run with no worktree database refuses to boot**: outside Vercel, and unless `DRIZZLE_TARGET=prod`, the app requires `DATABASE_DEV_URL`. With `.env.local` no longer copied into worktrees, a failed `wt:db create` leaves the worktree unable to start instead of silently on the shared dev branch.
- **Neon API access is limited to what local needs**, and the production branch is a Neon **protected branch** so no key can reset or delete it.
- **Zero-downtime rotation**: the app moves to a new prod login (`app_prod`, a member of the owning role) before `neondb_owner`'s password is reset, so prod never runs with a dead password while Vercel redeploys.
- **`db:refresh:dev` keeps working** without reading prod's `DATABASE_URL`: it identifies prod by configured Neon branch id instead of comparing endpoints.
- **Prod data jobs** (backfills, cron registration, test pushes to prod users) run via a `workflow_dispatch` GitHub Action that takes a script name, runs it with prod secrets held in GitHub, and requires owner approval through a protected GitHub **environment** (`production`). Data-only changes that belong with a schema change ship as SQL inside a migration instead.
- **`DRIZZLE_TARGET=prod`** stays as the lever; in the Action it reaches prod in full, locally it reaches prod only as `photos_writer`. `drizzle.config.ts` and `src/shared/config/data-target.ts` keep their "unset never means prod" rule, and the three scripts that break it today (`backfill-lead-source-fk.ts:8`, `seed-lead-sources.ts:11`, `migrate-notes-to-activities.ts:26`, unset → `DATABASE_URL`) default to `DATABASE_DEV_URL`.
- Vercel production keeps its own `DATABASE_URL`, unchanged.

### 10. Repo visibility and preview exposure

The repo is currently **public** (`gh repo view`, 2026-11-01) with no branch protection on `main`.

- Make the repo **private** and enable branch protection (requires GitHub Pro on the owner's personal account; the owner accepts the cost).
- Turn on **Vercel Deployment Protection** for previews (Vercel Authentication), so only the owner (logged into Vercel on the iPad once) can open a preview. The builder verifies the oAuthProxy redirect from prod back to a protected preview works in a real browser. Turn on **Protection Bypass for Automation** too, so QStash and Twilio callbacks still reach a preview.
- `/api/dev/playwright-session` stays gated by `DEV_LOGIN_SECRET` and is behind preview protection too.
- Review findings may go in PR bodies once the repo is private.
- Before flipping to private: check what depends on the repo being public (Vercel Git integration permissions, any public links, GitHub Actions minutes on a private repo).

### 11. Transition (one time)

1. Drain local main: one last `/pre-ship` of the 177 commits plus the dirty tree (owner decides what ships vs. moves to a branch).
2. Existing worktrees/branches (`edit-proposal-layout`, `filter-grouping-fields`, `issue-285`, `trade-scenes`, perf/stress detached checkouts, `prod`): each becomes a PR, a pushed parked branch, or is deleted. Owner decides per branch; the builder presents the list with what each holds.
3. Migrations baseline (section 3) lands on a clean main.
4. oAuthProxy ships to prod.
5. Repo goes private, prod credentials leave local env files (section 9), preview protection on (section 10).
6. Branch protection turns on. From here, main is read-only for people and agents.

### 12. Copies never reach real people or live files (owner, 2026-11-02)

Every worktree and preview database is a scrubbed copy of prod with real customer addresses and real storage paths, and shares the laptop's provider keys. Email and SMS already fail closed outside production (`resend/lib/dev-recipients.ts`, the VoIP dev override). Three more paths get the same treatment in this project, each at its single provider seam with a pure, tested decision:
- **Storage deletes**: `r2Client.deleteObject` (`src/shared/services/providers/r2/client.ts`) deletes only when the data target is production (`isProductionData()`); otherwise it logs and skips. Every copy shares prod's `tpr-media` paths, so a delete in a copy would remove the live photo.
- **Zoho Sign contracts**: outside production the homeowner signer's email is replaced by `EMAIL_DEV_OVERRIDE`, and the envelope is refused when that is unset, mirroring the Resend rule (`zoho-sign/lib/documents/assemble-envelope.ts:198-201` sends to the real `customerEmail` today).
- **Meeting realtime**: channel names come from one helper that prefixes `dev:` outside production, used by the publisher (`meeting-flow.router.ts:34`) and both subscribers (`meeting-realtime-sync.tsx:20`, `use-meeting-sync.ts:23`). Today a copy's event only makes a live iPad refetch, but the names should not cross environments.

The env audit in the transition also covers `NEXT_PUBLIC_BASE_URL`, `NGROK_URL`, `META_TEST_EVENT_CODE`, `QSTASH_*`, `ABLY_*`, `R2_*` and `ZOHO_*` per Vercel scope.

## Residual risks (known, accepted or out of scope)

- **The proxy secret** (section 5): accepted by the owner, rotated on suspicion.
- **The Neon API key reads prod's password**: Neon's `connection_uri` endpoint returns any branch's password to a key that can manage the project, and Neon has no read-only or branch-scoped key. The local key is therefore a path to prod by API even after the database passwords leave. Mitigations in this project: production is protected (no reset or delete), the scripts refuse to fetch prod's address (`assertNotProdEndpoint`), and the key is rotated with the prod password. A stronger fix (worktree databases created by a server-side job, no key on the laptop) is a follow-up if the owner wants it.
- **The storage key can delete**: Cloudflare R2 tokens cannot allow adding files without allowing deletes. Scoping the laptop's key to the buckets it needs belongs to the R2 storage reform (`docs/plans/` R2 tracker, D10); this project only stops the app from deleting outside prod (section 12).

## Left to the builder

- Exact script names and file layout under `scripts/` for create/scrub/migrate/delete/prune.
- Wording and home of the agent git instructions (section 6).
- The exact `photos_writer` grants, read from the two photo scripts and the media store and DAL they call (section 9 bounds them).
- Whether `orca.yaml` setup runs migrations itself or calls one script that does everything.

## Calls I made (owner to confirm while reading)

1. Worktree/preview databases fork from production + immediate fail-closed scrub, not from `development` (section 2).
2. Squash-merge PRs; update branches by merging `main` in, never rebase (section 6).
3. The one automated review is `ponytail-review` run locally by the agent, not a hosted GitHub action (section 6).
4. ~~`db:push:dev` survives for local experiments~~ Changed 2026-11-02: `db:push` is retired everywhere, because a push leaves the database out of step with its migration record (section 3).
5. Hotfix machinery is deleted outright, not kept as a fallback (section 8).
6. **If the baseline proof finds drift, prod wins**: the baseline describes what prod actually has, and the code (schema files) is fixed to match in the same PR. The baseline step never writes to prod's schema; any intended change after that is an ordinary reviewed migration (section 3).
7. **Branch protection binds the owner too.** Break-glass is the standard one: temporarily switch protection off in GitHub settings, push, switch it back on. Nothing automated commits to `main` today (`/dco` and the roadmap write to artifact databases, not the repo); the daily routine must not either (section 7).
8. **Neon usage stays bounded**: one preview branch per git branch (not per push), deleted when the git branch is deleted after merge; worktree branches deleted on archive; compute scale-to-zero on every non-prod branch; the prune command also flags branches idle more than 14 days. On Launch (2026-11-02) branches past 10 cost $1.50 per branch-month; the owner's estimate is about $15–25 a month in total at today's usage (section 1, 4).
9. **Rotation without downtime**: the app switches to a new `app_prod` login before the old password is reset (section 9).
10. **The preview half of the build step ships after the Neon–Vercel integration**, never before (section 4).
